"use server";

import { prisma } from "@/lib/prisma";

export async function getDashboardStats(branchId?: string, period?: "today" | "week" | "month" | "year") {
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
    prevPeriodStart = new Date(today); prevPeriodStart.setDate(prevPeriodStart.getDate() - 1);
  } else if (p === "week") {
    periodStart = new Date(today); periodStart.setDate(today.getDate() - 7);
    prevPeriodStart = new Date(periodStart); prevPeriodStart.setDate(prevPeriodStart.getDate() - 7);
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
    monthRevenue,
    monthTxCount,
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
    weekSalesAgg,
    refundCount,
    voidCount,
    activePromotions,
    pendingPurchaseOrders,
    todayProfitItems,
    lowStockRaw,
  ] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: periodStart, lt: tomorrow }, ...completedWhere } }),
    prisma.transaction.count({ where: { createdAt: { gte: periodStart, lt: tomorrow }, ...completedWhere } }),
    prisma.transaction.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: yesterday, lt: today }, ...completedWhere } }),
    prisma.transaction.count({ where: { createdAt: { gte: yesterday, lt: today }, ...completedWhere } }),
    prisma.transaction.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: periodStart, lt: tomorrow }, ...completedWhere } }),
    prisma.transaction.count({ where: { createdAt: { gte: periodStart, lt: tomorrow }, ...completedWhere } }),
    prisma.transaction.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: prevPeriodStart, lt: periodStart }, ...completedWhere } }),
    prisma.transaction.count({ where: { createdAt: { gte: prevPeriodStart, lt: periodStart }, ...completedWhere } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.customer.count(),
    prisma.transaction.findMany({ include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 7 }),
    prisma.transactionItem.groupBy({ by: ["productName"], _sum: { quantity: true, subtotal: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
    getDailySalesData(30, branchFilter),
    getYearlyComparison(branchFilter),
    prisma.transaction.groupBy({ by: ["paymentMethod"], _sum: { grandTotal: true }, _count: true, where: { createdAt: { gte: periodStart, lt: tomorrow }, ...completedWhere } }),
    getTopCashiers(periodStart, tomorrow, branchFilter),
    getCategoryBreakdown(periodStart, tomorrow, branchFilter),
    getHourlySalesData(today, tomorrow, branchFilter),
    prisma.transaction.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: periodStart, lt: tomorrow }, ...completedWhere } }),
    prisma.transaction.count({ where: { createdAt: { gte: periodStart, lt: tomorrow }, status: "REFUNDED" as const, ...branchFilter } }),
    prisma.transaction.count({ where: { createdAt: { gte: periodStart, lt: tomorrow }, status: "VOIDED" as const, ...branchFilter } }),
    prisma.promotion.count({ where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } } }),
    prisma.purchaseOrder.count({ where: { status: { in: ["DRAFT", "ORDERED"] }, ...branchFilter } }),
    prisma.transactionItem.findMany({
      where: { transaction: { createdAt: { gte: periodStart, lt: tomorrow }, ...completedWhere } },
      select: { quantity: true, unitPrice: true, product: { select: { purchasePrice: true } } },
    }),
    prisma.product.findMany({ where: { isActive: true }, include: { category: true }, orderBy: { stock: "asc" } }),
  ]);

  const lowStockProducts = lowStockRaw.filter((p) => p.stock <= p.minStock).slice(0, 10);

  // Branch performance
  let branchPerformance: { branchId: string; branchName: string; periodSales: number; periodTransactions: number; prevPeriodSales: number; prevPeriodTransactions: number }[] = [];
  if (!branchId) {
    const activeBranches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    branchPerformance = await Promise.all(
      activeBranches.map(async (branch) => {
        const bWhere = { status: "COMPLETED" as const, branchId: branch.id };
        const [periodAgg, periodCount, prevAgg, prevCount] = await Promise.all([
          prisma.transaction.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: periodStart, lt: tomorrow }, ...bWhere } }),
          prisma.transaction.count({ where: { createdAt: { gte: periodStart, lt: tomorrow }, ...bWhere } }),
          prisma.transaction.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: prevPeriodStart, lt: periodStart }, ...bWhere } }),
          prisma.transaction.count({ where: { createdAt: { gte: prevPeriodStart, lt: periodStart }, ...bWhere } }),
        ]);
        return {
          branchId: branch.id,
          branchName: branch.name,
          periodSales: periodAgg._sum.grandTotal || 0,
          periodTransactions: periodCount,
          prevPeriodSales: prevAgg._sum.grandTotal || 0,
          prevPeriodTransactions: prevCount,
        };
      })
    );
  }

  const todaySalesVal = todaySales._sum.grandTotal || 0;
  const yesterdaySalesVal = yesterdaySales._sum.grandTotal || 0;
  const monthRevenueVal = monthRevenue._sum.grandTotal || 0;
  const prevMonthRevenueVal = prevMonthRevenue._sum.grandTotal || 0;

  const salesGrowthDay = yesterdaySalesVal > 0 ? Math.round(((todaySalesVal - yesterdaySalesVal) / yesterdaySalesVal) * 100) : 0;
  const salesGrowthMonth = prevMonthRevenueVal > 0 ? Math.round(((monthRevenueVal - prevMonthRevenueVal) / prevMonthRevenueVal) * 100) : 0;
  const txGrowthMonth = prevMonthTxCount > 0 ? Math.round(((monthTxCount - prevMonthTxCount) / prevMonthTxCount) * 100) : 0;

  const avgTransactionValue = todayTxCount > 0 ? Math.round(todaySalesVal / todayTxCount) : 0;
  const todayProfit = todayProfitItems.reduce((sum, item) => {
    const purchasePrice = item.product?.purchasePrice || 0;
    return sum + (item.unitPrice - purchasePrice) * item.quantity;
  }, 0);
  const weekSales = weekSalesAgg._sum.grandTotal || 0;

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
    lowStockProducts,
    recentTransactions,
    topProducts,
    dailySales,
    yearlyComparison: monthlySales as { month: string; thisYear: number; lastYear: number; thisYearCount: number; lastYearCount: number }[],
    paymentBreakdown: paymentBreakdown.map((p) => ({
      method: p.paymentMethod,
      total: p._sum.grandTotal || 0,
      count: p._count,
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
  };
}

// Single query with GROUP BY instead of 30 individual queries
async function getDailySalesData(days: number, bf: Record<string, string> = {}) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  const branchCondition = bf.branchId ? `AND "branchId" = '${bf.branchId}'` : "";

  const rows = await prisma.$queryRawUnsafe<{ d: Date; total: bigint; count: bigint }[]>(`
    SELECT DATE_TRUNC('day', "createdAt") as d,
           COALESCE(SUM("grandTotal"), 0) as total,
           COUNT(*)::bigint as count
    FROM "Transaction"
    WHERE "createdAt" >= $1
      AND "status" = 'COMPLETED'
      ${branchCondition}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY d ASC
  `, startDate);

  const salesMap = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const dateKey = new Date(row.d).toISOString().slice(0, 10);
    salesMap.set(dateKey, { total: Number(row.total), count: Number(row.count) });
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
      date: date.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
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
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  const branchCondition = bf.branchId ? `AND "branchId" = '${bf.branchId}'` : "";

  const rows = await prisma.$queryRawUnsafe<{ y: number; m: number; total: bigint; count: bigint }[]>(`
    SELECT EXTRACT(YEAR FROM "createdAt")::int as y,
           EXTRACT(MONTH FROM "createdAt")::int as m,
           COALESCE(SUM("grandTotal"), 0) as total,
           COUNT(*)::bigint as count
    FROM "Transaction"
    WHERE "createdAt" >= $1
      AND "status" = 'COMPLETED'
      ${branchCondition}
    GROUP BY EXTRACT(YEAR FROM "createdAt"), EXTRACT(MONTH FROM "createdAt")
    ORDER BY y, m
  `, new Date(lastYear, 0, 1));

  const dataMap = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    dataMap.set(`${row.y}-${row.m}`, { total: Number(row.total), count: Number(row.count) });
  }

  return monthNames.map((month, i) => {
    const thisData = dataMap.get(`${thisYear}-${i + 1}`) || { total: 0, count: 0 };
    const lastData = dataMap.get(`${lastYear}-${i + 1}`) || { total: 0, count: 0 };
    return {
      month,
      thisYear: thisData.total,
      lastYear: lastData.total,
      thisYearCount: thisData.count,
      lastYearCount: lastData.count,
    };
  });
}

async function getTopCashiers(start: Date, end: Date, bf: Record<string, string> = {}) {
  const txByUser = await prisma.transaction.groupBy({ by: ["userId"], _sum: { grandTotal: true }, _count: true, where: { createdAt: { gte: start, lt: end }, status: "COMPLETED", ...bf }, orderBy: { _sum: { grandTotal: "desc" } }, take: 5 });
  const userIds = txByUser.map((t) => t.userId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  return txByUser.map((t) => ({ name: userMap.get(t.userId) || "Unknown", total: t._sum.grandTotal || 0, count: t._count }));
}

async function getCategoryBreakdown(start: Date, end: Date, bf: Record<string, string> = {}) {
  const items = await prisma.transactionItem.findMany({
    where: { transaction: { createdAt: { gte: start, lt: end }, status: "COMPLETED", ...bf } },
    select: { subtotal: true, quantity: true, product: { select: { category: { select: { name: true } } } } },
  });
  const map = new Map<string, { total: number; qty: number }>();
  for (const item of items) {
    const cat = item.product?.category?.name || "Lainnya";
    const existing = map.get(cat) || { total: 0, qty: 0 };
    existing.total += item.subtotal;
    existing.qty += item.quantity;
    map.set(cat, existing);
  }
  return Array.from(map.entries()).map(([name, data]) => ({ name, total: data.total, qty: data.qty })).sort((a, b) => b.total - a.total);
}

// Single query with GROUP BY instead of iterating 24 hours
async function getHourlySalesData(start: Date, end: Date, bf: Record<string, string> = {}) {
  const branchCondition = bf.branchId ? `AND "branchId" = '${bf.branchId}'` : "";

  const rows = await prisma.$queryRawUnsafe<{ h: number; total: bigint; count: bigint }[]>(`
    SELECT EXTRACT(HOUR FROM "createdAt")::int as h,
           COALESCE(SUM("grandTotal"), 0) as total,
           COUNT(*)::bigint as count
    FROM "Transaction"
    WHERE "createdAt" >= $1
      AND "createdAt" < $2
      AND "status" = 'COMPLETED'
      ${branchCondition}
    GROUP BY EXTRACT(HOUR FROM "createdAt")
    ORDER BY h
  `, start, end);

  const hoursMap = new Map<number, { total: number; count: number }>();
  for (const row of rows) {
    hoursMap.set(row.h, { total: Number(row.total), count: Number(row.count) });
  }

  return Array.from({ length: 24 }, (_, i) => {
    const data = hoursMap.get(i) || { total: 0, count: 0 };
    return { hour: `${String(i).padStart(2, "0")}:00`, total: data.total, count: data.count };
  });
}
