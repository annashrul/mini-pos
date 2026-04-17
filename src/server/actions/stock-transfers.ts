"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

interface GetStockTransfersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}

export async function getStockTransfers(params: GetStockTransfersParams = {}) {
  const {
    page = 1,
    limit = 15,
    search,
    status,
    sortBy,
    sortDir = "desc",
    dateFrom,
    dateTo,
    branchId,
  } = params;
  const skip = (page - 1) * limit;
  const companyId = await getCurrentCompanyId();

  const where: Record<string, unknown> = { companyId };
  if (branchId && branchId !== "ALL") {
    where.OR = [
      { fromBranchId: branchId },
      { toBranchId: branchId },
    ];
  }
  if (search) {
    const searchCondition = [
      { transferNumber: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ];
    if (where.OR) {
      // Combine branch filter AND search: must match branch AND search
      where.AND = [{ OR: where.OR }, { OR: searchCondition }];
      delete where.OR;
    } else {
      where.OR = searchCondition;
    }
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

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "transferNumber"
      ? { transferNumber: direction }
      : sortBy === "fromBranch"
        ? { fromBranch: { name: direction } }
        : sortBy === "toBranch"
          ? { toBranch: { name: direction } }
          : { createdAt: direction };

  const [transfers, total] = await Promise.all([
    prisma.stockTransfer.findMany({
      where,
      include: {
        fromBranch: { select: { name: true } },
        toBranch: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.stockTransfer.count({ where }),
  ]);

  return {
    transfers,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
}

/** Helper: validate transfer belongs to company via branch relationship */
async function validateTransferOwnership(id: string, companyId: string) {
  return prisma.stockTransfer.findFirst({
    where: { id, companyId },
  });
}

export async function getStockTransferStats(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { companyId };
  if (branchId && branchId !== "ALL") {
    where.OR = [{ fromBranchId: branchId }, { toBranchId: branchId }];
  }
  const counts = await prisma.stockTransfer.groupBy({
    by: ["status"],
    where,
    _count: true,
  });
  const map = new Map(counts.map((c) => [c.status, c._count]));
  return {
    pending: map.get("PENDING") ?? 0,
    approved: map.get("APPROVED") ?? 0,
    inTransit: map.get("IN_TRANSIT") ?? 0,
    received: map.get("RECEIVED") ?? 0,
    rejected: map.get("REJECTED") ?? 0,
  };
}

export async function getStockTransferById(id: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.stockTransfer.findFirst({
    where: { id, companyId },
    include: {
      fromBranch: { select: { name: true } },
      toBranch: { select: { name: true } },
      items: true,
    },
  });
}

interface TransferItem {
  productId: string;
  productName: string;
  quantity: number;
}

export async function createStockTransfer(data: {
  fromBranchId: string;
  toBranchId: string;
  items: TransferItem[];
  notes?: string;
}) {
  await assertMenuActionAccess("stock-transfers", "create");
  const companyId = await getCurrentCompanyId();

  if (!data.fromBranchId) return { error: "Cabang asal wajib dipilih" };
  if (!data.toBranchId) return { error: "Cabang tujuan wajib dipilih" };
  if (data.fromBranchId === data.toBranchId)
    return { error: "Cabang asal dan tujuan tidak boleh sama" };
  if (!data.items.length) return { error: "Minimal 1 item untuk transfer" };

  // Validate both branches belong to company
  const [fromBranch, toBranch] = await Promise.all([
    prisma.branch.findFirst({ where: { id: data.fromBranchId, companyId } }),
    prisma.branch.findFirst({ where: { id: data.toBranchId, companyId } }),
  ]);
  if (!fromBranch) return { error: "Cabang asal tidak ditemukan" };
  if (!toBranch) return { error: "Cabang tujuan tidak ditemukan" };

  try {
    const today = new Date();
    const prefix = `TRF-${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;
    const last = await prisma.stockTransfer.findFirst({
      where: { transferNumber: { startsWith: prefix } },
      orderBy: { transferNumber: "desc" },
    });
    let seq = 1;
    if (last) {
      const lastSeq = parseInt(last.transferNumber.split("-").pop() || "0");
      seq = lastSeq + 1;
    }
    const transferNumber = `${prefix}-${String(seq).padStart(4, "0")}`;

    await prisma.stockTransfer.create({
      data: {
        transferNumber,
        fromBranchId: data.fromBranchId,
        toBranchId: data.toBranchId,
        companyId,
        notes: data.notes || null,
        status: "PENDING",
        items: {
          create: data.items.map((item) => ({
            productId: item.productId || "manual",
            productName: item.productName,
            quantity: item.quantity,
          })),
        },
      },
    });

    createAuditLog({
      action: "CREATE",
      entity: "StockTransfer",
      entityId: transferNumber,
      details: { data: { fromBranchId: data.fromBranchId, toBranchId: data.toBranchId, itemCount: data.items.length } },
    }).catch(() => {});

    revalidatePath("/stock-transfers");
    return { success: true };
  } catch {
    return { error: "Gagal membuat transfer stok" };
  }
}

export async function approveStockTransfer(id: string) {
  await assertMenuActionAccess("stock-transfers", "approve");
  const companyId = await getCurrentCompanyId();
  try {
    const transfer = await validateTransferOwnership(id, companyId);
    if (!transfer) return { error: "Transfer tidak ditemukan" };
    if (transfer.status !== "PENDING")
      return { error: "Hanya transfer PENDING yang bisa diapprove" };

    await prisma.stockTransfer.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date() },
    });

    createAuditLog({
      action: "UPDATE",
      entity: "StockTransfer",
      entityId: id,
      details: { data: { transferId: id, status: "APPROVED" } },
    }).catch(() => {});

    revalidatePath("/stock-transfers");
    return { success: true };
  } catch {
    return { error: "Gagal meng-approve transfer" };
  }
}

export async function receiveStockTransfer(id: string) {
  await assertMenuActionAccess("stock-transfers", "receive");
  const companyId = await getCurrentCompanyId();
  try {
    // Pre-validate ownership before transaction
    const check = await validateTransferOwnership(id, companyId);
    if (!check) return { error: "Transfer tidak ditemukan" };

    await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!transfer) throw new Error("Transfer tidak ditemukan");
      if (transfer.status !== "APPROVED")
        throw new Error("Transfer harus di-approve terlebih dahulu");

      // Update stock for each item
      for (const item of transfer.items) {
        if (item.productId === "manual") continue;

        // Decrease stock from source (OUT)
        const product = await tx.product.findFirst({
          where: { id: item.productId, companyId },
        });
        if (!product) continue;

        if (product.stock < item.quantity) {
          throw new Error(
            `Stok ${item.productName} tidak mencukupi (sisa: ${product.stock})`,
          );
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "TRANSFER",
            quantity: item.quantity,
            note: `Transfer keluar ${transfer.transferNumber}`,
            reference: transfer.transferNumber,
            branchId: transfer.fromBranchId,
            companyId,
          },
        });

        // Create incoming stock movement for destination
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "TRANSFER",
            quantity: item.quantity,
            note: `Transfer masuk ${transfer.transferNumber}`,
            reference: transfer.transferNumber,
            branchId: transfer.toBranchId,
            companyId,
          },
        });

        // Update received qty
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { receivedQty: item.quantity },
        });
      }

      await tx.stockTransfer.update({
        where: { id },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });
    }, { timeout: 15000 });

    createAuditLog({
      action: "UPDATE",
      entity: "StockTransfer",
      entityId: id,
      details: { data: { transferId: id, status: "RECEIVED" } },
    }).catch(() => {});

    revalidatePath("/stock-transfers");
    revalidatePath("/products");
    revalidatePath("/stock");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal menerima transfer",
    };
  }
}

export async function rejectStockTransfer(id: string, reason?: string) {
  await assertMenuActionAccess("stock-transfers", "approve");
  const companyId = await getCurrentCompanyId();
  try {
    const transfer = await validateTransferOwnership(id, companyId);
    if (!transfer) return { error: "Transfer tidak ditemukan" };
    if (transfer.status !== "PENDING" && transfer.status !== "APPROVED") {
      return { error: "Transfer tidak bisa ditolak" };
    }

    await prisma.stockTransfer.update({
      where: { id },
      data: {
        status: "REJECTED",
        notes: reason
          ? `${transfer.notes || ""}\nAlasan ditolak: ${reason}`.trim()
          : transfer.notes,
      },
    });

    createAuditLog({
      action: "UPDATE",
      entity: "StockTransfer",
      entityId: id,
      details: { data: { transferId: id, status: "REJECTED" } },
    }).catch(() => {});

    revalidatePath("/stock-transfers");
    return { success: true };
  } catch {
    return { error: "Gagal menolak transfer" };
  }
}

// ─── Import Stock Transfers ───

export async function importStockTransfers(rows: { fromBranch: string; toBranch: string; items: string; notes: string }[]) {
  await assertMenuActionAccess("stock-transfers", "create");
  const companyId = await getCurrentCompanyId();
  const [branches, products] = await Promise.all([
    prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { companyId }, select: { id: true, code: true, name: true } }),
  ]);
  const branchMap = new Map(branches.map((b) => [b.name.toLowerCase(), b.id]));
  const productMap = new Map(products.map((p) => [p.code.toLowerCase(), { id: p.id, name: p.name }]));
  let counter = await prisma.stockTransfer.count({ where: { companyId } });

  type R = { row: number; success: boolean; name: string; error?: string };
  const results: R[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    const fromId = branchMap.get((row.fromBranch || "").toLowerCase().trim());
    const toId = branchMap.get((row.toBranch || "").toLowerCase().trim());
    if (!fromId) { results.push({ row: rowNum, success: false, name: `Baris ${rowNum}`, error: `Cabang asal "${row.fromBranch}" tidak ditemukan` }); continue; }
    if (!toId) { results.push({ row: rowNum, success: false, name: `Baris ${rowNum}`, error: `Cabang tujuan "${row.toBranch}" tidak ditemukan` }); continue; }
    if (fromId === toId) { results.push({ row: rowNum, success: false, name: `Baris ${rowNum}`, error: "Cabang asal dan tujuan tidak boleh sama" }); continue; }

    const itemPairs = (row.items || "").split(",").map((s) => s.trim()).filter(Boolean);
    const parsedItems: { productId: string; productName: string; quantity: number }[] = [];
    let itemError = false;
    for (const pair of itemPairs) {
      const [code, qty] = pair.split(":").map((s) => s.trim());
      const product = productMap.get((code || "").toLowerCase());
      if (!product) { results.push({ row: rowNum, success: false, name: `Baris ${rowNum}`, error: `Produk "${code}" tidak ditemukan` }); itemError = true; break; }
      parsedItems.push({ productId: product.id, productName: product.name, quantity: Number(qty) || 1 });
    }
    if (itemError || parsedItems.length === 0) continue;

    counter++;
    try {
      await prisma.stockTransfer.create({
        data: {
          transferNumber: `TRF-${String(counter).padStart(5, "0")}`, fromBranchId: fromId, toBranchId: toId, companyId, status: "PENDING",
          notes: row.notes?.trim() || null, requestedAt: new Date(),
          items: { create: parsedItems },
        },
      });
      results.push({ row: rowNum, success: true, name: `TRF-${String(counter).padStart(5, "0")}` });
    } catch { results.push({ row: rowNum, success: false, name: `Baris ${rowNum}`, error: "Gagal menyimpan" }); }
  }

  revalidatePath("/stock-transfers");
  return { results, successCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length };
}

const TRANSFER_TEMPLATE_COLS: TemplateColumn[] = [
  { header: "Cabang Asal *", width: 20, sampleValues: ["Cabang Utama", "Cabang A"] },
  { header: "Cabang Tujuan *", width: 20, sampleValues: ["Cabang A", "Cabang B"] },
  { header: "Item (kode:qty) *", width: 30, sampleValues: ["PRD-00001:50,PRD-00002:100", "PRD-00003:200"] },
  { header: "Catatan", width: 25, sampleValues: ["Transfer rutin", "Permintaan cabang"] },
];

export async function downloadTransferImportTemplate(format: "csv" | "excel" | "docx") {
  const companyId = await getCurrentCompanyId();
  const [branches, products] = await Promise.all([
    prisma.branch.findMany({ where: { companyId, isActive: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { companyId, isActive: true }, select: { code: true, name: true }, take: 20, orderBy: { code: "asc" } }),
  ]);
  const notes = [`Cabang: ${branches.map((b) => b.name).join(", ") || "-"}`, `Produk: ${products.map((p) => `${p.code} (${p.name})`).join(", ") || "-"}`, "Format item: kode:jumlah dipisah koma"];
  const result = await generateImportTemplate(TRANSFER_TEMPLATE_COLS, 2, notes, format);
  return { data: result.data, filename: `template-import-transfer.${format === "excel" ? "xlsx" : format}`, mimeType: result.mimeType };
}
