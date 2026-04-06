"use server";

import { prisma, shouldUseAccelerate } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

// ===========================
// HELPERS
// ===========================

function branchSQL(branchId?: string, alias?: string): string {
  if (!branchId) return "";
  const prefix = alias ? `${alias}.` : "";
  return ` AND ${prefix}"branchId" = '${branchId}'`;
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
  const { accountId, dateFrom, dateTo, branchId } = params;

  // Fetch account info with category
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { category: true },
  });

  if (!account) {
    throw new Error("Akun tidak ditemukan");
  }

  const normalSide = account.category.normalSide; // DEBIT or CREDIT
  const from = dateFrom ? toDate(dateFrom) : new Date("2000-01-01");
  const to = dateTo ? endOfDay(dateTo) : new Date("2099-12-31");

  // Calculate opening balance: openingBalance + all movements BEFORE dateFrom
  const priorMovements = await prisma.$queryRawUnsafe<
    { totalDebit: number; totalCredit: number }[]
  >(
    `
    SELECT
      COALESCE(SUM(jel.debit), 0)::float AS "totalDebit",
      COALESCE(SUM(jel.credit), 0)::float AS "totalCredit"
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel."journalId"
    WHERE jel."accountId" = $1
      AND je.status = 'POSTED'
      AND je.date < $2
      ${branchSQL(branchId, "je")}
    `,
    accountId,
    from,
  );

  const priorDebit = priorMovements[0]?.totalDebit ?? 0;
  const priorCredit = priorMovements[0]?.totalCredit ?? 0;

  let openingBalance = account.openingBalance;
  if (normalSide === "DEBIT") {
    openingBalance += priorDebit - priorCredit;
  } else {
    openingBalance += priorCredit - priorDebit;
  }

  // Fetch entries in range
  const entries = await prisma.$queryRawUnsafe<
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
      ${branchSQL(branchId, "je")}
    ORDER BY je.date ASC, je."createdAt" ASC
    `,
    accountId,
    from,
    to,
  );

  // Calculate running balance
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
      runningBalance,
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
    closingBalance: runningBalance,
    totalDebit: entries.reduce((s, e) => s + e.debit, 0),
    totalCredit: entries.reduce((s, e) => s + e.credit, 0),
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
  const { date, branchId } = params;
  const upTo = date ? endOfDay(date) : new Date("2099-12-31");

  // Get all active accounts with their categories
  const accounts = await prisma.account.findMany({
    where: {
      isActive: true,
      ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
    },
    include: { category: true },
    orderBy: { code: "asc" },
  });

  // Get aggregated journal movements per account up to the date
  const movements = await prisma.$queryRawUnsafe<
    { accountId: string; totalDebit: number; totalCredit: number }[]
  >(
    `
    SELECT
      jel."accountId",
      COALESCE(SUM(jel.debit), 0)::float AS "totalDebit",
      COALESCE(SUM(jel.credit), 0)::float AS "totalCredit"
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel."journalId"
    WHERE je.status = 'POSTED'
      AND je.date <= $1
      ${branchSQL(branchId, "je")}
    GROUP BY jel."accountId"
    `,
    upTo,
  );

  const movementMap = new Map(
    movements.map((m) => [
      m.accountId,
      { debit: m.totalDebit, credit: m.totalCredit },
    ]),
  );

  let grandTotalDebit = 0;
  let grandTotalCredit = 0;

  const rows: TrialBalanceRow[] = accounts.map((acc) => {
    const mv = movementMap.get(acc.id) ?? { debit: 0, credit: 0 };
    const normalSide = acc.category.normalSide;

    // Net balance = opening + movements
    let netBalance = acc.openingBalance;
    if (normalSide === "DEBIT") {
      netBalance += mv.debit - mv.credit;
    } else {
      netBalance += mv.credit - mv.debit;
    }

    // Place net balance on the correct side
    let debit = 0;
    let credit = 0;

    if (netBalance >= 0) {
      if (normalSide === "DEBIT") {
        debit = netBalance;
      } else {
        credit = netBalance;
      }
    } else {
      // Contra balance — place on opposite side
      if (normalSide === "DEBIT") {
        credit = Math.abs(netBalance);
      } else {
        debit = Math.abs(netBalance);
      }
    }

    grandTotalDebit += debit;
    grandTotalCredit += credit;

    return {
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      categoryType: acc.category.type,
      categoryName: acc.category.name,
      normalSide,
      debit,
      credit,
    };
  });

  const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.01;

  return {
    rows,
    totalDebit: grandTotalDebit,
    totalCredit: grandTotalCredit,
    isBalanced,
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
  const { dateFrom, dateTo, branchId } = params;
  const from = toDate(dateFrom);
  const to = endOfDay(dateTo);

  // Revenue accounts: net = credit - debit (positive = income)
  const revenueRows = await prisma.$queryRawUnsafe<
    { accountId: string; code: string; name: string; amount: number }[]
  >(
    `
    SELECT
      a.id AS "accountId",
      a.code,
      a.name,
      (COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0))::float AS amount
    FROM accounts a
    JOIN account_categories ac ON ac.id = a."categoryId"
    LEFT JOIN journal_entry_lines jel ON jel."accountId" = a.id
    LEFT JOIN journal_entries je ON je.id = jel."journalId"
      AND je.status = 'POSTED'
      AND je.date >= $1
      AND je.date <= $2
      ${branchSQL(branchId, "je")}
    WHERE ac.type = 'REVENUE'
      AND a."isActive" = true
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code ASC
    `,
    from,
    to,
  );

  // Expense accounts: net = debit - credit (positive = expense)
  const expenseRows = await prisma.$queryRawUnsafe<
    { accountId: string; code: string; name: string; amount: number }[]
  >(
    `
    SELECT
      a.id AS "accountId",
      a.code,
      a.name,
      (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))::float AS amount
    FROM accounts a
    JOIN account_categories ac ON ac.id = a."categoryId"
    LEFT JOIN journal_entry_lines jel ON jel."accountId" = a.id
    LEFT JOIN journal_entries je ON je.id = jel."journalId"
      AND je.status = 'POSTED'
      AND je.date >= $1
      AND je.date <= $2
      ${branchSQL(branchId, "je")}
    WHERE ac.type = 'EXPENSE'
      AND a."isActive" = true
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code ASC
    `,
    from,
    to,
  );

  const revenues: IncomeStatementAccount[] = revenueRows
    .filter((r) => r.amount !== 0)
    .map((r) => ({
      accountId: r.accountId,
      accountCode: r.code,
      accountName: r.name,
      amount: r.amount,
    }));

  const expenses: IncomeStatementAccount[] = expenseRows
    .filter((r) => r.amount !== 0)
    .map((r) => ({
      accountId: r.accountId,
      accountCode: r.code,
      accountName: r.name,
      amount: r.amount,
    }));

  const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenses.reduce((s, r) => s + r.amount, 0);
  const netIncome = totalRevenue - totalExpense;

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
  const { date, branchId } = params;
  const upTo = endOfDay(date);

  // Get all balances: openingBalance + journal movements up to date
  const accountBalances = await prisma.$queryRawUnsafe<
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
      ${branchSQL(branchId, "je")}
    WHERE a."isActive" = true
      AND ac.type IN ('ASSET', 'LIABILITY', 'EQUITY')
    GROUP BY a.id, a.code, a.name, ac.type, ac.name, ac."normalSide", a."openingBalance"
    ORDER BY a.code ASC
    `,
    upTo,
  );

  // Calculate retained earnings (laba ditahan) = accumulated (revenue - expense) up to date
  const retainedEarningsResult = await prisma.$queryRawUnsafe<
    { revenue: number; expense: number }[]
  >(
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
      ${branchSQL(branchId, "je")}
    `,
    upTo,
  );

  const retainedEarnings =
    (retainedEarningsResult[0]?.revenue ?? 0) -
    (retainedEarningsResult[0]?.expense ?? 0);

  // Build groups
  const groupMap: Record<string, BalanceSheetGroup> = {};

  for (const row of accountBalances) {
    let balance = row.openingBalance;
    if (row.normalSide === "DEBIT") {
      balance += row.totalDebit - row.totalCredit;
    } else {
      balance += row.totalCredit - row.totalDebit;
    }

    if (!groupMap[row.categoryType]) {
      groupMap[row.categoryType] = {
        categoryName: row.categoryName,
        accounts: [],
        total: 0,
      };
    }

    const group = groupMap[row.categoryType]!;
    if (balance !== 0) {
      group.accounts.push({
        accountId: row.accountId,
        accountCode: row.code,
        accountName: row.name,
        balance,
      });
      group.total += balance;
    }
  }

  // Add retained earnings to equity
  if (!groupMap["EQUITY"]) {
    groupMap["EQUITY"] = { categoryName: "Modal", accounts: [], total: 0 };
  }
  if (retainedEarnings !== 0) {
    groupMap["EQUITY"].accounts.push({
      accountId: "retained-earnings",
      accountCode: "-",
      accountName: "Laba Ditahan",
      balance: retainedEarnings,
    });
    groupMap["EQUITY"].total += retainedEarnings;
  }

  const assets = groupMap["ASSET"] ?? {
    categoryName: "Aset",
    accounts: [],
    total: 0,
  };
  const liabilities = groupMap["LIABILITY"] ?? {
    categoryName: "Kewajiban",
    accounts: [],
    total: 0,
  };
  const equity = groupMap["EQUITY"];

  const totalAssets = assets.total;
  const totalLiabilitiesAndEquity = liabilities.total + equity.total;
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  return {
    asOfDate: date,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities: liabilities.total,
    totalEquity: equity.total,
    totalLiabilitiesAndEquity,
    retainedEarnings,
    isBalanced,
    difference: totalAssets - totalLiabilitiesAndEquity,
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
  const { dateFrom, dateTo, branchId } = params;
  const from = toDate(dateFrom);
  const to = endOfDay(dateTo);

  // Opening cash balance: opening balance of cash accounts + movements before dateFrom
  const openingCashResult = await prisma.$queryRawUnsafe<{ balance: number }[]>(
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
        ${branchSQL(branchId, "je")}
      GROUP BY jel."accountId"
    ) mv ON mv."accountId" = a.id
    WHERE ac.type = 'ASSET'
      AND (a.code LIKE '1-1001%' OR a.code LIKE '1-1002%')
      AND a."isActive" = true
    `,
    from,
  );

  const openingCash = openingCashResult[0]?.balance ?? 0;

  // Cash In: journal lines where cash accounts are debited (money coming in)
  const cashInRows = await prisma.$queryRawUnsafe<
    {
      entryNumber: string;
      date: Date;
      description: string;
      lineDescription: string | null;
      amount: number;
      referenceType: string | null;
    }[]
  >(
    `
    SELECT
      je."entryNumber",
      je.date,
      je.description,
      jel.description AS "lineDescription",
      jel.debit::float AS amount,
      je."referenceType"
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel."journalId"
    JOIN accounts a ON a.id = jel."accountId"
    WHERE je.status = 'POSTED'
      AND je.date >= $1
      AND je.date <= $2
      AND (a.code LIKE '1-1001%' OR a.code LIKE '1-1002%')
      AND jel.debit > 0
      ${branchSQL(branchId, "je")}
    ORDER BY je.date ASC, je."createdAt" ASC
    `,
    from,
    to,
  );

  // Cash Out: journal lines where cash accounts are credited (money going out)
  const cashOutRows = await prisma.$queryRawUnsafe<
    {
      entryNumber: string;
      date: Date;
      description: string;
      lineDescription: string | null;
      amount: number;
      referenceType: string | null;
    }[]
  >(
    `
    SELECT
      je."entryNumber",
      je.date,
      je.description,
      jel.description AS "lineDescription",
      jel.credit::float AS amount,
      je."referenceType"
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel."journalId"
    JOIN accounts a ON a.id = jel."accountId"
    WHERE je.status = 'POSTED'
      AND je.date >= $1
      AND je.date <= $2
      AND (a.code LIKE '1-1001%' OR a.code LIKE '1-1002%')
      AND jel.credit > 0
      ${branchSQL(branchId, "je")}
    ORDER BY je.date ASC, je."createdAt" ASC
    `,
    from,
    to,
  );

  const cashIn: CashFlowItem[] = cashInRows.map((r) => ({
    description: r.lineDescription || r.description,
    amount: r.amount,
    entryNumber: r.entryNumber,
    date: r.date,
  }));

  const cashOut: CashFlowItem[] = cashOutRows.map((r) => ({
    description: r.lineDescription || r.description,
    amount: r.amount,
    entryNumber: r.entryNumber,
    date: r.date,
  }));

  const totalCashIn = cashIn.reduce((s, i) => s + i.amount, 0);
  const totalCashOut = cashOut.reduce((s, i) => s + i.amount, 0);
  const netCashFlow = totalCashIn - totalCashOut;
  const closingCash = openingCash + netCashFlow;

  // Summary by reference type
  const cashInByType = summarizeCashByType(cashInRows);
  const cashOutByType = summarizeCashByType(cashOutRows);

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
  rows: { referenceType: string | null; amount: number; description: string }[],
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
    amount,
  }));
}

// ===========================
// 6. DASHBOARD AKUNTANSI
// ===========================

async function getAccountingDashboardUncached(branchId?: string) {
  const cacheTags = ["accounting_dashboard"];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const branchCond = branchSQL(branchId, "je");

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
        WHERE je.status = 'POSTED' ${branchCond}
        GROUP BY jel."accountId"
      ) mv ON mv."accountId" = a.id
      WHERE (a.code LIKE '1-1001%' OR a.code LIKE '1-1002%')
        AND a."isActive" = true
      `,
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
        WHERE je.status = 'POSTED' ${branchCond}
        GROUP BY jel."accountId"
      ) mv ON mv."accountId" = a.id
      WHERE a.code LIKE '1-1003%'
        AND a."isActive" = true
      `,
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
        WHERE je.status = 'POSTED' ${branchCond}
        GROUP BY jel."accountId"
      ) mv ON mv."accountId" = a.id
      WHERE ac.type = 'LIABILITY'
        AND a."isActive" = true
      `,
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
        ${branchCond}
      `,
      todayStart,
      todayEnd,
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
        ${branchCond}
      `,
      monthStart,
      todayEnd,
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
        ${branchCond}
      GROUP BY je.date
      ORDER BY je.date ASC
      `,
      (() => {
        const d = new Date(todayStart);
        d.setDate(d.getDate() - 6);
        return d;
      })(),
      todayEnd,
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
        ${branchCond}
      GROUP BY a.id, a.code, a.name
      HAVING SUM(jel.debit - jel.credit) > 0
      ORDER BY amount DESC
      LIMIT 5
      `,
      monthStart,
      todayEnd,
    ),

    // Recent 10 journal entries
    prisma.journalEntry.findMany({
      where: {
        status: "POSTED",
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
  const b = branchId || "all";
  const cached = unstable_cache(
    () => getAccountingDashboardUncached(branchId),
    ["accounting-dashboard", b],
    {
      revalidate: 30,
      tags: ["accounting-dashboard", `accounting-dashboard:${b}`],
    },
  );
  return cached();
}
