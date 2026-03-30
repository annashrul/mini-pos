"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Get all branch prices for a specific branch
export async function getBranchPrices(params: {
  branchId: string;
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const { branchId, search, page = 1, perPage = 20 } = params;

  const productWhere: Record<string, unknown> = { isActive: true };
  if (search) {
    productWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      include: {
        category: { select: { name: true } },
        branchPrices: {
          where: { branchId },
          select: { sellingPrice: true, purchasePrice: true },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.product.count({ where: productWhere }),
  ]);

  const items = products.map((p) => {
    const branchPrice = p.branchPrices[0];
    return {
      productId: p.id,
      productCode: p.code,
      productName: p.name,
      category: p.category.name,
      defaultSellingPrice: p.sellingPrice,
      defaultPurchasePrice: p.purchasePrice,
      branchSellingPrice: branchPrice?.sellingPrice ?? null,
      branchPurchasePrice: branchPrice?.purchasePrice ?? null,
      hasCustomPrice: !!branchPrice,
    };
  });

  return { items, total, totalPages: Math.ceil(total / perPage) };
}

// Set price for a product at a branch
export async function setBranchPrice(
  branchId: string,
  productId: string,
  sellingPrice: number,
  purchasePrice?: number
) {
  if (sellingPrice < 0) return { error: "Harga jual tidak boleh negatif" };

  await prisma.branchProductPrice.upsert({
    where: { branchId_productId: { branchId, productId } },
    update: {
      sellingPrice,
      purchasePrice: purchasePrice ?? null,
    },
    create: {
      branchId,
      productId,
      sellingPrice,
      purchasePrice: purchasePrice ?? null,
    },
  });

  revalidatePath("/branch-prices");
  return { success: true };
}

// Bulk set prices
export async function setBranchPricesBulk(
  branchId: string,
  prices: { productId: string; sellingPrice: number; purchasePrice?: number }[]
) {
  await prisma.$transaction(
    prices.map((p) =>
      prisma.branchProductPrice.upsert({
        where: { branchId_productId: { branchId, productId: p.productId } },
        update: {
          sellingPrice: p.sellingPrice,
          purchasePrice: p.purchasePrice ?? null,
        },
        create: {
          branchId,
          productId: p.productId,
          sellingPrice: p.sellingPrice,
          purchasePrice: p.purchasePrice ?? null,
        },
      })
    )
  );

  revalidatePath("/branch-prices");
  return { success: true };
}

// Remove custom price (revert to default)
export async function removeBranchPrice(branchId: string, productId: string) {
  await prisma.branchProductPrice.deleteMany({
    where: { branchId, productId },
  });

  revalidatePath("/branch-prices");
  return { success: true };
}

// Get effective price for a product at a branch (used by POS)
export async function getEffectivePrice(productId: string, branchId?: string | null) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { sellingPrice: true, purchasePrice: true },
  });
  if (!product) return null;

  if (!branchId) return product;

  const branchPrice = await prisma.branchProductPrice.findUnique({
    where: { branchId_productId: { branchId, productId } },
  });

  return {
    sellingPrice: branchPrice?.sellingPrice ?? product.sellingPrice,
    purchasePrice: branchPrice?.purchasePrice ?? product.purchasePrice,
  };
}

// Copy prices from one branch to another
export async function copyBranchPrices(fromBranchId: string, toBranchId: string) {
  const sourcePrices = await prisma.branchProductPrice.findMany({
    where: { branchId: fromBranchId },
  });

  if (sourcePrices.length === 0) return { error: "Cabang sumber tidak memiliki harga khusus" };

  await prisma.$transaction(
    sourcePrices.map((p) =>
      prisma.branchProductPrice.upsert({
        where: { branchId_productId: { branchId: toBranchId, productId: p.productId } },
        update: { sellingPrice: p.sellingPrice, purchasePrice: p.purchasePrice },
        create: {
          branchId: toBranchId,
          productId: p.productId,
          sellingPrice: p.sellingPrice,
          purchasePrice: p.purchasePrice,
        },
      })
    )
  );

  revalidatePath("/branch-prices");
  return { success: true, count: sourcePrices.length };
}
