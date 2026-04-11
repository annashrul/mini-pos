"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function assertPlatformOwner() {
  const session = await auth();
  const role = (session?.user as Record<string, unknown> | undefined)?.role;
  if (role !== "PLATFORM_OWNER") throw new Error("Unauthorized");
}

export async function getPlatformDashboardStats() {
  await assertPlatformOwner();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalCompanies,
    totalUsers,
    totalBranches,
    totalProducts,
    planCounts,
    recentCompanies,
    subscriptionPayments,
    prevMonthlyRevenue,
    todayTransactions,
    monthTransactions,
    tenantRevenue,
    activeShifts,
    newRegistrations,
    topTenants,
    recentPayments,
    expiringSoon,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.user.count({ where: { role: { not: "PLATFORM_OWNER" } } }),
    prisma.branch.count(),
    prisma.product.count(),
    prisma.company.groupBy({
      by: ["plan"],
      _count: { _all: true },
    }),
    prisma.company.findMany({
      select: { id: true, name: true, plan: true, createdAt: true, _count: { select: { users: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Subscription revenue this month
    prisma.subscriptionPayment.aggregate({
      where: { status: "PAID", createdAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Subscription revenue prev month
    prisma.subscriptionPayment.aggregate({
      where: { status: "PAID", createdAt: { gte: prevMonthStart, lt: monthStart } },
      _sum: { amount: true },
    }),
    // Today's transactions across all tenants
    prisma.transaction.count({
      where: { status: "COMPLETED", createdAt: { gte: todayStart } },
    }),
    // Month transactions across all tenants
    prisma.transaction.count({
      where: { status: "COMPLETED", createdAt: { gte: monthStart } },
    }),
    // Total tenant revenue this month
    prisma.transaction.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: monthStart } },
      _sum: { grandTotal: true },
    }),
    // Active shifts right now
    prisma.cashierShift.count({ where: { isOpen: true } }),
    // New registrations this week
    prisma.company.count({
      where: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    // Top 5 tenants by revenue this month
    prisma.$queryRawUnsafe<{ companyId: string; companyName: string; revenue: number; txCount: number }[]>(`
      SELECT c.id AS "companyId", c.name AS "companyName",
        COALESCE(SUM(t."grandTotal"), 0)::float AS revenue,
        COUNT(t.id)::int AS "txCount"
      FROM companies c
      LEFT JOIN branches b ON b."companyId" = c.id
      LEFT JOIN transactions t ON t."branchId" = b.id AND t.status = 'COMPLETED' AND t."createdAt" >= $1
      GROUP BY c.id, c.name
      HAVING COUNT(t.id) > 0
      ORDER BY revenue DESC
      LIMIT 5
    `, monthStart),
    // Recent subscription payments
    prisma.subscriptionPayment.findMany({
      where: { status: "PAID" },
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Companies with plan expiring in next 7 days
    prisma.company.findMany({
      where: {
        plan: { not: "FREE" },
        planExpiresAt: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true, name: true, plan: true, planExpiresAt: true },
      orderBy: { planExpiresAt: "asc" },
    }),
  ]);

  const planMap: Record<string, number> = {};
  for (const p of planCounts) {
    planMap[p.plan] = p._count._all;
  }

  const subRevenue = subscriptionPayments?._sum?.amount || 0;
  const prevSubRevenue = prevMonthlyRevenue?._sum?.amount || 0;
  const revenueGrowth = prevSubRevenue > 0 ? ((subRevenue - prevSubRevenue) / prevSubRevenue) * 100 : 0;

  return {
    totalCompanies,
    totalUsers,
    totalBranches,
    totalProducts,
    planDistribution: {
      FREE: planMap["FREE"] || 0,
      PRO: planMap["PRO"] || 0,
      ENTERPRISE: planMap["ENTERPRISE"] || 0,
    },
    subscriptionRevenue: subRevenue,
    subscriptionCount: subscriptionPayments._count._all,
    revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    todayTransactions,
    monthTransactions,
    tenantTotalRevenue: tenantRevenue?._sum?.grandTotal || 0,
    activeShifts,
    newRegistrations,
    topTenants: topTenants.map((t) => ({
      companyId: t.companyId,
      companyName: t.companyName,
      revenue: t.revenue,
      txCount: t.txCount,
    })),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      companyName: p.company.name,
      plan: p.plan,
      amount: p.amount,
      createdAt: p.createdAt.toISOString(),
    })),
    recentCompanies: recentCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      plan: c.plan,
      userCount: c._count.users,
      createdAt: c.createdAt.toISOString(),
    })),
    expiringSoon: expiringSoon
      .filter((c) => c.planExpiresAt !== null)
      .map((c) => ({
        id: c.id,
        name: c.name,
        plan: c.plan,
        expiresAt: c.planExpiresAt!.toISOString(),
      })),
  };
}
