"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";

function parseIdList(data: FormData, key: string) {
  const raw = data.get(key);
  if (typeof raw !== "string" || !raw.trim()) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return raw.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export async function getPromotions(params?: {
  search?: string | undefined;
  type?: string | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
  sortBy?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
}) {
  const companyId = await getCurrentCompanyId();
  const { search, type, page = 1, perPage = 10, sortBy, sortDir = "desc" } = params || {};
  const where: Record<string, unknown> = { companyId };

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
  const companyId = await getCurrentCompanyId();
  const type = data.get("type") as string;
  const scope = data.get("scope") as string || "all";
  const productIds = parseIdList(data, "productIds");
  const categoryIds = parseIdList(data, "categoryIds");

  try {
    const baseData = {
      companyId,
      name: data.get("name") as string,
      type: type as never,
      value: Number(data.get("value")) || 0,
      scope,
      minPurchase: data.get("minPurchase") ? Number(data.get("minPurchase")) : null,
      maxDiscount: data.get("maxDiscount") ? Number(data.get("maxDiscount")) : null,
      buyQty: type === "BUY_X_GET_Y" || type === "BUNDLE" ? (Number(data.get("buyQty")) || null) : null,
      getQty: type === "BUY_X_GET_Y" || type === "BUNDLE" ? (Number(data.get("getQty")) || null) : null,
      getProductId: type === "BUY_X_GET_Y" || type === "BUNDLE" ? (data.get("getProductId") as string || null) : null,
      voucherCode: type === "VOUCHER" ? (data.get("voucherCode") as string || null) : null,
      usageLimit: data.get("usageLimit") ? Number(data.get("usageLimit")) : null,
      description: (data.get("description") as string) || null,
      isActive: data.get("isActive") === "true",
      startDate: new Date(data.get("startDate") as string),
      endDate: new Date(data.get("endDate") as string),
    };
    const targets = scope === "product"
      ? (productIds.length > 0 ? productIds : [((data.get("productId") as string) || "")]).filter(Boolean).map((id) => ({ productId: id, categoryId: null as string | null }))
      : scope === "category"
        ? (categoryIds.length > 0 ? categoryIds : [((data.get("categoryId") as string) || "")]).filter(Boolean).map((id) => ({ productId: null as string | null, categoryId: id }))
        : [{ productId: null as string | null, categoryId: null as string | null }];
    await prisma.$transaction(targets.map((target) => prisma.promotion.create({
      data: {
        ...baseData,
        productId: target.productId,
        categoryId: target.categoryId,
      },
    })));
    revalidatePath("/promotions");
    createAuditLog({ action: "CREATE", entity: "Promotion", details: { data: { name: baseData.name, type: baseData.type, value: baseData.value, startDate: baseData.startDate, endDate: baseData.endDate } } }).catch(() => {});
    return { success: true };
  } catch {
    return { error: "Gagal menambahkan promo" };
  }
}

export async function updatePromotion(id: string, data: FormData) {
  const companyId = await getCurrentCompanyId();
  const type = data.get("type") as string;
  const scope = data.get("scope") as string || "all";
  const productIds = parseIdList(data, "productIds");
  const categoryIds = parseIdList(data, "categoryIds");

  try {
    const oldPromo = await prisma.promotion.findUnique({
      where: { id },
      select: { name: true, type: true, value: true, isActive: true, startDate: true, endDate: true, minPurchase: true, maxDiscount: true, voucherCode: true, scope: true },
    });

    const baseData = {
      companyId,
      name: data.get("name") as string,
      type: type as never,
      value: Number(data.get("value")) || 0,
      scope,
      minPurchase: data.get("minPurchase") ? Number(data.get("minPurchase")) : null,
      maxDiscount: data.get("maxDiscount") ? Number(data.get("maxDiscount")) : null,
      buyQty: type === "BUY_X_GET_Y" || type === "BUNDLE" ? (Number(data.get("buyQty")) || null) : null,
      getQty: type === "BUY_X_GET_Y" || type === "BUNDLE" ? (Number(data.get("getQty")) || null) : null,
      getProductId: type === "BUY_X_GET_Y" || type === "BUNDLE" ? (data.get("getProductId") as string || null) : null,
      voucherCode: type === "VOUCHER" ? (data.get("voucherCode") as string || null) : null,
      usageLimit: data.get("usageLimit") ? Number(data.get("usageLimit")) : null,
      description: (data.get("description") as string) || null,
      isActive: data.get("isActive") === "true",
      startDate: new Date(data.get("startDate") as string),
      endDate: new Date(data.get("endDate") as string),
    };
    const targets = scope === "product"
      ? (productIds.length > 0 ? productIds : [((data.get("productId") as string) || "")]).filter(Boolean).map((item) => ({ productId: item, categoryId: null as string | null }))
      : scope === "category"
        ? (categoryIds.length > 0 ? categoryIds : [((data.get("categoryId") as string) || "")]).filter(Boolean).map((item) => ({ productId: null as string | null, categoryId: item }))
        : [{ productId: null as string | null, categoryId: null as string | null }];
    const first = targets[0] ?? { productId: null as string | null, categoryId: null as string | null };
    await prisma.promotion.update({
      where: { id },
      data: {
        ...baseData,
        productId: first.productId,
        categoryId: first.categoryId,
      },
    });
    for (let index = 1; index < targets.length; index += 1) {
      const target = targets[index];
      if (!target) continue;
      await prisma.promotion.create({
        data: {
          ...baseData,
          productId: target.productId,
          categoryId: target.categoryId,
        },
      });
    }
    revalidatePath("/promotions");
    if (oldPromo) {
      createAuditLog({ action: "UPDATE", entity: "Promotion", entityId: id, details: { before: oldPromo, after: { name: baseData.name, type: baseData.type, value: baseData.value, isActive: baseData.isActive, startDate: baseData.startDate, endDate: baseData.endDate, minPurchase: baseData.minPurchase, maxDiscount: baseData.maxDiscount, voucherCode: baseData.voucherCode, scope: baseData.scope } } }).catch(() => {});
    }
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate promo" };
  }
}

export async function deletePromotion(id: string) {
  await getCurrentCompanyId();
  try {
    const oldPromo = await prisma.promotion.findUnique({
      where: { id },
      select: { name: true, type: true },
    });

    await prisma.promotion.delete({ where: { id } });
    revalidatePath("/promotions");
    createAuditLog({ action: "DELETE", entity: "Promotion", entityId: id, details: { deleted: oldPromo } }).catch(() => {});
    return { success: true };
  } catch {
    return { error: "Gagal menghapus promo" };
  }
}
