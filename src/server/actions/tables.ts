"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getTables(branchId?: string) {
  return prisma.restaurantTable.findMany({
    where: {
      isActive: true,
      // Show global tables (branchId null) OR branch-specific tables
      ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}),
    },
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { number: "asc" }],
  });
}

export async function getTableById(id: string) {
  return prisma.restaurantTable.findUnique({ where: { id } });
}

export async function createTable(data: {
  number: number;
  name?: string;
  capacity?: number;
  section?: string;
  branchId?: string;
}) {
  const table = await prisma.restaurantTable.create({
    data: {
      number: data.number,
      name: data.name || null,
      capacity: data.capacity || 4,
      section: data.section || null,
      branchId: data.branchId || null,
    },
  });
  revalidatePath("/pos");
  return table;
}

export async function updateTableStatus(id: string, status: string) {
  const table = await prisma.restaurantTable.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/pos");
  return table;
}

export async function occupyTable(id: string) {
  return updateTableStatus(id, "OCCUPIED");
}

export async function releaseTable(id: string) {
  return updateTableStatus(id, "AVAILABLE");
}

export async function getTableSections(branchId?: string) {
  const where: Record<string, unknown> = { isActive: true };
  if (branchId) where.branchId = branchId;

  const tables = await prisma.restaurantTable.findMany({
    where,
    select: { section: true },
    distinct: ["section"],
  });
  return tables.map(t => t.section).filter(Boolean) as string[];
}
