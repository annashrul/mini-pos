"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getClosingReport(shiftId: string) {
  const shift = await prisma.cashierShift.findUnique({
    where: { id: shiftId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!shift) return null;

  // Get all transactions during this shift
  const where = {
    userId: shift.userId,
    createdAt: {
      gte: shift.openedAt,
      ...(shift.closedAt ? { lte: shift.closedAt } : {}),
    },
    status: "COMPLETED" as const,
  };

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      invoiceNumber: true,
      grandTotal: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      paymentMethod: true,
      paymentAmount: true,
      changeAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Aggregate per payment method
  const paymentSummary: Record<string, { count: number; total: number }> = {};
  let totalSales = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let cashIn = 0;

  for (const tx of transactions) {
    totalSales += tx.grandTotal;
    totalDiscount += tx.discountAmount;
    totalTax += tx.taxAmount;

    const method = tx.paymentMethod;
    if (!paymentSummary[method]) paymentSummary[method] = { count: 0, total: 0 };
    paymentSummary[method]!.count++;
    paymentSummary[method]!.total += tx.grandTotal;

    if (method === "CASH") {
      cashIn += tx.paymentAmount - tx.changeAmount;
    }
  }

  // Void/refund during shift
  const voidCount = await prisma.transaction.count({
    where: { userId: shift.userId, createdAt: { gte: shift.openedAt, ...(shift.closedAt ? { lte: shift.closedAt } : {}) }, status: "VOIDED" },
  });
  const refundCount = await prisma.transaction.count({
    where: { userId: shift.userId, createdAt: { gte: shift.openedAt, ...(shift.closedAt ? { lte: shift.closedAt } : {}) }, status: "REFUNDED" },
  });

  // Cash movements during shift
  const cashMovements = await prisma.cashMovement.findMany({
    where: { shiftId },
    orderBy: { createdAt: "asc" },
  });

  const cashMovementIn = cashMovements.filter((m) => m.type === "CASH_IN").reduce((s, m) => s + m.amount, 0);
  const cashMovementOut = cashMovements.filter((m) => m.type === "CASH_OUT").reduce((s, m) => s + m.amount, 0);

  // Expected cash = opening + cash sales + cash_in movements - cash_out movements
  const expectedCash = shift.openingCash + cashIn + cashMovementIn - cashMovementOut;

  return {
    shift: {
      id: shift.id,
      cashierName: shift.user.name,
      cashierEmail: shift.user.email,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openingCash: shift.openingCash,
      closingCash: shift.closingCash,
      expectedCash,
      cashDifference: shift.closingCash != null ? shift.closingCash - expectedCash : null,
      notes: shift.notes,
      isOpen: shift.isOpen,
    },
    summary: {
      totalTransactions: transactions.length,
      totalSales,
      totalDiscount,
      totalTax,
      averageTransaction: transactions.length > 0 ? totalSales / transactions.length : 0,
      voidCount,
      refundCount,
    },
    paymentSummary: Object.entries(paymentSummary).map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
    })),
    cashFlow: {
      openingCash: shift.openingCash,
      cashSales: cashIn,
      cashMovementIn,
      cashMovementOut,
      expectedCash,
      actualCash: shift.closingCash,
      difference: shift.closingCash != null ? shift.closingCash - expectedCash : null,
    },
    cashMovements,
    transactions,
  };
}

export async function getClosingReportList(params?: { page?: number; perPage?: number; search?: string; dateFrom?: string; dateTo?: string; branchId?: string }) {
  const { page = 1, perPage = 10, search, dateFrom, dateTo, branchId } = params || {};
  const where: Record<string, unknown> = { isOpen: false };
  if (branchId) where.branchId = branchId;

  if (search) {
    where.user = { OR: [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ]};
  }

  if (dateFrom || dateTo) {
    const closedAtFilter: Record<string, Date> = {};
    if (dateFrom) closedAtFilter.gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) closedAtFilter.lte = new Date(dateTo + "T23:59:59");
    where.closedAt = closedAtFilter;
  }

  const [shifts, total] = await Promise.all([
    prisma.cashierShift.findMany({
      where,
      include: { user: { select: { name: true } }, branch: { select: { name: true } } },
      orderBy: { closedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.cashierShift.count({ where }),
  ]);

  return { shifts, total, totalPages: Math.ceil(total / perPage) };
}

export async function recloseShift(shiftId: string, closingCash: number, notes?: string) {
  const shift = await prisma.cashierShift.findUnique({ where: { id: shiftId } });
  if (!shift) return { error: "Shift tidak ditemukan" };
  if (shift.isOpen) return { error: "Shift masih aktif, gunakan Close Shift" };

  // Recalculate expected
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: shift.userId,
      createdAt: { gte: shift.openedAt, ...(shift.closedAt ? { lte: shift.closedAt } : {}) },
      status: "COMPLETED",
      paymentMethod: "CASH",
    },
    select: { paymentAmount: true, changeAmount: true },
  });

  const cashIn = transactions.reduce((s, tx) => s + tx.paymentAmount - tx.changeAmount, 0);
  const cashMovements = await prisma.cashMovement.findMany({ where: { shiftId } });
  const cashMovementIn = cashMovements.filter((m) => m.type === "CASH_IN").reduce((s, m) => s + m.amount, 0);
  const cashMovementOut = cashMovements.filter((m) => m.type === "CASH_OUT").reduce((s, m) => s + m.amount, 0);
  const expectedCash = shift.openingCash + cashIn + cashMovementIn - cashMovementOut;

  await prisma.cashierShift.update({
    where: { id: shiftId },
    data: {
      closingCash,
      expectedCash,
      cashDifference: closingCash - expectedCash,
      notes: notes || shift.notes,
      closedAt: new Date(),
    },
  });

  revalidatePath("/closing-reports");
  revalidatePath("/shifts");
  return { success: true };
}
