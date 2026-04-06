"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";

export async function getBundles(params?: {
  search?: string;
  categoryId?: string;
  branchId?: string;
  isActive?: boolean;
  page?: number;
  perPage?: number;
}) {
  const { search, categoryId, branchId, isActive, page = 1, perPage = 20 } = params || {};
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (branchId) where.OR = [{ branchId: null }, { branchId }];
  if (isActive !== undefined) where.isActive = isActive;

  const [bundles, total] = await Promise.all([
    prisma.productBundle.findMany({
      where,
      include: {
        items: {
          include: {
            product: { select: { id: true, code: true, name: true, sellingPrice: true, purchasePrice: true, stock: true, unit: true, imageUrl: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
        category: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.productBundle.count({ where }),
  ]);

  return { bundles, total, totalPages: Math.ceil(total / perPage), currentPage: page };
}

export async function getBundleById(id: string) {
  return prisma.productBundle.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: { select: { id: true, code: true, name: true, sellingPrice: true, purchasePrice: true, stock: true, unit: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      category: { select: { id: true, name: true } },
    },
  });
}

export async function createBundle(data: {
  code: string;
  name: string;
  description?: string;
  sellingPrice: number;
  categoryId?: string;
  barcode?: string;
  branchId?: string;
  imageUrl?: string;
  items: { productId: string; quantity: number }[];
}) {
  await assertMenuActionAccess("products", "create");

  // Calculate total base price
  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sellingPrice: true },
  });
  const priceMap = new Map(products.map((p) => [p.id, p.sellingPrice]));
  const totalBasePrice = data.items.reduce((sum, item) => {
    return sum + (priceMap.get(item.productId) ?? 0) * item.quantity;
  }, 0);

  const bundle = await prisma.productBundle.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description || null,
      sellingPrice: data.sellingPrice,
      totalBasePrice,
      categoryId: data.categoryId || null,
      barcode: data.barcode || null,
      branchId: data.branchId || null,
      imageUrl: data.imageUrl || null,
      items: {
        create: data.items.map((item, idx) => ({
          productId: item.productId,
          quantity: item.quantity,
          sortOrder: idx,
        })),
      },
    },
    include: { items: true },
  });

  createAuditLog({ action: "CREATE", entity: "ProductBundle", entityId: bundle.id, details: { code: data.code, name: data.name, itemCount: data.items.length } }).catch(() => {});
  revalidatePath("/products");
  revalidatePath("/pos");
  return { bundle };
}

export async function updateBundle(id: string, data: {
  code?: string;
  name?: string;
  description?: string;
  sellingPrice?: number;
  categoryId?: string;
  barcode?: string;
  isActive?: boolean;
  imageUrl?: string;
  items?: { productId: string; quantity: number }[];
}) {
  await assertMenuActionAccess("products", "update");

  let totalBasePrice: number | undefined;
  if (data.items) {
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sellingPrice: true },
    });
    const priceMap = new Map(products.map((p) => [p.id, p.sellingPrice]));
    totalBasePrice = data.items.reduce((sum, item) => sum + (priceMap.get(item.productId) ?? 0) * item.quantity, 0);
  }

  const bundle = await prisma.$transaction(async (tx) => {
    if (data.items) {
      await tx.productBundleItem.deleteMany({ where: { bundleId: id } });
      await tx.productBundleItem.createMany({
        data: data.items.map((item, idx) => ({
          bundleId: id,
          productId: item.productId,
          quantity: item.quantity,
          sortOrder: idx,
        })),
      });
    }

    return tx.productBundle.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.sellingPrice !== undefined ? { sellingPrice: data.sellingPrice } : {}),
        ...(totalBasePrice !== undefined ? { totalBasePrice } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId || null } : {}),
        ...(data.barcode !== undefined ? { barcode: data.barcode || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      },
      include: {
        items: { include: { product: { select: { id: true, code: true, name: true, sellingPrice: true } } }, orderBy: { sortOrder: "asc" } },
      },
    });
  });

  createAuditLog({ action: "UPDATE", entity: "ProductBundle", entityId: id, details: { name: data.name } }).catch(() => {});
  revalidatePath("/products");
  revalidatePath("/pos");
  return { bundle };
}

export async function deleteBundle(id: string) {
  await assertMenuActionAccess("products", "delete");
  await prisma.productBundle.delete({ where: { id } });
  createAuditLog({ action: "DELETE", entity: "ProductBundle", entityId: id }).catch(() => {});
  revalidatePath("/products");
  return { success: true };
}

// Get active bundles for POS
export async function getActiveBundles(branchId?: string) {
  return prisma.productBundle.findMany({
    where: {
      isActive: true,
      ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}),
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, code: true, name: true, sellingPrice: true, purchasePrice: true, stock: true, unit: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }],
  });
}
