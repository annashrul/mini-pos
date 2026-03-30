"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";

export async function getPurchaseOrders(params?: {
  search?: string;
  status?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  dateFrom?: string;
  dateTo?: string;
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
    return { success: true };
  } catch {
    return { error: "Gagal membuat purchase order" };
  }
}

export async function receivePurchaseOrder(
  id: string,
  items: { itemId: string; receivedQty: number }[],
) {
  await assertMenuActionAccess("purchases", "receive");
  try {
    await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: { include: { product: true } } },
      });
      if (!po) throw new Error("PO tidak ditemukan");
      if (po.status === "CANCELLED" || po.status === "RECEIVED") {
        throw new Error("PO tidak bisa diterima");
      }

      let allReceived = true;
      for (const receiveItem of items) {
        const poItem = po.items.find((i) => i.id === receiveItem.itemId);
        if (!poItem) continue;

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

        // Update product stock
        if (receiveItem.receivedQty > 0) {
          await tx.product.update({
            where: { id: poItem.productId },
            data: { stock: { increment: receiveItem.receivedQty } },
          });

          await tx.stockMovement.create({
            data: {
              productId: poItem.productId,
              type: "IN",
              quantity: receiveItem.receivedQty,
              note: `Penerimaan PO ${po.orderNumber}`,
              reference: po.orderNumber,
            },
          });
        }

        if (newReceivedQty < poItem.quantity) allReceived = false;
      }

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
    });

    revalidatePath("/purchases");
    revalidatePath("/products");
    revalidatePath("/stock");
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
    return { success: true };
  } catch {
    return { error: "Gagal mengubah status PO" };
  }
}
