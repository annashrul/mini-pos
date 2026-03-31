"use server";

import { prisma } from "@/lib/prisma";

// Repeat customer detection
export async function getRepeatCustomers(_branchId?: string) {
  const customers = await prisma.customer.findMany({
    include: {
      _count: { select: { transactions: true } },
    },
    orderBy: { totalSpending: "desc" },
    take: 20,
  });

  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    memberLevel: c.memberLevel,
    totalSpending: c.totalSpending,
    points: c.points,
    transactionCount: c._count.transactions,
    isRepeat: c._count.transactions > 1,
  }));
}

// Favorite products per customer
export async function getCustomerFavorites(customerId: string, _branchId?: string) {
  const items = await prisma.transactionItem.groupBy({
    by: ["productId", "productName"],
    where: {
      transaction: { customerId },
    },
    _sum: { quantity: true, subtotal: true },
    _count: true,
    orderBy: { _sum: { quantity: "desc" } },
    take: 10,
  });

  return items.map((i) => ({
    productName: i.productName,
    productId: i.productId,
    totalQty: i._sum.quantity || 0,
    totalSpent: i._sum.subtotal || 0,
    purchaseCount: i._count,
  }));
}

// Shopping frequency analysis
export async function getShoppingFrequency(_branchId?: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const customers = await prisma.customer.findMany({
    where: {
      transactions: { some: { createdAt: { gte: thirtyDaysAgo } } },
    },
    include: {
      transactions: {
        where: { createdAt: { gte: thirtyDaysAgo }, status: "COMPLETED" },
        select: { createdAt: true, grandTotal: true },
        orderBy: { createdAt: "desc" },
      },
    },
    take: 20,
  });

  return customers
    .map((c) => {
      const txCount = c.transactions.length;
      const totalSpent = c.transactions.reduce(
        (sum, tx) => sum + tx.grandTotal,
        0,
      );
      const lastVisit = c.transactions[0]?.createdAt || null;
      const avgSpending = txCount > 0 ? totalSpent / txCount : 0;

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        memberLevel: c.memberLevel,
        visitCount: txCount,
        totalSpent,
        avgSpending,
        lastVisit,
      };
    })
    .sort((a, b) => b.visitCount - a.visitCount);
}

// Loyalty points summary
export async function getLoyaltySummary(_branchId?: string) {
  const levels = await prisma.customer.groupBy({
    by: ["memberLevel"],
    _count: true,
    _sum: { totalSpending: true, points: true },
  });

  return levels.map((l) => ({
    level: l.memberLevel,
    count: l._count,
    totalSpending: l._sum.totalSpending || 0,
    totalPoints: l._sum.points || 0,
  }));
}
