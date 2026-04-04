"use server";

import { prisma } from "@/lib/prisma";

export async function getLowStockProducts() {
  const products = await prisma.$queryRaw<
    { id: string; name: string; code: string; stock: number; minStock: number }[]
  >`
    SELECT id, name, code, stock, "minStock"
    FROM products
    WHERE "isActive" = true AND stock <= "minStock"
    ORDER BY stock ASC
    LIMIT 20
  `;
  return products;
}

export async function getExpiringProducts() {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  return prisma.product.findMany({
    where: {
      isActive: true,
      expiryDate: { not: null, lte: thirtyDaysFromNow },
    },
    select: { id: true, name: true, code: true, stock: true, expiryDate: true },
    orderBy: { expiryDate: "asc" },
    take: 20,
  });
}
