"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentCompanyId } from "@/lib/company";

export async function getTables(branchId?: string, search?: string, section?: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.restaurantTable.findMany({
    where: {
      isActive: true,
      branch: { companyId },
      // Show global tables (branchId null) OR branch-specific tables
      ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { section: { contains: search, mode: "insensitive" as const } },
          { number: { equals: parseInt(search) || -1 } },
        ],
      } : {}),
      ...(section === "Lainnya" ? { section: null } : section ? { section } : {}),
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
  revalidatePath("/tables");
  return table;
}

export async function updateTableStatus(id: string, status: string) {
  const table = await prisma.restaurantTable.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/pos");
  revalidatePath("/tables");
  return table;
}

export async function occupyTable(id: string) {
  return updateTableStatus(id, "OCCUPIED");
}

export async function releaseTable(id: string) {
  return updateTableStatus(id, "AVAILABLE");
}

export async function getTableSections(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { isActive: true, branch: { companyId } };
  if (branchId) where.branchId = branchId;

  const tables = await prisma.restaurantTable.findMany({
    where,
    select: { section: true },
    distinct: ["section"],
  });
  return tables.map(t => t.section).filter(Boolean) as string[];
}

export async function updateTable(id: string, data: {
  number?: number;
  name?: string;
  capacity?: number;
  section?: string;
  isActive?: boolean;
  sortOrder?: number;
}) {
  const table = await prisma.restaurantTable.update({
    where: { id },
    data: {
      ...(data.number !== undefined ? { number: data.number } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
      ...(data.section !== undefined ? { section: data.section } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
  });
  revalidatePath("/tables");
  return table;
}

export async function deleteTable(id: string) {
  await prisma.restaurantTable.delete({ where: { id } });
  revalidatePath("/tables");
  return { success: true };
}

export async function getTableStats(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { branch: { companyId } };
  if (branchId) where.OR = [{ branchId: null }, { branchId }];

  const tables = await prisma.restaurantTable.findMany({ where, select: { status: true, isActive: true } });
  return {
    total: tables.length,
    active: tables.filter(t => t.isActive).length,
    available: tables.filter(t => t.status === "AVAILABLE" && t.isActive).length,
    occupied: tables.filter(t => t.status === "OCCUPIED").length,
    reserved: tables.filter(t => t.status === "RESERVED").length,
    cleaning: tables.filter(t => t.status === "CLEANING").length,
  };
}
