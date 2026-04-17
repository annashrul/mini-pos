"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { expenseSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

export async function getExpenses(params?: {
  search?: string;
  page?: number;
  perPage?: number;
  branchId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const companyId = await getCurrentCompanyId();
  const {
    search,
    page = 1,
    perPage = 10,
    branchId,
    sortBy,
    sortDir = "desc",
  } = params || {};
  const where: Record<string, unknown> = { companyId };
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

export async function getExpenseStats(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { companyId };
  if (branchId && branchId !== "ALL") where.branchId = branchId;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.toISOString().slice(0, 10) + "T00:00:00");

  const [total, thisMonth, today] = await Promise.all([
    prisma.expense.aggregate({ where, _sum: { amount: true }, _count: true }),
    prisma.expense.aggregate({ where: { ...where, date: { gte: startOfMonth } }, _sum: { amount: true }, _count: true }),
    prisma.expense.aggregate({ where: { ...where, date: { gte: startOfDay } }, _sum: { amount: true }, _count: true }),
  ]);

  return {
    totalCount: total._count,
    totalAmount: total._sum.amount ?? 0,
    thisMonthCount: thisMonth._count,
    thisMonthAmount: thisMonth._sum.amount ?? 0,
    todayCount: today._count,
    todayAmount: today._sum.amount ?? 0,
  };
}

export async function createExpense(data: FormData) {
  await assertMenuActionAccess("expenses", "create");
  const companyId = await getCurrentCompanyId();
  const parsed = expenseSchema.safeParse({
    category: data.get("category"),
    description: data.get("description"),
    amount: data.get("amount"),
    date: data.get("date") || new Date(),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    const branchId = data.get("branchId") as string | null;

    // Determine target branches
    let targetBranchIds: string[];
    if (branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: branchId, companyId } });
      if (!branch) return { error: "Cabang tidak ditemukan" };
      targetBranchIds = [branchId];
    } else {
      const branches = await prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true } });
      targetBranchIds = branches.map((b) => b.id);
      if (targetBranchIds.length === 0) return { error: "Tidak ada cabang aktif" };
    }

    for (const bid of targetBranchIds) {
      const expense = await prisma.expense.create({
        data: {
          ...parsed.data,
          companyId,
          branchId: bid,
        },
      });

      createAuditLog({
        action: "CREATE",
        entity: "Expense",
        details: {
          data: {
            description: parsed.data.description,
            amount: parsed.data.amount,
            category: parsed.data.category,
            date: parsed.data.date,
          },
        },
        branchId: bid,
      }).catch(() => {});

      // Auto-create accounting journal
      import("@/server/actions/accounting")
        .then(({ createAutoJournal }) => {
          createAutoJournal({
            referenceType: "EXPENSE",
            referenceId: expense.id,
            branchId: bid,
          });
        })
        .catch(() => {});
    }

    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Gagal menambahkan pengeluaran" };
  }
}

export async function updateExpense(id: string, data: FormData) {
  await assertMenuActionAccess("expenses", "update");
  const companyId = await getCurrentCompanyId();
  const parsed = expenseSchema.safeParse({
    category: data.get("category"),
    description: data.get("description"),
    amount: data.get("amount"),
    date: data.get("date"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    const old = await prisma.expense.findFirst({
      where: { id, companyId },
      select: {
        description: true,
        amount: true,
        category: true,
        date: true,
        branchId: true,
      },
    });
    if (!old) return { error: "Pengeluaran tidak ditemukan" };
    await prisma.expense.update({
      where: { id },
      data: { ...parsed.data, companyId },
    });
    if (old) {
      createAuditLog({
        action: "UPDATE",
        entity: "Expense",
        entityId: id,
        details: {
          before: {
            description: old.description,
            amount: old.amount,
            category: old.category,
            date: old.date,
            branchId: old.branchId,
          },
          after: {
            description: parsed.data.description,
            amount: parsed.data.amount,
            category: parsed.data.category,
            date: parsed.data.date,
            branchId: old.branchId,
          },
        },
      }).catch(() => {});
    }
    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate pengeluaran" };
  }
}

export async function deleteExpense(id: string) {
  await assertMenuActionAccess("expenses", "delete");
  const companyId = await getCurrentCompanyId();
  try {
    const old = await prisma.expense.findFirst({ where: { id, companyId } });
    if (!old) return { error: "Pengeluaran tidak ditemukan" };
    await prisma.expense.delete({ where: { id } });
    createAuditLog({
      action: "DELETE",
      entity: "Expense",
      entityId: id,
      details: {
        deleted: { description: old?.description, amount: old?.amount },
      },
    }).catch(() => {});
    revalidatePath("/expenses");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus pengeluaran" };
  }
}

// ─── Import Expenses ───

export async function importExpenses(rows: { category: string; description: string; amount: number; date: string }[], branchId?: string) {
  await assertMenuActionAccess("expenses", "create");
  const companyId = await getCurrentCompanyId();

  type R = { row: number; success: boolean; name: string; error?: string };
  const results: R[] = [];
  const validRows: { category: string; description: string; amount: number; date: Date; companyId: string; branchId: string | null }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    if (!row.category?.trim()) { results.push({ row: rowNum, success: false, name: `Baris ${rowNum}`, error: "Kategori wajib diisi" }); continue; }
    if (!row.amount || row.amount <= 0) { results.push({ row: rowNum, success: false, name: row.category, error: "Jumlah harus lebih dari 0" }); continue; }
    validRows.push({ category: row.category.trim(), description: row.description?.trim() || "", amount: row.amount, date: row.date ? new Date(row.date) : new Date(), companyId, branchId: branchId || null });
  }

  if (validRows.length > 0) {
    try {
      await prisma.expense.createMany({ data: validRows });
      for (const r of validRows) results.push({ row: rows.findIndex((x) => x.category === r.category && x.amount === r.amount) + 2, success: true, name: `${r.category} - ${r.amount}` });
    } catch { for (const r of validRows) results.push({ row: 0, success: false, name: r.category, error: "Gagal menyimpan" }); }
  }

  results.sort((a, b) => a.row - b.row);
  revalidatePath("/expenses");
  return { results, successCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length };
}

const EXPENSE_TEMPLATE_COLS: TemplateColumn[] = [
  { header: "Kategori *", width: 20, sampleValues: ["Listrik", "Gaji Karyawan"] },
  { header: "Deskripsi", width: 30, sampleValues: ["Tagihan listrik bulan April", "Gaji kasir"] },
  { header: "Jumlah *", width: 14, sampleValues: ["500000", "3000000"] },
  { header: "Tanggal", width: 16, sampleValues: ["2026-04-14", "2026-04-14"] },
];

export async function downloadExpenseImportTemplate(format: "csv" | "excel" | "docx") {
  const result = await generateImportTemplate(EXPENSE_TEMPLATE_COLS, 2, ["Kolom dengan tanda * wajib diisi", "Format tanggal: YYYY-MM-DD"], format);
  return { data: result.data, filename: `template-import-pengeluaran.${format === "excel" ? "xlsx" : format}`, mimeType: result.mimeType };
}

export async function bulkDeleteExpenses(ids: string[]) {
  await assertMenuActionAccess("expenses", "delete");
  const companyId = await getCurrentCompanyId();
  const result = await prisma.expense.deleteMany({ where: { id: { in: ids }, companyId } });
  revalidatePath("/expenses");
  return { count: result.count };
}
