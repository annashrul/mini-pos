"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";
import { emitEvent, EVENTS } from "@/lib/socket-emit";

export async function getClosingReport(shiftId: string) {
  await getCurrentCompanyId();

  // Try to find closing report by shiftId first
  const report = await prisma.closingReport.findUnique({
    where: { shiftId },
    include: { branch: { select: { name: true } } },
  });

  // Get the shift for basic info
  const shift = await prisma.cashierShift.findUnique({
    where: { id: shiftId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!shift) return null;

  // Find ALL shifts for this cashier on the same day (for transaction list)
  const reportDate = new Date(shift.closedAt ?? shift.openedAt);
  reportDate.setHours(0, 0, 0, 0);
  const reportDateEnd = new Date(reportDate);
  reportDateEnd.setDate(reportDateEnd.getDate() + 1);

  const allShiftsToday = await prisma.cashierShift.findMany({
    where: {
      userId: shift.userId,
      branchId: shift.branchId,
      isOpen: false,
      closedAt: { gte: reportDate, lt: reportDateEnd },
    },
    select: { id: true, openedAt: true, closedAt: true },
    orderBy: { openedAt: "asc" },
  });

  // Collect all transactions from all shifts today
  const txConditions = allShiftsToday.map((s) => ({
    userId: shift.userId,
    createdAt: { gte: s.openedAt, ...(s.closedAt ? { lte: s.closedAt } : {}) },
    status: "COMPLETED" as const,
  }));

  const [transactions, voidCount, refundCount] = await Promise.all([
    prisma.transaction.findMany({
      where: { OR: txConditions },
      select: {
        id: true, invoiceNumber: true, grandTotal: true, subtotal: true,
        discountAmount: true, taxAmount: true, paymentMethod: true,
        paymentAmount: true, changeAmount: true, createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.count({
      where: { OR: allShiftsToday.map((s) => ({ userId: shift.userId, createdAt: { gte: s.openedAt, ...(s.closedAt ? { lte: s.closedAt } : {}) }, status: "VOIDED" as const })) },
    }),
    prisma.transaction.count({
      where: { OR: allShiftsToday.map((s) => ({ userId: shift.userId, createdAt: { gte: s.openedAt, ...(s.closedAt ? { lte: s.closedAt } : {}) }, status: "REFUNDED" as const })) },
    }),
  ]);

  // Cash movements from all shifts today
  const cashMovements = await prisma.cashMovement.findMany({
    where: { shiftId: { in: allShiftsToday.map((s) => s.id) } },
    orderBy: { createdAt: "asc" },
  });

  // Aggregate payment summary from transactions
  const paymentSummary: Record<string, { count: number; total: number }> = {};
  let totalSales = 0, totalDiscount = 0, totalTax = 0, cashIn = 0;

  for (const tx of transactions) {
    totalSales += tx.grandTotal;
    totalDiscount += tx.discountAmount;
    totalTax += tx.taxAmount;
    const method = tx.paymentMethod;
    if (!paymentSummary[method]) paymentSummary[method] = { count: 0, total: 0 };
    paymentSummary[method]!.count++;
    paymentSummary[method]!.total += tx.grandTotal;
    if (method === "CASH") cashIn += tx.paymentAmount - tx.changeAmount;
  }

  const cmIn = cashMovements.filter((m) => m.type === "CASH_IN").reduce((s, m) => s + m.amount, 0);
  const cmOut = cashMovements.filter((m) => m.type === "CASH_OUT").reduce((s, m) => s + m.amount, 0);

  // Use report data if available, otherwise calculate from shifts
  const openingCash = report?.openingCash ?? shift.openingCash;
  const closingCash = report?.closingCash ?? shift.closingCash;
  const expectedCash = report?.expectedCash ?? (openingCash + cashIn + cmIn - cmOut);
  const cashDifference = report?.cashDifference ?? (closingCash != null ? closingCash - expectedCash : null);

  return {
    shift: {
      id: shift.id,
      cashierName: shift.user.name,
      cashierEmail: shift.user.email,
      openedAt: allShiftsToday[0]?.openedAt ?? shift.openedAt,
      closedAt: shift.closedAt,
      openingCash,
      closingCash,
      expectedCash,
      cashDifference,
      notes: report?.notes ?? shift.notes,
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
      method, count: data.count, total: data.total,
    })),
    cashFlow: {
      openingCash,
      cashSales: cashIn,
      cashMovementIn: cmIn,
      cashMovementOut: cmOut,
      expectedCash,
      actualCash: closingCash,
      difference: cashDifference,
    },
    cashMovements,
    transactions,
  };
}

export async function getClosingReportList(params?: {
  page?: number;
  perPage?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}) {
  const {
    page = 1,
    perPage = 10,
    search,
    dateFrom,
    dateTo,
    branchId,
  } = params || {};
  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { companyId };
  if (branchId) where.branchId = branchId;

  if (search) {
    where.cashierName = { contains: search, mode: "insensitive" };
  }

  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(`${dateFrom}T00:00:00.000`);
    if (dateTo) dateFilter.lte = new Date(`${dateTo}T23:59:59.999`);
    where.date = dateFilter;
  }

  const [reports, total] = await Promise.all([
    prisma.closingReport.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        shift: { select: { openedAt: true, closedAt: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.closingReport.count({ where }),
  ]);

  // Map to match existing UI shape
  const shifts = reports.map((r) => ({
    id: r.shiftId,
    reportId: r.id,
    userId: "",
    user: { name: r.cashierName },
    branchId: r.branchId,
    branch: r.branch,
    openedAt: r.shift.openedAt,
    closedAt: r.shift.closedAt,
    openingCash: r.openingCash,
    closingCash: r.closingCash,
    expectedCash: r.expectedCash,
    cashDifference: r.cashDifference,
    totalSales: r.totalSales,
    totalTransactions: r.totalTransactions,
    totalDiscount: r.totalDiscount,
    totalTax: r.totalTax,
    totalCashSales: r.totalCashSales,
    totalNonCashSales: r.totalNonCashSales,
    voidCount: r.voidCount,
    refundCount: r.refundCount,
    paymentSummary: r.paymentSummary,
    notes: r.notes,
    isOpen: false,
    allowReopen: r.allowReopen,
  }));

  return { shifts, total, totalPages: Math.ceil(total / perPage) };
}

export async function recloseShift(
  shiftId: string,
  closingCash: number,
  notes?: string,
) {
  const shift = await prisma.cashierShift.findUnique({
    where: { id: shiftId },
  });
  if (!shift) return { error: "Shift tidak ditemukan" };
  if (shift.isOpen) return { error: "Shift masih aktif, gunakan Close Shift" };

  // Recalculate expected
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: shift.userId,
      createdAt: {
        gte: shift.openedAt,
        ...(shift.closedAt ? { lte: shift.closedAt } : {}),
      },
      status: "COMPLETED",
      paymentMethod: "CASH",
    },
    select: { paymentAmount: true, changeAmount: true },
  });

  const cashIn = transactions.reduce(
    (s, tx) => s + tx.paymentAmount - tx.changeAmount,
    0,
  );
  const cashMovements = await prisma.cashMovement.findMany({
    where: { shiftId },
  });
  const cashMovementIn = cashMovements
    .filter((m) => m.type === "CASH_IN")
    .reduce((s, m) => s + m.amount, 0);
  const cashMovementOut = cashMovements
    .filter((m) => m.type === "CASH_OUT")
    .reduce((s, m) => s + m.amount, 0);
  const expectedCash =
    shift.openingCash + cashIn + cashMovementIn - cashMovementOut;

  const cashDiff = closingCash - expectedCash;
  await prisma.cashierShift.update({
    where: { id: shiftId },
    data: {
      closingCash,
      expectedCash,
      cashDifference: cashDiff,
      notes: notes || shift.notes,
    },
  });

  // Update closing report if exists — and allow cashier to reopen shift
  await prisma.closingReport.updateMany({
    where: { shiftId },
    data: { closingCash, expectedCash, cashDifference: cashDiff, notes: notes || shift.notes, allowReopen: true },
  });

  revalidatePath("/closing-reports");
  revalidatePath("/shifts");

  createAuditLog({ action: "UPDATE", entity: "CashierShift", entityId: shiftId, details: { data: { shiftId, newClosingCash: closingCash, notes: notes || shift.notes } } }).catch(() => {});

  emitEvent(EVENTS.SHIFT_RECLOSED, { shiftId }, shift.branchId || undefined);

  return { success: true };
}
