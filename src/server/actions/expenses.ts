"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { expenseSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";

export async function getExpenses(params?: {
  search?: string;
  page?: number;
  perPage?: number;
  branchId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const { search, page = 1, perPage = 10, branchId, sortBy, sortDir = "desc" } = params || {};
  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;

  if (search) {
    where.OR = [
      { category: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "date"
      ? { date: direction }
      : sortBy === "category"
        ? { category: direction }
        : sortBy === "description"
          ? { description: direction }
          : sortBy === "amount"
            ? { amount: direction }
            : { date: direction };

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { branch: { select: { name: true } } },
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.expense.count({ where }),
  ]);

  return { expenses, total, totalPages: Math.ceil(total / perPage) };
}

export async function createExpense(data: FormData) {
  await assertMenuActionAccess("expenses", "create");
  const parsed = expenseSchema.safeParse({
    category: data.get("category"),
    description: data.get("description"),
    amount: data.get("amount"),
    date: data.get("date") || new Date(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    const expense = await prisma.expense.create({ data: parsed.data });
    const branchId = data.get("branchId") as string | null;
    createAuditLog({ action: "CREATE", entity: "Expense", details: { data: { description: parsed.data.description, amount: parsed.data.amount, category: parsed.data.category, date: parsed.data.date } }, ...(branchId ? { branchId } : {}) }).catch(() => {});
    revalidatePath("/expenses");

    // Auto-create accounting journal
    import("@/server/actions/accounting").then(({ createAutoJournal }) => {
      createAutoJournal({
        referenceType: "EXPENSE",
        referenceId: expense.id,
        ...(branchId ? { branchId: branchId as string } : {}),
      });
    }).catch(() => {});

    return { success: true };
  } catch {
    return { error: "Gagal menambahkan pengeluaran" };
  }
}

export async function updateExpense(id: string, data: FormData) {
  await assertMenuActionAccess("expenses", "update");
  const parsed = expenseSchema.safeParse({
    category: data.get("category"),
    description: data.get("description"),
    amount: data.get("amount"),
    date: data.get("date"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    const old = await prisma.expense.findUnique({ where: { id }, select: { description: true, amount: true, category: true, date: true, branchId: true } });
    await prisma.expense.update({ where: { id }, data: parsed.data });
    if (old) {
      createAuditLog({ action: "UPDATE", entity: "Expense", entityId: id, details: { before: { description: old.description, amount: old.amount, category: old.category, date: old.date, branchId: old.branchId }, after: { description: parsed.data.description, amount: parsed.data.amount, category: parsed.data.category, date: parsed.data.date, branchId: old.branchId } } }).catch(() => {});
    }
    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate pengeluaran" };
  }
}

export async function deleteExpense(id: string) {
  await assertMenuActionAccess("expenses", "delete");
  try {
    const old = await prisma.expense.findUnique({ where: { id } });
    await prisma.expense.delete({ where: { id } });
    createAuditLog({ action: "DELETE", entity: "Expense", entityId: id, details: { deleted: { description: old?.description, amount: old?.amount } } }).catch(() => {});
    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus pengeluaran" };
  }
}
