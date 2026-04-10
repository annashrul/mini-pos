"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentCompanyId } from "@/lib/company";

type Period = "today" | "week" | "month" | "year";

function getPeriodDates(period: Period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let periodStart: Date;
  let prevPeriodStart: Date;
  let prevPeriodEnd: Date;

  switch (period) {
    case "today":
      periodStart = today;
      prevPeriodStart = new Date(today);
      prevPeriodStart.setDate(prevPeriodStart.getDate() - 1);
      prevPeriodEnd = today;
      break;
    case "week":
      periodStart = new Date(today);
      periodStart.setDate(today.getDate() - 7);
      prevPeriodStart = new Date(periodStart);
      prevPeriodStart.setDate(prevPeriodStart.getDate() - 7);
      prevPeriodEnd = periodStart;
      break;
    case "year":
      periodStart = new Date(today.getFullYear(), 0, 1);
      prevPeriodStart = new Date(today.getFullYear() - 1, 0, 1);
      prevPeriodEnd = new Date(today.getFullYear(), 0, 1);
      break;
    default: // month
      periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
      prevPeriodStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      prevPeriodEnd = periodStart;
      break;
  }

  return { periodStart, prevPeriodStart, prevPeriodEnd, periodEnd: tomorrow };
}

function branchClause(
  branchId: string | undefined,
  alias: string | undefined,
  paramIndex: number,
): { condition: string; params: unknown[] } {
  if (!branchId) return { condition: "", params: [] };
  const col = alias ? `${alias}."branchId"` : `"branchId"`;
  return {
    condition: `AND ${col} = $${paramIndex}`,
    params: [branchId],
  };
}

export async function getProfitOverview(period: Period, branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const { periodStart, prevPeriodStart, prevPeriodEnd, periodEnd } = getPeriodDates(period);
  const bc = branchClause(branchId, "t", 3);
  const bcNextIdx = 3 + bc.params.length;
  const companyClause = `AND t."branchId" IN (SELECT id FROM branches WHERE "companyId" = $${bcNextIdx})`;
  const bcExpense = branchClause(branchId, undefined, 3);
  const bcExpNextIdx = 3 + bcExpense.params.length;
  const companyExpenseClause = `AND "branchId" IN (SELECT id FROM branches WHERE "companyId" = $${bcExpNextIdx})`;

  // Current period: revenue, COGS
  const [currentData] = await prisma.$queryRawUnsafe<
    { revenue: number; cogs: number; tx_count: number }[]
  >(`
    SELECT
      COALESCE(SUM(ti."subtotal"), 0)::float AS revenue,
      COALESCE(SUM(ti."quantity" * p."purchasePrice"), 0)::float AS cogs,
      COUNT(DISTINCT t."id")::int AS tx_count
    FROM transactions t
    JOIN transaction_items ti ON ti."transactionId" = t."id"
    JOIN products p ON p."id" = ti."productId"
    WHERE t."status" = 'COMPLETED'
      AND t."createdAt" >= $1
      AND t."createdAt" < $2
      ${bc.condition}
      ${companyClause}
  `, periodStart, periodEnd, ...bc.params, companyId);

  // Previous period: revenue, COGS
  const [prevData] = await prisma.$queryRawUnsafe<
    { revenue: number; cogs: number; tx_count: number }[]
  >(`
    SELECT
      COALESCE(SUM(ti."subtotal"), 0)::float AS revenue,
      COALESCE(SUM(ti."quantity" * p."purchasePrice"), 0)::float AS cogs,
      COUNT(DISTINCT t."id")::int AS tx_count
    FROM transactions t
    JOIN transaction_items ti ON ti."transactionId" = t."id"
    JOIN products p ON p."id" = ti."productId"
    WHERE t."status" = 'COMPLETED'
      AND t."createdAt" >= $1
      AND t."createdAt" < $2
      ${bc.condition}
      ${companyClause}
  `, prevPeriodStart, prevPeriodEnd, ...bc.params, companyId);

  // Current period expenses
  const [currentExpenses] = await prisma.$queryRawUnsafe<{ total: number }[]>(`
    SELECT COALESCE(SUM("amount"), 0)::float AS total
    FROM expenses
    WHERE "date" >= $1 AND "date" < $2
    ${bcExpense.condition}
    ${companyExpenseClause}
  `, periodStart, periodEnd, ...bcExpense.params, companyId);

  // Previous period expenses
  const [prevExpenses] = await prisma.$queryRawUnsafe<{ total: number }[]>(`
    SELECT COALESCE(SUM("amount"), 0)::float AS total
    FROM expenses
    WHERE "date" >= $1 AND "date" < $2
    ${bcExpense.condition}
    ${companyExpenseClause}
  `, prevPeriodStart, prevPeriodEnd, ...bcExpense.params, companyId);

  const revenue = currentData?.revenue ?? 0;
  const cogs = currentData?.cogs ?? 0;
  const grossProfit = revenue - cogs;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const expenses = currentExpenses?.total ?? 0;
  const netProfit = grossProfit - expenses;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const prevRevenue = prevData?.revenue ?? 0;
  const prevCogs = prevData?.cogs ?? 0;
  const prevGrossProfit = prevRevenue - prevCogs;
  const prevExpensesTotal = prevExpenses?.total ?? 0;
  const prevNetProfit = prevGrossProfit - prevExpensesTotal;

  const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
  const grossProfitGrowth = prevGrossProfit > 0 ? ((grossProfit - prevGrossProfit) / prevGrossProfit) * 100 : 0;
  const netProfitGrowth = prevNetProfit > 0 ? ((netProfit - prevNetProfit) / prevNetProfit) * 100 : 0;
  const cogsGrowth = prevCogs > 0 ? ((cogs - prevCogs) / prevCogs) * 100 : 0;
  const expensesGrowth = prevExpensesTotal > 0 ? ((expenses - prevExpensesTotal) / prevExpensesTotal) * 100 : 0;

  return {
    revenue,
    cogs,
    grossProfit,
    grossMargin: Math.round(grossMargin * 100) / 100,
    expenses,
    netProfit,
    netMargin: Math.round(netMargin * 100) / 100,
    revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    grossProfitGrowth: Math.round(grossProfitGrowth * 10) / 10,
    netProfitGrowth: Math.round(netProfitGrowth * 10) / 10,
    cogsGrowth: Math.round(cogsGrowth * 10) / 10,
    expensesGrowth: Math.round(expensesGrowth * 10) / 10,
    transactionCount: currentData?.tx_count ?? 0,
  };
}

export async function getProfitByCategory(period: Period, branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const { periodStart, periodEnd } = getPeriodDates(period);
  const bc = branchClause(branchId, "t", 3);

  const rows = await prisma.$queryRawUnsafe<
    { category: string; revenue: number; cost: number; units: number }[]
  >(`
    SELECT
      COALESCE(c."name", 'Lainnya') AS category,
      COALESCE(SUM(ti."subtotal"), 0)::float AS revenue,
      COALESCE(SUM(ti."quantity" * p."purchasePrice"), 0)::float AS cost,
      COALESCE(SUM(ti."quantity"), 0)::int AS units
    FROM transactions t
    JOIN transaction_items ti ON ti."transactionId" = t."id"
    JOIN products p ON p."id" = ti."productId"
    LEFT JOIN categories c ON c."id" = p."categoryId"
    WHERE t."status" = 'COMPLETED'
      AND t."createdAt" >= $1
      AND t."createdAt" < $2
      ${bc.condition}
      AND t."branchId" IN (SELECT id FROM branches WHERE "companyId" = $${3 + bc.params.length})
    GROUP BY c."name"
    ORDER BY SUM(ti."subtotal") DESC
  `, periodStart, periodEnd, ...bc.params, companyId);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  return rows.map((r) => ({
    category: r.category,
    revenue: r.revenue,
    cost: r.cost,
    profit: r.revenue - r.cost,
    margin: r.revenue > 0 ? Math.round(((r.revenue - r.cost) / r.revenue) * 1000) / 10 : 0,
    contribution: totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 1000) / 10 : 0,
    units: r.units,
  }));
}

export async function getProfitByProduct(
  period: Period,
  branchId?: string,
  limit: number = 10,
  order: "top" | "bottom" = "top"
) {
  const companyId = await getCurrentCompanyId();
  const { periodStart, periodEnd } = getPeriodDates(period);
  const sortDir = order === "top" ? "DESC" : "ASC";
  const prodParams: unknown[] = [periodStart, periodEnd];
  let prodBranchCondition = "";
  if (branchId) {
    prodParams.push(branchId);
    prodBranchCondition = `AND t."branchId" = $${prodParams.length}`;
  }
  prodParams.push(companyId);
  const companyProdCondition = `AND t."branchId" IN (SELECT id FROM branches WHERE "companyId" = $${prodParams.length})`;
  prodParams.push(limit);
  const limitIdx = prodParams.length;

  const rows = await prisma.$queryRawUnsafe<
    { product_name: string; product_code: string; units_sold: number; revenue: number; cost: number }[]
  >(`
    SELECT
      ti."productName" AS product_name,
      ti."productCode" AS product_code,
      SUM(ti."quantity")::int AS units_sold,
      SUM(ti."subtotal")::float AS revenue,
      SUM(ti."quantity" * p."purchasePrice")::float AS cost
    FROM transactions t
    JOIN transaction_items ti ON ti."transactionId" = t."id"
    JOIN products p ON p."id" = ti."productId"
    WHERE t."status" = 'COMPLETED'
      AND t."createdAt" >= $1
      AND t."createdAt" < $2
      ${prodBranchCondition}
      ${companyProdCondition}
    GROUP BY ti."productName", ti."productCode"
    ORDER BY (SUM(ti."subtotal") - SUM(ti."quantity" * p."purchasePrice")) ${sortDir}
    LIMIT $${limitIdx}
  `, ...prodParams);

  return rows.map((r) => ({
    productName: r.product_name,
    productCode: r.product_code,
    unitsSold: r.units_sold,
    revenue: r.revenue,
    cost: r.cost,
    profit: r.revenue - r.cost,
    margin: r.revenue > 0 ? Math.round(((r.revenue - r.cost) / r.revenue) * 1000) / 10 : 0,
  }));
}

export async function getProfitByBranch(period: Period) {
  const companyId = await getCurrentCompanyId();
  const { periodStart, periodEnd } = getPeriodDates(period);

  const rows = await prisma.$queryRawUnsafe<
    { branch_id: string; branch_name: string; revenue: number; cost: number }[]
  >(`
    SELECT
      b."id" AS branch_id,
      b."name" AS branch_name,
      COALESCE(SUM(ti."subtotal"), 0)::float AS revenue,
      COALESCE(SUM(ti."quantity" * p."purchasePrice"), 0)::float AS cost
    FROM branches b
    LEFT JOIN transactions t ON t."branchId" = b."id"
      AND t."status" = 'COMPLETED'
      AND t."createdAt" >= $1
      AND t."createdAt" < $2
    LEFT JOIN transaction_items ti ON ti."transactionId" = t."id"
    LEFT JOIN products p ON p."id" = ti."productId"
    WHERE b."isActive" = true
      AND b."companyId" = $3
    GROUP BY b."id", b."name"
    ORDER BY SUM(ti."subtotal") DESC NULLS LAST
  `, periodStart, periodEnd, companyId);

  // Get expenses per branch
  const expenseRows = await prisma.$queryRawUnsafe<
    { branch_id: string; total: number }[]
  >(`
    SELECT "branchId" AS branch_id, COALESCE(SUM("amount"), 0)::float AS total
    FROM expenses
    WHERE "date" >= $1 AND "date" < $2 AND "branchId" IS NOT NULL
      AND "branchId" IN (SELECT id FROM branches WHERE "companyId" = $3)
    GROUP BY "branchId"
  `, periodStart, periodEnd, companyId);

  const expenseMap = new Map(expenseRows.map((e) => [e.branch_id, e.total]));
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  return rows.map((r) => {
    const expenses = expenseMap.get(r.branch_id) ?? 0;
    const grossProfit = r.revenue - r.cost;
    const netProfit = grossProfit - expenses;
    return {
      branchId: r.branch_id,
      branchName: r.branch_name,
      revenue: r.revenue,
      cost: r.cost,
      grossProfit,
      expenses,
      netProfit,
      grossMargin: r.revenue > 0 ? Math.round(((grossProfit) / r.revenue) * 1000) / 10 : 0,
      netMargin: r.revenue > 0 ? Math.round((netProfit / r.revenue) * 1000) / 10 : 0,
      contribution: totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 1000) / 10 : 0,
    };
  });
}

export async function getProfitTrend(days: number = 30, branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  const bc = branchClause(branchId, "t", 2);

  const rows = await prisma.$queryRawUnsafe<
    { d: Date; revenue: number; cost: number }[]
  >(`
    SELECT
      DATE_TRUNC('day', t."createdAt") AS d,
      COALESCE(SUM(ti."subtotal"), 0)::float AS revenue,
      COALESCE(SUM(ti."quantity" * p."purchasePrice"), 0)::float AS cost
    FROM transactions t
    JOIN transaction_items ti ON ti."transactionId" = t."id"
    JOIN products p ON p."id" = ti."productId"
    WHERE t."status" = 'COMPLETED'
      AND t."createdAt" >= $1
      ${bc.condition}
      AND t."branchId" IN (SELECT id FROM branches WHERE "companyId" = $${2 + bc.params.length})
    GROUP BY DATE_TRUNC('day', t."createdAt")
    ORDER BY d ASC
  `, startDate, ...bc.params, companyId);

  const dataMap = new Map<string, { revenue: number; cost: number }>();
  for (const row of rows) {
    const key = new Date(row.d).toISOString().slice(0, 10);
    dataMap.set(key, { revenue: row.revenue, cost: row.cost });
  }

  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const key = date.toISOString().slice(0, 10);
    const data = dataMap.get(key) || { revenue: 0, cost: 0 };
    result.push({
      date: date.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      revenue: data.revenue,
      cost: data.cost,
      profit: data.revenue - data.cost,
    });
  }
  return result;
}

export async function getMarginDistribution(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const bc = branchClause(branchId, "t", 1);

  const rows = await prisma.$queryRawUnsafe<
    { product_name: string; revenue: number; cost: number }[]
  >(`
    SELECT
      ti."productName" AS product_name,
      SUM(ti."subtotal")::float AS revenue,
      SUM(ti."quantity" * p."purchasePrice")::float AS cost
    FROM transactions t
    JOIN transaction_items ti ON ti."transactionId" = t."id"
    JOIN products p ON p."id" = ti."productId"
    WHERE t."status" = 'COMPLETED'
      ${bc.condition}
      AND t."branchId" IN (SELECT id FROM branches WHERE "companyId" = $${1 + bc.params.length})
    GROUP BY ti."productName"
    HAVING SUM(ti."subtotal") > 0
  `, ...bc.params, companyId);

  const brackets = [
    { label: "0-10%", min: 0, max: 10, count: 0, revenue: 0 },
    { label: "10-20%", min: 10, max: 20, count: 0, revenue: 0 },
    { label: "20-30%", min: 20, max: 30, count: 0, revenue: 0 },
    { label: "30-50%", min: 30, max: 50, count: 0, revenue: 0 },
    { label: "50%+", min: 50, max: 999, count: 0, revenue: 0 },
  ];

  for (const row of rows) {
    const margin = ((row.revenue - row.cost) / row.revenue) * 100;
    for (const bracket of brackets) {
      if (margin >= bracket.min && margin < bracket.max) {
        bracket.count++;
        bracket.revenue += row.revenue;
        break;
      }
    }
  }

  return brackets.map((b) => ({
    label: b.label,
    count: b.count,
    revenue: b.revenue,
  }));
}
