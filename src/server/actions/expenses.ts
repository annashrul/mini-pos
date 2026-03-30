"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { expenseSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";

export async function getExpenses(params?: {
  search?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const { search, page = 1, perPage = 10, sortBy, sortDir = "desc" } = params || {};
  const where: Record<string, unknown> = {};

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
    await prisma.expense.create({ data: parsed.data });
    revalidatePath("/expenses");
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
    await prisma.expense.update({ where: { id }, data: parsed.data });
    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate pengeluaran" };
  }
}

export async function deleteExpense(id: string) {
  await assertMenuActionAccess("expenses", "delete");
  try {
    await prisma.expense.delete({ where: { id } });
    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus pengeluaran" };
  }
}
