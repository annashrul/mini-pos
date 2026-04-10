"use server";

import { prisma } from "@/lib/prisma";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { emitEvent, EVENTS } from "@/lib/socket-emit";
import { getCurrentCompanyId } from "@/lib/company";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── getOrderQueue ─────────────────────────────────────────────────────────────

export async function getOrderQueue(params?: {
  branchId?: string;
  status?: string;
}) {
  await assertMenuActionAccess("kitchen-display", "view");
  const companyId = await getCurrentCompanyId();

  const where: Record<string, unknown> = { branch: { companyId } };
  if (params?.branchId) where.branchId = params.branchId;
  if (params?.status) where.status = params.status;

  const orders = await prisma.orderQueue.findMany({
    where,
    include: {
      items: true,
      transaction: {
        select: {
          invoiceNumber: true,
          customer: { select: { name: true } },
        },
      },
      branch: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  // Group by status
  const grouped = {
    NEW: orders.filter((o) => o.status === "NEW"),
    PREPARING: orders.filter((o) => o.status === "PREPARING"),
    READY: orders.filter((o) => o.status === "READY"),
    SERVED: orders
      .filter((o) => o.status === "SERVED")
      .sort((a, b) => (b.servedAt?.getTime() ?? 0) - (a.servedAt?.getTime() ?? 0))
      .slice(0, 10),
    CANCELLED: orders
      .filter((o) => o.status === "CANCELLED")
      .slice(0, 5),
  };

  return grouped;
}

// ─── createOrderFromTransaction ────────────────────────────────────────────────

export async function createOrderFromTransaction(transactionId: string) {
  await assertMenuActionAccess("kitchen-display", "create");

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      items: {
        include: {
          product: { select: { name: true } },
        },
      },
    },
  });

  if (!transaction) throw new Error("Transaksi tidak ditemukan");

  // Auto-increment queue number per day
  const today = startOfToday();
  const lastQueue = await prisma.orderQueue.findFirst({
    where: {
      createdAt: { gte: today },
      ...(transaction.branchId ? { branchId: transaction.branchId } : {}),
    },
    orderBy: { queueNumber: "desc" },
    select: { queueNumber: true },
  });

  const nextNumber = (lastQueue?.queueNumber ?? 0) + 1;

  const order = await prisma.orderQueue.create({
    data: {
      queueNumber: nextNumber,
      transactionId: transaction.id,
      branchId: transaction.branchId,
      status: "NEW",
      priority: 0,
      notes: transaction.notes || null,
      items: {
        create: transaction.items.map((item) => ({
          productName: item.productName || item.product?.name || "Unknown",
          quantity: item.quantity,
          notes: null,
          status: "PENDING",
        })),
      },
    },
    include: { items: true },
  });

  await createAuditLog({
    action: "CREATE",
    entity: "OrderQueue",
    entityId: order.id,
    details: { queueNumber: nextNumber, transactionId },
    ...(transaction.branchId ? { branchId: transaction.branchId } : {}),
  });

  emitEvent(EVENTS.ORDER_QUEUE_CREATED, { orderId: order.id, queueNumber: nextNumber }, transaction.branchId || undefined);
  // NOTE: Do NOT revalidatePath("/kitchen-display") here — it causes component re-mount
  // which resets refs and triggers double audio. Kitchen display uses realtime events instead.
  return order;
}

// ─── updateOrderStatus ────────────────────────────────────────────────────────

const STATUS_FLOW: Record<string, string> = {
  NEW: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
};

export async function updateOrderStatus(id: string, status: string) {
  await assertMenuActionAccess("kitchen-display", "update");

  const validStatuses = ["NEW", "PREPARING", "READY", "SERVED", "CANCELLED"];
  if (!validStatuses.includes(status)) {
    throw new Error("Status tidak valid");
  }

  const data: Record<string, unknown> = { status };
  if (status === "SERVED") {
    data.servedAt = new Date();
  }

  // When moving to PREPARING, set all items to PREPARING
  if (status === "PREPARING") {
    await prisma.orderQueueItem.updateMany({
      where: { orderQueueId: id, status: "PENDING" },
      data: { status: "PREPARING" },
    });
  }

  // When moving to READY, set all items to DONE
  if (status === "READY") {
    await prisma.orderQueueItem.updateMany({
      where: { orderQueueId: id, status: { not: "DONE" } },
      data: { status: "DONE" },
    });
  }

  const order = await prisma.orderQueue.update({
    where: { id },
    data,
    include: { items: true },
  });

  await createAuditLog({
    action: "UPDATE_STATUS",
    entity: "OrderQueue",
    entityId: id,
    details: { status, queueNumber: order.queueNumber },
    ...(order.branchId ? { branchId: order.branchId } : {}),
  });

  emitEvent(EVENTS.ORDER_QUEUE_UPDATED, { orderId: id, status }, order.branchId || undefined);
  // Kitchen display uses realtime events, no revalidatePath needed
  return order;
}

// ─── advanceOrderStatus ────────────────────────────────────────────────────────

export async function advanceOrderStatus(id: string) {
  const order = await prisma.orderQueue.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!order) throw new Error("Order tidak ditemukan");
  const nextStatus = STATUS_FLOW[order.status];
  if (!nextStatus) throw new Error("Order tidak dapat dilanjutkan dari status ini");

  return updateOrderStatus(id, nextStatus);
}

// ─── updateOrderItemStatus ────────────────────────────────────────────────────

export async function updateOrderItemStatus(id: string, status: string) {
  await assertMenuActionAccess("kitchen-display", "update");

  const validStatuses = ["PENDING", "PREPARING", "DONE"];
  if (!validStatuses.includes(status)) {
    throw new Error("Status item tidak valid");
  }

  const item = await prisma.orderQueueItem.update({
    where: { id },
    data: { status },
  });

  // Check if all items are DONE - auto-advance order to READY
  const allItems = await prisma.orderQueueItem.findMany({
    where: { orderQueueId: item.orderQueueId },
  });

  const allDone = allItems.every((i) => i.status === "DONE");
  if (allDone) {
    const parentOrder = await prisma.orderQueue.findUnique({
      where: { id: item.orderQueueId },
      select: { status: true },
    });
    if (parentOrder?.status === "PREPARING") {
      await updateOrderStatus(item.orderQueueId, "READY");
    }
  }

  // Kitchen display uses realtime events, no revalidatePath needed
  return item;
}

// ─── cancelOrder ──────────────────────────────────────────────────────────────

export async function cancelOrder(id: string) {
  await assertMenuActionAccess("kitchen-display", "update");

  const order = await prisma.orderQueue.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await prisma.orderQueueItem.updateMany({
    where: { orderQueueId: id },
    data: { status: "DONE" },
  });

  await createAuditLog({
    action: "CANCEL",
    entity: "OrderQueue",
    entityId: id,
    details: { queueNumber: order.queueNumber },
    ...(order.branchId ? { branchId: order.branchId } : {}),
  });

  emitEvent(EVENTS.ORDER_QUEUE_CANCELLED, { orderId: id }, order.branchId || undefined);
  // Kitchen display uses realtime events, no revalidatePath needed
  return order;
}

// ─── getQueueStats ────────────────────────────────────────────────────────────

export async function getQueueStats(branchId?: string) {
  await assertMenuActionAccess("kitchen-display", "view");
  const companyId = await getCurrentCompanyId();

  const today = startOfToday();
  const where: Record<string, unknown> = {
    createdAt: { gte: today },
    branch: { companyId },
  };
  if (branchId) where.branchId = branchId;

  const [counts, servedOrders] = await Promise.all([
    prisma.orderQueue.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
    }),
    prisma.orderQueue.findMany({
      where: {
        ...where,
        status: "SERVED",
        servedAt: { not: null },
      },
      select: { createdAt: true, servedAt: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {
    NEW: 0,
    PREPARING: 0,
    READY: 0,
    SERVED: 0,
    CANCELLED: 0,
  };

  for (const c of counts) {
    statusCounts[c.status] = c._count.id;
  }

  const totalToday = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  // Avg preparation time in minutes
  let avgPrepTime = 0;
  if (servedOrders.length > 0) {
    const totalMs = servedOrders.reduce((sum, o) => {
      return sum + ((o.servedAt?.getTime() ?? 0) - o.createdAt.getTime());
    }, 0);
    avgPrepTime = Math.round(totalMs / servedOrders.length / 60000);
  }

  return {
    totalToday,
    inQueue: statusCounts.NEW,
    preparing: statusCounts.PREPARING,
    ready: statusCounts.READY,
    served: statusCounts.SERVED,
    cancelled: statusCounts.CANCELLED,
    avgPrepTime,
  };
}

// ─── resetDailyQueue ──────────────────────────────────────────────────────────

export async function resetDailyQueue(branchId?: string) {
  await assertMenuActionAccess("kitchen-display", "update");

  const where: Record<string, unknown> = {
    status: { in: ["NEW", "PREPARING", "READY"] },
  };
  if (branchId) where.branchId = branchId;

  // Cancel all active orders
  const result = await prisma.orderQueue.updateMany({
    where,
    data: { status: "CANCELLED" },
  });

  await createAuditLog({
    action: "RESET_QUEUE",
    entity: "OrderQueue",
    details: { cancelledCount: result.count, branchId },
    ...(branchId ? { branchId } : {}),
  });

  // Kitchen display uses realtime events, no revalidatePath needed
  return { cancelledCount: result.count };
}

// ─── createManualOrder ────────────────────────────────────────────────────────

export async function createManualOrder(params: {
  items: { productName: string; quantity: number; notes?: string }[];
  branchId?: string;
  priority?: number;
  notes?: string;
}) {
  await assertMenuActionAccess("kitchen-display", "create");

  const today = startOfToday();
  const lastQueue = await prisma.orderQueue.findFirst({
    where: {
      createdAt: { gte: today },
      ...(params.branchId ? { branchId: params.branchId } : {}),
    },
    orderBy: { queueNumber: "desc" },
    select: { queueNumber: true },
  });

  const nextNumber = (lastQueue?.queueNumber ?? 0) + 1;

  const order = await prisma.orderQueue.create({
    data: {
      queueNumber: nextNumber,
      ...(params.branchId ? { branchId: params.branchId } : {}),
      status: "NEW",
      priority: params.priority ?? 0,
      ...(params.notes ? { notes: params.notes } : {}),
      items: {
        create: params.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          notes: item.notes ?? null,
          status: "PENDING",
        })),
      },
    },
    include: { items: true },
  });

  emitEvent(EVENTS.ORDER_QUEUE_CREATED, { orderId: order.id, queueNumber: nextNumber }, params.branchId);
  // Kitchen display uses realtime events, no revalidatePath needed
  return order;
}
