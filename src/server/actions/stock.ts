"use server";

import { prisma } from "@/lib/prisma";
import { stockMovementSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";

interface GetStockMovementsParams {
  page?: number;
  perPage?: number;
  limit?: number;
  search?: string;
  productId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function getStockMovements(params: GetStockMovementsParams = {}) {
  const { page = 1, search, productId, type, dateFrom, dateTo, sortBy, sortDir = "desc" } = params;
  const perPage = params.perPage || params.limit || 15;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = {};
  if (productId) where.productId = productId;
  if (type && type !== "all") where.type = type;
  if (search) {
    where.product = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ],
    };
  }
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59");
    where.createdAt = createdAt;
  }

  const direction = sortDir === "asc" ? "asc" as const : "desc" as const;
  const orderBy =
    sortBy === "product" ? { product: { name: direction } }
    : sortBy === "type" ? { type: direction }
    : sortBy === "quantity" ? { quantity: direction }
    : { createdAt: direction };

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: { product: { select: { name: true, code: true, stock: true } } },
      orderBy,
      skip,
      take: perPage,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { movements, total, totalPages: Math.ceil(total / perPage), currentPage: page };
}

export async function createStockMovement(formData: FormData) {
  await assertMenuActionAccess("stock", "create");
  const data = {
    productId: formData.get("productId") as string,
    type: formData.get("type") as string,
    quantity: Number(formData.get("quantity")),
    note: (formData.get("note") as string) || null,
  };

  const parsed = stockMovementSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: parsed.data.productId } });
      if (!product) throw new Error("Produk tidak ditemukan");

      if (parsed.data.type === "OUT" && product.stock < parsed.data.quantity) {
        throw new Error(`Stok tidak mencukupi (sisa: ${product.stock})`);
      }

      await tx.stockMovement.create({
        data: {
          productId: parsed.data.productId,
          type: parsed.data.type,
          quantity: parsed.data.quantity,
          note: parsed.data.note ?? null,
        },
      });

      const stockChange = parsed.data.type === "IN" ? parsed.data.quantity
        : parsed.data.type === "OUT" ? -parsed.data.quantity
        : 0;

      if (parsed.data.type === "ADJUSTMENT") {
        await tx.product.update({
          where: { id: parsed.data.productId },
          data: { stock: parsed.data.quantity },
        });
      } else {
        await tx.product.update({
          where: { id: parsed.data.productId },
          data: { stock: { increment: stockChange } },
        });
      }
    });

    revalidatePath("/stock");
    revalidatePath("/products");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menyimpan pergerakan stok" };
  }
}

export async function getProductsForSelect() {
  return prisma.product.findMany({
    select: { id: true, name: true, code: true, stock: true },
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}
