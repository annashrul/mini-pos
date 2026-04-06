"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";

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
  const where: Record<string, unknown> = {};

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
  return prisma.purchaseOrder.findUnique({
    where: { id },
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
  if (!data.supplierId) return { error: "Supplier wajib dipilih" };
  if (!data.items.length) return { error: "Minimal 1 item" };

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

  try {
    const totalAmount = data.items.reduce(
      (sum, i) => sum + i.quantity * i.unitPrice,
      0,
    );

    await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId: data.supplierId,
        branchId: data.branchIds?.[0] ?? data.branchId ?? null,
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

    revalidatePath("/purchases");
    createAuditLog({ action: "CREATE", entity: "PurchaseOrder", details: { data: { orderNumber, supplierId: data.supplierId, itemCount: data.items.length } }, ...(data.branchIds?.[0] || data.branchId ? { branchId: data.branchIds?.[0] ?? data.branchId! } : {}) }).catch(() => {});
    return { success: true };
  } catch {
    return { error: "Gagal membuat purchase order" };
  }
}

export async function receivePurchaseOrder(
  id: string,
  items: { itemId: string; receivedQty: number }[],
  paidAmount?: number,
) {
  await assertMenuActionAccess("purchases", "receive");
  try {
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
    });

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
  try {
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
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
