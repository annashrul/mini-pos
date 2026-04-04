"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { shiftSchema, closeShiftSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { emitEvent, EVENTS } from "@/lib/socket-emit";

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
  const where: Record<string, unknown> = {};
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

  return prisma.cashierShift.findFirst({
    where: { userId: resolvedUserId, isOpen: true },
    include: { user: { select: { name: true } } },
  });
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

    await prisma.cashierShift.update({
      where: { id },
      data: {
        closingCash: parsed.data.closingCash,
        expectedCash,
        cashDifference,
        totalSales: totalSalesAgg._sum.grandTotal ?? 0,
        totalTransactions: totalSalesAgg._count,
        notes: parsed.data.notes ?? null,
        closedAt: new Date(),
        isOpen: false,
      },
    });
    revalidatePath("/shifts");

    createAuditLog({ action: "UPDATE", entity: "Shift", entityId: id, details: { data: { openingCash: shift.openingCash, closingCash: parsed.data.closingCash, expectedCash, cashDifference, notes: parsed.data.notes ?? null } } }).catch(() => {});

    emitEvent(EVENTS.SHIFT_CLOSED, {}, shift.branchId || undefined);

    return { success: true };
  } catch {
    return { error: "Gagal menutup shift" };
  }
}
