"use server";

import { prisma } from "@/lib/prisma";

export async function getSalesReport(
  period: "daily" | "monthly" = "daily",
  dateFrom?: string,
  dateTo?: string
) {
  const now = new Date();
  const results = [];

  if (period === "daily") {
    const startDate = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const endDate = dateTo ? new Date(dateTo) : now;
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

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
        },
      });

      results.push({
        label: date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
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
        },
      });

      results.push({
        label: date.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
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
  dateTo?: string
) {
  const where: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1);
      (where.createdAt as Record<string, unknown>).lt = to;
    }
  }

  const items = await prisma.transactionItem.groupBy({
    by: ["productName", "productCode"],
    where,
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  return items;
}

export async function getProfitLossReport(dateFrom?: string, dateTo?: string) {
  const now = new Date();
  const monthStart = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = dateTo ? (() => { const d = new Date(dateTo); d.setDate(d.getDate() + 1); return d; })() : new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const transactions = await prisma.transaction.findMany({
    where: { createdAt: { gte: monthStart, lt: monthEnd }, status: "COMPLETED" },
    include: { items: { include: { product: { select: { purchasePrice: true } } } } },
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

  const periodLabel = dateFrom && dateTo
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
