"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getCurrentCompanyId } from "@/lib/company";

// ─── Create Installment Plan ───

interface CreateInstallmentPlanInput {
  debtId: string;
  downPayment: number;
  installmentCount: number;
  interval: "WEEKLY" | "MONTHLY";
}

export async function createInstallmentPlan(input: CreateInstallmentPlanInput) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const companyId = await getCurrentCompanyId();

  const debt = await prisma.debt.findFirst({ where: { id: input.debtId, companyId } });
  if (!debt) return { error: "Data hutang/piutang tidak ditemukan" };
  if (debt.status === "PAID") return { error: "Hutang/piutang sudah lunas" };

  const { downPayment, installmentCount, interval } = input;
  if (downPayment < 0) return { error: "DP tidak boleh negatif" };
  if (installmentCount < 1 || installmentCount > 60) return { error: "Jumlah cicilan harus 1-60" };
  if (downPayment >= debt.totalAmount) return { error: "DP tidak boleh >= total" };

  const remainingAfterDp = debt.totalAmount - downPayment;
  const perInstallment = Math.ceil(remainingAfterDp / installmentCount);
  const today = new Date();

  // Build installment schedule
  const installments: { installmentNo: number; amount: number; dueDate: Date }[] = [];
  for (let i = 0; i < installmentCount; i++) {
    const dueDate = new Date(today);
    if (interval === "WEEKLY") {
      dueDate.setDate(dueDate.getDate() + (i + 1) * 7);
    } else {
      dueDate.setMonth(dueDate.getMonth() + (i + 1));
    }
    // Last installment gets remainder to handle rounding
    const amount = i === installmentCount - 1
      ? remainingAfterDp - perInstallment * (installmentCount - 1)
      : perInstallment;
    installments.push({ installmentNo: i + 1, amount, dueDate });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Update debt with installment config
      await tx.debt.update({
        where: { id: input.debtId },
        data: {
          downPayment,
          installmentCount,
          installmentInterval: interval,
        },
      });

      // Delete existing installments if re-creating
      await tx.installment.deleteMany({ where: { debtId: input.debtId } });

      // Create installment schedule
      await tx.installment.createMany({
        data: installments.map((inst) => ({
          debtId: input.debtId,
          installmentNo: inst.installmentNo,
          amount: inst.amount,
          dueDate: inst.dueDate,
        })),
      });

      // If DP > 0, record DP as first payment
      if (downPayment > 0) {
        await tx.debtPayment.create({
          data: {
            debtId: input.debtId,
            amount: downPayment,
            method: "CASH",
            notes: "Down Payment (DP)",
            paidBy: session.user!.id,
          },
        });
        const newPaid = debt.paidAmount + downPayment;
        const newRemaining = debt.totalAmount - newPaid;
        await tx.debt.update({
          where: { id: input.debtId },
          data: {
            paidAmount: newPaid,
            remainingAmount: Math.max(newRemaining, 0),
            status: newRemaining <= 0 ? "PAID" : "PARTIAL",
          },
        });
      }
    });

    revalidatePath("/debts");
    return { success: true };
  } catch {
    return { error: "Gagal membuat jadwal cicilan" };
  }
}

// ─── Pay Installment ───

export async function payInstallment(params: {
  installmentId: string;
  amount: number;
  method?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const companyId = await getCurrentCompanyId();

  const { installmentId, amount, method = "CASH", notes } = params;
  if (amount <= 0) return { error: "Jumlah harus lebih dari 0" };

  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    include: { debt: { select: { id: true, companyId: true, totalAmount: true, paidAmount: true, remainingAmount: true } } },
  });
  if (!installment || installment.debt.companyId !== companyId) return { error: "Cicilan tidak ditemukan" };
  if (installment.status === "PAID") return { error: "Cicilan ini sudah lunas" };

  const maxPayable = installment.amount - installment.paidAmount;
  if (amount > maxPayable) return { error: `Maksimal pembayaran cicilan ini: ${maxPayable}` };

  try {
    await prisma.$transaction(async (tx) => {
      const newInstPaid = installment.paidAmount + amount;
      const instStatus = newInstPaid >= installment.amount ? "PAID" : "PARTIAL";

      // Update installment
      await tx.installment.update({
        where: { id: installmentId },
        data: {
          paidAmount: newInstPaid,
          status: instStatus,
          ...(instStatus === "PAID" ? { paidAt: new Date() } : {}),
        },
      });

      // Create debt payment record
      await tx.debtPayment.create({
        data: {
          debtId: installment.debtId,
          amount,
          method,
          notes: notes || `Cicilan ke-${installment.installmentNo}`,
          paidBy: session.user!.id,
        },
      });

      // Update parent debt
      const newDebtPaid = installment.debt.paidAmount + amount;
      const newDebtRemaining = installment.debt.totalAmount - newDebtPaid;
      await tx.debt.update({
        where: { id: installment.debtId },
        data: {
          paidAmount: newDebtPaid,
          remainingAmount: Math.max(newDebtRemaining, 0),
          status: newDebtRemaining <= 0 ? "PAID" : "PARTIAL",
        },
      });
    });

    // Auto-jurnal
    import("@/server/actions/accounting").then(({ createAutoJournal }) => {
      createAutoJournal({ referenceType: "DEBT_PAYMENT", referenceId: installmentId });
    }).catch(() => {});

    revalidatePath("/debts");
    return { success: true };
  } catch {
    return { error: "Gagal memproses pembayaran cicilan" };
  }
}

// ─── Get Installments by Debt ───

export async function getInstallmentsByDebt(debtId: string) {
  const companyId = await getCurrentCompanyId();
  const debt = await prisma.debt.findFirst({
    where: { id: debtId, companyId },
    select: {
      id: true, totalAmount: true, paidAmount: true, remainingAmount: true, status: true,
      downPayment: true, installmentCount: true, installmentInterval: true,
      partyName: true, description: true, dueDate: true,
      installments: { orderBy: { installmentNo: "asc" } },
      payments: { orderBy: { paidAt: "desc" }, select: { id: true, amount: true, method: true, notes: true, paidAt: true } },
    },
  });
  if (!debt) return null;
  return debt;
}

// ─── Get Upcoming Due Installments (for notifications) ───

export async function getUpcomingDueInstallments(daysAhead = 7) {
  const companyId = await getCurrentCompanyId();
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);

  const installments = await prisma.installment.findMany({
    where: {
      status: { in: ["UNPAID", "PARTIAL"] },
      dueDate: { lte: future },
      debt: { companyId },
    },
    include: {
      debt: { select: { partyName: true, description: true, type: true, referenceType: true, referenceId: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 50,
  });

  return installments.map((inst) => ({
    ...inst,
    isOverdue: new Date(inst.dueDate) < now,
    daysUntilDue: Math.ceil((new Date(inst.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  }));
}

// ─── Auto-update overdue installments ───

export async function updateOverdueInstallments() {
  const now = new Date();
  await prisma.installment.updateMany({
    where: { status: "UNPAID", dueDate: { lt: now } },
    data: { status: "OVERDUE" },
  });
}

// ─── Preview installment schedule (no save) ───

export function previewInstallmentSchedule(totalAmount: number, downPayment: number, installmentCount: number, interval: "WEEKLY" | "MONTHLY") {
  const remainingAfterDp = totalAmount - downPayment;
  if (remainingAfterDp <= 0 || installmentCount <= 0) return [];

  const perInstallment = Math.ceil(remainingAfterDp / installmentCount);
  const today = new Date();
  const schedule: { no: number; amount: number; dueDate: string }[] = [];

  for (let i = 0; i < installmentCount; i++) {
    const dueDate = new Date(today);
    if (interval === "WEEKLY") {
      dueDate.setDate(dueDate.getDate() + (i + 1) * 7);
    } else {
      dueDate.setMonth(dueDate.getMonth() + (i + 1));
    }
    const amount = i === installmentCount - 1
      ? remainingAfterDp - perInstallment * (installmentCount - 1)
      : perInstallment;
    schedule.push({
      no: i + 1,
      amount,
      dueDate: dueDate.toISOString().split("T")[0]!,
    });
  }

  return schedule;
}
