"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCurrentCompanyId } from "@/lib/company";

export async function getCashierFavorites() {
  const session = await auth();
  if (!session?.user?.id) return [];
  const companyId = await getCurrentCompanyId();

  const favorites = await prisma.cashierFavorite.findMany({
    where: { userId: session.user.id, user: { companyId } },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          code: true,
          sellingPrice: true,
          stock: true,
          image: true,
          unit: true,
          isActive: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return favorites
    .filter((f) => f.product.isActive)
    .map((f) => ({
      id: f.id,
      productId: f.product.id,
      name: f.product.name,
      code: f.product.code,
      price: f.product.sellingPrice,
      stock: f.product.stock,
      image: f.product.image,
      unit: f.product.unit,
    }));
}

export async function addCashierFavorite(productId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const existing = await prisma.cashierFavorite.findUnique({
    where: { userId_productId: { userId: session.user.id, productId } },
  });
  if (existing) return { error: "Sudah ada di favorit" };

  const maxSort = await prisma.cashierFavorite.aggregate({
    where: { userId: session.user.id },
    _max: { sortOrder: true },
  });

  await prisma.cashierFavorite.create({
    data: {
      userId: session.user.id,
      productId,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return { success: true };
}

export async function removeCashierFavorite(productId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  await prisma.cashierFavorite.deleteMany({
    where: { userId: session.user.id, productId },
  });

  return { success: true };
}

export async function reorderCashierFavorites(productIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  await Promise.all(
    productIds.map((productId, index) =>
      prisma.cashierFavorite.updateMany({
        where: { userId: session.user.id, productId },
        data: { sortOrder: index },
      })
    )
  );

  return { success: true };
}
