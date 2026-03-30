"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getPromotions(params?: {
  search?: string | undefined;
  type?: string | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
}) {
  const { search, type, page = 1, perPage = 10, sortBy, sortDir = "desc" } = params || {};
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { voucherCode: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }
  if (type && type !== "ALL") where.type = type;

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "name"
      ? { name: direction }
      : sortBy === "value"
        ? { value: direction }
        : { createdAt: direction };

  const [promotions, total] = await Promise.all([
    prisma.promotion.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        category: { select: { name: true } },
        product: { select: { name: true, code: true } },
      },
    }),
    prisma.promotion.count({ where }),
  ]);

  return { promotions, total, totalPages: Math.ceil(total / perPage) };
}

export async function createPromotion(data: FormData) {
  const type = data.get("type") as string;
  const scope = data.get("scope") as string || "all";

  try {
    await prisma.promotion.create({
      data: {
        name: data.get("name") as string,
        type: type as never,
        value: Number(data.get("value")) || 0,
        scope,
        minPurchase: data.get("minPurchase") ? Number(data.get("minPurchase")) : null,
        maxDiscount: data.get("maxDiscount") ? Number(data.get("maxDiscount")) : null,
        categoryId: scope === "category" ? (data.get("categoryId") as string || null) : null,
        productId: scope === "product" ? (data.get("productId") as string || null) : null,
        buyQty: type === "BUY_X_GET_Y" ? (Number(data.get("buyQty")) || null) : null,
        getQty: type === "BUY_X_GET_Y" ? (Number(data.get("getQty")) || null) : null,
        getProductId: type === "BUY_X_GET_Y" ? (data.get("getProductId") as string || null) : null,
        voucherCode: type === "VOUCHER" ? (data.get("voucherCode") as string || null) : null,
        usageLimit: data.get("usageLimit") ? Number(data.get("usageLimit")) : null,
        description: (data.get("description") as string) || null,
        isActive: data.get("isActive") === "true",
        startDate: new Date(data.get("startDate") as string),
        endDate: new Date(data.get("endDate") as string),
      },
    });
    revalidatePath("/promotions");
    return { success: true };
  } catch {
    return { error: "Gagal menambahkan promo" };
  }
}

export async function updatePromotion(id: string, data: FormData) {
  const type = data.get("type") as string;
  const scope = data.get("scope") as string || "all";

  try {
    await prisma.promotion.update({
      where: { id },
      data: {
        name: data.get("name") as string,
        type: type as never,
        value: Number(data.get("value")) || 0,
        scope,
        minPurchase: data.get("minPurchase") ? Number(data.get("minPurchase")) : null,
        maxDiscount: data.get("maxDiscount") ? Number(data.get("maxDiscount")) : null,
        categoryId: scope === "category" ? (data.get("categoryId") as string || null) : null,
        productId: scope === "product" ? (data.get("productId") as string || null) : null,
        buyQty: type === "BUY_X_GET_Y" ? (Number(data.get("buyQty")) || null) : null,
        getQty: type === "BUY_X_GET_Y" ? (Number(data.get("getQty")) || null) : null,
        getProductId: type === "BUY_X_GET_Y" ? (data.get("getProductId") as string || null) : null,
        voucherCode: type === "VOUCHER" ? (data.get("voucherCode") as string || null) : null,
        usageLimit: data.get("usageLimit") ? Number(data.get("usageLimit")) : null,
        description: (data.get("description") as string) || null,
        isActive: data.get("isActive") === "true",
        startDate: new Date(data.get("startDate") as string),
        endDate: new Date(data.get("endDate") as string),
      },
    });
    revalidatePath("/promotions");
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate promo" };
  }
}

export async function deletePromotion(id: string) {
  try {
    await prisma.promotion.delete({ where: { id } });
    revalidatePath("/promotions");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus promo" };
  }
}
