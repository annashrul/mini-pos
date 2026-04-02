"use server";

import { prisma } from "@/lib/prisma";
import { branchSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";

export async function getBranches(params?: { search?: string; page?: number; perPage?: number }) {
  const { search, page = 1, perPage = 10 } = params || {};
  const where: Record<string, unknown> = {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [branches, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.branch.count({ where }),
  ]);

  return { branches, total, totalPages: Math.ceil(total / perPage) };
}

export async function getAllBranches() {
  return prisma.branch.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createBranch(data: FormData) {
  await assertMenuActionAccess("branches", "create");
  const parsed = branchSchema.safeParse({
    name: data.get("name"),
    address: data.get("address") || null,
    phone: data.get("phone") || null,
    isActive: data.get("isActive") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    const result = await prisma.branch.create({ data: { name: parsed.data.name, address: parsed.data.address ?? null, phone: parsed.data.phone ?? null, isActive: parsed.data.isActive } });
    revalidatePath("/branches");
    createAuditLog({ action: "CREATE", entity: "Branch", entityId: result.id, details: { data: { name: parsed.data.name, address: parsed.data.address ?? null, phone: parsed.data.phone ?? null, isActive: parsed.data.isActive } } }).catch(() => {});
    return { success: true };
  } catch {
    return { error: "Cabang dengan nama tersebut sudah ada" };
  }
}

export async function updateBranch(id: string, data: FormData) {
  await assertMenuActionAccess("branches", "update");
  const parsed = branchSchema.safeParse({
    name: data.get("name"),
    address: data.get("address") || null,
    phone: data.get("phone") || null,
    isActive: data.get("isActive") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    const old = await prisma.branch.findUnique({ where: { id } });
    await prisma.branch.update({ where: { id }, data: { name: parsed.data.name, address: parsed.data.address ?? null, phone: parsed.data.phone ?? null, isActive: parsed.data.isActive } });
    revalidatePath("/branches");
    if (old) {
      createAuditLog({ action: "UPDATE", entity: "Branch", entityId: id, details: { before: { name: old.name, address: old.address, phone: old.phone, isActive: old.isActive }, after: { name: parsed.data.name, address: parsed.data.address ?? null, phone: parsed.data.phone ?? null, isActive: parsed.data.isActive } } }).catch(() => {});
    }
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate cabang" };
  }
}

export async function deleteBranch(id: string) {
  await assertMenuActionAccess("branches", "delete");
  try {
    const old = await prisma.branch.findUnique({ where: { id } });
    await prisma.branch.delete({ where: { id } });
    revalidatePath("/branches");
    createAuditLog({ action: "DELETE", entity: "Branch", entityId: id, details: { deleted: { name: old?.name, address: old?.address } } }).catch(() => {});
    return { success: true };
  } catch {
    return { error: "Gagal menghapus cabang" };
  }
}
