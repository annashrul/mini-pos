"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { BADGE_DEFINITIONS } from "./sales-targets-types";
import type { LeaderboardEntry } from "./sales-targets-types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GetSalesTargetsParams {
  type?: string | undefined;
  period?: string | undefined;
  userId?: string | undefined;
  branchId?: string | undefined;
}

interface CreateSalesTargetInput {
  userId?: string | undefined;
  branchId?: string | undefined;
  type: "DAILY" | "WEEKLY" | "MONTHLY";
  targetRevenue?: number | undefined;
  targetTx?: number | undefined;
  targetItems?: number | undefined;
  period: string;
}

// Types re-exported from sales-targets-types.ts

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPeriodDateRange(period: string, type: string): { start: Date; end: Date } {
  if (type === "DAILY") {
    // period format: "2026-04-04"
    const d = new Date(period + "T00:00:00");
    const end = new Date(period + "T23:59:59.999");
    return { start: d, end };
  }

  if (type === "WEEKLY") {
    // period format: "2026-W14"
    const parts = period.split("-W");
    const year = parseInt(parts[0] ?? "2026");
    const week = parseInt(parts[1] ?? "1");
    // ISO week: Jan 4 is always in week 1
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
    const start = new Date(startOfWeek1);
    start.setDate(startOfWeek1.getDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // MONTHLY: period format: "2026-04"
  const parts = period.split("-");
  const year = parseInt(parts[0] ?? "2026");
  const month = parseInt(parts[1] ?? "1") - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getCurrentPeriod(type: "DAILY" | "WEEKLY" | "MONTHLY"): string {
  const now = new Date();
  if (type === "DAILY") {
    return now.toISOString().slice(0, 10);
  }
  if (type === "WEEKLY") {
    // ISO week calculation
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ── Server Actions ────────────────────────────────────────────────────────────

export async function getSalesTargets(params?: GetSalesTargetsParams) {
  await assertMenuActionAccess("sales-targets", "view");

  const where: Record<string, unknown> = {};
  if (params?.type) where.type = params.type;
  if (params?.period) where.period = params.period;
  if (params?.userId) where.userId = params.userId;
  if (params?.branchId) where.branchId = params.branchId;

  const targets = await prisma.salesTarget.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return targets;
}

export async function createSalesTarget(data: CreateSalesTargetInput) {
  await assertMenuActionAccess("sales-targets", "create");

  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Upsert based on unique constraint
  const target = await prisma.salesTarget.upsert({
    where: {
      userId_type_period: {
        userId: data.userId || "",
        type: data.type,
        period: data.period,
      },
    },
    create: {
      userId: data.userId || null,
      branchId: data.branchId || null,
      type: data.type,
      targetRevenue: data.targetRevenue || null,
      targetTx: data.targetTx || null,
      targetItems: data.targetItems || null,
      period: data.period,
      createdBy: session.user.id,
    },
    update: {
      targetRevenue: data.targetRevenue || null,
      targetTx: data.targetTx || null,
      targetItems: data.targetItems || null,
      branchId: data.branchId || null,
      isActive: true,
    },
  });

  await createAuditLog({
    action: "CREATE",
    entity: "SalesTarget",
    entityId: target.id,
    details: { type: data.type, period: data.period, userId: data.userId, targetRevenue: data.targetRevenue },
  });

  revalidatePath("/sales-targets");
  return target;
}

export async function deleteSalesTarget(id: string) {
  await assertMenuActionAccess("sales-targets", "delete");

  const target = await prisma.salesTarget.delete({ where: { id } });

  await createAuditLog({
    action: "DELETE",
    entity: "SalesTarget",
    entityId: id,
    details: { type: target.type, period: target.period },
  });

  revalidatePath("/sales-targets");
  return { success: true };
}

export async function getLeaderboard(params: {
  period?: string | undefined;
  type?: "DAILY" | "WEEKLY" | "MONTHLY" | undefined;
  branchId?: string | undefined;
}) {
  await assertMenuActionAccess("sales-targets", "view");

  const type = params.type || "MONTHLY";
  const period = params.period || getCurrentPeriod(type);
  const { start, end } = getPeriodDateRange(period, type);

  // Get all cashier/user transactions in this period
  const txWhere: Record<string, unknown> = {
    status: "COMPLETED",
    createdAt: { gte: start, lte: end },
  };
  if (params.branchId) txWhere.branchId = params.branchId;

  const [salesAgg, itemsAgg, targets, badges] = await Promise.all([
    // Revenue and tx count per user
    prisma.transaction.groupBy({
      by: ["userId"],
      where: txWhere,
      _sum: { grandTotal: true },
      _count: true,
    }),
    // Items sold per user
    prisma.$queryRaw<{ userId: string; totalItems: bigint }[]>`
      SELECT t."userId", SUM(ti.quantity) as "totalItems"
      FROM "transactions" t
      JOIN "transaction_items" ti ON ti."transactionId" = t.id
      WHERE t.status = 'COMPLETED'
        AND t."createdAt" >= ${start}
        AND t."createdAt" <= ${end}
        ${params.branchId ? prisma.$queryRaw`AND t."branchId" = ${params.branchId}` : prisma.$queryRaw``}
      GROUP BY t."userId"
    `.catch(() => [] as { userId: string; totalItems: bigint }[]),
    // Targets for this period
    prisma.salesTarget.findMany({
      where: { type, period, isActive: true },
      include: { user: { select: { id: true, name: true } } },
    }),
    // Badges for this period
    prisma.cashierBadge.findMany({
      where: { period },
      select: { userId: true, badge: true, title: true },
    }),
  ]);

  // Build target map (userId -> target revenue)
  const targetMap = new Map<string, number>();
  for (const t of targets) {
    if (t.userId && t.targetRevenue) {
      targetMap.set(t.userId, t.targetRevenue);
    }
  }

  // Build items map
  const itemsMap = new Map<string, number>();
  for (const item of itemsAgg) {
    itemsMap.set(item.userId, Number(item.totalItems));
  }

  // Build badges map
  const badgesMap = new Map<string, { badge: string; title: string }[]>();
  for (const b of badges) {
    if (!badgesMap.has(b.userId)) badgesMap.set(b.userId, []);
    badgesMap.get(b.userId)!.push({ badge: b.badge, title: b.title });
  }

  // Get user names
  const userIds = salesAgg.map((s) => s.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, role: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Build leaderboard
  const leaderboard: LeaderboardEntry[] = salesAgg
    .map((s) => {
      const user = userMap.get(s.userId);
      if (!user) return null;
      const revenue = s._sum.grandTotal || 0;
      const target = targetMap.get(s.userId) || 0;
      const percentage = target > 0 ? Math.round((revenue / target) * 100) : 0;
      return {
        rank: 0,
        userId: s.userId,
        name: user.name,
        avatarInitial: user.name.charAt(0).toUpperCase(),
        revenue,
        target,
        percentage,
        transactions: s._count,
        itemsSold: itemsMap.get(s.userId) || 0,
        badges: badgesMap.get(s.userId) || [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.revenue - a!.revenue) as LeaderboardEntry[];

  // Assign ranks
  leaderboard.forEach((entry, i) => {
    entry.rank = i + 1;
  });

  return { leaderboard, period, type };
}

export async function getBadges(userId?: string) {
  await assertMenuActionAccess("sales-targets", "view");

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;

  const badges = await prisma.cashierBadge.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { earnedAt: "desc" },
  });

  return badges;
}

export async function evaluateAndAwardBadges(period?: string) {
  await assertMenuActionAccess("sales-targets", "create");

  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const type = "MONTHLY";
  const currentPeriod = period || getCurrentPeriod(type);
  const { start, end } = getPeriodDateRange(currentPeriod, type);

  const txWhere = {
    status: "COMPLETED" as const,
    createdAt: { gte: start, lte: end },
  };

  // Gather data for all badge evaluations
  const [salesAgg, voidAgg, targets, earlyBirdAgg, nightOwlAgg, branchAgg] = await Promise.all([
    // Revenue + tx count per user
    prisma.transaction.groupBy({
      by: ["userId"],
      where: txWhere,
      _sum: { grandTotal: true },
      _count: true,
    }),
    // Void count per user
    prisma.transaction.groupBy({
      by: ["userId"],
      where: { status: "VOIDED", createdAt: { gte: start, lte: end } },
      _count: true,
    }),
    // Targets for period
    prisma.salesTarget.findMany({
      where: { type, period: currentPeriod, isActive: true },
    }),
    // Early bird: transactions before 10 AM
    prisma.$queryRaw<{ userId: string; cnt: bigint }[]>`
      SELECT "userId", COUNT(*)::bigint as cnt
      FROM transactions
      WHERE status = 'COMPLETED'
        AND "createdAt" >= ${start} AND "createdAt" <= ${end}
        AND EXTRACT(HOUR FROM "createdAt") < 10
      GROUP BY "userId"
      ORDER BY cnt DESC
      LIMIT 1
    `.catch(() => []),
    // Night owl: transactions after 8 PM
    prisma.$queryRaw<{ userId: string; cnt: bigint }[]>`
      SELECT "userId", COUNT(*)::bigint as cnt
      FROM transactions
      WHERE status = 'COMPLETED'
        AND "createdAt" >= ${start} AND "createdAt" <= ${end}
        AND EXTRACT(HOUR FROM "createdAt") >= 20
      GROUP BY "userId"
      ORDER BY cnt DESC
      LIMIT 1
    `.catch(() => []),
    // Team player: distinct branches per user
    prisma.$queryRaw<{ userId: string; branchCount: bigint }[]>`
      SELECT "userId", COUNT(DISTINCT "branchId")::bigint as "branchCount"
      FROM transactions
      WHERE status = 'COMPLETED'
        AND "createdAt" >= ${start} AND "createdAt" <= ${end}
        AND "branchId" IS NOT NULL
      GROUP BY "userId"
      ORDER BY "branchCount" DESC
      LIMIT 1
    `.catch(() => []),
  ]);

  const awarded: { userId: string; badge: string; title: string }[] = [];

  // Helper to award if not already earned
  async function award(userId: string, badgeKey: string) {
    const def = BADGE_DEFINITIONS.find((b) => b.key === badgeKey);
    if (!def) return;

    const exists = await prisma.cashierBadge.findFirst({
      where: { userId, badge: badgeKey, period: currentPeriod },
    });
    if (exists) return;

    await prisma.cashierBadge.create({
      data: {
        userId,
        badge: badgeKey,
        title: def.title,
        description: def.description,
        period: currentPeriod,
      },
    });
    awarded.push({ userId, badge: badgeKey, title: def.title });
  }

  // Build maps
  const voidMap = new Map(voidAgg.map((v) => [v.userId, v._count]));
  const targetMap = new Map(targets.map((t) => [t.userId, t]));

  // Sort by revenue desc
  const sorted = [...salesAgg].sort((a, b) => (b._sum.grandTotal || 0) - (a._sum.grandTotal || 0));

  // TOP_SELLER: highest revenue
  const topSeller = sorted[0];
  if (topSeller) {
    await award(topSeller.userId, "TOP_SELLER");
  }

  // SPEED_DEMON: highest tx count
  const sortedByTx = [...salesAgg].sort((a, b) => b._count - a._count);
  const speedDemon = sortedByTx[0];
  if (speedDemon) {
    await award(speedDemon.userId, "SPEED_DEMON");
  }

  // Process each cashier
  for (const s of salesAgg) {
    const voidCount = voidMap.get(s.userId) || 0;

    // ZERO_VOID
    if (voidCount === 0) {
      await award(s.userId, "ZERO_VOID");
    }

    // TARGET_CRUSHER: exceeded target by 120%+
    const target = targetMap.get(s.userId);
    if (target?.targetRevenue && (s._sum.grandTotal || 0) >= target.targetRevenue * 1.2) {
      await award(s.userId, "TARGET_CRUSHER");
    }
  }

  // EARLY_BIRD
  const earlyBird = earlyBirdAgg[0];
  if (earlyBird && Number(earlyBird.cnt) > 0) {
    await award(earlyBird.userId, "EARLY_BIRD");
  }

  // NIGHT_OWL
  const nightOwl = nightOwlAgg[0];
  if (nightOwl && Number(nightOwl.cnt) > 0) {
    await award(nightOwl.userId, "NIGHT_OWL");
  }

  // TEAM_PLAYER
  const teamPlayer = branchAgg[0];
  if (teamPlayer && Number(teamPlayer.branchCount) > 1) {
    await award(teamPlayer.userId, "TEAM_PLAYER");
  }

  // STREAK_7: check daily targets for last 7 days
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  // Get all users with daily targets in last 7 days
  const dailyTargets = await prisma.salesTarget.findMany({
    where: {
      type: "DAILY",
      isActive: true,
      period: { gte: sevenDaysAgo.toISOString().slice(0, 10), lte: today.toISOString().slice(0, 10) },
      userId: { not: null },
    },
  });

  // Group by user
  const userDailyTargets = new Map<string, typeof dailyTargets>();
  for (const dt of dailyTargets) {
    if (!dt.userId) continue;
    if (!userDailyTargets.has(dt.userId)) userDailyTargets.set(dt.userId, []);
    userDailyTargets.get(dt.userId)!.push(dt);
  }

  for (const [userId, dts] of userDailyTargets) {
    if (dts.length < 7) continue;
    // Check each day's actual vs target
    let streakCount = 0;
    for (const dt of dts) {
      const dayRange = getPeriodDateRange(dt.period, "DAILY");
      const daySales = await prisma.transaction.aggregate({
        where: { userId, status: "COMPLETED", createdAt: { gte: dayRange.start, lte: dayRange.end } },
        _sum: { grandTotal: true },
      });
      if (dt.targetRevenue && (daySales._sum.grandTotal || 0) >= dt.targetRevenue) {
        streakCount++;
      }
    }
    if (streakCount >= 7) {
      await award(userId, "STREAK_7");
    }
  }

  await createAuditLog({
    action: "EVALUATE_BADGES",
    entity: "CashierBadge",
    details: { period: currentPeriod, awarded: awarded.length },
  });

  revalidatePath("/sales-targets");
  return { awarded, period: currentPeriod };
}

// ── Utility: get users for select dropdown ────────────────────────────────────

export async function getSalesTargetUsers() {
  const users = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, role: true, branchId: true },
    orderBy: { name: "asc" },
  });
  return users;
}

export async function getSalesTargetBranches() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return branches;
}
