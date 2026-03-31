"use server";

import { prisma } from "@/lib/prisma";

function buildTransactionDateWhere(dateFrom?: string, dateTo?: string) {
  const createdAt: Record<string, Date> = {};
  if (dateFrom) createdAt.gte = new Date(dateFrom);
  if (dateTo) {
    const to = new Date(dateTo);
    to.setDate(to.getDate() + 1);
    createdAt.lt = to;
  }
  return Object.keys(createdAt).length > 0 ? { createdAt } : {};
}

export async function getSalesReport(
  period: "daily" | "monthly" = "daily",
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const now = new Date();
  const results = [];
  const branchWhere = branchId ? { branchId } : {};

  if (period === "daily") {
    const startDate = dateFrom
      ? new Date(dateFrom)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const endDate = dateTo ? new Date(dateTo) : now;
    const days =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const sales = await prisma.transaction.aggregate({
        _sum: { grandTotal: true, discountAmount: true, taxAmount: true },
        _count: true,
        where: {
          createdAt: { gte: date, lt: nextDate },
          status: "COMPLETED",
          ...branchWhere,
        },
      });

      results.push({
        label: date.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
        }),
        sales: sales._sum.grandTotal || 0,
        discount: sales._sum.discountAmount || 0,
        tax: sales._sum.taxAmount || 0,
        transactions: sales._count,
      });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const sales = await prisma.transaction.aggregate({
        _sum: { grandTotal: true, discountAmount: true, taxAmount: true },
        _count: true,
        where: {
          createdAt: { gte: date, lt: nextMonth },
          status: "COMPLETED",
          ...branchWhere,
        },
      });

      results.push({
        label: date.toLocaleDateString("id-ID", {
          month: "short",
          year: "2-digit",
        }),
        sales: sales._sum.grandTotal || 0,
        discount: sales._sum.discountAmount || 0,
        tax: sales._sum.taxAmount || 0,
        transactions: sales._count,
      });
    }
  }

  return results;
}

export async function getTopProductsReport(
  limit: number = 10,
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const items = await prisma.transactionItem.groupBy({
    by: ["productName", "productCode"],
    where: {
      transaction: {
        status: "COMPLETED",
        ...(branchId ? { branchId } : {}),
        ...buildTransactionDateWhere(dateFrom, dateTo),
      },
    },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  return items;
}

export async function getProfitLossReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const now = new Date();
  const monthStart = dateFrom
    ? new Date(dateFrom)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = dateTo
    ? (() => {
        const d = new Date(dateTo);
        d.setDate(d.getDate() + 1);
        return d;
      })()
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: monthStart, lt: monthEnd },
      status: "COMPLETED",
      ...(branchId ? { branchId } : {}),
    },
    include: {
      items: { include: { product: { select: { purchasePrice: true } } } },
    },
  });

  let totalRevenue = 0;
  let totalCost = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const tx of transactions) {
    totalRevenue += tx.grandTotal;
    totalDiscount += tx.discountAmount;
    totalTax += tx.taxAmount;
    for (const item of tx.items) {
      totalCost += item.product.purchasePrice * item.quantity;
    }
  }

  const periodLabel =
    dateFrom && dateTo
      ? `${new Date(dateFrom).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} - ${new Date(dateTo).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}`
      : `${monthStart.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`;

  return {
    revenue: totalRevenue,
    cost: totalCost,
    grossProfit: totalRevenue - totalCost,
    discount: totalDiscount,
    tax: totalTax,
    netProfit: totalRevenue - totalCost - totalTax,
    transactionCount: transactions.length,
    period: periodLabel,
  };
}

export async function getPaymentMethodReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const grouped = await prisma.transaction.groupBy({
    by: ["paymentMethod"],
    where: {
      status: "COMPLETED",
      ...(branchId ? { branchId } : {}),
      ...buildTransactionDateWhere(dateFrom, dateTo),
    },
    _sum: { grandTotal: true },
    _count: true,
    orderBy: { _sum: { grandTotal: "desc" } },
  });

  return grouped.map((item) => ({
    method: item.paymentMethod,
    total: item._sum.grandTotal || 0,
    transactions: item._count,
  }));
}

export async function getHourlySalesReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const now = new Date();
  const start = dateFrom
    ? new Date(dateFrom)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const end = dateTo ? new Date(dateTo) : new Date();
  end.setHours(23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: {
      status: "COMPLETED",
      ...(branchId ? { branchId } : {}),
      createdAt: { gte: start, lte: end },
    },
    select: { createdAt: true, grandTotal: true },
  });

  const bucket: Record<number, { total: number; transactions: number }> = {};
  for (let hour = 0; hour < 24; hour += 1) {
    bucket[hour] = { total: 0, transactions: 0 };
  }
  transactions.forEach((tx) => {
    const hour = new Date(tx.createdAt).getHours();
    if (!bucket[hour]) return;
    bucket[hour].total += tx.grandTotal;
    bucket[hour].transactions += 1;
  });

  return Object.entries(bucket).map(([hour, value]) => ({
    hour: `${hour.toString().padStart(2, "0")}:00`,
    total: value.total,
    transactions: value.transactions,
  }));
}

export async function getReportOverview(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const where = {
    status: "COMPLETED" as const,
    ...(branchId ? { branchId } : {}),
    ...buildTransactionDateWhere(dateFrom, dateTo),
  };

  const [totals, topCashiersRaw, itemRows] = await Promise.all([
    prisma.transaction.aggregate({
      where,
      _sum: { grandTotal: true, discountAmount: true, taxAmount: true },
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ["userId"],
      where,
      _sum: { grandTotal: true },
      _count: true,
      orderBy: { _sum: { grandTotal: "desc" } },
      take: 5,
    }),
    prisma.transactionItem.findMany({
      where: { transaction: where },
      select: {
        quantity: true,
        subtotal: true,
        product: { select: { category: { select: { name: true } } } },
      },
    }),
  ]);

  const users = await prisma.user.findMany({
    where: { id: { in: topCashiersRaw.map((item) => item.userId) } },
    select: { id: true, name: true },
  });

  const totalItemsSold = itemRows.reduce((sum, row) => sum + row.quantity, 0);
  const categoryMap = new Map<string, { total: number; quantity: number }>();
  itemRows.forEach((row) => {
    const categoryName = row.product.category.name;
    const current = categoryMap.get(categoryName) ?? { total: 0, quantity: 0 };
    current.total += row.subtotal;
    current.quantity += row.quantity;
    categoryMap.set(categoryName, current);
  });

  return {
    revenue: totals._sum.grandTotal || 0,
    transactions: totals._count,
    totalItemsSold,
    averageTicket:
      totals._count > 0 ? (totals._sum.grandTotal || 0) / totals._count : 0,
    totalDiscount: totals._sum.discountAmount || 0,
    totalTax: totals._sum.taxAmount || 0,
    topCashiers: topCashiersRaw.map((item) => ({
      userId: item.userId,
      name: users.find((user) => user.id === item.userId)?.name || "Unknown",
      transactions: item._count,
      revenue: item._sum.grandTotal || 0,
    })),
    categorySales: Array.from(categoryMap.entries())
      .map(([category, value]) => ({
        category,
        total: value.total,
        quantity: value.quantity,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
  };
}
