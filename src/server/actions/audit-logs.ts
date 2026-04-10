"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getCurrentCompanyId } from "@/lib/company";

type AuditLogListItem = Prisma.AuditLogGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    branch: { select: { name: true } };
  };
}>;

export async function getAuditLogs(params?: {
  search?: string;
  entity?: string;
  action?: string;
  branchId?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ logs: AuditLogListItem[]; total: number; totalPages: number }> {
  const {
    search,
    entity,
    action,
    branchId,
    page = 1,
    perPage = 15,
    sortBy,
    sortDir = "desc",
    dateFrom,
    dateTo,
  } = params || {};
  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { user: { companyId } };
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
  if (action && action !== "ALL") {
    where.action = action;
  }
  if (dateFrom || dateTo) {
    const createdAtFilter: Record<string, Date> = {};
    if (dateFrom) createdAtFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      createdAtFilter.lte = end;
    }
    where.createdAt = createdAtFilter;
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
      include: {
        user: { select: { name: true, email: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, totalPages: Math.ceil(total / perPage) };
}
