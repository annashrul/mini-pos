"use server";

import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";

export async function getCategories(params?: {
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const { search, page = 1, perPage = 10 } = params || {};
  const where: Record<string, unknown> = {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.category.count({ where }),
  ]);

  return { categories, total, totalPages: Math.ceil(total / perPage) };
}

export async function getAllCategories() {
  return prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(data: FormData) {
  await assertMenuActionAccess("categories", "create");
  const parsed = categorySchema.safeParse({
    name: data.get("name"),
    description: data.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
    });
    revalidatePath("/categories");
    return { success: true, id: category.id, name: category.name };
  } catch {
    return { error: "Kategori dengan nama tersebut sudah ada" };
  }
}

export async function updateCategory(id: string, data: FormData) {
  await assertMenuActionAccess("categories", "update");
  const parsed = categorySchema.safeParse({
    name: data.get("name"),
    description: data.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  try {
    await prisma.category.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
    });
    revalidatePath("/categories");
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate kategori" };
  }
}

export async function deleteCategory(id: string) {
  await assertMenuActionAccess("categories", "delete");
  try {
    const productsCount = await prisma.product.count({
      where: { categoryId: id },
    });
    if (productsCount > 0) {
      return { error: `Kategori masih memiliki ${productsCount} produk` };
    }
    await prisma.category.delete({ where: { id } });
    revalidatePath("/categories");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus kategori" };
  }
}
