"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface ProductUnitInput {
  name: string;
  conversionQty: number;
  sellingPrice: number;
  purchasePrice?: number;
  barcode?: string;
  isDefault?: boolean;
  sortOrder?: number;
}

// Get all units for a product
export async function getProductUnits(productId: string) {
  return prisma.productUnit.findMany({
    where: { productId },
    orderBy: { conversionQty: "asc" },
  });
}

// Save units for a product (delete + recreate)
export async function saveProductUnits(productId: string, units: ProductUnitInput[]) {
  await prisma.$transaction(async (tx) => {
    await tx.productUnit.deleteMany({ where: { productId } });
    if (units.length > 0) {
      await tx.productUnit.createMany({
        data: units.map((u, i) => ({
          productId,
          name: u.name,
          conversionQty: u.conversionQty,
          sellingPrice: u.sellingPrice,
          purchasePrice: u.purchasePrice ?? null,
          barcode: u.barcode || null,
          isDefault: u.isDefault ?? false,
          sortOrder: u.sortOrder ?? i,
        })),
      });
    }
  });
  revalidatePath("/products");
  return { success: true };
}

// Find product by unit barcode (for POS scanner)
export async function findByUnitBarcode(barcode: string) {
  const unit = await prisma.productUnit.findFirst({
    where: { barcode },
    include: {
      product: {
        include: { category: true },
      },
    },
  });

  if (!unit) return null;

  return {
    product: unit.product,
    unit: {
      id: unit.id,
      name: unit.name,
      conversionQty: unit.conversionQty,
      sellingPrice: unit.sellingPrice,
      purchasePrice: unit.purchasePrice,
      barcode: unit.barcode,
    },
  };
}

// Get all sellable units for a product (for POS unit selector)
export async function getSellableUnits(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      unit: true,
      sellingPrice: true,
      purchasePrice: true,
      stock: true,
      units: { orderBy: { conversionQty: "asc" } },
    },
  });

  if (!product) return [];

  // Always include base unit
  const result = [
    {
      unitName: product.unit,
      conversionQty: 1,
      sellingPrice: product.sellingPrice,
      purchasePrice: product.purchasePrice,
      stockInUnit: product.stock,
      isBase: true,
    },
    ...product.units.map((u) => ({
      unitName: u.name,
      conversionQty: u.conversionQty,
      sellingPrice: u.sellingPrice,
      purchasePrice: u.purchasePrice ?? product.purchasePrice,
      stockInUnit: Math.floor(product.stock / u.conversionQty),
      isBase: false,
    })),
  ];

  return result;
}
