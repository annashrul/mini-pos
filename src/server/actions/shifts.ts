"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { shiftSchema, closeShiftSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { emitEvent, EVENTS } from "@/lib/socket-emit";
import { getCurrentCompanyId } from "@/lib/company";

async function resolveSessionUserId(
  session: { user?: { id?: string; email?: string } } | null,
) {
  const sessionUserId = session?.user?.id;
  if (sessionUserId) {
    const byId = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true },
    });
    if (byId) return byId.id;
  }

  const sessionEmail = session?.user?.email;
  if (sessionEmail) {
    const byEmail = await prisma.user.findUnique({
      where: { email: sessionEmail },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }

  return null;
}

export async function getShifts(params?: {
  search?: string;
  page?: number;
  perPage?: number;
  branchId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const {
    search,
    page = 1,
    perPage = 10,
    branchId,
    sortBy,
    sortDir = "desc",
  } = params || {};
  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { branch: { companyId } };
  if (branchId) where.branchId = branchId;
  if (search) {
    where.user = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "user"
      ? { user: { name: direction } }
      : sortBy === "closedAt"
        ? { closedAt: direction }
        : sortBy === "openingCash"
          ? { openingCash: direction }
          : sortBy === "closingCash"
            ? { closingCash: direction }
            : sortBy === "cashDifference"
              ? { cashDifference: direction }
              : { openedAt: direction };

  const [shifts, total] = await Promise.all([
    prisma.cashierShift.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { name: true, email: true } }, branch: { select: { name: true } } },
    }),
    prisma.cashierShift.count({ where }),
  ]);

  return { shifts, total, totalPages: Math.ceil(total / perPage) };
}

export async function getActiveShift() {
  const session = await auth();
  const resolvedUserId = await resolveSessionUserId(session);
  if (!resolvedUserId) return null;

  const shift = await prisma.cashierShift.findFirst({
    where: { userId: resolvedUserId, isOpen: true },
    include: { user: { select: { name: true } } },
  });

  if (!shift) return null;

  // Auto-close if shift is from a previous day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (shift.openedAt < today) {
    try {
      // Calculate expected cash from transactions
      const txs = await prisma.transaction.findMany({
        where: { userId: shift.userId, createdAt: { gte: shift.openedAt }, status: "COMPLETED", paymentMethod: "CASH" },
        select: { paymentAmount: true, changeAmount: true },
      });
      const netCash = txs.reduce((s, tx) => s + tx.paymentAmount - tx.changeAmount, 0);
      const totalSalesAgg = await prisma.transaction.aggregate({
        where: { userId: shift.userId, createdAt: { gte: shift.openedAt }, status: "COMPLETED" },
        _sum: { grandTotal: true }, _count: true,
      });
      const expectedCash = shift.openingCash + netCash;

      await prisma.cashierShift.update({
        where: { id: shift.id },
        data: {
          closedAt: new Date(shift.openedAt.getTime() + 24 * 60 * 60 * 1000 - 1), // end of opening day
          closingCash: expectedCash,
          expectedCash,
          cashDifference: 0,
          totalSales: totalSalesAgg._sum.grandTotal ?? 0,
          totalTransactions: totalSalesAgg._count,
          notes: "Auto-closing: shift tidak ditutup pada hari sebelumnya",
          isOpen: false,
        },
      });

      // Generate closing report
      const companyId = await getCurrentCompanyId();
      const allTx = await prisma.transaction.findMany({
        where: { userId: shift.userId, createdAt: { gte: shift.openedAt }, status: "COMPLETED" },
        select: { grandTotal: true, discountAmount: true, taxAmount: true, paymentMethod: true, paymentAmount: true, changeAmount: true },
      });
      let totalSales = 0, totalDiscount = 0, totalTax = 0, totalCashSales = 0, totalNonCashSales = 0;
      for (const tx of allTx) {
        totalSales += tx.grandTotal;
        totalDiscount += tx.discountAmount;
        totalTax += tx.taxAmount;
        if (tx.paymentMethod === "CASH") totalCashSales += tx.paymentAmount - tx.changeAmount;
        else totalNonCashSales += tx.grandTotal;
      }

      await prisma.closingReport.create({
        data: {
          shiftId: shift.id,
          branchId: shift.branchId,
          companyId,
          cashierUserId: shift.userId,
          cashierName: shift.user.name,
          date: shift.openedAt,
          openingCash: shift.openingCash,
          closingCash: expectedCash,
          expectedCash,
          cashDifference: 0,
          totalTransactions: allTx.length,
          totalSales, totalDiscount, totalTax,
          totalCashSales, totalNonCashSales,
          cashMovementIn: 0, cashMovementOut: 0,
          voidCount: 0, refundCount: 0,
          notes: "Auto-closing: shift tidak ditutup pada hari sebelumnya",
          allowReopen: true, // allow cashier to proceed today
        },
      }).catch(() => {}); // ignore if already exists

      revalidatePath("/shifts");
      revalidatePath("/closing-reports");
    } catch (e) {
      console.error("Auto-close shift failed:", e);
    }
    return null; // shift is now closed, return null so POS shows setup screen
  }

  return shift;
}

/** Check if cashier already closed a shift today — blocks POS access on same day
 *  Returns false if admin has reclosed (allowReopen flag set via reclosing) */
export async function hasClosedShiftToday(): Promise<boolean> {
  const session = await auth();
  const resolvedUserId = await resolveSessionUserId(session);
  if (!resolvedUserId) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check closing report for today
  const report = await prisma.closingReport.findFirst({
    where: {
      cashierUserId: resolvedUserId,
      date: { gte: today, lt: tomorrow },
    },
    select: { allowReopen: true },
    orderBy: { createdAt: "desc" },
  });

  // No report today = can open shift
  if (!report) return false;

  // If reclosed with allowReopen = true, cashier can open new shift
  return !report.allowReopen;
}

export async function openShift(data: FormData) {
  await assertMenuActionAccess("shifts", "create");
  const session = await auth();
  const resolvedUserId = await resolveSessionUserId(session);
  if (!resolvedUserId)
    return { error: "Akun kasir tidak ditemukan. Silakan login ulang." };

  const existing = await prisma.cashierShift.findFirst({
    where: { userId: resolvedUserId, isOpen: true },
  });
  if (existing) return { error: "Anda masih memiliki shift yang aktif" };

  // Check if already closed today
  const closedToday = await hasClosedShiftToday();
  if (closedToday) return { error: "Anda sudah melakukan closing hari ini. Hubungi admin untuk reclosing jika diperlukan." };

  const parsed = shiftSchema.safeParse({
    openingCash: data.get("openingCash"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  const branchId = (data.get("branchId") as string) || null;

  try {
    await prisma.cashierShift.create({
      data: {
        userId: resolvedUserId,
        openingCash: parsed.data.openingCash,
        branchId,
      },
    });
    revalidatePath("/shifts");

    createAuditLog({ action: "CREATE", entity: "Shift", details: { data: { openingCash: parsed.data.openingCash, branchId } } }).catch(() => {});

    emitEvent(EVENTS.SHIFT_OPENED, {}, branchId || undefined);

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { error: `Gagal membuka shift: ${error.message}` };
    }
    return { error: "Gagal membuka shift" };
  }
}

export async function getShiftSummary(shiftId: string) {
  try {
    const shift = await prisma.cashierShift.findUnique({
      where: { id: shiftId },
    });
    if (!shift) return null;

    const now = new Date();
    const periodStart = shift.openedAt;
    const periodEnd = shift.closedAt ?? now;

    // All completed transactions by this user during the shift
    const [transactions, voidedCount] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: shift.userId,
          createdAt: { gte: periodStart, lte: periodEnd },
          status: "COMPLETED",
        },
        select: {
          grandTotal: true,
          paymentMethod: true,
          paymentAmount: true,
          changeAmount: true,
        },
      }),
      prisma.transaction.count({
        where: {
          userId: shift.userId,
          createdAt: { gte: periodStart, lte: periodEnd },
          status: "VOIDED",
        },
      }),
    ]);

    // Expenses during the shift (safe - returns 0 if table empty)
    let expenseAmount = 0;
    try {
      const expenses = await prisma.expense.aggregate({
        where: { createdAt: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
      });
      expenseAmount = expenses._sum.amount ?? 0;
    } catch {
      // Expense table may not have data
    }

    let cashIn = 0;
    let nonCashIn = 0;
    let cashOut = 0;
    const totalTransactions = transactions.length;
    let totalSales = 0;

    for (const tx of transactions) {
      totalSales += tx.grandTotal;
      if (tx.paymentMethod === "CASH") {
        cashIn += tx.paymentAmount;
        cashOut += tx.changeAmount;
      } else {
        nonCashIn += tx.grandTotal;
      }
    }

    const netCash = cashIn - cashOut;
    const expectedCash = shift.openingCash + netCash - expenseAmount;

    return {
      openingCash: shift.openingCash,
      totalTransactions,
      totalSales,
      cashIn,
      cashOut,
      netCash,
      nonCashIn,
      expenseAmount,
      expectedCash,
      voidedCount,
    };
  } catch (error) {
    console.error("getShiftSummary error:", error);
    return null;
  }
}

export async function closeShift(id: string, data: FormData) {
  await assertMenuActionAccess("shifts", "close_shift");
  const parsed = closeShiftSchema.safeParse({
    closingCash: data.get("closingCash"),
    notes: data.get("notes") || null,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    const shift = await prisma.cashierShift.findUnique({ where: { id } });
    if (!shift) return { error: "Shift tidak ditemukan" };

    // Calculate expected cash: opening + net cash sales - expenses
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: shift.userId,
        createdAt: { gte: shift.openedAt, lte: new Date() },
        status: "COMPLETED",
        paymentMethod: "CASH",
      },
      select: { paymentAmount: true, changeAmount: true },
    });
    const expenses = await prisma.expense.aggregate({
      where: { createdAt: { gte: shift.openedAt, lte: new Date() } },
      _sum: { amount: true },
    });
    let netCash = 0;
    for (const tx of transactions) {
      netCash += tx.paymentAmount - tx.changeAmount;
    }
    const expenseAmount = expenses._sum.amount ?? 0;
    const expectedCash = shift.openingCash + netCash - expenseAmount;
    const cashDifference = parsed.data.closingCash - expectedCash;

    const totalSalesAgg = await prisma.transaction.aggregate({
      where: {
        userId: shift.userId,
        createdAt: { gte: shift.openedAt, lte: new Date() },
        status: "COMPLETED",
      },
      _sum: { grandTotal: true },
      _count: true,
    });

    const closedAt = new Date();
    await prisma.cashierShift.update({
      where: { id },
      data: {
        closingCash: parsed.data.closingCash,
        expectedCash,
        cashDifference,
        totalSales: totalSalesAgg._sum.grandTotal ?? 0,
        totalTransactions: totalSalesAgg._count,
        notes: parsed.data.notes ?? null,
        closedAt,
        isOpen: false,
      },
    });

    // Generate closing report snapshot
    try {
      const companyId = await getCurrentCompanyId();
      // All transactions during shift (all payment methods)
      const allTx = await prisma.transaction.findMany({
        where: { userId: shift.userId, createdAt: { gte: shift.openedAt, lte: closedAt }, status: "COMPLETED" },
        select: { grandTotal: true, discountAmount: true, taxAmount: true, paymentMethod: true, paymentAmount: true, changeAmount: true },
      });
      const [voidCount, refundCount] = await Promise.all([
        prisma.transaction.count({ where: { userId: shift.userId, createdAt: { gte: shift.openedAt, lte: closedAt }, status: "VOIDED" } }),
        prisma.transaction.count({ where: { userId: shift.userId, createdAt: { gte: shift.openedAt, lte: closedAt }, status: "REFUNDED" } }),
      ]);
      const cashMovements = await prisma.cashMovement.findMany({ where: { shiftId: id } });
      const cmIn = cashMovements.filter((m) => m.type === "CASH_IN").reduce((s, m) => s + m.amount, 0);
      const cmOut = cashMovements.filter((m) => m.type === "CASH_OUT").reduce((s, m) => s + m.amount, 0);

      let totalSales = 0, totalDiscount = 0, totalTax = 0, totalCashSales = 0, totalNonCashSales = 0;
      const pmSummary: Record<string, { count: number; total: number }> = {};
      for (const tx of allTx) {
        totalSales += tx.grandTotal;
        totalDiscount += tx.discountAmount;
        totalTax += tx.taxAmount;
        const m = tx.paymentMethod;
        if (!pmSummary[m]) pmSummary[m] = { count: 0, total: 0 };
        pmSummary[m]!.count++;
        pmSummary[m]!.total += tx.grandTotal;
        if (m === "CASH") totalCashSales += tx.paymentAmount - tx.changeAmount;
        else totalNonCashSales += tx.grandTotal;
      }

      const cashierUser = await prisma.user.findUnique({ where: { id: shift.userId }, select: { name: true } });
      const paymentData = Object.entries(pmSummary).map(([method, d]) => ({ method, count: d.count, total: d.total }));

      // Check if there's already a closing report for this cashier + branch + today
      const reportDate = new Date(closedAt);
      reportDate.setHours(0, 0, 0, 0);
      const reportDateEnd = new Date(reportDate);
      reportDateEnd.setDate(reportDateEnd.getDate() + 1);

      const existingReport = await prisma.closingReport.findFirst({
        where: {
          cashierUserId: shift.userId,
          branchId: shift.branchId,
          date: { gte: reportDate, lt: reportDateEnd },
        },
      });

      if (existingReport) {
        // Update existing report — accumulate data from this shift
        await prisma.closingReport.update({
          where: { id: existingReport.id },
          data: {
            shiftId: id, // update to latest shift
            closingCash: parsed.data.closingCash,
            expectedCash: existingReport.expectedCash + expectedCash - existingReport.openingCash,
            cashDifference: parsed.data.closingCash - (existingReport.expectedCash + expectedCash - existingReport.openingCash),
            totalTransactions: existingReport.totalTransactions + allTx.length,
            totalSales: existingReport.totalSales + totalSales,
            totalDiscount: existingReport.totalDiscount + totalDiscount,
            totalTax: existingReport.totalTax + totalTax,
            totalCashSales: existingReport.totalCashSales + totalCashSales,
            totalNonCashSales: existingReport.totalNonCashSales + totalNonCashSales,
            cashMovementIn: existingReport.cashMovementIn + cmIn,
            cashMovementOut: existingReport.cashMovementOut + cmOut,
            voidCount: existingReport.voidCount + voidCount,
            refundCount: existingReport.refundCount + refundCount,
            paymentSummary: paymentData, // latest snapshot
            notes: parsed.data.notes ?? existingReport.notes,
            allowReopen: false, // reset after new closing
          },
        });
      } else {
        // Create new report
        await prisma.closingReport.create({
          data: {
            shiftId: id,
            branchId: shift.branchId,
            companyId,
            cashierUserId: shift.userId,
            cashierName: cashierUser?.name ?? "",
            date: closedAt,
            openingCash: shift.openingCash,
            closingCash: parsed.data.closingCash,
            expectedCash,
            cashDifference,
            totalTransactions: allTx.length,
            totalSales,
            totalDiscount,
            totalTax,
            totalCashSales,
            totalNonCashSales,
            cashMovementIn: cmIn,
            cashMovementOut: cmOut,
            voidCount,
            refundCount,
            paymentSummary: paymentData,
            notes: parsed.data.notes ?? null,
          },
        });
      }
    } catch (e) {
      console.error("Failed to create closing report:", e);
    }

    revalidatePath("/shifts");
    revalidatePath("/closing-reports");

    createAuditLog({ action: "UPDATE", entity: "Shift", entityId: id, details: { data: { openingCash: shift.openingCash, closingCash: parsed.data.closingCash, expectedCash, cashDifference, notes: parsed.data.notes ?? null } } }).catch(() => {});

    emitEvent(EVENTS.SHIFT_CLOSED, {}, shift.branchId || undefined);

    return { success: true };
  } catch {
    return { error: "Gagal menutup shift" };
  }
}
