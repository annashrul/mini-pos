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
