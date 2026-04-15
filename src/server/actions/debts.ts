"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma, DebtType, DebtStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { getCurrentCompanyId } from "@/lib/company";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

// ===========================
// GET DEBTS (list with filters)
// ===========================

export async function getDebts(params?: {
  type?: DebtType | undefined;
  status?: DebtStatus | undefined;
  partyType?: string | undefined;
  search?: string | undefined;
  branchId?: string | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
}) {
  const {
    type,
    status,
    partyType,
    search,
    branchId,
    page = 1,
    perPage = 10,
    dateFrom,
    dateTo,
    sortBy,
    sortDir = "desc",
  } = params || {};

  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { companyId };

  if (type) where.type = type;
  if (status) where.status = status;
  if (partyType) where.partyType = partyType;
  if (branchId) where.branchId = branchId;

  if (search) {
    where.OR = [
      { partyName: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { referenceId: { contains: search, mode: "insensitive" } },
    ];
  }

  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
    };
  }

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "partyName"
      ? { partyName: direction }
      : sortBy === "totalAmount"
        ? { totalAmount: direction }
        : sortBy === "remainingAmount"
          ? { remainingAmount: direction }
          : sortBy === "dueDate"
            ? { dueDate: direction }
            : sortBy === "status"
              ? { status: direction }
              : sortBy === "type"
                ? { type: direction }
                : { createdAt: direction };

  const [debts, total] = await Promise.all([
    prisma.debt.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        payments: {
          orderBy: { paidAt: "desc" },
          take: 1,
          select: { paidAt: true, amount: true },
        },
      },
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.debt.count({ where }),
  ]);

  return { debts, total, totalPages: Math.ceil(total / perPage) };
}

// ===========================
// GET DEBT BY ID
// ===========================

export async function getDebtById(id: string) {
  const companyId = await getCurrentCompanyId();
  const debt = await prisma.debt.findFirst({
    where: { id, companyId },
    include: {
      branch: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      payments: {
        include: {
          payer: { select: { id: true, name: true } },
        },
        orderBy: { paidAt: "desc" },
      },
    },
  });

  if (!debt) return { error: "Data hutang/piutang tidak ditemukan" };
  return { debt };
}

// ===========================
// CREATE DEBT
// ===========================

export async function createDebt(data: {
  type: DebtType;
  referenceType?: string | undefined;
  referenceId?: string | undefined;
  partyType: string;
  partyId?: string | undefined;
  partyName: string;
  description?: string | undefined;
  totalAmount: number;
  dueDate?: string | undefined;
  branchId?: string | undefined;
}) {
  await assertMenuActionAccess("debts", "create");
  const companyId = await getCurrentCompanyId();

  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  if (!data.type || !data.partyType || !data.partyName) {
    return { error: "Tipe, jenis pihak, dan nama pihak wajib diisi" };
  }
  if (!data.totalAmount || data.totalAmount <= 0) {
    return { error: "Jumlah hutang/piutang harus lebih dari 0" };
  }

  try {
    // Determine target branches
    let targetBranchIds: string[];
    if (data.branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: data.branchId, companyId } });
      if (!branch) return { error: "Cabang tidak ditemukan" };
      targetBranchIds = [data.branchId];
    } else {
      const branches = await prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true } });
      targetBranchIds = branches.map((b) => b.id);
      if (targetBranchIds.length === 0) return { error: "Tidak ada cabang aktif" };
    }

    for (const bid of targetBranchIds) {
      const debt = await prisma.debt.create({
        data: {
          type: data.type,
          referenceType: data.referenceType || null,
          referenceId: data.referenceId || null,
          partyType: data.partyType,
          partyId: data.partyId || null,
          partyName: data.partyName,
          description: data.description || null,
          totalAmount: data.totalAmount,
          paidAmount: 0,
          remainingAmount: data.totalAmount,
          status: "UNPAID",
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          branchId: bid,
          companyId,
          createdBy: session.user.id,
        },
      });

      createAuditLog({
        action: "CREATE",
        entity: "Debt",
        entityId: debt.id,
        details: {
          type: debt.type,
          partyName: debt.partyName,
          partyType: debt.partyType,
          totalAmount: debt.totalAmount,
        },
        branchId: bid,
      }).catch(() => {});
    }

    revalidatePath("/debts");
    return { success: true };
  } catch (err) {
    console.error("[createDebt]", err);
    return { error: "Gagal membuat data hutang/piutang" };
  }
}

// ===========================
// UPDATE DEBT
// ===========================

export async function updateDebt(
  id: string,
  data: {
    referenceType?: string | undefined;
    referenceId?: string | undefined;
    partyType?: string | undefined;
    partyId?: string | undefined;
    partyName?: string | undefined;
    description?: string | undefined;
    totalAmount?: number | undefined;
    dueDate?: string | null | undefined;
    branchId?: string | null | undefined;
  }
) {
  await assertMenuActionAccess("debts", "update");
  const companyId = await getCurrentCompanyId();

  try {
    const existing = await prisma.debt.findFirst({ where: { id, companyId } });
    if (!existing) return { error: "Data hutang/piutang tidak ditemukan" };

    // Recalculate remaining amount if totalAmount changed
    const newTotal = data.totalAmount ?? existing.totalAmount;
    const newRemaining = newTotal - existing.paidAmount;

    if (newRemaining < 0) {
      return { error: "Total baru tidak boleh lebih kecil dari jumlah yang sudah dibayar" };
    }

    // Determine new status
    let newStatus = existing.status;
    if (newRemaining === 0) {
      newStatus = "PAID";
    } else if (existing.paidAmount > 0 && newRemaining > 0) {
      newStatus = "PARTIAL";
    } else if (existing.paidAmount === 0) {
      newStatus = "UNPAID";
    }

    const debt = await prisma.debt.update({
      where: { id },
      data: {
        ...(data.referenceType !== undefined ? { referenceType: data.referenceType || null } : {}),
        ...(data.referenceId !== undefined ? { referenceId: data.referenceId || null } : {}),
        ...(data.partyType !== undefined ? { partyType: data.partyType } : {}),
        ...(data.partyId !== undefined ? { partyId: data.partyId || null } : {}),
        ...(data.partyName !== undefined ? { partyName: data.partyName } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.totalAmount !== undefined
          ? { totalAmount: newTotal, remainingAmount: newRemaining, status: newStatus }
          : {}),
        ...(data.dueDate !== undefined
          ? { dueDate: data.dueDate ? new Date(data.dueDate) : null }
          : {}),
        ...(data.branchId !== undefined ? { branchId: data.branchId || null } : {}),
      },
    });

    createAuditLog({
      action: "UPDATE",
      entity: "Debt",
      entityId: id,
      details: {
        before: {
          partyName: existing.partyName,
          totalAmount: existing.totalAmount,
          dueDate: existing.dueDate,
          description: existing.description,
        },
        after: {
          partyName: debt.partyName,
          totalAmount: debt.totalAmount,
          dueDate: debt.dueDate,
          description: debt.description,
        },
      },
      ...(debt.branchId ? { branchId: debt.branchId } : {}),
    }).catch(() => {});

    revalidatePath("/debts");
    return { success: true, debt };
  } catch (err) {
    console.error("[updateDebt]", err);
    return { error: "Gagal mengupdate data hutang/piutang" };
  }
}

// ===========================
// DELETE DEBT
// ===========================

export async function deleteDebt(id: string) {
  await assertMenuActionAccess("debts", "delete");
  const companyId = await getCurrentCompanyId();

  try {
    const existing = await prisma.debt.findFirst({ where: { id, companyId } });
    if (!existing) return { error: "Data hutang/piutang tidak ditemukan" };

    if (existing.status !== "UNPAID") {
      return {
        error:
          "Hanya hutang/piutang yang belum dibayar (UNPAID) yang dapat dihapus. Batalkan pembayaran terlebih dahulu.",
      };
    }

    await prisma.debt.delete({ where: { id } });

    createAuditLog({
      action: "DELETE",
      entity: "Debt",
      entityId: id,
      details: {
        deleted: {
          type: existing.type,
          partyName: existing.partyName,
          totalAmount: existing.totalAmount,
        },
      },
      ...(existing.branchId ? { branchId: existing.branchId } : {}),
    }).catch(() => {});

    revalidatePath("/debts");
    return { success: true };
  } catch (err) {
    console.error("[deleteDebt]", err);
    return { error: "Gagal menghapus data hutang/piutang" };
  }
}

// ===========================
// ADD DEBT PAYMENT
// ===========================

export async function addDebtPayment(params: {
  debtId: string;
  amount: number;
  method?: string | undefined;
  notes?: string | undefined;
}) {
  await assertMenuActionAccess("debts", "create");
  const companyId = await getCurrentCompanyId();

  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const { debtId, amount, method = "CASH", notes } = params;

  if (!amount || amount <= 0) {
    return { error: "Jumlah pembayaran harus lebih dari 0" };
  }

  try {
    const debt = await prisma.debt.findFirst({ where: { id: debtId, companyId } });
    if (!debt) return { error: "Data hutang/piutang tidak ditemukan" };

    if (debt.status === "PAID") {
      return { error: "Hutang/piutang ini sudah lunas" };
    }

    if (amount > debt.remainingAmount) {
      return {
        error: `Jumlah pembayaran (${amount}) melebihi sisa hutang/piutang (${debt.remainingAmount})`,
      };
    }

    // Just create payment — trigger auto-updates debt status, paidAmount, remainingAmount
    const payment = await prisma.debtPayment.create({
      data: {
        debtId,
        amount,
        method,
        notes: notes || null,
        paidBy: session.user.id,
      },
    });

    createAuditLog({
      action: "CREATE",
      entity: "DebtPayment",
      entityId: payment.id,
      details: {
        debtId,
        amount,
        method,
        partyName: debt.partyName,
        type: debt.type,
      },
      ...(debt.branchId ? { branchId: debt.branchId } : {}),
    }).catch(() => {});

    revalidatePath("/debts");

    // Auto-create accounting journal for debt payment
    import("@/server/actions/accounting").then(({ createAutoJournal }) => {
      createAutoJournal({
        referenceType: "DEBT_PAYMENT",
        referenceId: payment.id,
        ...(debt.branchId ? { branchId: debt.branchId } : {}),
      });
    }).catch(() => {});

    return { success: true, payment };
  } catch (err) {
    console.error("[addDebtPayment]", err);
    return { error: "Gagal menambahkan pembayaran" };
  }
}

// ===========================
// GET DEBT SUMMARY
// ===========================

export async function getDebtSummary(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const branchFilter = branchId ? { branchId, companyId } : { companyId };

  const [
    totalPayable,
    totalReceivable,
    totalPayablePaid,
    totalReceivablePaid,
    overdueCount,
    unpaidPayableCount,
    unpaidReceivableCount,
    recentPayments,
  ] = await Promise.all([
    // Total hutang (PAYABLE) - remaining
    prisma.debt.aggregate({
      where: { type: "PAYABLE", status: { not: "PAID" }, ...branchFilter },
      _sum: { remainingAmount: true },
    }),
    // Total piutang (RECEIVABLE) - remaining
    prisma.debt.aggregate({
      where: { type: "RECEIVABLE", status: { not: "PAID" }, ...branchFilter },
      _sum: { remainingAmount: true },
    }),
    // Total hutang sudah dibayar
    prisma.debt.aggregate({
      where: { type: "PAYABLE", ...branchFilter },
      _sum: { paidAmount: true },
    }),
    // Total piutang sudah dibayar
    prisma.debt.aggregate({
      where: { type: "RECEIVABLE", ...branchFilter },
      _sum: { paidAmount: true },
    }),
    // Overdue count
    prisma.debt.count({
      where: {
        status: { not: "PAID" },
        dueDate: { lt: new Date() },
        ...branchFilter,
      },
    }),
    // Unpaid payable count
    prisma.debt.count({
      where: { type: "PAYABLE", status: { not: "PAID" }, ...branchFilter },
    }),
    // Unpaid receivable count
    prisma.debt.count({
      where: { type: "RECEIVABLE", status: { not: "PAID" }, ...branchFilter },
    }),
    // Recent payments
    prisma.debtPayment.findMany({
      where: branchId ? { debt: { branchId, companyId } } : { debt: { companyId } },
      include: {
        debt: { select: { type: true, partyName: true } },
        payer: { select: { name: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    totalPayableRemaining: totalPayable._sum.remainingAmount ?? 0,
    totalReceivableRemaining: totalReceivable._sum.remainingAmount ?? 0,
    totalPayablePaid: totalPayablePaid._sum.paidAmount ?? 0,
    totalReceivablePaid: totalReceivablePaid._sum.paidAmount ?? 0,
    overdueCount,
    unpaidPayableCount,
    unpaidReceivableCount,
    recentPayments,
  };
}

// ─── Import Debts ───

export async function importDebts(rows: { type: string; partyName: string; description: string; totalAmount: number; dueDate: string }[], branchId?: string) {
  await assertMenuActionAccess("debts", "create");
  const companyId = await getCurrentCompanyId();
  const session = await auth();
  if (!session?.user?.id) return { results: [], successCount: 0, failedCount: rows.length };

  type R = { row: number; success: boolean; name: string; error?: string };
  const results: R[] = [];
  const validRows: { type: DebtType; partyType: string; partyName: string; description: string | null; totalAmount: number; paidAmount: number; remainingAmount: number; status: DebtStatus; dueDate: Date | null; branchId: string | null; companyId: string; createdBy: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    if (!row.partyName?.trim()) { results.push({ row: rowNum, success: false, name: `Baris ${rowNum}`, error: "Nama pihak wajib diisi" }); continue; }
    if (!row.totalAmount || row.totalAmount <= 0) { results.push({ row: rowNum, success: false, name: row.partyName, error: "Jumlah harus lebih dari 0" }); continue; }
    const type = row.type?.toUpperCase().trim() === "RECEIVABLE" ? "RECEIVABLE" as DebtType : "PAYABLE" as DebtType;
    validRows.push({
      type, partyType: "OTHER", partyName: row.partyName.trim(), description: row.description?.trim() || null,
      totalAmount: row.totalAmount, paidAmount: 0, remainingAmount: row.totalAmount, status: "UNPAID" as DebtStatus,
      dueDate: row.dueDate ? new Date(row.dueDate) : null, branchId: branchId || null, companyId, createdBy: session.user.id,
    });
  }

  if (validRows.length > 0) {
    try {
      await prisma.debt.createMany({ data: validRows });
      for (const r of validRows) results.push({ row: rows.findIndex((x) => x.partyName === r.partyName && x.totalAmount === r.totalAmount) + 2, success: true, name: r.partyName });
    } catch { for (const r of validRows) results.push({ row: 0, success: false, name: r.partyName, error: "Gagal menyimpan" }); }
  }

  results.sort((a, b) => a.row - b.row);
  revalidatePath("/debts");
  return { results, successCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length };
}

const DEBT_TEMPLATE_COLS: TemplateColumn[] = [
  { header: "Tipe (PAYABLE/RECEIVABLE) *", width: 24, sampleValues: ["PAYABLE", "RECEIVABLE"] },
  { header: "Nama Pihak *", width: 22, sampleValues: ["PT Supplier A", "Toko Pelanggan B"] },
  { header: "Deskripsi", width: 28, sampleValues: ["Hutang pembelian barang", "Piutang penjualan kredit"] },
  { header: "Jumlah *", width: 14, sampleValues: ["5000000", "2000000"] },
  { header: "Jatuh Tempo", width: 14, sampleValues: ["2026-05-14", "2026-04-30"] },
];

export async function downloadDebtImportTemplate(format: "csv" | "excel" | "docx") {
  const result = await generateImportTemplate(DEBT_TEMPLATE_COLS, 2, ["Kolom dengan tanda * wajib diisi", "Tipe: PAYABLE (hutang) atau RECEIVABLE (piutang)", "Format tanggal: YYYY-MM-DD"], format);
  return { data: result.data, filename: `template-import-hutang-piutang.${format === "excel" ? "xlsx" : format}`, mimeType: result.mimeType };
}
