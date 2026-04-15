"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

export async function getPurchaseOrders(params?: {
  search?: string;
  status?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}) {
  const {
    search,
    status,
    page = 1,
    perPage = 10,
    sortBy,
    sortDir = "desc",
    dateFrom,
    dateTo,
    branchId,
  } = params || {};
  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { companyId };

  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { supplier: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59");
    where.createdAt = createdAt;
  }
  if (branchId && branchId !== "ALL") where.branchId = branchId;

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "orderNumber"
      ? { orderNumber: direction }
      : sortBy === "supplier"
        ? { supplier: { name: direction } }
        : sortBy === "totalAmount"
          ? { totalAmount: direction }
          : { createdAt: direction };

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        supplier: { select: { name: true } },
        branch: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { orders, total, totalPages: Math.ceil(total / perPage) };
}

export async function getPurchaseOrderById(id: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.purchaseOrder.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      items: {
        include: {
          product: { select: { name: true, code: true, stock: true } },
        },
      },
    },
  });
}

interface POItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export async function createPurchaseOrder(data: {
  supplierId: string;
  branchId?: string;
  branchIds?: string[];
  expectedDate?: string;
  notes?: string;
  items: POItem[];
}) {
  await assertMenuActionAccess("purchases", "create");
  const companyId = await getCurrentCompanyId();
  if (!data.supplierId) return { error: "Supplier wajib dipilih" };
  if (!data.items.length) return { error: "Minimal 1 item" };

  // Determine target branches
  let targetBranchIds: string[];
  if (data.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: data.branchId, companyId } });
    if (!branch) return { error: "Cabang tidak ditemukan" };
    targetBranchIds = [data.branchId];
  } else if (data.branchIds && data.branchIds.length > 0) {
    // Validate all branches belong to company
    const branches = await prisma.branch.findMany({ where: { id: { in: data.branchIds }, companyId }, select: { id: true } });
    if (branches.length !== data.branchIds.length) return { error: "Cabang tidak ditemukan" };
    targetBranchIds = data.branchIds;
  } else {
    const branches = await prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true } });
    targetBranchIds = branches.map((b) => b.id);
    if (targetBranchIds.length === 0) return { error: "Tidak ada cabang aktif" };
  }

  try {
    const totalAmount = data.items.reduce(
      (sum, i) => sum + i.quantity * i.unitPrice,
      0,
    );

    for (const bid of targetBranchIds) {
      // Generate unique order number per PO
      const today = new Date();
      const prefix = `PO-${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;
      const last = await prisma.purchaseOrder.findFirst({
        where: { orderNumber: { startsWith: prefix } },
        orderBy: { orderNumber: "desc" },
      });
      let seq = 1;
      if (last) {
        const lastSeq = parseInt(last.orderNumber.split("-").pop() || "0");
        seq = lastSeq + 1;
      }
      const orderNumber = `${prefix}-${String(seq).padStart(4, "0")}`;

      await prisma.purchaseOrder.create({
        data: {
          orderNumber,
          supplierId: data.supplierId,
          branchId: bid,
          companyId,
          totalAmount,
          notes: data.notes || null,
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.quantity * item.unitPrice,
            })),
          },
        },
      });

      createAuditLog({ action: "CREATE", entity: "PurchaseOrder", details: { data: { orderNumber, supplierId: data.supplierId, itemCount: data.items.length } }, branchId: bid }).catch(() => {});
    }

    revalidatePath("/purchases");
    return { success: true };
  } catch (err) {
    console.error("createPurchaseOrder error:", err);
    return { error: err instanceof Error ? err.message : "Gagal membuat purchase order" };
  }
}

export async function receivePurchaseOrder(
  id: string,
  items: { itemId: string; receivedQty: number }[],
  paidAmount?: number,
) {
  await assertMenuActionAccess("purchases", "receive");
  const companyId = await getCurrentCompanyId();
  try {
    // Verify PO belongs to company
    const poCheck = await prisma.purchaseOrder.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!poCheck) return { error: "PO tidak ditemukan" };

    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: { include: { product: true } },
          supplier: { select: { name: true } },
        },
      });
      if (!po) throw new Error("PO tidak ditemukan");
      if (po.status === "CANCELLED" || po.status === "RECEIVED") {
        throw new Error("PO tidak bisa diterima");
      }

      let allReceived = true;

      // Batch all item operations
      await Promise.all(items.map(async (receiveItem) => {
        const poItem = po.items.find((i) => i.id === receiveItem.itemId);
        if (!poItem) return;

        const newReceivedQty = poItem.receivedQty + receiveItem.receivedQty;
        if (newReceivedQty > poItem.quantity) {
          throw new Error(
            `Qty diterima melebihi qty order untuk ${poItem.product.name}`,
          );
        }

        await tx.purchaseOrderItem.update({
          where: { id: receiveItem.itemId },
          data: { receivedQty: newReceivedQty },
        });

        if (receiveItem.receivedQty > 0) {
          await Promise.all([
            tx.product.update({
              where: { id: poItem.productId },
              data: { stock: { increment: receiveItem.receivedQty } },
            }),
            tx.stockMovement.create({
              data: {
                productId: poItem.productId,
                type: "IN",
                quantity: receiveItem.receivedQty,
                note: `Penerimaan PO ${po.orderNumber}`,
                reference: po.orderNumber,
                branchId: po.branchId,
                companyId,
              },
            }),
          ]);
        }

        if (newReceivedQty < poItem.quantity) allReceived = false;
      }));

      // Check items not in the receive list
      for (const poItem of po.items) {
        if (!items.find((i) => i.itemId === poItem.id)) {
          if (poItem.receivedQty < poItem.quantity) allReceived = false;
        }
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: allReceived ? "RECEIVED" : "PARTIAL",
          receivedDate: allReceived ? new Date() : null,
        },
      });

      return { po, allReceived };
    }, { timeout: 15000 });

    // Create payable debt for unpaid portion of PO
    const paid = paidAmount ?? 0;
    const unpaidAmount = result.po.totalAmount - paid;
    if (unpaidAmount > 0) {
      const { auth } = await import("@/lib/auth");
      const session = await auth();
      const createdBy = session?.user?.id;
      if (createdBy) {
        await prisma.debt.create({
          data: {
            type: "PAYABLE",
            referenceType: "PURCHASE",
            referenceId: id,
            partyType: "SUPPLIER",
            partyId: result.po.supplierId,
            partyName: result.po.supplier.name,
            description: `Hutang pembelian PO ${result.po.orderNumber}`,
            totalAmount: unpaidAmount,
            paidAmount: 0,
            remainingAmount: unpaidAmount,
            status: "UNPAID",
            branchId: result.po.branchId || null,
            companyId,
            createdBy,
          },
        });
      }
    }

    revalidatePath("/purchases");
    revalidatePath("/products");
    revalidatePath("/stock");
    revalidatePath("/debts");
    createAuditLog({ action: "RECEIVE", entity: "PurchaseOrder", entityId: id, details: { data: { orderId: id, paidAmount: paid, unpaidAmount: unpaidAmount > 0 ? unpaidAmount : 0 } } }).catch(() => {});

    // Auto-create accounting journal for purchase
    import("@/server/actions/accounting").then(({ createAutoJournal }) => {
      createAutoJournal({
        referenceType: "PURCHASE",
        referenceId: id,
        ...(result.po.branchId ? { branchId: result.po.branchId } : {}),
      });
    }).catch(() => {});

    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal menerima barang",
    };
  }
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: "ORDERED" | "CANCELLED",
) {
  await assertMenuActionAccess("purchases", "approve");
  const companyId = await getCurrentCompanyId();
  try {
    const po = await prisma.purchaseOrder.findFirst({ where: { id, companyId } });
    if (!po) return { error: "PO tidak ditemukan" };

    if (
      status === "CANCELLED" &&
      po.status !== "DRAFT" &&
      po.status !== "ORDERED"
    ) {
      return { error: "Hanya PO DRAFT/ORDERED yang bisa dibatalkan" };
    }

    await prisma.purchaseOrder.update({
      where: { id },
      data: { status },
    });

    revalidatePath("/purchases");
    createAuditLog({ action: "UPDATE", entity: "PurchaseOrder", entityId: id, details: { before: { status: po.status }, after: { status } } }).catch(() => {});
    return { success: true };
  } catch {
    return { error: "Gagal mengubah status PO" };
  }
}

// ─── Import Purchase Orders ───

export async function importPurchaseOrders(rows: { supplierName: string; items: string; notes: string; orderDate: string }[], branchId?: string) {
  await assertMenuActionAccess("purchases", "create");
  const companyId = await getCurrentCompanyId();
  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { companyId }, select: { id: true, code: true, purchasePrice: true } }),
  ]);
  const supplierMap = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]));
  const productMap = new Map(products.map((p) => [p.code.toLowerCase(), p]));
  let counter = await prisma.purchaseOrder.count({ where: { companyId } });

  type R = { row: number; success: boolean; name: string; error?: string };
  const results: R[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    const supplierId = supplierMap.get((row.supplierName || "").toLowerCase().trim());
    if (!supplierId) { results.push({ row: rowNum, success: false, name: row.supplierName || `Baris ${rowNum}`, error: `Supplier "${row.supplierName}" tidak ditemukan` }); continue; }
    if (!row.items?.trim()) { results.push({ row: rowNum, success: false, name: row.supplierName, error: "Item wajib diisi" }); continue; }

    const itemPairs = row.items.split(",").map((s) => s.trim()).filter(Boolean);
    const parsedItems: { productId: string; quantity: number; unitPrice: number }[] = [];
    let itemError = false;
    for (const pair of itemPairs) {
      const [code, qty, price] = pair.split(":").map((s) => s.trim());
      const product = productMap.get((code || "").toLowerCase());
      if (!product) { results.push({ row: rowNum, success: false, name: row.supplierName, error: `Produk "${code}" tidak ditemukan` }); itemError = true; break; }
      parsedItems.push({ productId: product.id, quantity: Number(qty) || 1, unitPrice: price ? Number(price) : product.purchasePrice });
    }
    if (itemError) continue;

    counter++;
    const orderNumber = `PO-${String(counter).padStart(5, "0")}`;
    const totalAmount = parsedItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

    try {
      await prisma.purchaseOrder.create({
        data: {
          orderNumber, supplierId, branchId: branchId || null, companyId, status: "DRAFT", totalAmount, paidAmount: 0,
          notes: row.notes?.trim() || null, orderDate: row.orderDate ? new Date(row.orderDate) : new Date(),
          items: { create: parsedItems.map((it) => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice, subtotal: it.unitPrice * it.quantity })) },
        },
      });
      results.push({ row: rowNum, success: true, name: orderNumber });
    } catch { results.push({ row: rowNum, success: false, name: row.supplierName, error: "Gagal menyimpan" }); }
  }

  revalidatePath("/purchases");
  return { results, successCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length };
}

const PO_TEMPLATE_COLS: TemplateColumn[] = [
  { header: "Nama Supplier *", width: 22, sampleValues: ["PT Supplier A", "CV Jaya"] },
  { header: "Item (kode:qty:harga) *", width: 35, sampleValues: ["PRD-00001:50:2500,PRD-00002:100:3000", "PRD-00003:200:1500"] },
  { header: "Catatan", width: 25, sampleValues: ["Restok bulanan", "Order urgent"] },
  { header: "Tanggal Order", width: 14, sampleValues: ["2026-04-14", "2026-04-15"] },
];

export async function downloadPOImportTemplate(format: "csv" | "excel" | "docx") {
  const companyId = await getCurrentCompanyId();
  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({ where: { companyId }, select: { name: true }, take: 10, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { companyId, isActive: true }, select: { code: true, name: true }, take: 20, orderBy: { code: "asc" } }),
  ]);
  const notes = [`Supplier: ${suppliers.map((s) => s.name).join(", ") || "-"}`, `Produk: ${products.map((p) => `${p.code} (${p.name})`).join(", ") || "-"}`, "Format item: kode:jumlah:harga dipisah koma. Harga opsional (default harga beli)"];
  const result = await generateImportTemplate(PO_TEMPLATE_COLS, 2, notes, format);
  return { data: result.data, filename: `template-import-po.${format === "excel" ? "xlsx" : format}`, mimeType: result.mimeType };
}
