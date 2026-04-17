"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";
import type { Prisma } from "@prisma/client";

// ============================================================
// HELPERS
// ============================================================

async function resolveSessionUserId() {
  const session = await auth();
  const sessionUserId = session?.user?.id;
  const sessionEmail = session?.user?.email;

  if (!sessionUserId && !sessionEmail) {
    return { error: "Unauthorized" };
  }

  // 1 query dengan OR, eliminasi serial fallback
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(sessionUserId ? [{ id: sessionUserId }] : []),
        ...(sessionEmail ? [{ email: sessionEmail }] : []),
      ],
    },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return { error: "Sesi tidak valid. Silakan login ulang." };
  }

  return { userId: user.id };
}

async function getSystemAccounts(codes: string[], companyId: string) {
  // Account codes may have company suffix (e.g. "1-1001-ABCD"), so use startsWith match
  const accounts = await prisma.account.findMany({
    where: {
      OR: codes.map((code) => ({ code: { startsWith: code } })),
      category: { companyId },
    },
  });

  // Map back to base code (e.g. "1-1001-ABCD" -> "1-1001")
  const map = new Map<string, typeof accounts[number]>();
  for (const account of accounts) {
    const baseCode = codes.find((c) => account.code.startsWith(c));
    if (baseCode && !map.has(baseCode)) {
      map.set(baseCode, account);
    }
  }

  for (const code of codes) {
    if (!map.has(code)) {
      throw new Error(
        `System account "${code}" not found. Please run seedDefaultCOA first.`,
      );
    }
  }

  return map;
}

async function createJournalChangeLog(params: {
  journalId: string;
  action: string;
  userId: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  snapshot?: Record<string, unknown>;
}) {
  try {
    await prisma.journalChangeLog.create({
      data: {
        journalId: params.journalId,
        action: params.action,
        userId: params.userId,
        changes: params.changes ? JSON.stringify(params.changes) : null,
        snapshot: params.snapshot ? JSON.stringify(params.snapshot) : null,
      },
    });
  } catch { /* non-blocking */ }
}

function generateEntryNumber(date: Date, sequence: number): string {
  const yy = date.getFullYear().toString().slice(-2);
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  return `JV-${yy}${mm}${dd}-${sequence.toString().padStart(4, "0")}`;
}

// ============================================================
// CHART OF ACCOUNTS — CATEGORIES
// ============================================================

export async function getAccountCategories() {
  const companyId = await getCurrentCompanyId();
  const categories = await prisma.accountCategory.findMany({
    where: { companyId },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { accounts: true } },
    },
  });
  return categories;
}

// ============================================================
// CHART OF ACCOUNTS — ACCOUNTS
// ============================================================

interface GetAccountsParams {
  page?: number;
  perPage?: number;
  search?: string;
  categoryId?: string;
  parentId?: string | null;
  branchId?: string;
  isActive?: boolean;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function getAccounts(params: GetAccountsParams = {}) {
  const companyId = await getCurrentCompanyId();
  const {
    page = 1,
    search,
    categoryId,
    parentId,
    branchId,
    isActive,
    sortBy,
    sortDir = "asc",
  } = params;
  const perPage = params.perPage || 20;
  const skip = (page - 1) * perPage;

  const where: Prisma.AccountWhereInput = { category: { companyId } };
  const and: Prisma.AccountWhereInput[] = [];

  if (search) {
    and.push({
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (categoryId) and.push({ categoryId });
  if (parentId !== undefined) and.push({ parentId });
  if (branchId) and.push({ OR: [{ branchId }, { branchId: null }] });
  if (isActive !== undefined) and.push({ isActive });

  if (and.length > 0) where.AND = and;

  const direction = sortDir === "desc" ? ("desc" as const) : ("asc" as const);
  const orderBy =
    sortBy === "name"
      ? { name: direction }
      : sortBy === "category"
        ? { category: { name: direction } }
        : { code: direction };

  const [accounts, total] = await Promise.all([
    prisma.account.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, type: true, normalSide: true },
        },
        parent: { select: { id: true, code: true, name: true } },
        _count: { select: { children: true, journalLines: true } },
      },
      orderBy,
      skip,
      take: perPage,
    }),
    prisma.account.count({ where }),
  ]);

  return {
    accounts,
    total,
    totalPages: Math.ceil(total / perPage),
    currentPage: page,
  };
}

export async function getAccountTree() {
  const companyId = await getCurrentCompanyId();
  // Parallelkan 3 query yang independen
  const [categories, accounts, balances] = await Promise.all([
    prisma.accountCategory.findMany({
      where: { companyId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.account.findMany({
      where: { isActive: true, category: { companyId } },
      include: {
        category: {
          select: { id: true, name: true, type: true, normalSide: true },
        },
        _count: { select: { children: true, journalLines: true } },
      },
      orderBy: { code: "asc" },
    }),
    // Calculate actual balance per account from posted journals
    prisma.$queryRaw<Array<{ accountId: string; total_debit: number; total_credit: number }>>`
      SELECT jel."accountId", COALESCE(SUM(jel.debit), 0)::float AS total_debit, COALESCE(SUM(jel.credit), 0)::float AS total_credit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel."journalId"
      JOIN accounts a ON a.id = jel."accountId"
      JOIN account_categories ac ON ac.id = a."categoryId"
      WHERE je.status = 'POSTED' AND ac."companyId" = ${companyId}
      GROUP BY jel."accountId"
    `,
  ]);

  const balanceMap = new Map(balances.map((b) => [b.accountId, b]));

  const tree = categories.map((cat) => {
    const catAccounts = accounts.filter((a) => a.categoryId === cat.id);
    const rootAccounts = catAccounts.filter((a) => !a.parentId);
    const childMap = new Map<string, typeof catAccounts>();
    for (const acc of catAccounts) {
      if (acc.parentId) {
        const existing = childMap.get(acc.parentId) || [];
        existing.push(acc);
        childMap.set(acc.parentId, existing);
      }
    }

    function buildNode(
      account: (typeof catAccounts)[0],
    ): Record<string, unknown> {
      const bal = balanceMap.get(account.id);
      const normalSide = cat.normalSide;
      // DEBIT-normal accounts: balance = opening + debit - credit
      // CREDIT-normal accounts: balance = opening + credit - debit
      const calculatedBalance = normalSide === "DEBIT"
        ? account.openingBalance + (bal?.total_debit ?? 0) - (bal?.total_credit ?? 0)
        : account.openingBalance + (bal?.total_credit ?? 0) - (bal?.total_debit ?? 0);
      return {
        ...account,
        openingBalance: calculatedBalance,
        children: (childMap.get(account.id) || []).map(buildNode),
      };
    }

    return { ...cat, accounts: rootAccounts.map(buildNode) };
  });

  return tree;
}

export async function getAccountById(id: string) {
  const companyId = await getCurrentCompanyId();
  const account = await prisma.account.findFirst({
    where: { id, category: { companyId } },
    include: {
      category: true,
      parent: { select: { id: true, code: true, name: true } },
      children: {
        select: { id: true, code: true, name: true, isActive: true },
        orderBy: { code: "asc" },
      },
      _count: { select: { journalLines: true, children: true } },
    },
  });

  if (!account) {
    return { error: "Akun tidak ditemukan" };
  }

  return { account };
}

export async function getCoaStats() {
  const companyId = await getCurrentCompanyId();
  const results = await prisma.$queryRaw<Array<{ category: string; count: number; total_balance: number }>>`
    SELECT ac.type AS category, COUNT(DISTINCT a.id)::int AS count,
      COALESCE(SUM(a."openingBalance" + COALESCE(jl.total_debit, 0) - COALESCE(jl.total_credit, 0)), 0)::float AS total_balance
    FROM accounts a
    JOIN account_categories ac ON ac.id = a."categoryId"
    LEFT JOIN (
      SELECT jel."accountId", SUM(jel.debit) AS total_debit, SUM(jel.credit) AS total_credit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel."journalId"
      WHERE je.status = 'POSTED'
      GROUP BY jel."accountId"
    ) jl ON jl."accountId" = a.id
    WHERE ac."companyId" = ${companyId}
    GROUP BY ac.type
  `;
  const map = new Map(results.map((r) => [r.category, r]));
  const totalAccounts = results.reduce((s, r) => s + r.count, 0);
  return {
    totalAccounts,
    aset: map.get("ASET")?.total_balance ?? 0,
    kewajiban: map.get("KEWAJIBAN")?.total_balance ?? 0,
    modal: map.get("MODAL")?.total_balance ?? 0,
  };
}

interface CreateAccountInput {
  code?: string;
  name: string;
  description?: string;
  categoryId: string;
  parentId?: string;
  branchId?: string;
  openingBalance?: number;
}

export async function createAccount(data: CreateAccountInput) {
  await assertMenuActionAccess("accounting-coa", "create");
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };

  // Wave 1: category + parent sekaligus (independen)
  const [category, parent] = await Promise.all([
    prisma.accountCategory.findUnique({ where: { id: data.categoryId, companyId } }),
    data.parentId
      ? prisma.account.findFirst({
          where: { id: data.parentId, category: { companyId } },
          select: { id: true, categoryId: true },
        })
      : Promise.resolve(null),
  ]);

  if (!category) return { error: "Kategori akun tidak ditemukan" };

  if (data.parentId) {
    if (!parent) return { error: "Akun induk tidak ditemukan" };
    if (parent.categoryId !== data.categoryId)
      return { error: "Akun induk harus dalam kategori yang sama" };
  }

  // Resolve code
  let code = data.code?.trim();
  if (!code) {
    const prefixMap: Record<string, string> = {
      ASSET: "1",
      LIABILITY: "2",
      EQUITY: "3",
      REVENUE: "4",
      EXPENSE: "5",
    };
    const prefix = prefixMap[category.type] || "9";

    const lastAccount = await prisma.account.findFirst({
      where: { code: { startsWith: `${prefix}-` }, category: { companyId } },
      orderBy: { code: "desc" },
      select: { code: true },
    });

    let nextSeq = 1001;
    if (lastAccount) {
      const parts = lastAccount.code.split("-");
      const lastSeq = parseInt(parts[1] ?? "0", 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }
    code = `${prefix}-${nextSeq}`;
  }

  // Wave 2: cek uniqueness code (hanya jika code sudah diketahui)
  const existing = await prisma.account.findFirst({ where: { code, category: { companyId } } });
  if (existing) return { error: `Kode akun "${code}" sudah digunakan` };

  const account = await prisma.account.create({
    data: {
      code,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      categoryId: data.categoryId,
      parentId: data.parentId || null,
      branchId: data.branchId || null,
      openingBalance: data.openingBalance || 0,
      isActive: true,
      isSystem: false,
    },
    include: {
      category: { select: { name: true, type: true } },
    },
  });

  await createAuditLog({
    action: "CREATE",
    entity: "Account",
    entityId: account.id,
    details: {
      code: account.code,
      name: account.name,
      category: account.category.name,
    },
  });

  revalidatePath("/accounting");
  return { account };
}

interface UpdateAccountInput {
  name?: string;
  description?: string;
  categoryId?: string;
  parentId?: string | null;
  branchId?: string | null;
  openingBalance?: number;
  isActive?: boolean;
  code?: string;
}

export async function updateAccount(id: string, data: UpdateAccountInput) {
  await assertMenuActionAccess("accounting-coa", "update");
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };

  // Wave 1: existing + code uniqueness + parent — semua parallel
  const [existing, codeConflict, parent] = await Promise.all([
    prisma.account.findFirst({ where: { id, category: { companyId } }, include: { category: true } }),
    data.code
      ? prisma.account.findFirst({
          where: { code: data.code, category: { companyId } },
          select: { id: true },
        })
      : Promise.resolve(null),
    data.parentId && data.parentId !== id
      ? prisma.account.findFirst({
          where: { id: data.parentId, category: { companyId } },
          select: { id: true, categoryId: true },
        })
      : Promise.resolve(null),
  ]);

  if (!existing) return { error: "Akun tidak ditemukan" };

  if (existing.isSystem) {
    if (data.code && data.code !== existing.code)
      return { error: "Tidak dapat mengubah kode akun sistem" };
    if (data.categoryId && data.categoryId !== existing.categoryId)
      return { error: "Tidak dapat mengubah kategori akun sistem" };
  }

  if (codeConflict && data.code !== existing.code)
    return { error: `Kode akun "${data.code}" sudah digunakan` };

  if (data.parentId !== undefined && data.parentId !== existing.parentId) {
    if (data.parentId) {
      if (data.parentId === id)
        return { error: "Akun tidak bisa menjadi induk dari dirinya sendiri" };
      if (!parent) return { error: "Akun induk tidak ditemukan" };
      const targetCategoryId = data.categoryId || existing.categoryId;
      if (parent.categoryId !== targetCategoryId)
        return { error: "Akun induk harus dalam kategori yang sama" };
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined)
    updateData.description = data.description?.trim() || null;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.branchId !== undefined) updateData.branchId = data.branchId;
  if (data.openingBalance !== undefined)
    updateData.openingBalance = data.openingBalance;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.code !== undefined) updateData.code = data.code;

  const account = await prisma.account.update({
    where: { id },
    data: updateData,
    include: { category: { select: { name: true, type: true } } },
  });

  await createAuditLog({
    action: "UPDATE",
    entity: "Account",
    entityId: account.id,
    details: {
      code: account.code,
      name: account.name,
      changes: Object.keys(updateData),
    },
  });

  revalidatePath("/accounting");
  return { account };
}

export async function deleteAccount(id: string) {
  await assertMenuActionAccess("accounting-coa", "delete");
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };

  const account = await prisma.account.findFirst({
    where: { id, category: { companyId } },
    include: {
      _count: { select: { journalLines: true, children: true } },
    },
  });

  if (!account) {
    return { error: "Akun tidak ditemukan" };
  }

  if (account.isSystem) {
    return { error: "Akun sistem tidak dapat dihapus" };
  }

  if (account._count.children > 0) {
    return { error: "Akun memiliki sub-akun. Hapus sub-akun terlebih dahulu." };
  }

  if (account._count.journalLines > 0) {
    return {
      error:
        "Akun memiliki entri jurnal. Tidak dapat dihapus, hanya bisa dinonaktifkan.",
    };
  }

  // Soft delete — set isActive = false
  await prisma.account.update({
    where: { id },
    data: { isActive: false },
  });

  await createAuditLog({
    action: "DELETE",
    entity: "Account",
    entityId: id,
    details: { code: account.code, name: account.name, softDelete: true },
  });

  revalidatePath("/accounting");
  return { success: true };
}

export async function getAccountsByType(type: string) {
  const companyId = await getCurrentCompanyId();
  const accounts = await prisma.account.findMany({
    where: {
      isActive: true,
      category: { type, companyId },
    },
    include: {
      category: { select: { name: true, type: true, normalSide: true } },
    },
    orderBy: { code: "asc" },
  });
  return accounts;
}

// ============================================================
// JOURNAL ENTRIES
// ============================================================

interface GetJournalEntriesParams {
  page?: number;
  perPage?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  referenceType?: string;
  branchId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function getJournalEntries(params: GetJournalEntriesParams = {}) {
  const companyId = await getCurrentCompanyId();
  const {
    page = 1,
    search,
    dateFrom,
    dateTo,
    status,
    referenceType,
    branchId,
    sortBy,
    sortDir = "desc",
  } = params;
  const perPage = params.perPage || 20;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = { branch: { companyId } };

  if (search) {
    where.OR = [
      { entryNumber: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status && status !== "all") where.status = status;
  if (referenceType && referenceType !== "all")
    where.referenceType = referenceType;
  if (branchId) where.branchId = branchId;
  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) dateFilter.lte = new Date(dateTo + "T23:59:59");
    where.date = dateFilter;
  }

  const direction = sortDir === "asc" ? ("asc" as const) : ("desc" as const);
  const orderBy =
    sortBy === "entryNumber"
      ? { entryNumber: direction }
      : sortBy === "totalDebit"
        ? { totalDebit: direction }
        : { date: direction };

  const [entries, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
        createdByUser: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } },
        period: { select: { id: true, name: true, status: true } },
      },
      orderBy,
      skip,
      take: perPage,
    }),
    prisma.journalEntry.count({ where }),
  ]);

  return {
    entries,
    total,
    totalPages: Math.ceil(total / perPage),
    currentPage: page,
  };
}

export async function getJournalEntryById(id: string) {
  const companyId = await getCurrentCompanyId();
  const entry = await prisma.journalEntry.findFirst({
    where: { id, branch: { companyId } },
    include: {
      lines: {
        include: {
          account: {
            select: {
              id: true,
              code: true,
              name: true,
              category: { select: { name: true, type: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      createdByUser: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, name: true } },
      period: { select: { id: true, name: true, status: true } },
    },
  });

  if (!entry) {
    return { error: "Jurnal tidak ditemukan" };
  }

  return { entry };
}

interface JournalLineInput {
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
}

interface CreateJournalEntryInput {
  date: string;
  description: string;
  reference?: string;
  branchId?: string;
  notes?: string;
  lines: JournalLineInput[];
}

export async function createJournalEntry(data: CreateJournalEntryInput) {
  await assertMenuActionAccess("accounting-journals", "create");
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };
  const userId = authResult.userId;

  // Validate lines
  if (!data.lines || data.lines.length < 2) {
    return { error: "Jurnal harus memiliki minimal 2 baris" };
  }

  // Calculate totals
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of data.lines) {
    if (line.debit < 0 || line.credit < 0) {
      return { error: "Debit dan kredit tidak boleh negatif" };
    }
    if (line.debit > 0 && line.credit > 0) {
      return {
        error: "Satu baris tidak boleh memiliki debit dan kredit sekaligus",
      };
    }
    if (line.debit === 0 && line.credit === 0) {
      return { error: "Setiap baris harus memiliki nilai debit atau kredit" };
    }
    totalDebit += line.debit;
    totalCredit += line.credit;
  }

  // Debit must equal credit
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return {
      error: `Total debit (${totalDebit.toLocaleString()}) harus sama dengan total kredit (${totalCredit.toLocaleString()})`,
    };
  }

  // Validate all accounts exist
  const accountIds = [...new Set(data.lines.map((l) => l.accountId))];
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds }, category: { companyId } },
    select: { id: true, isActive: true },
  });
  if (accounts.length !== accountIds.length) {
    return { error: "Satu atau lebih akun tidak ditemukan" };
  }
  const inactiveAccounts = accounts.filter((a) => !a.isActive);
  if (inactiveAccounts.length > 0) {
    return { error: "Satu atau lebih akun tidak aktif" };
  }

  // Check period is not closed/locked
  const entryDate = new Date(data.date);
  const period = await prisma.accountingPeriod.findFirst({
    where: {
      startDate: { lte: entryDate },
      endDate: { gte: entryDate },
    },
  });
  if (period && (period.status === "CLOSED" || period.status === "LOCKED")) {
    return {
      error: `Periode akuntansi "${period.name}" sudah ${period.status === "CLOSED" ? "ditutup" : "dikunci"}. Tidak dapat membuat jurnal.`,
    };
  }

  // Generate entry number
  const todayStr = `JV-${entryDate.getFullYear().toString().slice(-2)}${(entryDate.getMonth() + 1).toString().padStart(2, "0")}${entryDate.getDate().toString().padStart(2, "0")}`;
  const lastEntry = await prisma.journalEntry.findFirst({
    where: { entryNumber: { startsWith: todayStr } },
    orderBy: { entryNumber: "desc" },
    select: { entryNumber: true },
  });
  let sequence = 1;
  if (lastEntry) {
    const parts = lastEntry.entryNumber.split("-");
    const lastSeq = parseInt(parts[2] ?? "0", 10);
    if (!isNaN(lastSeq)) sequence = lastSeq + 1;
  }
  const entryNumber = generateEntryNumber(entryDate, sequence);

  const entry = await prisma.journalEntry.create({
    data: {
      entryNumber,
      date: entryDate,
      description: data.description.trim(),
      reference: data.reference?.trim() || null,
      referenceType: "MANUAL",
      branchId:
        data.branchId && data.branchId.trim().length > 0 ? data.branchId : null,
      periodId: period?.id || null,
      status: "DRAFT",
      totalDebit,
      totalCredit,
      createdBy: userId,
      notes: data.notes?.trim() || null,
      lines: {
        create: data.lines.map((line, idx) => ({
          accountId: line.accountId,
          description: line.description?.trim() || null,
          debit: line.debit,
          credit: line.credit,
          sortOrder: idx,
        })),
      },
    },
    include: {
      lines: {
        include: { account: { select: { code: true, name: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  await createAuditLog({
    action: "CREATE",
    entity: "JournalEntry",
    entityId: entry.id,
    details: { entryNumber, totalDebit, totalCredit, linesCount: data.lines.length },
  });

  createJournalChangeLog({
    journalId: entry.id,
    action: "CREATED",
    userId,
    snapshot: { entryNumber, description: data.description, status: "DRAFT", totalDebit, totalCredit, lines: entry.lines },
  });

  revalidatePath("/accounting");
  return { entry };
}

interface UpdateJournalEntryInput {
  date?: string;
  description?: string;
  reference?: string;
  branchId?: string | null;
  notes?: string;
  lines?: JournalLineInput[];
}

export async function updateJournalEntry(
  id: string,
  data: UpdateJournalEntryInput,
) {
  await assertMenuActionAccess("accounting-journals", "update");
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };
  const userId = authResult.userId;

  const existing = await prisma.journalEntry.findFirst({
    where: { id, branch: { companyId } },
    select: { id: true, status: true, entryNumber: true },
  });
  if (!existing) {
    return { error: "Jurnal tidak ditemukan" };
  }
  if (existing.status !== "DRAFT") {
    return { error: "Hanya jurnal berstatus DRAFT yang dapat diedit" };
  }

  const updateData: Record<string, unknown> = { updatedBy: userId };

  if (data.date !== undefined) {
    const entryDate = new Date(data.date);
    // Check period
    const period = await prisma.accountingPeriod.findFirst({
      where: {
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
    });
    if (period && (period.status === "CLOSED" || period.status === "LOCKED")) {
      return {
        error: `Periode akuntansi "${period.name}" sudah ${period.status === "CLOSED" ? "ditutup" : "dikunci"}.`,
      };
    }
    updateData.date = entryDate;
    updateData.periodId = period?.id || null;
  }
  if (data.description !== undefined)
    updateData.description = data.description.trim();
  if (data.reference !== undefined)
    updateData.reference = data.reference?.trim() || null;
  if (data.branchId !== undefined) updateData.branchId = data.branchId;
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;

  // If lines provided, replace all lines
  if (data.lines && data.lines.length > 0) {
    if (data.lines.length < 2) {
      return { error: "Jurnal harus memiliki minimal 2 baris" };
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of data.lines) {
      if (line.debit < 0 || line.credit < 0) {
        return { error: "Debit dan kredit tidak boleh negatif" };
      }
      if (line.debit > 0 && line.credit > 0) {
        return {
          error: "Satu baris tidak boleh memiliki debit dan kredit sekaligus",
        };
      }
      if (line.debit === 0 && line.credit === 0) {
        return { error: "Setiap baris harus memiliki nilai debit atau kredit" };
      }
      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        error: `Total debit (${totalDebit.toLocaleString()}) harus sama dengan total kredit (${totalCredit.toLocaleString()})`,
      };
    }

    // Validate accounts
    const accountIds = [...new Set(data.lines.map((l) => l.accountId))];
    const accounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, category: { companyId } },
      select: { id: true, isActive: true },
    });
    if (accounts.length !== accountIds.length) {
      return { error: "Satu atau lebih akun tidak ditemukan" };
    }

    updateData.totalDebit = totalDebit;
    updateData.totalCredit = totalCredit;

    // Delete old lines and create new ones in a transaction
    await prisma.$transaction([
      prisma.journalEntryLine.deleteMany({ where: { journalId: id } }),
      prisma.journalEntry.update({
        where: { id },
        data: {
          ...updateData,
          lines: {
            create: data.lines.map((line, idx) => ({
              accountId: line.accountId,
              description: line.description?.trim() || null,
              debit: line.debit,
              credit: line.credit,
              sortOrder: idx,
            })),
          },
        },
      }),
    ]);
  } else {
    await prisma.journalEntry.update({
      where: { id },
      data: updateData,
    });
  }

  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      lines: {
        include: { account: { select: { code: true, name: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  await createAuditLog({
    action: "UPDATE",
    entity: "JournalEntry",
    entityId: id,
    details: {
      entryNumber: existing.entryNumber,
      changes: Object.keys(updateData),
    },
  });

  revalidatePath("/accounting");
  return { entry };
}

export async function postJournalEntry(id: string) {
  await assertMenuActionAccess("accounting-journals", "update");
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };
  const userId = authResult.userId;

  const entry = await prisma.journalEntry.findFirst({
    where: { id, branch: { companyId } },
    select: {
      id: true,
      status: true,
      entryNumber: true,
      totalDebit: true,
      totalCredit: true,
    },
  });
  if (!entry) {
    return { error: "Jurnal tidak ditemukan" };
  }
  if (entry.status !== "DRAFT" && entry.status !== "PENDING_APPROVAL") {
    return { error: "Hanya jurnal DRAFT atau PENDING_APPROVAL yang dapat diposting" };
  }
  if (Math.abs(entry.totalDebit - entry.totalCredit) > 0.01) {
    return { error: "Total debit dan kredit tidak seimbang" };
  }

  await prisma.journalEntry.update({
    where: { id },
    data: { status: "POSTED", updatedBy: userId, approvedBy: userId, approvedAt: new Date() },
  });

  createJournalChangeLog({ journalId: id, action: "POSTED", userId, changes: { status: { old: entry.status, new: "POSTED" } } });

  await createAuditLog({
    action: "POST",
    entity: "JournalEntry",
    entityId: id,
    details: { entryNumber: entry.entryNumber, totalDebit: entry.totalDebit },
  });

  revalidatePath("/accounting");
  return { success: true };
}

// ─── Journal Approval Workflow ───

export async function submitJournalForApproval(id: string) {
  await assertMenuActionAccess("accounting-journals", "create");
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };

  const entry = await prisma.journalEntry.findFirst({
    where: { id, branch: { companyId } },
    select: { id: true, status: true, totalDebit: true, totalCredit: true, entryNumber: true },
  });
  if (!entry) return { error: "Jurnal tidak ditemukan" };
  if (entry.status !== "DRAFT") return { error: "Hanya jurnal DRAFT yang dapat diajukan" };
  if (Math.abs(entry.totalDebit - entry.totalCredit) > 0.01) return { error: "Total debit dan kredit tidak seimbang" };

  await prisma.journalEntry.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });
  createJournalChangeLog({ journalId: id, action: "SUBMITTED", userId: authResult.userId, changes: { status: { old: "DRAFT", new: "PENDING_APPROVAL" } } });
  revalidatePath("/accounting");
  return { success: true };
}

export async function approveJournalEntry(id: string) {
  await assertMenuActionAccess("accounting-journals", "approve");
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };

  const entry = await prisma.journalEntry.findFirst({
    where: { id, branch: { companyId } },
    select: { id: true, status: true, entryNumber: true },
  });
  if (!entry) return { error: "Jurnal tidak ditemukan" };
  if (entry.status !== "PENDING_APPROVAL") return { error: "Hanya jurnal PENDING_APPROVAL yang dapat disetujui" };

  await prisma.journalEntry.update({
    where: { id },
    data: { status: "POSTED", approvedBy: authResult.userId, approvedAt: new Date() },
  });
  createJournalChangeLog({ journalId: id, action: "APPROVED", userId: authResult.userId, changes: { status: { old: "PENDING_APPROVAL", new: "POSTED" } } });
  revalidatePath("/accounting");
  return { success: true };
}

export async function rejectJournalEntry(id: string, reason: string) {
  await assertMenuActionAccess("accounting-journals", "approve");
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };

  const entry = await prisma.journalEntry.findFirst({
    where: { id, branch: { companyId } },
    select: { id: true, status: true, entryNumber: true },
  });
  if (!entry) return { error: "Jurnal tidak ditemukan" };
  if (entry.status !== "PENDING_APPROVAL") return { error: "Hanya jurnal PENDING_APPROVAL yang dapat ditolak" };

  await prisma.journalEntry.update({
    where: { id },
    data: { status: "DRAFT", rejectionNote: reason },
  });
  createJournalChangeLog({ journalId: id, action: "REJECTED", userId: authResult.userId, changes: { status: { old: "PENDING_APPROVAL", new: "DRAFT" }, rejectionNote: { old: null, new: reason } } });
  revalidatePath("/accounting");
  return { success: true };
}

export async function getJournalChangeHistory(journalId: string) {
  const companyId = await getCurrentCompanyId();
  const entry = await prisma.journalEntry.findFirst({ where: { id: journalId, branch: { companyId } }, select: { id: true } });
  if (!entry) return [];
  return prisma.journalChangeLog.findMany({
    where: { journalId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function voidJournalEntry(id: string, reason: string) {
  await assertMenuActionAccess("accounting-journals", "void");
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };
  const userId = authResult.userId;

  if (!reason?.trim()) return { error: "Alasan void wajib diisi" };

  // Fetch entry + period check + last entry number — parallel
  const entry = await prisma.journalEntry.findFirst({
    where: { id, branch: { companyId } },
    select: {
      id: true,
      status: true,
      entryNumber: true,
      description: true,
      branchId: true,
      periodId: true,
      totalDebit: true,
      totalCredit: true,
      notes: true,
      // Select minimal fields di lines — jangan include semua kolom
      lines: {
        select: {
          accountId: true,
          description: true,
          debit: true,
          credit: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!entry) return { error: "Jurnal tidak ditemukan" };
  if (entry.status === "VOIDED") return { error: "Jurnal sudah di-void" };
  if (entry.status === "DRAFT")
    return { error: "Jurnal berstatus DRAFT. Hapus saja atau ubah langsung." };

  // Parallel: cek period + cari last entry number untuk reversing
  const today = new Date();
  const todayPrefix = `JV-${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;

  const [period, lastEntry, currentPeriod] = await Promise.all([
    entry.periodId
      ? prisma.accountingPeriod.findUnique({
          where: { id: entry.periodId },
          select: { status: true },
        })
      : Promise.resolve(null),
    prisma.journalEntry.findFirst({
      where: { entryNumber: { startsWith: todayPrefix } },
      orderBy: { entryNumber: "desc" },
      select: { entryNumber: true },
    }),
    prisma.accountingPeriod.findFirst({
      where: {
        startDate: { lte: today },
        endDate: { gte: today },
        status: "OPEN",
      },
      select: { id: true },
    }),
  ]);

  if (period?.status === "LOCKED")
    return { error: "Periode sudah dikunci. Tidak bisa void jurnal." };

  let sequence = 1;
  if (lastEntry) {
    const parts = lastEntry.entryNumber.split("-");
    const lastSeq = parseInt(parts[2] ?? "0", 10);
    if (!isNaN(lastSeq)) sequence = lastSeq + 1;
  }
  const reversingNumber = generateEntryNumber(today, sequence);

  await prisma.$transaction([
    prisma.journalEntry.update({
      where: { id },
      data: {
        status: "VOIDED",
        updatedBy: userId,
        notes: entry.notes
          ? `${entry.notes}\n[VOIDED] ${reason.trim()}`
          : `[VOIDED] ${reason.trim()}`,
      },
    }),
    prisma.journalEntry.create({
      data: {
        entryNumber: reversingNumber,
        date: today,
        description: `Reversing: ${entry.description} — ${reason.trim()}`,
        reference: entry.entryNumber,
        referenceType: "MANUAL",
        referenceId: entry.id,
        branchId: entry.branchId,
        periodId: currentPeriod?.id || null,
        status: "POSTED",
        totalDebit: entry.totalCredit,
        totalCredit: entry.totalDebit,
        createdBy: userId,
        notes: `Reversing entry for voided journal ${entry.entryNumber}`,
        lines: {
          create: entry.lines.map((line, idx) => ({
            accountId: line.accountId,
            description: `Reversing: ${line.description || ""}`,
            debit: line.credit,
            credit: line.debit,
            sortOrder: idx,
          })),
        },
      },
    }),
  ]);

  await createAuditLog({
    action: "VOID",
    entity: "JournalEntry",
    entityId: id,
    details: {
      entryNumber: entry.entryNumber,
      reason: reason.trim(),
      reversingEntry: reversingNumber,
    },
  });

  createJournalChangeLog({ journalId: id, action: "VOIDED", userId, changes: { status: { old: entry.status, new: "VOIDED" }, reason: { old: null, new: reason.trim() } } });

  revalidatePath("/accounting");
  return { success: true, reversingEntryNumber: reversingNumber };
}

// ============================================================
// AUTO-JOURNAL FROM POS
// ============================================================

interface CreateAutoJournalParams {
  referenceType:
    | "TRANSACTION"
    | "PURCHASE"
    | "RETURN"
    | "DEBT_PAYMENT"
    | "EXPENSE";
  referenceId: string;
  branchId?: string;
}

export async function createAutoJournal(params: CreateAutoJournalParams) {
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };
  const userId = authResult.userId;

  const { referenceType, referenceId, branchId } = params;
  let description = "";
  let reference = "";
  const lines: {
    accountId: string;
    description: string;
    debit: number;
    credit: number;
    taxType?: string;
    taxAmount?: number;
    taxBaseAmount?: number;
  }[] = [];

  try {
    switch (referenceType) {
      case "TRANSACTION": {
        // Fetch transaksi + semua system accounts sekaligus — parallel
        const taxAccountCodes = ["2-1100"]; // PPN Keluaran
        const [txn, accs] = await Promise.all([
          prisma.transaction.findUnique({
            where: { id: referenceId },
            include: {
              items: { include: { product: { select: { purchasePrice: true } } } },
              payments: true,
            },
          }),
          getSystemAccounts(["1-1001", "1-1002", "1-1003", "1-1004", "4-1001", "5-1001", ...taxAccountCodes], companyId),
        ]);
        if (!txn) return { error: "Transaksi tidak ditemukan" };

        description = `Penjualan ${txn.invoiceNumber}`;
        reference = txn.invoiceNumber;

        const cashAccount = accs.get("1-1001")!;
        const bankAccount = accs.get("1-1002")!;
        const receivableAccount = accs.get("1-1003")!;
        const inventoryAccount = accs.get("1-1004")!;
        const revenueAccount = accs.get("4-1001")!;
        const cogsAccount = accs.get("5-1001")!;
        const ppnKeluaranAccount = accs.get("2-1100");

        // Debit: asset accounts (cash/bank/receivable)
        if (txn.payments && txn.payments.length > 0) {
          for (const payment of txn.payments) {
            const targetAccount = payment.method === "CASH" ? cashAccount : payment.method === "TERMIN" ? receivableAccount : bankAccount;
            lines.push({ accountId: targetAccount.id, description: `Penerimaan ${payment.method} — ${txn.invoiceNumber}`, debit: payment.amount, credit: 0 });
          }
        } else {
          const targetAccount = txn.paymentMethod === "CASH" ? cashAccount : txn.paymentMethod === "TERMIN" ? receivableAccount : bankAccount;
          lines.push({ accountId: targetAccount.id, description: `Penerimaan ${txn.paymentMethod} — ${txn.invoiceNumber}`, debit: txn.grandTotal, credit: 0 });
        }

        // Credit: revenue (DPP) + PPN Keluaran
        const taxAmount = txn.taxAmount || 0;
        const dpp = txn.grandTotal - taxAmount;
        lines.push({ accountId: revenueAccount.id, description: `Pendapatan penjualan — ${txn.invoiceNumber}`, debit: 0, credit: dpp });

        if (taxAmount > 0 && ppnKeluaranAccount) {
          lines.push({ accountId: ppnKeluaranAccount.id, description: `PPN Keluaran — ${txn.invoiceNumber}`, debit: 0, credit: taxAmount, taxType: "PPN_KELUARAN", taxAmount, taxBaseAmount: dpp });
        }

        // COGS + Inventory reduction
        let totalCogs = 0;
        for (const item of txn.items) {
          const costPrice = item.product?.purchasePrice || 0;
          const baseQty = item.baseQty || item.quantity * item.conversionQty;
          totalCogs += costPrice * baseQty;
        }
        if (totalCogs > 0) {
          lines.push({ accountId: cogsAccount.id, description: `HPP — ${txn.invoiceNumber}`, debit: totalCogs, credit: 0 });
          lines.push({ accountId: inventoryAccount.id, description: `Pengurangan persediaan — ${txn.invoiceNumber}`, debit: 0, credit: totalCogs });
        }
        break;
      }

      case "PURCHASE": {
        const [po, accs] = await Promise.all([
          prisma.purchaseOrder.findUnique({
            where: { id: referenceId },
            include: { supplier: { select: { name: true } } },
          }),
          getSystemAccounts(["1-1001", "1-1004", "1-1100", "2-1001"], companyId),
        ]);
        if (!po) return { error: "Purchase order tidak ditemukan" };

        description = `Pembelian ${po.orderNumber} — ${po.supplier.name}`;
        reference = po.orderNumber;

        const inventoryAccount = accs.get("1-1004")!;
        const ppnMasukanAccount = accs.get("1-1100");
        const payableAccount = accs.get("2-1001")!;
        const cashAccount = accs.get("1-1001")!;

        // Assume PPN 11% on purchases (configurable via TaxConfig later)
        const ppnRate = 0.11;
        const dpp = Math.round(po.totalAmount / (1 + ppnRate));
        const ppnAmount = po.totalAmount - dpp;

        lines.push({ accountId: inventoryAccount.id, description: `Persediaan masuk — ${po.orderNumber}`, debit: dpp, credit: 0 });

        if (ppnAmount > 0 && ppnMasukanAccount) {
          lines.push({ accountId: ppnMasukanAccount.id, description: `PPN Masukan — ${po.orderNumber}`, debit: ppnAmount, credit: 0, taxType: "PPN_MASUKAN", taxAmount: ppnAmount, taxBaseAmount: dpp });
        }

        const unpaidAmount = po.totalAmount - po.paidAmount;
        if (po.paidAmount > 0)
          lines.push({ accountId: cashAccount.id, description: `Pembayaran tunai — ${po.orderNumber}`, debit: 0, credit: po.paidAmount });
        if (unpaidAmount > 0)
          lines.push({ accountId: payableAccount.id, description: `Hutang dagang — ${po.orderNumber}`, debit: 0, credit: unpaidAmount });
        break;
      }

      case "RETURN": {
        const [ret, accs] = await Promise.all([
          prisma.returnExchange.findUnique({
            where: { id: referenceId },
            include: {
              items: {
                include: { product: { select: { purchasePrice: true } } },
              },
              transaction: { select: { invoiceNumber: true } },
            },
          }),
          getSystemAccounts(["1-1001", "1-1002", "1-1004", "4-1002", "5-1001"], companyId),
        ]);
        if (!ret) return { error: "Return tidak ditemukan" };

        description = `Retur penjualan ${ret.returnNumber}`;
        reference = ret.returnNumber;

        const cashAccount = accs.get("1-1001")!;
        const bankAccount = accs.get("1-1002")!;
        const inventoryAccount = accs.get("1-1004")!;
        const returnRevenueAccount = accs.get("4-1002")!;
        const cogsAccount = accs.get("5-1001")!;

        if (ret.totalRefund > 0) {
          lines.push({
            accountId: returnRevenueAccount.id,
            description: `Retur penjualan — ${ret.returnNumber}`,
            debit: ret.totalRefund,
            credit: 0,
          });
          const refundAccount =
            ret.refundMethod === "CASH" || !ret.refundMethod
              ? cashAccount
              : bankAccount;
          lines.push({
            accountId: refundAccount.id,
            description: `Pengembalian dana — ${ret.returnNumber}`,
            debit: 0,
            credit: ret.totalRefund,
          });
        }

        let returnCogs = 0;
        for (const item of ret.items)
          returnCogs += (item.product?.purchasePrice || 0) * item.quantity;
        if (returnCogs > 0) {
          lines.push({
            accountId: inventoryAccount.id,
            description: `Persediaan kembali — ${ret.returnNumber}`,
            debit: returnCogs,
            credit: 0,
          });
          lines.push({
            accountId: cogsAccount.id,
            description: `Reversal HPP — ${ret.returnNumber}`,
            debit: 0,
            credit: returnCogs,
          });
        }
        break;
      }

      case "DEBT_PAYMENT": {
        const [payment, accs] = await Promise.all([
          prisma.debtPayment.findUnique({
            where: { id: referenceId },
            include: {
              debt: {
                select: {
                  id: true,
                  type: true,
                  partyName: true,
                  description: true,
                },
              },
            },
          }),
          getSystemAccounts(["1-1001", "1-1003", "2-1001"], companyId),
        ]);
        if (!payment)
          return { error: "Pembayaran hutang/piutang tidak ditemukan" };

        const cashAccount = accs.get("1-1001")!;
        const receivableAccount = accs.get("1-1003")!;
        const payableAccount = accs.get("2-1001")!;

        if (payment.debt.type === "PAYABLE") {
          description = `Pembayaran hutang — ${payment.debt.partyName}`;
          reference = payment.debt.description || `Debt-${payment.debtId}`;
          lines.push({
            accountId: payableAccount.id,
            description: `Pelunasan hutang — ${payment.debt.partyName}`,
            debit: payment.amount,
            credit: 0,
          });
          lines.push({
            accountId: cashAccount.id,
            description: `Pembayaran kas — ${payment.debt.partyName}`,
            debit: 0,
            credit: payment.amount,
          });
        } else {
          description = `Penerimaan piutang — ${payment.debt.partyName}`;
          reference = payment.debt.description || `Debt-${payment.debtId}`;
          lines.push({
            accountId: cashAccount.id,
            description: `Penerimaan kas — ${payment.debt.partyName}`,
            debit: payment.amount,
            credit: 0,
          });
          lines.push({
            accountId: receivableAccount.id,
            description: `Pelunasan piutang — ${payment.debt.partyName}`,
            debit: 0,
            credit: payment.amount,
          });
        }
        break;
      }

      case "EXPENSE": {
        const expense = await prisma.expense.findUnique({
          where: { id: referenceId },
        });
        if (!expense) return { error: "Pengeluaran tidak ditemukan" };

        description = `Beban: ${expense.description}`;
        reference = `EXP-${expense.id.slice(0, 8)}`;

        const categoryLower = expense.category.toLowerCase();
        const expenseAccountCode =
          categoryLower.includes("gaji") || categoryLower.includes("salary")
            ? "5-1003"
            : "5-1002";

        // Fetch cash + expense account sekaligus
        const accs = await getSystemAccounts(["1-1001", expenseAccountCode], companyId);
        const cashAccount = accs.get("1-1001")!;
        const expenseAccount = accs.get(expenseAccountCode)!;

        lines.push({
          accountId: expenseAccount.id,
          description: `${expense.category}: ${expense.description}`,
          debit: expense.amount,
          credit: 0,
        });
        lines.push({
          accountId: cashAccount.id,
          description: `Pengeluaran kas — ${expense.description}`,
          debit: 0,
          credit: expense.amount,
        });
        break;
      }

      default:
        return { error: `Tipe referensi "${referenceType}" tidak dikenali` };
    }

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01)
      return {
        error: `Jurnal tidak seimbang: debit=${totalDebit}, kredit=${totalCredit}`,
      };
    if (lines.length === 0)
      return { error: "Tidak ada entri jurnal yang dihasilkan" };

    const today = new Date();
    const todayPrefix = `JV-${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;

    // Parallel: last entry number + current period
    const [lastEntry, currentPeriod] = await Promise.all([
      prisma.journalEntry.findFirst({
        where: { entryNumber: { startsWith: todayPrefix } },
        orderBy: { entryNumber: "desc" },
        select: { entryNumber: true },
      }),
      prisma.accountingPeriod.findFirst({
        where: {
          startDate: { lte: today },
          endDate: { gte: today },
          status: "OPEN",
        },
        select: { id: true },
      }),
    ]);

    let sequence = 1;
    if (lastEntry) {
      const parts = lastEntry.entryNumber.split("-");
      const lastSeq = parseInt(parts[2] ?? "0", 10);
      if (!isNaN(lastSeq)) sequence = lastSeq + 1;
    }
    const entryNumber = generateEntryNumber(today, sequence);

    const entry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        date: today,
        description,
        reference,
        referenceType,
        referenceId,
        branchId: branchId || null,
        periodId: currentPeriod?.id || null,
        status: "POSTED",
        totalDebit,
        totalCredit,
        createdBy: userId,
        lines: {
          create: lines.map((line, idx) => ({
            accountId: line.accountId,
            description: line.description,
            debit: line.debit,
            credit: line.credit,
            taxType: line.taxType ?? null,
            taxAmount: line.taxAmount ?? null,
            taxBaseAmount: line.taxBaseAmount ?? null,
            sortOrder: idx,
          })),
        },
      },
      include: {
        lines: {
          include: { account: { select: { code: true, name: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    await createAuditLog({
      action: "AUTO_JOURNAL",
      entity: "JournalEntry",
      entityId: entry.id,
      details: { entryNumber, referenceType, referenceId, totalDebit },
    });

    createJournalChangeLog({ journalId: entry.id, action: "CREATED", userId, snapshot: { entryNumber, referenceType, referenceId, status: "POSTED", totalDebit, totalCredit } });

    revalidatePath("/accounting");
    return { entry };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal membuat jurnal otomatis";
    console.error(`[createAutoJournal] ${referenceType}/${referenceId}:`, message);
    return { error: message };
  }
}

// ============================================================
// ACCOUNTING PERIODS
// ============================================================

export async function getAccountingPeriods() {
  const companyId = await getCurrentCompanyId();
  const periods = await prisma.accountingPeriod.findMany({
    where: { companyId },
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { journals: true } },
    },
  });
  return periods;
}

interface CreateAccountingPeriodInput {
  name: string;
  startDate: string;
  endDate: string;
}

export async function createAccountingPeriod(
  data: CreateAccountingPeriodInput,
) {
  await assertMenuActionAccess("accounting-periods", "create");
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };

  if (!data.name?.trim()) {
    return { error: "Nama periode wajib diisi" };
  }

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  if (endDate <= startDate) {
    return { error: "Tanggal akhir harus setelah tanggal awal" };
  }

  const companyId = await getCurrentCompanyId();

  // Check overlapping periods
  const overlapping = await prisma.accountingPeriod.findFirst({
    where: {
      companyId,
      OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
    },
  });
  if (overlapping) {
    return { error: `Periode tumpang tindih dengan "${overlapping.name}"` };
  }

  const period = await prisma.accountingPeriod.create({
    data: {
      name: data.name.trim(),
      startDate,
      endDate,
      status: "OPEN",
      companyId,
    },
  });

  await createAuditLog({
    action: "CREATE",
    entity: "AccountingPeriod",
    entityId: period.id,
    details: {
      name: period.name,
      startDate: data.startDate,
      endDate: data.endDate,
    },
  });

  revalidatePath("/accounting");
  return { period };
}

export async function closePeriod(id: string) {
  await assertMenuActionAccess("accounting-periods", "update");
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };
  const userId = authResult.userId;

  const period = await prisma.accountingPeriod.findUnique({ where: { id } });
  if (!period) return { error: "Periode tidak ditemukan" };
  if (period.status === "CLOSED") return { error: "Periode sudah ditutup" };
  if (period.status === "LOCKED") return { error: "Periode sudah dikunci" };

  // Check for draft journals in this period
  const draftCount = await prisma.journalEntry.count({
    where: { periodId: id, status: "DRAFT" },
  });
  if (draftCount > 0) {
    return {
      error: `Masih ada ${draftCount} jurnal berstatus DRAFT. Posting atau hapus terlebih dahulu.`,
    };
  }

  await prisma.accountingPeriod.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedBy: userId,
      closedAt: new Date(),
    },
  });

  await createAuditLog({
    action: "CLOSE",
    entity: "AccountingPeriod",
    entityId: id,
    details: { name: period.name },
  });

  revalidatePath("/accounting");
  return { success: true };
}

export async function reopenPeriod(id: string) {
  await assertMenuActionAccess("accounting-periods", "update");
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };

  const period = await prisma.accountingPeriod.findUnique({ where: { id } });
  if (!period) return { error: "Periode tidak ditemukan" };
  if (period.status === "OPEN") return { error: "Periode sudah terbuka" };
  if (period.status === "LOCKED")
    return {
      error:
        "Periode sudah dikunci secara permanen. Tidak dapat dibuka kembali.",
    };

  await prisma.accountingPeriod.update({
    where: { id },
    data: {
      status: "OPEN",
      closedBy: null,
      closedAt: null,
    },
  });

  await createAuditLog({
    action: "REOPEN",
    entity: "AccountingPeriod",
    entityId: id,
    details: { name: period.name },
  });

  revalidatePath("/accounting");
  return { success: true };
}

export async function lockPeriod(id: string) {
  await assertMenuActionAccess("accounting-periods", "update");
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };
  const userId = authResult.userId;

  const period = await prisma.accountingPeriod.findUnique({ where: { id } });
  if (!period) return { error: "Periode tidak ditemukan" };
  if (period.status === "LOCKED") return { error: "Periode sudah dikunci" };
  if (period.status === "OPEN")
    return { error: "Periode harus ditutup terlebih dahulu sebelum dikunci" };

  // Check for draft journals
  const draftCount = await prisma.journalEntry.count({
    where: { periodId: id, status: "DRAFT" },
  });
  if (draftCount > 0) {
    return { error: `Masih ada ${draftCount} jurnal berstatus DRAFT.` };
  }

  await prisma.accountingPeriod.update({
    where: { id },
    data: {
      status: "LOCKED",
      closedBy: userId,
      closedAt: new Date(),
    },
  });

  await createAuditLog({
    action: "LOCK",
    entity: "AccountingPeriod",
    entityId: id,
    details: { name: period.name, permanent: true },
  });

  revalidatePath("/accounting");
  return { success: true };
}

// ============================================================
// RECURRING JOURNAL TEMPLATES
// ============================================================

export async function getRecurringTemplates(params?: { page?: number; perPage?: number }) {
  const companyId = await getCurrentCompanyId();
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;
  const [templates, total] = await Promise.all([
    prisma.recurringJournalTemplate.findMany({
      where: { companyId },
      include: {
        lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { sortOrder: "asc" } },
        branch: { select: { name: true } },
        createdByUser: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.recurringJournalTemplate.count({ where: { companyId } }),
  ]);
  return { templates, total, totalPages: Math.ceil(total / perPage) };
}

export async function createRecurringTemplate(data: {
  name: string;
  description?: string | undefined;
  frequency: string;
  dayOfMonth?: number | undefined;
  branchId?: string | undefined;
  lines: { accountId: string; description?: string | undefined; debit: number; credit: number }[];
}) {
  await assertMenuActionAccess("accounting-recurring", "create");
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };

  if (!data.lines.length || data.lines.length < 2) return { error: "Minimal 2 baris jurnal" };
  const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) return { error: "Total debit dan kredit harus seimbang" };

  // Calculate next run date
  const now = new Date();
  const day = data.dayOfMonth ?? 1;
  let nextRun = new Date(now.getFullYear(), now.getMonth(), day);
  if (nextRun <= now) {
    if (data.frequency === "MONTHLY") nextRun.setMonth(nextRun.getMonth() + 1);
    else if (data.frequency === "QUARTERLY") nextRun.setMonth(nextRun.getMonth() + 3);
    else if (data.frequency === "YEARLY") nextRun.setFullYear(nextRun.getFullYear() + 1);
  }

  const template = await prisma.recurringJournalTemplate.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      frequency: data.frequency,
      dayOfMonth: day,
      nextRunDate: nextRun,
      companyId,
      branchId: data.branchId ?? null,
      createdBy: authResult.userId,
      lines: {
        create: data.lines.map((l, i) => ({
          accountId: l.accountId,
          description: l.description ?? null,
          debit: l.debit,
          credit: l.credit,
          sortOrder: i,
        })),
      },
    },
  });

  revalidatePath("/accounting/recurring");
  return { success: true, id: template.id };
}

export async function deleteRecurringTemplate(id: string) {
  await assertMenuActionAccess("accounting-recurring", "delete");
  const companyId = await getCurrentCompanyId();
  const template = await prisma.recurringJournalTemplate.findFirst({ where: { id, companyId } });
  if (!template) return { error: "Template tidak ditemukan" };
  await prisma.recurringJournalTemplate.delete({ where: { id } });
  revalidatePath("/accounting/recurring");
  return { success: true };
}

export async function toggleRecurringTemplate(id: string) {
  const companyId = await getCurrentCompanyId();
  const template = await prisma.recurringJournalTemplate.findFirst({ where: { id, companyId } });
  if (!template) return { error: "Template tidak ditemukan" };
  await prisma.recurringJournalTemplate.update({ where: { id }, data: { isActive: !template.isActive } });
  revalidatePath("/accounting/recurring");
  return { success: true };
}

export async function executeRecurringJournals() {
  const companyId = await getCurrentCompanyId();
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };

  const today = new Date();
  const templates = await prisma.recurringJournalTemplate.findMany({
    where: { companyId, isActive: true, nextRunDate: { lte: today } },
    include: { lines: true },
  });

  let created = 0;
  let failed = 0;

  for (const tmpl of templates) {
    try {
      const todayDate = new Date();
      const prefix = `JV-${todayDate.getFullYear().toString().slice(-2)}${(todayDate.getMonth() + 1).toString().padStart(2, "0")}${todayDate.getDate().toString().padStart(2, "0")}`;
      const last = await prisma.journalEntry.findFirst({ where: { entryNumber: { startsWith: prefix } }, orderBy: { entryNumber: "desc" }, select: { entryNumber: true } });
      let seq = 1;
      if (last) { const s = parseInt(last.entryNumber.split("-")[2] ?? "0"); if (!isNaN(s)) seq = s + 1; }
      const entryNumber = generateEntryNumber(todayDate, seq);

      const totalDebit = tmpl.lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = tmpl.lines.reduce((s, l) => s + l.credit, 0);

      await prisma.journalEntry.create({
        data: {
          entryNumber,
          date: todayDate,
          description: `[Recurring] ${tmpl.name}`,
          reference: `REC-${tmpl.id.slice(0, 8)}`,
          referenceType: "RECURRING",
          branchId: tmpl.branchId,
          status: "POSTED",
          totalDebit,
          totalCredit,
          createdBy: authResult.userId,
          lines: {
            create: tmpl.lines.map((l, i) => ({
              accountId: l.accountId,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
              sortOrder: i,
            })),
          },
        },
      });

      // Advance next run date
      const next = new Date(tmpl.nextRunDate);
      if (tmpl.frequency === "MONTHLY") next.setMonth(next.getMonth() + 1);
      else if (tmpl.frequency === "QUARTERLY") next.setMonth(next.getMonth() + 3);
      else if (tmpl.frequency === "YEARLY") next.setFullYear(next.getFullYear() + 1);

      await prisma.recurringJournalTemplate.update({
        where: { id: tmpl.id },
        data: { lastRunDate: todayDate, nextRunDate: next },
      });
      created++;
    } catch {
      failed++;
    }
  }

  revalidatePath("/accounting");
  return { created, failed, total: templates.length };
}

// ============================================================
// SEED DEFAULT COA
// ============================================================

export async function seedDefaultCOA() {
  const companyId = await getCurrentCompanyId();
  const existingCategories = await prisma.accountCategory.count({
    where: { companyId },
  });
  if (existingCategories > 0) {
    return { message: "Default COA already exists. Skipping seed." };
  }

  const categories = [
    { name: "Aset", type: "ASSET", normalSide: "DEBIT", sortOrder: 1 },
    {
      name: "Kewajiban",
      type: "LIABILITY",
      normalSide: "CREDIT",
      sortOrder: 2,
    },
    { name: "Modal", type: "EQUITY", normalSide: "CREDIT", sortOrder: 3 },
    { name: "Pendapatan", type: "REVENUE", normalSide: "CREDIT", sortOrder: 4 },
    { name: "Beban", type: "EXPENSE", normalSide: "DEBIT", sortOrder: 5 },
  ];

  const createdCategories = await prisma.$transaction(
    categories.map((cat) => prisma.accountCategory.create({ data: { ...cat, companyId } })),
  );

  const categoryMap = new Map(createdCategories.map((c) => [c.type, c.id]));

  const systemAccounts = [
    {
      code: "1-1001",
      name: "Kas",
      categoryType: "ASSET",
      description: "Kas tunai",
    },
    {
      code: "1-1002",
      name: "Bank",
      categoryType: "ASSET",
      description: "Rekening bank",
    },
    {
      code: "1-1003",
      name: "Piutang Dagang",
      categoryType: "ASSET",
      description: "Piutang dari pelanggan",
    },
    {
      code: "1-1004",
      name: "Persediaan Barang",
      categoryType: "ASSET",
      description: "Persediaan barang dagangan",
    },
    {
      code: "2-1001",
      name: "Hutang Dagang",
      categoryType: "LIABILITY",
      description: "Hutang ke supplier",
    },
    {
      code: "4-1001",
      name: "Pendapatan Penjualan",
      categoryType: "REVENUE",
      description: "Pendapatan dari penjualan barang",
    },
    {
      code: "4-1002",
      name: "Retur Penjualan",
      categoryType: "REVENUE",
      description: "Contra revenue — retur penjualan",
    },
    {
      code: "5-1001",
      name: "Harga Pokok Penjualan",
      categoryType: "EXPENSE",
      description: "HPP / COGS",
    },
    {
      code: "5-1002",
      name: "Beban Operasional",
      categoryType: "EXPENSE",
      description: "Beban operasional umum",
    },
    {
      code: "5-1003",
      name: "Beban Gaji",
      categoryType: "EXPENSE",
      description: "Beban gaji karyawan",
    },
    // Tax accounts
    {
      code: "2-1100",
      name: "PPN Keluaran",
      categoryType: "LIABILITY",
      description: "PPN yang dipungut dari penjualan",
    },
    {
      code: "1-1100",
      name: "PPN Masukan",
      categoryType: "ASSET",
      description: "PPN yang dibayar atas pembelian",
    },
    {
      code: "2-1200",
      name: "Hutang PPh 21",
      categoryType: "LIABILITY",
      description: "PPh 21 yang dipotong dari gaji",
    },
    {
      code: "2-1201",
      name: "Hutang PPh 23",
      categoryType: "LIABILITY",
      description: "PPh 23 atas jasa/sewa",
    },
    {
      code: "5-1010",
      name: "Beban PPh 23",
      categoryType: "EXPENSE",
      description: "Beban pajak PPh 23",
    },
  ];

  await prisma.$transaction(
    systemAccounts.map((acc) =>
      prisma.account.create({
        data: {
          code: acc.code,
          name: acc.name,
          description: acc.description,
          categoryId: categoryMap.get(acc.categoryType)!,
          isSystem: true,
          isActive: true,
          openingBalance: 0,
        },
      }),
    ),
  );

  return {
    message: "Default COA seeded successfully",
    categoriesCreated: categories.length,
    accountsCreated: systemAccounts.length,
  };
}

// ============================================================
// BACKFILL JOURNALS — create missing journals for existing transactions
// ============================================================

export async function backfillJournals() {
  const companyId = await getCurrentCompanyId();

  // Find all transactions that don't have a journal yet
  const existingRefs = await prisma.journalEntry.findMany({
    where: { branch: { companyId } },
    select: { reference: true },
  });
  const refSet = new Set(existingRefs.map((r) => r.reference).filter(Boolean));

  // Transactions
  const transactions = await prisma.transaction.findMany({
    where: { companyId, status: "COMPLETED" },
    select: { id: true, invoiceNumber: true },
  });
  let created = 0;
  let failed = 0;

  for (const txn of transactions) {
    if (refSet.has(txn.invoiceNumber)) continue;
    try {
      await createAutoJournal({ referenceType: "TRANSACTION", referenceId: txn.id });
      created++;
    } catch { failed++; }
  }

  // Expenses
  const expenses = await prisma.expense.findMany({
    where: { companyId },
    select: { id: true },
  });
  for (const exp of expenses) {
    try {
      await createAutoJournal({ referenceType: "EXPENSE", referenceId: exp.id });
      created++;
    } catch { failed++; }
  }

  // Purchase Orders (received)
  const pos = await prisma.purchaseOrder.findMany({
    where: { companyId, status: { in: ["RECEIVED", "PARTIAL", "CLOSED"] } },
    select: { id: true },
  });
  for (const po of pos) {
    try {
      await createAutoJournal({ referenceType: "PURCHASE", referenceId: po.id });
      created++;
    } catch { failed++; }
  }

  revalidatePath("/accounting");
  return { created, failed, message: `Backfill selesai: ${created} jurnal dibuat, ${failed} gagal` };
}
