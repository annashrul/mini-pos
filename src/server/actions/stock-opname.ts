"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";

interface GetStockOpnamesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}

export async function getStockOpnames(params: GetStockOpnamesParams = {}) {
  const {
    page = 1,
    limit = 15,
    search,
    status,
    sortBy,
    sortDir = "desc",
    dateFrom,
    dateTo,
    branchId,
  } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { opnameNumber: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59");
    where.createdAt = createdAt;
  }
  if (branchId && branchId !== "ALL") where.branchId = branchId;

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "opnameNumber"
      ? { opnameNumber: direction }
      : sortBy === "branch"
        ? { branch: { name: direction } }
        : { createdAt: direction };

  const [opnames, total] = await Promise.all([
    prisma.stockOpname.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.stockOpname.count({ where }),
  ]);

  return {
    opnames,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
}

export async function getStockOpnameById(id: string) {
  return prisma.stockOpname.findUnique({
    where: { id },
    include: {
      branch: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, code: true, stock: true } },
        },
        orderBy: { product: { name: "asc" } },
      },
    },
  });
}

export async function createStockOpname(
  branchIdOrIds: string | string[] | null,
  notes?: string,
) {
  const branchId = Array.isArray(branchIdOrIds) ? (branchIdOrIds[0] ?? null) : branchIdOrIds;
  await assertMenuActionAccess("stock-opname", "create");
  try {
    const today = new Date();
    const prefix = `SO-${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;
    const last = await prisma.stockOpname.findFirst({
      where: { opnameNumber: { startsWith: prefix } },
      orderBy: { opnameNumber: "desc" },
    });
    let seq = 1;
    if (last) {
      const lastSeq = parseInt(last.opnameNumber.split("-").pop() || "0");
      seq = lastSeq + 1;
    }
    const opnameNumber = `${prefix}-${String(seq).padStart(4, "0")}`;

    // Load all active products with their current stock
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, stock: true },
      orderBy: { name: "asc" },
    });

    if (products.length === 0) {
      return { error: "Tidak ada produk aktif untuk di-opname" };
    }

    await prisma.stockOpname.create({
      data: {
        opnameNumber,
        branchId: branchId || null,
        notes: notes || null,
        status: "DRAFT",
        items: {
          create: products.map((p: (typeof products)[number]) => ({
            productId: p.id,
            systemStock: p.stock,
            actualStock: p.stock, // default to system stock
            difference: 0,
          })),
        },
      },
    });

    createAuditLog({
      action: "CREATE",
      entity: "StockOpname",
      entityId: opnameNumber,
      details: { data: { opnameNumber, branchId, itemCount: products.length } },
      ...(branchId ? { branchId } : {}),
    }).catch(() => {});

    revalidatePath("/stock-opname");
    return { success: true };
  } catch {
    return { error: "Gagal membuat stock opname" };
  }
}

export async function updateOpnameItems(
  opnameId: string,
  items: { productId: string; actualStock: number }[],
) {
  await assertMenuActionAccess("stock-opname", "update");
  try {
    const opname = await prisma.stockOpname.findUnique({
      where: { id: opnameId },
    });
    if (!opname) return { error: "Stock opname tidak ditemukan" };
    if (opname.status === "COMPLETED" || opname.status === "CANCELLED") {
      return { error: "Stock opname sudah selesai atau dibatalkan" };
    }

    await prisma.$transaction(async (tx) => {
      // Update status to IN_PROGRESS if still DRAFT
      if (opname.status === "DRAFT") {
        await tx.stockOpname.update({
          where: { id: opnameId },
          data: { status: "IN_PROGRESS" },
        });
      }

      for (const item of items) {
        const opnameItem = await tx.stockOpnameItem.findFirst({
          where: { stockOpnameId: opnameId, productId: item.productId },
        });
        if (opnameItem) {
          await tx.stockOpnameItem.update({
            where: { id: opnameItem.id },
            data: {
              actualStock: item.actualStock,
              difference: item.actualStock - opnameItem.systemStock,
            },
          });
        }
      }
    });

    createAuditLog({
      action: "UPDATE",
      entity: "StockOpname",
      entityId: opnameId,
      details: { data: { opnameId, status: opname.status === "DRAFT" ? "IN_PROGRESS" : opname.status, itemCount: items.length } },
    }).catch(() => {});

    revalidatePath("/stock-opname");
    return { success: true };
  } catch {
    return { error: "Gagal menyimpan data opname" };
  }
}

export async function completeStockOpname(id: string) {
  await assertMenuActionAccess("stock-opname", "approve");
  try {
    await prisma.$transaction(async (tx) => {
      const opname = await tx.stockOpname.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!opname) throw new Error("Stock opname tidak ditemukan");
      if (opname.status === "COMPLETED")
        throw new Error("Stock opname sudah diselesaikan");
      if (opname.status === "CANCELLED")
        throw new Error("Stock opname sudah dibatalkan");

      // Create stock movements for items with differences and update product stock
      for (const item of opname.items) {
        if (item.difference !== 0) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "OPNAME",
              quantity: Math.abs(item.difference),
              note: `Stock Opname ${opname.opnameNumber}: ${item.difference > 0 ? "kelebihan" : "kekurangan"} ${Math.abs(item.difference)} unit`,
              reference: opname.opnameNumber,
            },
          });

          await tx.product.update({
            where: { id: item.productId },
            data: { stock: item.actualStock },
          });
        }
      }

      await tx.stockOpname.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    });

    createAuditLog({
      action: "UPDATE",
      entity: "StockOpname",
      entityId: id,
      details: { data: { opnameId: id, status: "COMPLETED" } },
    }).catch(() => {});

    revalidatePath("/stock-opname");
    revalidatePath("/products");
    revalidatePath("/stock");
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Gagal menyelesaikan stock opname",
    };
  }
}

export async function cancelStockOpname(id: string) {
  await assertMenuActionAccess("stock-opname", "approve");
  try {
    const opname = await prisma.stockOpname.findUnique({ where: { id } });
    if (!opname) return { error: "Stock opname tidak ditemukan" };
    if (opname.status === "COMPLETED")
      return { error: "Stock opname yang sudah selesai tidak bisa dibatalkan" };
    if (opname.status === "CANCELLED")
      return { error: "Stock opname sudah dibatalkan" };

    await prisma.stockOpname.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    createAuditLog({
      action: "UPDATE",
      entity: "StockOpname",
      entityId: id,
      details: { data: { opnameId: id, status: "CANCELLED" } },
    }).catch(() => {});

    revalidatePath("/stock-opname");
    return { success: true };
  } catch {
    return { error: "Gagal membatalkan stock opname" };
  }
}
