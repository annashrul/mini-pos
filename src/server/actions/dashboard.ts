"use server";

import { prisma, shouldUseAccelerate } from "@/lib/prisma";
import { redisDelByPrefix, redisGetJson, redisSetJson } from "@/lib/redis";
import { revalidateTag } from "next/cache";

const dashboardCacheStrategy = {
  ttl: 30,
  swr: 60,
  tags: ["dashboard_stats"],
} as const;
const DASHBOARD_REDIS_TTL_SECONDS = 30;

async function invalidateAccelerate(tags: string[]) {
  const accelerate = (
    prisma as unknown as {
      $accelerate?: {
        invalidate: (args: { tags: string[] }) => Promise<unknown>;
      };
    }
  ).$accelerate;
  if (!accelerate) return;
  try {
    await accelerate.invalidate({ tags });
  } catch {
    //
  }
}

async function getDashboardStatsUncached(
  branchId?: string,
  period?: "today" | "week" | "month" | "year",
) {
  const branchFilter = branchId ? { branchId } : {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const p = period || "today";
  let periodStart: Date;
  let prevPeriodStart: Date;

  if (p === "today") {
    periodStart = today;
    prevPeriodStart = new Date(today);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - 1);
  } else if (p === "week") {
    periodStart = new Date(today);
    periodStart.setDate(today.getDate() - 7);
    prevPeriodStart = new Date(periodStart);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - 7);
  } else if (p === "year") {
    periodStart = new Date(today.getFullYear(), 0, 1);
    prevPeriodStart = new Date(today.getFullYear() - 1, 0, 1);
  } else {
    periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
    prevPeriodStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const completedWhere = { status: "COMPLETED" as const, ...branchFilter };

  // Single batch of parallel queries — no loops
  const [
    todaySales,
    todayTxCount,
    yesterdaySales,
    yesterdayTxCount,
    prevMonthRevenue,
    prevMonthTxCount,
    totalProducts,
    totalCustomers,
    recentTransactions,
    topProducts,
    dailySales,
    monthlySales,
    paymentBreakdown,
    topCashiers,
    categoryBreakdown,
    hourlySales,
    refundCount,
    voidCount,
    activePromotions,
    pendingPurchaseOrders,
    profitRows,
    lowStockProducts,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { grandTotal: true },
      where: {
        createdAt: { gte: periodStart, lt: tomorrow },
        ...completedWhere,
      },
      ...(shouldUseAccelerate
        ? ({
            cacheStrategy: dashboardCacheStrategy,
          } as unknown as Record<string, unknown>)
        : {}),
    }),
    prisma.transaction.count({
      where: {
        createdAt: { gte: periodStart, lt: tomorrow },
        ...completedWhere,
      },
      ...(shouldUseAccelerate
        ? ({
            cacheStrategy: dashboardCacheStrategy,
          } as unknown as Record<string, unknown>)
        : {}),
    }),
    prisma.transaction.aggregate({
      _sum: { grandTotal: true },
      where: { createdAt: { gte: yesterday, lt: today }, ...completedWhere },
    }),
    prisma.transaction.count({
      where: { createdAt: { gte: yesterday, lt: today }, ...completedWhere },
    }),
    prisma.transaction.aggregate({
      _sum: { grandTotal: true },
      where: {
        createdAt: { gte: prevPeriodStart, lt: periodStart },
        ...completedWhere,
      },
    }),
    prisma.transaction.count({
      where: {
        createdAt: { gte: prevPeriodStart, lt: periodStart },
        ...completedWhere,
      },
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.customer.count(),
    prisma.transaction.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 7,
    }),
    prisma.transactionItem.groupBy({
      by: ["productName"],
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    getDailySalesData(30, branchFilter),
    getYearlyComparison(branchFilter),
    prisma.transaction.groupBy({
      by: ["paymentMethod"],
      _sum: { grandTotal: true },
      _count: { _all: true },
      where: {
        createdAt: { gte: periodStart, lt: tomorrow },
        ...completedWhere,
      },
    }),
    getTopCashiers(periodStart, tomorrow, branchFilter),
    getCategoryBreakdown(periodStart, tomorrow, branchFilter),
    getHourlySalesData(today, tomorrow, branchFilter),
    prisma.transaction.count({
      where: {
        createdAt: { gte: periodStart, lt: tomorrow },
        status: "REFUNDED" as const,
        ...branchFilter,
      },
    }),
    prisma.transaction.count({
      where: {
        createdAt: { gte: periodStart, lt: tomorrow },
        status: "VOIDED" as const,
        ...branchFilter,
      },
    }),
    prisma.promotion.count({
      where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
    }),
    prisma.purchaseOrder.count({
      where: { status: { in: ["DRAFT", "ORDERED"] as const }, ...branchFilter },
    }),
    prisma.$queryRawUnsafe<{ profit: number }[]>(
      `
      SELECT
        COALESCE(SUM((ti."unitPrice" - p."purchasePrice") * ti.quantity), 0)::float AS profit
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti."transactionId"
      JOIN products p ON p.id = ti."productId"
      WHERE t.status = 'COMPLETED'
        AND t."createdAt" >= $1
        AND t."createdAt" < $2
        ${branchId ? `AND t."branchId" = $3` : ""}
      `,
      periodStart,
      tomorrow,
      ...(branchId ? [branchId] : []),
    ),
    prisma.$queryRawUnsafe<
      {
        id: string;
        name: string;
        code: string;
        stock: number;
        minStock: number;
        categoryId: string;
        categoryName: string;
      }[]
    >(
      `
      SELECT p.id, p.name, p.code, p.stock, p."minStock", p."categoryId", c.name as "categoryName"
      FROM products p
      LEFT JOIN categories c ON c.id = p."categoryId"
      WHERE p."isActive" = true
        AND p.stock <= p."minStock"
      ORDER BY p.stock ASC
      LIMIT 10
      `,
    ),
  ]);

  const lowStockMapped = lowStockProducts.map((p) => ({
    id: p.id,
    name: p.name,
    stock: p.stock,
    minStock: p.minStock,
    category: { name: p.categoryName || "Uncategorized" },
  }));

  // Branch performance — single query with GROUP BY instead of per-branch loops
  let branchPerformance: {
    branchId: string;
    branchName: string;
    periodSales: number;
    periodTransactions: number;
    prevPeriodSales: number;
    prevPeriodTransactions: number;
  }[] = [];
  if (!branchId) {
    const [activeBranches, periodByBranch, prevByBranch] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
      prisma.transaction.groupBy({
        by: ["branchId"],
        where: {
          createdAt: { gte: periodStart, lt: tomorrow },
          status: "COMPLETED",
        },
        _sum: { grandTotal: true },
        _count: { _all: true },
      }),
      prisma.transaction.groupBy({
        by: ["branchId"],
        where: {
          createdAt: { gte: prevPeriodStart, lt: periodStart },
          status: "COMPLETED",
        },
        _sum: { grandTotal: true },
        _count: { _all: true },
      }),
    ]);

    const periodMap = new Map(
      periodByBranch.map((r) => [
        r.branchId,
        { sales: r._sum?.grandTotal || 0, count: r._count?._all || 0 },
      ]),
    );
    const prevMap = new Map(
      prevByBranch.map((r) => [
        r.branchId,
        { sales: r._sum?.grandTotal || 0, count: r._count?._all || 0 },
      ]),
    );

    branchPerformance = activeBranches.map((branch) => {
      const curr = periodMap.get(branch.id) || { sales: 0, count: 0 };
      const prev = prevMap.get(branch.id) || { sales: 0, count: 0 };
      return {
        branchId: branch.id,
        branchName: branch.name,
        periodSales: curr.sales,
        periodTransactions: curr.count,
        prevPeriodSales: prev.sales,
        prevPeriodTransactions: prev.count,
      };
    });
  }

  const todaySalesVal = todaySales._sum?.grandTotal || 0;
  const yesterdaySalesVal = yesterdaySales._sum?.grandTotal || 0;
  const monthRevenueVal = todaySalesVal;
  const prevMonthRevenueVal = prevMonthRevenue._sum?.grandTotal || 0;
  const monthTxCount = todayTxCount;

  const salesGrowthDay =
    yesterdaySalesVal > 0
      ? Math.round(
          ((todaySalesVal - yesterdaySalesVal) / yesterdaySalesVal) * 100,
        )
      : 0;
  const salesGrowthMonth =
    prevMonthRevenueVal > 0
      ? Math.round(
          ((monthRevenueVal - prevMonthRevenueVal) / prevMonthRevenueVal) * 100,
        )
      : 0;
  const txGrowthMonth =
    prevMonthTxCount > 0
      ? Math.round(((monthTxCount - prevMonthTxCount) / prevMonthTxCount) * 100)
      : 0;

  const avgTransactionValue =
    todayTxCount > 0 ? Math.round(todaySalesVal / todayTxCount) : 0;
  const todayProfit = profitRows[0]?.profit ?? 0;
  const weekSales = todaySalesVal;

  // Upcoming debts (unpaid/partial, sorted by due date)
  const upcomingDebts = await prisma.debt.findMany({
    where: {
      status: { in: ["UNPAID", "PARTIAL"] },
      ...(branchId ? { branchId } : {}),
    },
    select: {
      id: true,
      type: true,
      partyName: true,
      totalAmount: true,
      paidAmount: true,
      remainingAmount: true,
      status: true,
      dueDate: true,
    },
    orderBy: [
      { dueDate: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: 5,
  });

  return {
    todaySales: todaySalesVal,
    todayTransactionCount: todayTxCount,
    yesterdaySales: yesterdaySalesVal,
    yesterdayTransactionCount: yesterdayTxCount,
    monthRevenue: monthRevenueVal,
    monthTransactionCount: monthTxCount,
    prevMonthRevenue: prevMonthRevenueVal,
    prevMonthTransactionCount: prevMonthTxCount,
    totalProducts,
    totalCustomers,
    salesGrowthDay,
    salesGrowthMonth,
    txGrowthMonth,
    lowStockProducts: lowStockMapped,
    recentTransactions,
    topProducts,
    dailySales,
    yearlyComparison: monthlySales as {
      month: string;
      thisYear: number;
      lastYear: number;
      thisYearCount: number;
      lastYearCount: number;
    }[],
    paymentBreakdown: paymentBreakdown.map((p) => ({
      method: p.paymentMethod,
      total: p._sum.grandTotal || 0,
      count: p._count?._all || 0,
    })),
    topCashiers,
    categoryBreakdown,
    hourlySales,
    avgTransactionValue,
    todayProfit,
    weekSales,
    refundCount,
    voidCount,
    activePromotions,
    pendingPurchaseOrders,
    branchPerformance,
    upcomingDebts: upcomingDebts.map((d) => ({
      id: d.id,
      type: d.type as "PAYABLE" | "RECEIVABLE",
      partyName: d.partyName,
      totalAmount: d.totalAmount,
      remainingAmount: d.remainingAmount,
      status: d.status,
      dueDate: d.dueDate,
    })),
  };
}

export async function getDashboardStats(
  branchId?: string,
  period?: "today" | "week" | "month" | "year",
) {
  const p = period || "today";
  const b = branchId || "all";
  const cacheKey = `dashboard:stats:${b}:${p}`;
  const cached =
    await redisGetJson<Awaited<ReturnType<typeof getDashboardStatsUncached>>>(
      cacheKey,
    );
  if (cached) return cached;
  const fresh = await getDashboardStatsUncached(branchId, period);
  await redisSetJson(cacheKey, fresh, DASHBOARD_REDIS_TTL_SECONDS);
  return fresh;
}

export async function revalidateDashboardStats(branchId?: string) {
  revalidateTag("dashboard-stats", "max");
  if (branchId) revalidateTag(`dashboard-stats:${branchId}`, "max");
  await invalidateAccelerate(["dashboard_stats"]);
  if (branchId) {
    await redisDelByPrefix(`dashboard:stats:${branchId}:`);
    return;
  }
  await redisDelByPrefix("dashboard:stats:");
}

// Single query with GROUP BY instead of 30 individual queries
async function getDailySalesData(
  days: number,
  bf: Record<string, string> = {},
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  const params: unknown[] = [startDate];
  const branchCondition = bf.branchId
    ? (() => {
        params.push(bf.branchId);
        return `AND "branchId" = $${params.length}`;
      })()
    : "";

  const rows = await prisma.$queryRawUnsafe<
    { d: Date; total: bigint; count: bigint }[]
  >(
    `
    SELECT DATE_TRUNC('day', "createdAt") as d,
           COALESCE(SUM("grandTotal"), 0) as total,
           COUNT(*)::bigint as count
    FROM transactions
    WHERE "createdAt" >= $1
      AND status = 'COMPLETED'
      ${branchCondition}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY d ASC
  `,
    ...params,
  );

  const salesMap = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const dateKey = new Date(row.d).toISOString().slice(0, 10);
    salesMap.set(dateKey, {
      total: Number(row.total),
      count: Number(row.count),
    });
  }

  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dateKey = date.toISOString().slice(0, 10);
    const data = salesMap.get(dateKey) || { total: 0, count: 0 };
    result.push({
      date: date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      }),
      total: data.total,
      count: data.count,
    });
  }
  return result;
}

// Single query instead of 24 queries (12 months × 2 years)
async function getYearlyComparison(bf: Record<string, string> = {}) {
  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];

  const params: unknown[] = [new Date(lastYear, 0, 1)];
  const branchCondition = bf.branchId
    ? (() => {
        params.push(bf.branchId);
        return `AND "branchId" = $${params.length}`;
      })()
    : "";

  const rows = await prisma.$queryRawUnsafe<
    { y: number; m: number; total: bigint; count: bigint }[]
  >(
    `
    SELECT EXTRACT(YEAR FROM "createdAt")::int as y,
           EXTRACT(MONTH FROM "createdAt")::int as m,
           COALESCE(SUM("grandTotal"), 0) as total,
           COUNT(*)::bigint as count
    FROM transactions
    WHERE "createdAt" >= $1
      AND "status" = 'COMPLETED'
      ${branchCondition}
    GROUP BY EXTRACT(YEAR FROM "createdAt"), EXTRACT(MONTH FROM "createdAt")
    ORDER BY y, m
  `,
    ...params,
  );

  const dataMap = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    dataMap.set(`${row.y}-${row.m}`, {
      total: Number(row.total),
      count: Number(row.count),
    });
  }

  return monthNames.map((month, i) => {
    const thisData = dataMap.get(`${thisYear}-${i + 1}`) || {
      total: 0,
      count: 0,
    };
    const lastData = dataMap.get(`${lastYear}-${i + 1}`) || {
      total: 0,
      count: 0,
    };
    return {
      month,
      thisYear: thisData.total,
      lastYear: lastData.total,
      thisYearCount: thisData.count,
      lastYearCount: lastData.count,
    };
  });
}

async function getTopCashiers(
  start: Date,
  end: Date,
  bf: Record<string, string> = {},
) {
  const params: unknown[] = [start, end];
  const branchCondition = bf.branchId
    ? (() => {
        params.push(bf.branchId);
        return `AND t."branchId" = $${params.length}`;
      })()
    : "";

  return prisma.$queryRawUnsafe<
    { name: string; total: number; count: number }[]
  >(
    `
    SELECT
      u.name as name,
      COALESCE(SUM(t."grandTotal"), 0)::float as total,
      COUNT(*)::int as count
    FROM transactions t
    JOIN users u ON u.id = t."userId"
    WHERE t."createdAt" >= $1
      AND t."createdAt" < $2
      AND t.status = 'COMPLETED'
      ${branchCondition}
    GROUP BY u.id, u.name
    ORDER BY total DESC
    LIMIT 5
    `,
    ...params,
  );
}

async function getCategoryBreakdown(
  start: Date,
  end: Date,
  bf: Record<string, string> = {},
) {
  const params: unknown[] = [start, end];
  const branchCondition = bf.branchId
    ? (() => {
        params.push(bf.branchId);
        return `AND t."branchId" = $${params.length}`;
      })()
    : "";

  return prisma.$queryRawUnsafe<{ name: string; total: number; qty: number }[]>(
    `
    SELECT
      COALESCE(c.name, 'Lainnya') as name,
      COALESCE(SUM(ti.subtotal), 0)::float as total,
      COALESCE(SUM(ti.quantity), 0)::int as qty
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti."transactionId"
    JOIN products p ON p.id = ti."productId"
    LEFT JOIN categories c ON c.id = p."categoryId"
    WHERE t."createdAt" >= $1
      AND t."createdAt" < $2
      AND t.status = 'COMPLETED'
      ${branchCondition}
    GROUP BY c.name
    ORDER BY total DESC
    `,
    ...params,
  );
}

// Single query with GROUP BY instead of iterating 24 hours
async function getHourlySalesData(
  start: Date,
  end: Date,
  bf: Record<string, string> = {},
) {
  const params: unknown[] = [start, end];
  const branchCondition = bf.branchId
    ? (() => {
        params.push(bf.branchId);
        return `AND "branchId" = $${params.length}`;
      })()
    : "";

  const rows = await prisma.$queryRawUnsafe<
    { h: number; total: bigint; count: bigint }[]
  >(
    `
    SELECT EXTRACT(HOUR FROM "createdAt")::int as h,
           COALESCE(SUM("grandTotal"), 0) as total,
           COUNT(*)::bigint as count
    FROM transactions
    WHERE "createdAt" >= $1
      AND "createdAt" < $2
      AND "status" = 'COMPLETED'
      ${branchCondition}
    GROUP BY EXTRACT(HOUR FROM "createdAt")
    ORDER BY h
  `,
    ...params,
  );

  const hoursMap = new Map<number, { total: number; count: number }>();
  for (const row of rows) {
    hoursMap.set(row.h, { total: Number(row.total), count: Number(row.count) });
  }

  return Array.from({ length: 24 }, (_, i) => {
    const data = hoursMap.get(i) || { total: 0, count: 0 };
    return {
      hour: `${String(i).padStart(2, "0")}:00`,
      total: data.total,
      count: data.count,
    };
  });
}
