"use server";

import { prisma } from "@/lib/prisma";
import { brandSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";

export async function getBrands(params?: { search?: string; page?: number; perPage?: number }) {
  const { search, page = 1, perPage = 10 } = params || {};
  const where: Record<string, unknown> = {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [brands, total] = await Promise.all([
    prisma.brand.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.brand.count({ where }),
  ]);

  return { brands, total, totalPages: Math.ceil(total / perPage) };
}

export async function createBrand(data: FormData) {
  await assertMenuActionAccess("brands", "create");
  const parsed = brandSchema.safeParse({ name: data.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    const brand = await prisma.brand.create({ data: parsed.data });
    createAuditLog({ action: "CREATE", entity: "Brand", entityId: brand.id, details: { data: { name: parsed.data.name } } }).catch(() => {});
    revalidatePath("/brands");
    return { success: true, id: brand.id };
  } catch {
    return { error: "Brand dengan nama tersebut sudah ada" };
  }
}

export async function updateBrand(id: string, data: FormData) {
  await assertMenuActionAccess("brands", "update");
  const parsed = brandSchema.safeParse({ name: data.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    const oldBrand = await prisma.brand.findUniqueOrThrow({ where: { id } });
    await prisma.brand.update({ where: { id }, data: parsed.data });
    createAuditLog({ action: "UPDATE", entity: "Brand", entityId: id, details: { before: { name: oldBrand.name }, after: { name: parsed.data.name } } }).catch(() => {});
    revalidatePath("/brands");
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate brand" };
  }
}

export async function deleteBrand(id: string) {
  await assertMenuActionAccess("brands", "delete");
  try {
    const productsCount = await prisma.product.count({ where: { brandId: id } });
    if (productsCount > 0) {
      return { error: `Brand masih memiliki ${productsCount} produk` };
    }
    const brand = await prisma.brand.findUniqueOrThrow({ where: { id } });
    await prisma.brand.delete({ where: { id } });
    createAuditLog({ action: "DELETE", entity: "Brand", entityId: id, details: { deleted: { name: brand.name } } }).catch(() => {});
    revalidatePath("/brands");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus brand" };
  }
}
