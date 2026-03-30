"use server";

import { prisma } from "@/lib/prisma";

export async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthEnd = monthStart;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const completedWhere = { status: "COMPLETED" as const };

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
  ] = await Promise.all([
    // Today
    prisma.transaction.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: today, lt: tomorrow }, ...completedWhere } }),
    prisma.transaction.count({ where: { createdAt: { gte: today, lt: tomorrow }, ...completedWhere } }),
    // Yesterday
    prisma.transaction.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: yesterday, lt: today }, ...completedWhere } }),
    prisma.transaction.count({ where: { createdAt: { gte: yesterday, lt: today }, ...completedWhere } }),
    // This month
    prisma.transaction.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: monthStart, lt: monthEnd }, ...completedWhere } }),
    prisma.transaction.count({ where: { createdAt: { gte: monthStart, lt: monthEnd }, ...completedWhere } }),
    // Last month
    prisma.transaction.aggregate({ _sum: { grandTotal: true }, where: { createdAt: { gte: prevMonthStart, lt: prevMonthEnd }, ...completedWhere } }),
    prisma.transaction.count({ where: { createdAt: { gte: prevMonthStart, lt: prevMonthEnd }, ...completedWhere } }),
    // Totals
    prisma.product.count({ where: { isActive: true } }),
    prisma.customer.count(),
    // Recent transactions
    prisma.transaction.findMany({ include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 7 }),
    // Top products
    prisma.transactionItem.groupBy({ by: ["productName"], _sum: { quantity: true, subtotal: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
    // Daily sales 30 days
    getDailySalesData(30),
    // Monthly sales 6 months
    getMonthlySalesData(6),
    // Payment method breakdown this month
    prisma.transaction.groupBy({ by: ["paymentMethod"], _sum: { grandTotal: true }, _count: true, where: { createdAt: { gte: monthStart, lt: monthEnd }, ...completedWhere } }),
    // Top cashiers this month
    getTopCashiers(monthStart, monthEnd),
    // Category breakdown
    getCategoryBreakdown(monthStart, monthEnd),
    // Hourly sales today
    getHourlySalesData(today, tomorrow),
  ]);

  // Low stock
  const lowStockRaw = await prisma.product.findMany({ where: { isActive: true }, include: { category: true }, orderBy: { stock: "asc" } });
  const lowStockProducts = lowStockRaw.filter((p) => p.stock <= p.minStock).slice(0, 10);

  // Growth calculations
  const todaySalesVal = todaySales._sum.grandTotal || 0;
  const yesterdaySalesVal = yesterdaySales._sum.grandTotal || 0;
  const monthRevenueVal = monthRevenue._sum.grandTotal || 0;
  const prevMonthRevenueVal = prevMonthRevenue._sum.grandTotal || 0;

  const salesGrowthDay = yesterdaySalesVal > 0 ? Math.round(((todaySalesVal - yesterdaySalesVal) / yesterdaySalesVal) * 100) : 0;
  const salesGrowthMonth = prevMonthRevenueVal > 0 ? Math.round(((monthRevenueVal - prevMonthRevenueVal) / prevMonthRevenueVal) * 100) : 0;
  const txGrowthMonth = prevMonthTxCount > 0 ? Math.round(((monthTxCount - prevMonthTxCount) / prevMonthTxCount) * 100) : 0;

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
    monthlySales,
    paymentBreakdown: paymentBreakdown.map((p) => ({
      method: p.paymentMethod,
      total: p._sum.grandTotal || 0,
      count: p._count,
    })),
    topCashiers,
    categoryBreakdown,
    hourlySales,
  };
}

async function getDailySalesData(days: number) {
  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today); date.setDate(date.getDate() - i); date.setHours(0, 0, 0, 0);
    const next = new Date(date); next.setDate(next.getDate() + 1);
    const sales = await prisma.transaction.aggregate({ _sum: { grandTotal: true }, _count: true, where: { createdAt: { gte: date, lt: next }, status: "COMPLETED" } });
    result.push({ date: date.toLocaleDateString("id-ID", { day: "numeric", month: "short" }), total: sales._sum.grandTotal || 0, count: sales._count });
  }
  return result;
}

async function getMonthlySalesData(months: number) {
  const result = [];
  const today = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
    const sales = await prisma.transaction.aggregate({ _sum: { grandTotal: true }, _count: true, where: { createdAt: { gte: start, lt: end }, status: "COMPLETED" } });
    result.push({ month: start.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }), total: sales._sum.grandTotal || 0, count: sales._count });
  }
  return result;
}

async function getTopCashiers(start: Date, end: Date) {
  const txByUser = await prisma.transaction.groupBy({ by: ["userId"], _sum: { grandTotal: true }, _count: true, where: { createdAt: { gte: start, lt: end }, status: "COMPLETED" }, orderBy: { _sum: { grandTotal: "desc" } }, take: 5 });
  const userIds = txByUser.map((t) => t.userId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  return txByUser.map((t) => ({ name: userMap.get(t.userId) || "Unknown", total: t._sum.grandTotal || 0, count: t._count }));
}

async function getCategoryBreakdown(start: Date, end: Date) {
  const items = await prisma.transactionItem.findMany({
    where: { transaction: { createdAt: { gte: start, lt: end }, status: "COMPLETED" } },
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

async function getHourlySalesData(start: Date, end: Date) {
  const txs = await prisma.transaction.findMany({
    where: { createdAt: { gte: start, lt: end }, status: "COMPLETED" },
    select: { createdAt: true, grandTotal: true },
  });
  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, "0")}:00`, total: 0, count: 0 }));
  for (const tx of txs) {
    const h = new Date(tx.createdAt).getHours();
    hours[h]!.total += tx.grandTotal;
    hours[h]!.count++;
  }
  return hours;
}
