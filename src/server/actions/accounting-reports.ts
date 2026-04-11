"use server";

import { prisma, shouldUseAccelerate } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { getCurrentCompanyId } from "@/lib/company";

// ===========================
// HELPERS
// ===========================

function branchSQL(
  branchId: string | undefined,
  alias: string | undefined,
  paramIndex: number,
): { condition: string; params: unknown[] } {
  if (!branchId) return { condition: "", params: [] };
  const prefix = alias ? `${alias}.` : "";
  return {
    condition: ` AND ${prefix}"branchId" = $${paramIndex}`,
    params: [branchId],
  };
}

function toDate(iso: string): Date {
  return new Date(iso);
}

function endOfDay(iso: string): Date {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ===========================
// 1. BUKU BESAR (General Ledger)
// ===========================

interface GeneralLedgerParams {
  accountId: string;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}

interface LedgerEntry {
  date: Date;
  entryNumber: string;
  description: string;
  lineDescription: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

export async function getGeneralLedger(params: GeneralLedgerParams) {
  const companyId = await getCurrentCompanyId();
  const { accountId, dateFrom, dateTo, branchId } = params;

  const from = dateFrom ? toDate(dateFrom) : new Date("2000-01-01");
  const to = dateTo ? endOfDay(dateTo) : new Date("2099-12-31");

  const priorBranch = branchSQL(branchId, "je", 3);
  const entriesBranch = branchSQL(branchId, "je", 4);

  // Parallelkan semua 3 query sekaligus
  const [account, priorMovements, entries] = await Promise.all([
    prisma.account.findFirst({
      where: { id: accountId, category: { companyId } },
      include: { category: true },
    }),

    prisma.$queryRawUnsafe<{ totalDebit: number; totalCredit: number }[]>(
      `
        SELECT
          COALESCE(SUM(jel.debit), 0)::float AS "totalDebit",
          COALESCE(SUM(jel.credit), 0)::float AS "totalCredit"
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel."journalId"
        WHERE jel."accountId" = $1
          AND je.status = 'POSTED'
          AND je.date < $2
          ${priorBranch.condition}
        `,
      accountId,
      from,
      ...priorBranch.params,
    ),

    prisma.$queryRawUnsafe<
      {
        date: Date;
        entryNumber: string;
        description: string;
        lineDescription: string | null;
        debit: number;
        credit: number;
      }[]
    >(
      `
        SELECT
          je.date,
          je."entryNumber",
          je.description,
          jel.description AS "lineDescription",
          jel.debit::float AS debit,
          jel.credit::float AS credit
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel."journalId"
        WHERE jel."accountId" = $1
          AND je.status = 'POSTED'
          AND je.date >= $2
          AND je.date <= $3
          ${entriesBranch.condition}
        ORDER BY je.date ASC, je."createdAt" ASC
        `,
      accountId,
      from,
      to,
      ...entriesBranch.params,
    ),
  ]);

  if (!account) throw new Error("Akun tidak ditemukan");

  const normalSide = account.category.normalSide;
  const priorDebit = priorMovements[0]?.totalDebit ?? 0;
  const priorCredit = priorMovements[0]?.totalCredit ?? 0;

  let openingBalance = account.openingBalance;
  if (normalSide === "DEBIT") {
    openingBalance += priorDebit - priorCredit;
  } else {
    openingBalance += priorCredit - priorDebit;
  }

  let runningBalance = openingBalance;
  const ledgerEntries: LedgerEntry[] = entries.map((e) => {
    if (normalSide === "DEBIT") {
      runningBalance += e.debit - e.credit;
    } else {
      runningBalance += e.credit - e.debit;
    }
    return {
      date: e.date,
      entryNumber: e.entryNumber,
      description: e.lineDescription || e.description,
      lineDescription: e.lineDescription,
      debit: e.debit,
      credit: e.credit,
      runningBalance: Math.round(runningBalance * 100) / 100,
    };
  });

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      categoryType: account.category.type,
      categoryName: account.category.name,
      normalSide,
    },
    openingBalance,
    entries: ledgerEntries,
    closingBalance: Math.round(runningBalance * 100) / 100,
    totalDebit:
      Math.round(entries.reduce((s, e) => s + e.debit, 0) * 100) / 100,
    totalCredit:
      Math.round(entries.reduce((s, e) => s + e.credit, 0) * 100) / 100,
  };
}

// ===========================
// 2. NERACA SALDO (Trial Balance)
// ===========================

interface TrialBalanceParams {
  date?: string; // up to this date
  branchId?: string;
}

interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  categoryType: string;
  categoryName: string;
  normalSide: string;
  debit: number;
  credit: number;
}

export async function getTrialBalance(params: TrialBalanceParams = {}) {
  const companyId = await getCurrentCompanyId();
  const { date, branchId } = params;
  const upTo = date ? endOfDay(date) : new Date("2099-12-31");

  const tbBranch = branchSQL(branchId, "je", 2);
  const acctBranchIdx = 2 + tbBranch.params.length + 1;
  const acctBranchCondition = branchId
    ? `AND (a."branchId" = $${acctBranchIdx} OR a."branchId" IS NULL)`
    : "";
  const acctBranchParams = branchId ? [branchId] : [];
  const companyIdx = 2 + tbBranch.params.length + acctBranchParams.length;

  // 1 query: accounts + movements di-join langsung di DB
  const rows = await prisma.$queryRawUnsafe<
    {
      accountId: string;
      accountCode: string;
      accountName: string;
      categoryType: string;
      categoryName: string;
      normalSide: string;
      openingBalance: number;
      totalDebit: number;
      totalCredit: number;
      isActive: boolean;
    }[]
  >(
    `
      SELECT
        a.id AS "accountId",
        a.code AS "accountCode",
        a.name AS "accountName",
        ac.type AS "categoryType",
        ac.name AS "categoryName",
        ac."normalSide",
        a."openingBalance"::float AS "openingBalance",
        COALESCE(SUM(jel.debit), 0)::float AS "totalDebit",
        COALESCE(SUM(jel.credit), 0)::float AS "totalCredit"
      FROM accounts a
      JOIN account_categories ac ON ac.id = a."categoryId"
      LEFT JOIN journal_entry_lines jel ON jel."accountId" = a.id
      LEFT JOIN journal_entries je ON je.id = jel."journalId"
        AND je.status = 'POSTED'
        AND je.date <= $1
        ${tbBranch.condition}
      WHERE a."isActive" = true
        AND ac."companyId" = $${companyIdx}
        ${acctBranchCondition}
      GROUP BY a.id, a.code, a.name, ac.type, ac.name, ac."normalSide", a."openingBalance"
      ORDER BY a.code ASC
      `,
    upTo,
    ...tbBranch.params,
    ...acctBranchParams,
    companyId,
  );

  let grandTotalDebit = 0;
  let grandTotalCredit = 0;

  const result: TrialBalanceRow[] = rows.map((row) => {
    const { normalSide, openingBalance, totalDebit, totalCredit } = row;

    let netBalance = openingBalance;
    if (normalSide === "DEBIT") {
      netBalance += totalDebit - totalCredit;
    } else {
      netBalance += totalCredit - totalDebit;
    }

    let debit = 0;
    let credit = 0;

    if (netBalance >= 0) {
      if (normalSide === "DEBIT") debit = netBalance;
      else credit = netBalance;
    } else {
      if (normalSide === "DEBIT") credit = Math.abs(netBalance);
      else debit = Math.abs(netBalance);
    }

    grandTotalDebit += debit;
    grandTotalCredit += credit;

    return {
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      categoryType: row.categoryType,
      categoryName: row.categoryName,
      normalSide,
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
    };
  });

  grandTotalDebit = Math.round(grandTotalDebit * 100) / 100;
  grandTotalCredit = Math.round(grandTotalCredit * 100) / 100;

  return {
    rows: result,
    totalDebit: grandTotalDebit,
    totalCredit: grandTotalCredit,
    isBalanced: Math.abs(grandTotalDebit - grandTotalCredit) < 0.01,
    difference: grandTotalDebit - grandTotalCredit,
    asOfDate: date ?? new Date().toISOString().split("T")[0],
  };
}

// ===========================
// 3. LAPORAN LABA RUGI (Income Statement)
// ===========================

interface IncomeStatementParams {
  dateFrom: string;
  dateTo: string;
  branchId?: string;
}

interface IncomeStatementAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: number;
}

export async function getIncomeStatement(params: IncomeStatementParams) {
  const companyId = await getCurrentCompanyId();
  const { dateFrom, dateTo, branchId } = params;
  const from = toDate(dateFrom);
  const to = endOfDay(dateTo);
  const isBranch = branchSQL(branchId, "je", 3);
  const companyIdx = 3 + isBranch.params.length;

  // Gabungkan revenue + expense jadi 1 query, pivot di JS
  const allRows = await prisma.$queryRawUnsafe<
    {
      accountId: string;
      code: string;
      name: string;
      type: string;
      amount: number;
    }[]
  >(
    `
      SELECT
        a.id AS "accountId",
        a.code,
        a.name,
        ac.type,
        CASE
          WHEN ac.type = 'REVENUE' THEN (COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0))
          WHEN ac.type = 'EXPENSE' THEN (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))
        END::float AS amount
      FROM accounts a
      JOIN account_categories ac ON ac.id = a."categoryId"
      LEFT JOIN journal_entry_lines jel ON jel."accountId" = a.id
      LEFT JOIN journal_entries je ON je.id = jel."journalId"
        AND je.status = 'POSTED'
        AND je.date >= $1
        AND je.date <= $2
        ${isBranch.condition}
      WHERE ac.type IN ('REVENUE', 'EXPENSE')
        AND a."isActive" = true
        AND ac."companyId" = $${companyIdx}
      GROUP BY a.id, a.code, a.name, ac.type
      ORDER BY a.code ASC
      `,
    from,
    to,
    ...isBranch.params,
    companyId,
  );

  const revenues: IncomeStatementAccount[] = allRows
    .filter((r) => r.type === "REVENUE" && r.amount !== 0)
    .map((r) => ({
      accountId: r.accountId,
      accountCode: r.code,
      accountName: r.name,
      amount: r.amount,
    }));

  const expenses: IncomeStatementAccount[] = allRows
    .filter((r) => r.type === "EXPENSE" && r.amount !== 0)
    .map((r) => ({
      accountId: r.accountId,
      accountCode: r.code,
      accountName: r.name,
      amount: r.amount,
    }));

  const totalRevenue =
    Math.round(revenues.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const totalExpense =
    Math.round(expenses.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const netIncome = Math.round((totalRevenue - totalExpense) * 100) / 100;

  return {
    period: { dateFrom, dateTo },
    revenues,
    totalRevenue,
    expenses,
    totalExpense,
    netIncome,
    isProfit: netIncome >= 0,
  };
}

// ===========================
// 4. NERACA KEUANGAN (Balance Sheet)
// ===========================

interface BalanceSheetParams {
  date: string;
  branchId?: string;
}

interface BalanceSheetAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: number;
}

interface BalanceSheetGroup {
  categoryName: string;
  accounts: BalanceSheetAccount[];
  total: number;
}

export async function getBalanceSheet(params: BalanceSheetParams) {
  const companyId = await getCurrentCompanyId();
  const { date, branchId } = params;
  const upTo = endOfDay(date);
  const bsBranch = branchSQL(branchId, "je", 2);
  const companyIdx = 2 + bsBranch.params.length;

  // Parallelkan kedua query yang sebelumnya serial
  const [accountBalances, retainedEarningsResult] = await Promise.all([
    prisma.$queryRawUnsafe<
      {
        accountId: string;
        code: string;
        name: string;
        categoryType: string;
        categoryName: string;
        normalSide: string;
        openingBalance: number;
        totalDebit: number;
        totalCredit: number;
      }[]
    >(
      `
        SELECT
          a.id AS "accountId",
          a.code,
          a.name,
          ac.type AS "categoryType",
          ac.name AS "categoryName",
          ac."normalSide",
          a."openingBalance"::float AS "openingBalance",
          COALESCE(SUM(jel.debit), 0)::float AS "totalDebit",
          COALESCE(SUM(jel.credit), 0)::float AS "totalCredit"
        FROM accounts a
        JOIN account_categories ac ON ac.id = a."categoryId"
        LEFT JOIN journal_entry_lines jel ON jel."accountId" = a.id
        LEFT JOIN journal_entries je ON je.id = jel."journalId"
          AND je.status = 'POSTED'
          AND je.date <= $1
          ${bsBranch.condition}
        WHERE a."isActive" = true
          AND ac.type IN ('ASSET', 'LIABILITY', 'EQUITY')
          AND ac."companyId" = $${companyIdx}
        GROUP BY a.id, a.code, a.name, ac.type, ac.name, ac."normalSide", a."openingBalance"
        ORDER BY a.code ASC
        `,
      upTo,
      ...bsBranch.params,
      companyId,
    ),

    prisma.$queryRawUnsafe<{ revenue: number; expense: number }[]>(
      `
        SELECT
          COALESCE(SUM(CASE WHEN ac.type = 'REVENUE' THEN jel.credit - jel.debit ELSE 0 END), 0)::float AS revenue,
          COALESCE(SUM(CASE WHEN ac.type = 'EXPENSE' THEN jel.debit - jel.credit ELSE 0 END), 0)::float AS expense
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel."journalId"
        JOIN accounts a ON a.id = jel."accountId"
        JOIN account_categories ac ON ac.id = a."categoryId"
        WHERE je.status = 'POSTED'
          AND je.date <= $1
          AND ac.type IN ('REVENUE', 'EXPENSE')
          AND ac."companyId" = $${companyIdx}
          ${bsBranch.condition}
        `,
      upTo,
      ...bsBranch.params,
      companyId,
    ),
  ]);

  const retainedEarnings =
    Math.round(
      ((retainedEarningsResult[0]?.revenue ?? 0) -
        (retainedEarningsResult[0]?.expense ?? 0)) *
        100,
    ) / 100;

  // FIX BUG: key pakai composite "categoryType::categoryName" bukan hanya categoryType
  // Supaya ASSET Lancar dan ASSET Tetap tidak tercampur jadi satu grup
  const groupMap: Record<
    string,
    {
      categoryType: string;
      categoryName: string;
      accounts: BalanceSheetAccount[];
      total: number;
    }
  > = {};

  for (const row of accountBalances) {
    let balance = row.openingBalance;
    if (row.normalSide === "DEBIT") {
      balance += row.totalDebit - row.totalCredit;
    } else {
      balance += row.totalCredit - row.totalDebit;
    }
    balance = Math.round(balance * 100) / 100;

    const key = `${row.categoryType}::${row.categoryName}`;
    if (!groupMap[key]) {
      groupMap[key] = {
        categoryType: row.categoryType,
        categoryName: row.categoryName,
        accounts: [],
        total: 0,
      };
    }

    if (balance !== 0) {
      groupMap[key]!.accounts.push({
        accountId: row.accountId,
        accountCode: row.code,
        accountName: row.name,
        balance,
      });
      groupMap[key]!.total += balance;
    }
  }

  // Tambah retained earnings ke EQUITY
  const equityKey =
    Object.keys(groupMap).find((k) => k.startsWith("EQUITY::")) ??
    "EQUITY::Modal";
  if (!groupMap[equityKey]) {
    groupMap[equityKey] = {
      categoryType: "EQUITY",
      categoryName: "Modal",
      accounts: [],
      total: 0,
    };
  }
  if (retainedEarnings !== 0) {
    groupMap[equityKey]!.accounts.push({
      accountId: "retained-earnings",
      accountCode: "-",
      accountName: "Laba Ditahan",
      balance: retainedEarnings,
    });
    groupMap[equityKey]!.total += retainedEarnings;
  }

  // Aggregasi per categoryType untuk return values
  const allGroups = Object.values(groupMap);
  const assetGroups = allGroups.filter((g) => g.categoryType === "ASSET");
  const liabilityGroups = allGroups.filter(
    (g) => g.categoryType === "LIABILITY",
  );
  const equityGroups = allGroups.filter((g) => g.categoryType === "EQUITY");

  const totalAssets =
    Math.round(assetGroups.reduce((s, g) => s + g.total, 0) * 100) / 100;
  const totalLiabilities =
    Math.round(liabilityGroups.reduce((s, g) => s + g.total, 0) * 100) / 100;
  const totalEquity =
    Math.round(equityGroups.reduce((s, g) => s + g.total, 0) * 100) / 100;
  const totalLiabilitiesAndEquity =
    Math.round((totalLiabilities + totalEquity) * 100) / 100;

  const assets: BalanceSheetGroup = {
    categoryName: "Aset",
    accounts: assetGroups.flatMap((g) => g.accounts),
    total: totalAssets,
  };
  const liabilities: BalanceSheetGroup = {
    categoryName: "Kewajiban",
    accounts: liabilityGroups.flatMap((g) => g.accounts),
    total: totalLiabilities,
  };
  const equity: BalanceSheetGroup = {
    categoryName: "Ekuitas",
    accounts: equityGroups.flatMap((g) => g.accounts),
    total: totalEquity,
  };

  return {
    asOfDate: date,
    assets,
    liabilities,
    equity,
    assetGroups, // breaking change: sekarang array of groups, bukan single group
    liabilityGroups,
    equityGroups,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    retainedEarnings,
    isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    difference:
      Math.round((totalAssets - totalLiabilitiesAndEquity) * 100) / 100,
  };
}

// ===========================
// 5. ARUS KAS (Cash Flow Statement)
// ===========================

interface CashFlowParams {
  dateFrom: string;
  dateTo: string;
  branchId?: string;
}

interface CashFlowItem {
  description: string;
  amount: number;
  entryNumber?: string;
  date?: Date;
}

export async function getCashFlow(params: CashFlowParams) {
  const companyId = await getCurrentCompanyId();
  const { dateFrom, dateTo, branchId } = params;
  const from = toDate(dateFrom);
  const to = endOfDay(dateTo);

  const cfBranch = branchSQL(branchId, "je", 2);
  const cfRangeBranch = branchSQL(branchId, "je", 3);
  const companyIdxOpening = 2 + cfBranch.params.length;
  const companyIdxRange = 3 + cfRangeBranch.params.length;

  // Parallelkan semua 3 query sekaligus
  const [openingCashResult, cashMovements] = await Promise.all([
    prisma.$queryRawUnsafe<{ balance: number }[]>(
      `
        SELECT
          COALESCE(SUM(
            a."openingBalance" + COALESCE(mv."totalDebit", 0) - COALESCE(mv."totalCredit", 0)
          ), 0)::float AS balance
        FROM accounts a
        JOIN account_categories ac ON ac.id = a."categoryId"
        LEFT JOIN (
          SELECT
            jel."accountId",
            SUM(jel.debit)::float AS "totalDebit",
            SUM(jel.credit)::float AS "totalCredit"
          FROM journal_entry_lines jel
          JOIN journal_entries je ON je.id = jel."journalId"
          WHERE je.status = 'POSTED'
            AND je.date < $1
            ${cfBranch.condition}
          GROUP BY jel."accountId"
        ) mv ON mv."accountId" = a.id
        WHERE ac.type = 'ASSET'
          AND (a.code LIKE '1-1001%' OR a.code LIKE '1-1002%')
          AND a."isActive" = true
          AND ac."companyId" = $${companyIdxOpening}
        `,
      from,
      ...cfBranch.params,
      companyId,
    ),

    // Gabungkan cashIn + cashOut jadi 1 query dengan kolom "direction"
    prisma.$queryRawUnsafe<
      {
        entryNumber: string;
        date: Date;
        description: string;
        lineDescription: string | null;
        debitAmount: number;
        creditAmount: number;
        referenceType: string | null;
      }[]
    >(
      `
        SELECT
          je."entryNumber",
          je.date,
          je.description,
          jel.description AS "lineDescription",
          jel.debit::float AS "debitAmount",
          jel.credit::float AS "creditAmount",
          je."referenceType"
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel."journalId"
        JOIN accounts a ON a.id = jel."accountId"
        JOIN account_categories ac ON ac.id = a."categoryId"
        WHERE je.status = 'POSTED'
          AND je.date >= $1
          AND je.date <= $2
          AND (a.code LIKE '1-1001%' OR a.code LIKE '1-1002%')
          AND (jel.debit > 0 OR jel.credit > 0)
          AND ac."companyId" = $${companyIdxRange}
          ${cfRangeBranch.condition}
        ORDER BY je.date ASC, je."createdAt" ASC
        `,
      from,
      to,
      ...cfRangeBranch.params,
      companyId,
    ),
  ]);

  const openingCash = openingCashResult[0]?.balance ?? 0;

  const cashIn: CashFlowItem[] = [];
  const cashOut: CashFlowItem[] = [];

  for (const r of cashMovements) {
    const desc = r.lineDescription || r.description;
    if (r.debitAmount > 0) {
      cashIn.push({
        description: desc,
        amount: r.debitAmount,
        entryNumber: r.entryNumber,
        date: r.date,
      });
    }
    if (r.creditAmount > 0) {
      cashOut.push({
        description: desc,
        amount: r.creditAmount,
        entryNumber: r.entryNumber,
        date: r.date,
      });
    }
  }

  const totalCashIn =
    Math.round(cashIn.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const totalCashOut =
    Math.round(cashOut.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const netCashFlow = Math.round((totalCashIn - totalCashOut) * 100) / 100;
  const closingCash = Math.round((openingCash + netCashFlow) * 100) / 100;

  const cashInByType = summarizeCashByType(
    cashMovements
      .filter((r) => r.debitAmount > 0)
      .map((r) => ({ referenceType: r.referenceType, amount: r.debitAmount })),
  );
  const cashOutByType = summarizeCashByType(
    cashMovements
      .filter((r) => r.creditAmount > 0)
      .map((r) => ({ referenceType: r.referenceType, amount: r.creditAmount })),
  );

  return {
    period: { dateFrom, dateTo },
    openingCash,
    cashIn,
    totalCashIn,
    cashOut,
    totalCashOut,
    netCashFlow,
    closingCash,
    cashInByType,
    cashOutByType,
  };
}

function summarizeCashByType(
  rows: { referenceType: string | null; amount: number }[], // hapus 'description'
): { type: string; description: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const type = r.referenceType || "LAINNYA";
    map.set(type, (map.get(type) ?? 0) + r.amount);
  }

  const labels: Record<string, string> = {
    TRANSACTION: "Penjualan",
    PURCHASE: "Pembelian",
    RETURN: "Retur",
    DEBT_PAYMENT: "Pembayaran Hutang/Piutang",
    EXPENSE: "Pengeluaran Operasional",
    MANUAL: "Jurnal Manual",
    LAINNYA: "Lainnya",
  };

  return Array.from(map.entries()).map(([type, amount]) => ({
    type,
    description: labels[type] ?? type,
    amount: Math.round(amount * 100) / 100,
  }));
}
// ===========================
// 6. DASHBOARD AKUNTANSI
// ===========================

async function getAccountingDashboardUncached(branchId: string | undefined, companyId: string) {
  const cacheTags = ["accounting_dashboard"];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // For queries with 0 positional params, branchId is $1
  const branchCond0 = branchSQL(branchId, "je", 1);
  // For queries with 2 positional params ($1, $2), branchId is $3
  const branchCond2 = branchSQL(branchId, "je", 3);
  const companyIdx0 = 1 + branchCond0.params.length;
  const companyIdx2 = 3 + branchCond2.params.length;

  const recentJournalInclude = {
    lines: {
      include: { account: { select: { code: true, name: true } } },
      orderBy: { sortOrder: "asc" as const },
    },
    createdByUser: { select: { name: true } },
  } as const;

  type RecentJournal = Prisma.JournalEntryGetPayload<{
    include: typeof recentJournalInclude;
  }>;

  const [
    cashBalance,
    receivableBalance,
    payableBalance,
    todayPnL,
    monthPnL,
    revenueTrend,
    topExpenses,
    recentJournals,
  ] = await Promise.all([
    // Total Kas (cash accounts: 1-1001*, 1-1002*)
    prisma.$queryRawUnsafe<{ balance: number }[]>(
      `
      SELECT COALESCE(SUM(
        a."openingBalance" + COALESCE(mv.net, 0)
      ), 0)::float AS balance
      FROM accounts a
      JOIN account_categories ac ON ac.id = a."categoryId"
      LEFT JOIN (
        SELECT jel."accountId", SUM(jel.debit - jel.credit)::float AS net
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel."journalId"
        WHERE je.status = 'POSTED' ${branchCond0.condition}
        GROUP BY jel."accountId"
      ) mv ON mv."accountId" = a.id
      WHERE (a.code LIKE '1-1001%' OR a.code LIKE '1-1002%')
        AND a."isActive" = true
        AND ac."companyId" = $${companyIdx0}
      `,
      ...branchCond0.params,
      companyId,
    ),

    // Total Piutang (receivable: typically code 1-1003*)
    prisma.$queryRawUnsafe<{ balance: number }[]>(
      `
      SELECT COALESCE(SUM(
        a."openingBalance" + COALESCE(mv.net, 0)
      ), 0)::float AS balance
      FROM accounts a
      JOIN account_categories ac ON ac.id = a."categoryId"
      LEFT JOIN (
        SELECT jel."accountId", SUM(jel.debit - jel.credit)::float AS net
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel."journalId"
        WHERE je.status = 'POSTED' ${branchCond0.condition}
        GROUP BY jel."accountId"
      ) mv ON mv."accountId" = a.id
      WHERE a.code LIKE '1-1003%'
        AND a."isActive" = true
        AND ac."companyId" = $${companyIdx0}
      `,
      ...branchCond0.params,
      companyId,
    ),

    // Total Hutang (payable: liability accounts code 2-%)
    prisma.$queryRawUnsafe<{ balance: number }[]>(
      `
      SELECT COALESCE(SUM(
        a."openingBalance" + COALESCE(mv.net, 0)
      ), 0)::float AS balance
      FROM accounts a
      JOIN account_categories ac ON ac.id = a."categoryId"
      LEFT JOIN (
        SELECT jel."accountId", SUM(jel.credit - jel.debit)::float AS net
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel."journalId"
        WHERE je.status = 'POSTED' ${branchCond0.condition}
        GROUP BY jel."accountId"
      ) mv ON mv."accountId" = a.id
      WHERE ac.type = 'LIABILITY'
        AND a."isActive" = true
        AND ac."companyId" = $${companyIdx0}
      `,
      ...branchCond0.params,
      companyId,
    ),

    // Laba Hari Ini
    prisma.$queryRawUnsafe<{ revenue: number; expense: number }[]>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN ac.type = 'REVENUE' THEN jel.credit - jel.debit ELSE 0 END), 0)::float AS revenue,
        COALESCE(SUM(CASE WHEN ac.type = 'EXPENSE' THEN jel.debit - jel.credit ELSE 0 END), 0)::float AS expense
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel."journalId"
      JOIN accounts a ON a.id = jel."accountId"
      JOIN account_categories ac ON ac.id = a."categoryId"
      WHERE je.status = 'POSTED'
        AND je.date >= $1 AND je.date < $2
        AND ac.type IN ('REVENUE', 'EXPENSE')
        AND ac."companyId" = $${companyIdx2}
        ${branchCond2.condition}
      `,
      todayStart,
      todayEnd,
      ...branchCond2.params,
      companyId,
    ),

    // Laba Bulan Ini
    prisma.$queryRawUnsafe<{ revenue: number; expense: number }[]>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN ac.type = 'REVENUE' THEN jel.credit - jel.debit ELSE 0 END), 0)::float AS revenue,
        COALESCE(SUM(CASE WHEN ac.type = 'EXPENSE' THEN jel.debit - jel.credit ELSE 0 END), 0)::float AS expense
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel."journalId"
      JOIN accounts a ON a.id = jel."accountId"
      JOIN account_categories ac ON ac.id = a."categoryId"
      WHERE je.status = 'POSTED'
        AND je.date >= $1 AND je.date < $2
        AND ac.type IN ('REVENUE', 'EXPENSE')
        AND ac."companyId" = $${companyIdx2}
        ${branchCond2.condition}
      `,
      monthStart,
      todayEnd,
      ...branchCond2.params,
      companyId,
    ),

    // Revenue trend last 7 days
    prisma.$queryRawUnsafe<{ date: Date; revenue: number }[]>(
      `
      SELECT
        je.date,
        COALESCE(SUM(jel.credit - jel.debit), 0)::float AS revenue
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel."journalId"
      JOIN accounts a ON a.id = jel."accountId"
      JOIN account_categories ac ON ac.id = a."categoryId"
      WHERE je.status = 'POSTED'
        AND ac.type = 'REVENUE'
        AND je.date >= $1
        AND je.date < $2
        AND ac."companyId" = $${companyIdx2}
        ${branchCond2.condition}
      GROUP BY je.date
      ORDER BY je.date ASC
      `,
      (() => {
        const d = new Date(todayStart);
        d.setDate(d.getDate() - 6);
        return d;
      })(),
      todayEnd,
      ...branchCond2.params,
      companyId,
    ),

    // Top 5 expense accounts this month
    prisma.$queryRawUnsafe<
      { accountCode: string; accountName: string; amount: number }[]
    >(
      `
      SELECT
        a.code AS "accountCode",
        a.name AS "accountName",
        COALESCE(SUM(jel.debit - jel.credit), 0)::float AS amount
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel."journalId"
      JOIN accounts a ON a.id = jel."accountId"
      JOIN account_categories ac ON ac.id = a."categoryId"
      WHERE je.status = 'POSTED'
        AND ac.type = 'EXPENSE'
        AND je.date >= $1 AND je.date < $2
        AND ac."companyId" = $${companyIdx2}
        ${branchCond2.condition}
      GROUP BY a.id, a.code, a.name
      HAVING SUM(jel.debit - jel.credit) > 0
      ORDER BY amount DESC
      LIMIT 5
      `,
      monthStart,
      todayEnd,
      ...branchCond2.params,
      companyId,
    ),

    // Recent 10 journal entries
    prisma.journalEntry.findMany({
      where: {
        status: "POSTED",
        createdByUser: { companyId },
        ...(branchId ? { branchId } : {}),
      },
      include: recentJournalInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
      ...(shouldUseAccelerate
        ? ({
            cacheStrategy: { ttl: 30, swr: 60, tags: cacheTags },
          } as unknown as Record<string, unknown>)
        : {}),
    }),
  ] as const);

  const recentJournalsTyped = recentJournals as unknown as RecentJournal[];

  const todayRevenue = todayPnL[0]?.revenue ?? 0;
  const todayExpense = todayPnL[0]?.expense ?? 0;
  const monthRevenue = monthPnL[0]?.revenue ?? 0;
  const monthExpense = monthPnL[0]?.expense ?? 0;

  // Build revenue trend with zero-fill for missing days
  const trendMap = new Map(
    revenueTrend.map((r) => [
      new Date(r.date).toISOString().split("T")[0],
      r.revenue,
    ]),
  );
  const revenueTrendFilled: { date: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0]!;
    revenueTrendFilled.push({ date: key, revenue: trendMap.get(key) ?? 0 });
  }

  return {
    totalCash: cashBalance[0]?.balance ?? 0,
    totalReceivable: receivableBalance[0]?.balance ?? 0,
    totalPayable: payableBalance[0]?.balance ?? 0,
    todayProfit: todayRevenue - todayExpense,
    todayRevenue,
    todayExpense,
    monthProfit: monthRevenue - monthExpense,
    monthRevenue,
    monthExpense,
    revenueTrend: revenueTrendFilled,
    topExpenses,
    recentJournals: recentJournalsTyped.map((j) => ({
      id: j.id,
      entryNumber: j.entryNumber,
      date: j.date,
      description: j.description,
      totalDebit: j.totalDebit,
      totalCredit: j.totalCredit,
      referenceType: j.referenceType,
      createdBy: j.createdByUser.name,
      lines: j.lines.map((l) => ({
        accountCode: l.account.code,
        accountName: l.account.name,
        description: l.description,
        debit: l.debit,
        credit: l.credit,
      })),
    })),
  };
}

export async function getAccountingDashboard(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const b = branchId || "all";
  const cached = unstable_cache(
    () => getAccountingDashboardUncached(branchId, companyId),
    ["accounting-dashboard", companyId, b],
    {
      revalidate: 30,
      tags: ["accounting-dashboard", `accounting-dashboard:${companyId}:${b}`],
    },
  );
  return cached();
}
