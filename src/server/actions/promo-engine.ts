"use server";

import { prisma } from "@/lib/prisma";

interface CartItem {
  productId: string;
  productName: string;
  categoryId?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface AppliedPromo {
  promoId: string;
  promoName: string;
  type: string;
  discountAmount: number;
  appliedTo: string; // "cart" | productId
}

export async function getActivePromotions() {
  const now = new Date();
  return prisma.promotion.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: {
      category: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
    },
  });
}

export async function calculateAutoPromo(
  items: CartItem[],
  subtotal: number
): Promise<{ promos: AppliedPromo[]; totalDiscount: number }> {
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
      type: { not: "VOUCHER" },
    },
    include: {
      category: { select: { id: true } },
      product: { select: { id: true } },
    },
  });

  const appliedPromos: AppliedPromo[] = [];
  let totalDiscount = 0;

  for (const promo of promotions) {
    // Check min purchase
    if (promo.minPurchase && subtotal < promo.minPurchase) continue;

    if (promo.type === "DISCOUNT_PERCENT") {
      if (promo.productId) {
        // Per product discount
        const item = items.find((i) => i.productId === promo.productId);
        if (item) {
          let disc = Math.round(item.subtotal * (promo.value / 100));
          if (promo.maxDiscount && disc > promo.maxDiscount) disc = promo.maxDiscount;
          appliedPromos.push({
            promoId: promo.id,
            promoName: promo.name,
            type: promo.type,
            discountAmount: disc,
            appliedTo: promo.productId,
          });
          totalDiscount += disc;
        }
      } else if (promo.categoryId) {
        // Per category discount
        const catItems = items.filter((i) => i.categoryId === promo.categoryId);
        for (const item of catItems) {
          let disc = Math.round(item.subtotal * (promo.value / 100));
          if (promo.maxDiscount && disc > promo.maxDiscount) disc = promo.maxDiscount;
          appliedPromos.push({
            promoId: promo.id,
            promoName: promo.name,
            type: promo.type,
            discountAmount: disc,
            appliedTo: item.productId,
          });
          totalDiscount += disc;
        }
      } else {
        // Global discount
        let disc = Math.round(subtotal * (promo.value / 100));
        if (promo.maxDiscount && disc > promo.maxDiscount) disc = promo.maxDiscount;
        appliedPromos.push({
          promoId: promo.id,
          promoName: promo.name,
          type: promo.type,
          discountAmount: disc,
          appliedTo: "cart",
        });
        totalDiscount += disc;
      }
    } else if (promo.type === "DISCOUNT_AMOUNT") {
      appliedPromos.push({
        promoId: promo.id,
        promoName: promo.name,
        type: promo.type,
        discountAmount: promo.value,
        appliedTo: promo.productId || "cart",
      });
      totalDiscount += promo.value;
    } else if (promo.type === "BUY_X_GET_Y" && promo.productId) {
      const item = items.find((i) => i.productId === promo.productId);
      if (item && item.quantity >= 2) {
        const freeItems = Math.floor(item.quantity / 2);
        const disc = freeItems * item.unitPrice;
        appliedPromos.push({
          promoId: promo.id,
          promoName: promo.name,
          type: promo.type,
          discountAmount: disc,
          appliedTo: promo.productId,
        });
        totalDiscount += disc;
      }
    }
  }

  return { promos: appliedPromos, totalDiscount };
}

export async function validateVoucher(code: string, subtotal: number) {
  const now = new Date();
  const promo = await prisma.promotion.findFirst({
    where: {
      voucherCode: code.toUpperCase(),
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
      type: "VOUCHER",
    },
  });

  if (!promo) return { error: "Voucher tidak valid atau sudah expired" };
  if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
    return { error: "Voucher sudah habis digunakan" };
  }
  if (promo.minPurchase && subtotal < promo.minPurchase) {
    return { error: `Minimum pembelian ${promo.minPurchase} untuk voucher ini` };
  }

  let discount = promo.value;
  if (promo.maxDiscount && discount > promo.maxDiscount) discount = promo.maxDiscount;

  return {
    success: true,
    promoId: promo.id,
    promoName: promo.name,
    discount,
  };
}

export async function findCustomerByPhone(phone: string) {
  if (!phone || phone.length < 4) return null;

  return prisma.customer.findFirst({
    where: {
      OR: [
        { phone: { contains: phone } },
        { memberCardCode: phone },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      memberLevel: true,
      points: true,
      totalSpending: true,
      memberCardCode: true,
    },
  });
}
