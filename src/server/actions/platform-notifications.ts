"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function assertPlatformOwner() {
  const session = await auth();
  const role = (session?.user as Record<string, unknown> | undefined)?.role;
  if (role !== "PLATFORM_OWNER") throw new Error("Unauthorized");
}

/**
 * Get activity logs across all tenants (for platform owner)
 */
export async function getPlatformActivityLogs(params: {
  page?: number;
  perPage?: number;
  search?: string;
  action?: string;
  entity?: string;
} = {}) {
  await assertPlatformOwner();
  const { page = 1, perPage = 20, search, action, entity } = params;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { entity: { contains: search, mode: "insensitive" } },
      { details: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { company: { name: { contains: search, mode: "insensitive" } } } },
    ];
  }
  if (action && action !== "ALL") where.action = action;
  if (entity && entity !== "ALL") where.entity = entity;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true, role: true, company: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      details: l.details,
      userName: l.user?.name || "System",
      userEmail: l.user?.email || "",
      userRole: l.user?.role || "",
      companyName: l.user?.company?.name || "Platform",
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Get platform notifications (recent important events)
 */
export async function getPlatformNotifications() {
  await assertPlatformOwner();

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [recentEvents, unreadCount] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        action: { in: ["LOGIN", "CREATE", "UPDATE_PLAN", "EXTEND_PLAN", "REVOKE_PLAN", "REGISTER"] },
        entity: { in: ["Session", "Company", "Subscription", "User", "Transaction"] },
        createdAt: { gte: oneDayAgo },
      },
      include: {
        user: { select: { name: true, company: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    // Count events in last hour as "unread"
    prisma.auditLog.count({
      where: {
        action: { in: ["CREATE", "UPDATE_PLAN", "EXTEND_PLAN", "LOGIN"] },
        entity: { in: ["Company", "Subscription", "Session"] },
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    notifications: recentEvents.map((e) => ({
      id: e.id,
      action: e.action,
      entity: e.entity,
      details: e.details,
      userName: e.user?.name || "System",
      companyName: e.user?.company?.name || "Platform",
      createdAt: e.createdAt.toISOString(),
    })),
    unreadCount,
  };
}
