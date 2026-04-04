"use server";

import { prisma } from "@/lib/prisma";
import { stockMovementSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { emitEvent, EVENTS } from "@/lib/socket-emit";

interface GetStockMovementsParams {
  page?: number;
  perPage?: number;
  limit?: number;
  search?: string;
  productId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function getStockMovements(params: GetStockMovementsParams = {}) {
  const {
    page = 1,
    search,
    productId,
    type,
    dateFrom,
    dateTo,
    branchId,
    sortBy,
    sortDir = "desc",
  } = params;
  const perPage = params.perPage || params.limit || 10;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = {};
  if (productId) where.productId = productId;
  if (branchId) where.branchId = branchId;
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

  const direction = sortDir === "asc" ? ("asc" as const) : ("desc" as const);
  const orderBy =
    sortBy === "product"
      ? { product: { name: direction } }
      : sortBy === "type"
        ? { type: direction }
        : sortBy === "quantity"
          ? { quantity: direction }
          : { createdAt: direction };

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: { product: { select: { name: true, code: true, stock: true } }, branch: { select: { name: true } } },
      orderBy,
      skip,
      take: perPage,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return {
    movements,
    total,
    totalPages: Math.ceil(total / perPage),
    currentPage: page,
  };
}

export async function createStockMovement(formData: FormData) {
  await assertMenuActionAccess("stock", "create");
  const data = {
    productId: formData.get("productId") as string,
    type: formData.get("type") as string,
    quantity: Number(formData.get("quantity")),
    note: (formData.get("note") as string) || null,
  };
  const branchIdsRaw = (formData.get("branchIds") as string) || "";
  const branchIds: string[] = branchIdsRaw ? JSON.parse(branchIdsRaw) : [];
  // For backward compat, also check single branchId
  const singleBranchId = (formData.get("branchId") as string) || null;
  if (singleBranchId && branchIds.length === 0) branchIds.push(singleBranchId);

  const parsed = stockMovementSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: parsed.data.productId } });
      if (!product) throw new Error("Produk tidak ditemukan");

      const stockChange = parsed.data.type === "IN" ? parsed.data.quantity : parsed.data.type === "OUT" ? -parsed.data.quantity : 0;

      if (branchIds.length > 0) {
        // Per-branch operation
        for (const bid of branchIds) {
          const bs = await tx.branchStock.findUnique({ where: { branchId_productId: { branchId: bid, productId: parsed.data.productId } } });
          if (parsed.data.type === "OUT" && (bs?.quantity ?? 0) < parsed.data.quantity) {
            const branchName = (await tx.branch.findUnique({ where: { id: bid }, select: { name: true } }))?.name ?? bid;
            throw new Error(`Stok di ${branchName} tidak mencukupi (sisa: ${bs?.quantity ?? 0})`);
          }

          await tx.stockMovement.create({ data: { productId: parsed.data.productId, branchId: bid, type: parsed.data.type, quantity: parsed.data.quantity, note: parsed.data.note ?? null } });

          if (parsed.data.type === "ADJUSTMENT") {
            await tx.branchStock.upsert({ where: { branchId_productId: { branchId: bid, productId: parsed.data.productId } }, create: { branchId: bid, productId: parsed.data.productId, quantity: parsed.data.quantity }, update: { quantity: parsed.data.quantity } });
          } else if (bs) {
            await tx.branchStock.update({ where: { branchId_productId: { branchId: bid, productId: parsed.data.productId } }, data: { quantity: { increment: stockChange } } });
          } else if (stockChange > 0) {
            await tx.branchStock.create({ data: { branchId: bid, productId: parsed.data.productId, quantity: stockChange } });
          }
        }
      } else {
        // Global operation (no branch)
        if (parsed.data.type === "OUT" && product.stock < parsed.data.quantity) {
          throw new Error(`Stok tidak mencukupi (sisa: ${product.stock})`);
        }
        await tx.stockMovement.create({ data: { productId: parsed.data.productId, type: parsed.data.type, quantity: parsed.data.quantity, note: parsed.data.note ?? null } });
      }

      // Update global stock
      if (parsed.data.type === "ADJUSTMENT") {
        await tx.product.update({ where: { id: parsed.data.productId }, data: { stock: parsed.data.quantity } });
      } else {
        await tx.product.update({ where: { id: parsed.data.productId }, data: { stock: { increment: stockChange } } });
      }
    });

    revalidatePath("/stock");
    revalidatePath("/products");

    createAuditLog({ action: "CREATE", entity: "StockMovement", details: { data: { type: parsed.data.type, productId: parsed.data.productId, quantity: parsed.data.quantity, notes: parsed.data.note, ...(branchIds.length > 0 ? { branchId: branchIds.length === 1 ? branchIds[0] : branchIds } : {}) } } }).catch(() => {});

    // Emit stock updated event for each branch, or globally
    if (branchIds.length > 0) {
      for (const bid of branchIds) {
        emitEvent(EVENTS.STOCK_UPDATED, { productId: parsed.data.productId }, bid);
      }
    } else {
      emitEvent(EVENTS.STOCK_UPDATED, { productId: parsed.data.productId });
    }

    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Gagal menyimpan pergerakan stok",
    };
  }
}

export async function getProductsForSelect() {
  return prisma.product.findMany({
    select: { id: true, name: true, code: true, stock: true },
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}
