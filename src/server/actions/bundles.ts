"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";

export async function getBundles(params?: {
  search?: string;
  categoryId?: string;
  branchId?: string;
  isActive?: boolean;
  page?: number;
  perPage?: number;
}) {
  const companyId = await getCurrentCompanyId();
  const { search, categoryId, branchId, isActive, page = 1, perPage = 20 } = params || {};
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = { companyId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (branchId) where.branchId = branchId;
  if (isActive !== undefined) where.isActive = isActive;

  const [rawBundles, total] = await Promise.all([
    prisma.productBundle.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true, code: true, name: true, sellingPrice: true, purchasePrice: true, stock: true, unit: true, imageUrl: true,
                ...(branchId ? {
                  branchPrices: { where: { branchId }, select: { sellingPrice: true, purchasePrice: true }, take: 1 },
                  branchStocks: { where: { branchId }, select: { quantity: true }, take: 1 },
                } : {}),
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        category: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.productBundle.count({ where }),
  ]);

  // Override product prices/stock with branch-specific data
  const bundles = branchId
    ? rawBundles.map((bundle) => ({
        ...bundle,
        items: bundle.items.map((item) => {
          const p = item.product as Record<string, unknown>;
          const bp = (p.branchPrices as Array<{ sellingPrice: number; purchasePrice: number | null }> | undefined)?.[0];
          const bs = (p.branchStocks as Array<{ quantity: number }> | undefined)?.[0];
          return {
            ...item,
            product: {
              id: item.product.id,
              code: item.product.code,
              name: item.product.name,
              sellingPrice: bp?.sellingPrice ?? item.product.sellingPrice,
              purchasePrice: bp?.purchasePrice ?? item.product.purchasePrice,
              stock: bs?.quantity ?? item.product.stock,
              unit: item.product.unit,
              imageUrl: item.product.imageUrl,
            },
          };
        }),
      }))
    : rawBundles;

  return { bundles, total, totalPages: Math.ceil(total / perPage), currentPage: page };
}

export async function getBundleById(id: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.productBundle.findFirst({
    where: { id, companyId },
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
  const companyId = await getCurrentCompanyId();

  // Determine target branches
  let targetBranchIds: string[];
  if (data.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: data.branchId, companyId } });
    if (!branch) return { error: "Cabang tidak ditemukan" };
    targetBranchIds = [data.branchId];
  } else {
    const branches = await prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true } });
    targetBranchIds = branches.map((b) => b.id);
    if (targetBranchIds.length === 0) return { error: "Tidak ada cabang aktif" };
  }

  // Calculate total base price
  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId },
    select: { id: true, sellingPrice: true },
  });
  const priceMap = new Map(products.map((p) => [p.id, p.sellingPrice]));
  const totalBasePrice = data.items.reduce((sum, item) => {
    return sum + (priceMap.get(item.productId) ?? 0) * item.quantity;
  }, 0);

  let lastBundle = null;
  for (const bid of targetBranchIds) {
    // Generate unique code per branch if multi-branch
    const bundleCode = targetBranchIds.length > 1 ? `${data.code}-${bid.slice(-4)}` : data.code;
    const bundle = await prisma.productBundle.create({
      data: {
        code: bundleCode,
        name: data.name,
        description: data.description || null,
        sellingPrice: data.sellingPrice,
        totalBasePrice,
        categoryId: data.categoryId && data.categoryId !== "none" ? data.categoryId : null,
        barcode: data.barcode || null,
        branchId: bid,
        companyId,
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
    lastBundle = bundle;

    createAuditLog({ action: "CREATE", entity: "ProductBundle", entityId: bundle.id, details: { code: bundleCode, name: data.name, itemCount: data.items.length }, branchId: bid }).catch(() => {});
  }

  revalidatePath("/products");
  revalidatePath("/pos");
  return { bundle: lastBundle };
}

export async function updateBundle(id: string, data: {
  code?: string;
  name?: string;
  description?: string;
  sellingPrice?: number;
  categoryId?: string;
  barcode?: string;
  branchId?: string;
  isActive?: boolean;
  imageUrl?: string;
  items?: { productId: string; quantity: number }[];
}) {
  await assertMenuActionAccess("products", "update");
  const companyId = await getCurrentCompanyId();

  // Verify bundle belongs to company
  const existing = await prisma.productBundle.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!existing) return { error: "Bundle tidak ditemukan" };

  let totalBasePrice: number | undefined;
  if (data.items) {
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, companyId },
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
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId && data.categoryId !== "none" ? data.categoryId : null } : {}),
        ...(data.barcode !== undefined ? { barcode: data.barcode || null } : {}),
        ...(data.branchId !== undefined ? { branchId: data.branchId || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      },
      include: {
        items: { include: { product: { select: { id: true, code: true, name: true, sellingPrice: true } } }, orderBy: { sortOrder: "asc" } },
      },
    });
  }, { timeout: 15000 });

  createAuditLog({ action: "UPDATE", entity: "ProductBundle", entityId: id, details: { name: data.name } }).catch(() => {});
  revalidatePath("/products");
  revalidatePath("/pos");
  return { bundle };
}

export async function deleteBundle(id: string) {
  await assertMenuActionAccess("products", "delete");
  const companyId = await getCurrentCompanyId();
  const existing = await prisma.productBundle.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!existing) return { error: "Bundle tidak ditemukan" };
  await prisma.productBundle.delete({ where: { id } });
  createAuditLog({ action: "DELETE", entity: "ProductBundle", entityId: id }).catch(() => {});
  revalidatePath("/products");
  return { success: true };
}

// Get active bundles for POS
export async function getActiveBundles(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.productBundle.findMany({
    where: {
      isActive: true,
      companyId,
      ...(branchId ? { branchId } : {}),
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
