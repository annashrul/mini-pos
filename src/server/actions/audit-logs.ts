"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";

export async function getAuditLogs(params?: {
  search?: string;
  entity?: string;
  branchId?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const { search, entity, branchId, page = 1, perPage = 15, sortBy, sortDir = "desc" } = params || {};
  const where: Record<string, unknown> = {};
  if (branchId) where.branchId = branchId;

  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { entity: { contains: search, mode: "insensitive" } },
      { details: { contains: search, mode: "insensitive" } },
    ];
  }
  if (entity && entity !== "ALL") {
    where.entity = entity;
  }

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "user"
      ? { user: { name: direction } }
      : sortBy === "entity"
        ? { entity: direction }
        : { createdAt: direction };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { name: true, email: true } }, branch: { select: { name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, totalPages: Math.ceil(total / perPage) };
}

export async function createAuditLog(params: {
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return;

  try {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        details: params.details ?? null,
      },
    });
  } catch {
    // silently fail - audit logs should not block operations
  }
}
