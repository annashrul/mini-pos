"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { calculateEarnedPoints, calculateRedeemValue, determineLevel } from "@/lib/point-config";
import { getPointConfig } from "@/server/actions/settings";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";

// ===========================
// Earn points after transaction
// ===========================

export async function earnPoints(customerId: string, grandTotal: number, invoiceNumber: string) {
  const config = await getPointConfig();
  if (!config.pointsEnabled) return;
  const companyId = await getCurrentCompanyId();

  const customer = await prisma.customer.findUnique({ where: { id: customerId, companyId } });
  if (!customer) return;

  const earned = calculateEarnedPoints(grandTotal, customer.memberLevel, config);
  if (earned <= 0) return;

  const newTotalSpending = customer.totalSpending + grandTotal;
  const newLevel = determineLevel(newTotalSpending, config);
  const levelChanged = newLevel !== customer.memberLevel;

  await prisma.$transaction(async (tx) => {
    await tx.customerPointHistory.create({
      data: {
        customerId,
        points: earned,
        type: "EARN",
        reference: invoiceNumber,
        description: `Mendapat ${earned} poin dari transaksi ${invoiceNumber}`,
      },
    });

    await tx.customer.update({
      where: { id: customerId },
      data: {
        points: { increment: earned },
        totalSpending: newTotalSpending,
        memberLevel: newLevel as "REGULAR" | "SILVER" | "GOLD" | "PLATINUM",
      },
    });

    if (levelChanged) {
      await tx.customerPointHistory.create({
        data: {
          customerId,
          points: 0,
          type: "ADJUST",
          description: `Level naik: ${customer.memberLevel} → ${newLevel}`,
        },
      });
    }
  }, { timeout: 15000 });

  createAuditLog({
    action: "CREATE",
    entity: "Points",
    details: { data: { customerName: customer.name, earned, invoiceNumber } },
  }).catch(() => {});

  revalidatePath("/customers");
  return { earned, newLevel: levelChanged ? newLevel : undefined };
}

// ===========================
// Redeem points as discount
// ===========================

export async function redeemPoints(customerId: string, points: number) {
  const config = await getPointConfig();
  if (!config.pointsEnabled) return { error: "Sistem poin tidak aktif" };
  if (points < config.redeemMin) return { error: `Minimum redeem ${config.redeemMin} poin` };

  const companyId = await getCurrentCompanyId();
  const customer = await prisma.customer.findUnique({ where: { id: customerId, companyId } });
  if (!customer) return { error: "Customer tidak ditemukan" };
  if (customer.points < points) return { error: `Poin tidak cukup (sisa: ${customer.points})` };

  const discountValue = calculateRedeemValue(points, config);
  return { success: true, points, discountValue };
}

// ===========================
// Confirm redeem
// ===========================

export async function confirmRedeem(customerId: string, points: number, invoiceNumber: string) {
  await prisma.$transaction(async (tx) => {
    await tx.customerPointHistory.create({
      data: {
        customerId,
        points: -points,
        type: "REDEEM",
        reference: invoiceNumber,
        description: `Tukar ${points} poin untuk diskon di transaksi ${invoiceNumber}`,
      },
    });
    await tx.customer.update({
      where: { id: customerId },
      data: { points: { decrement: points } },
    });
  }, { timeout: 15000 });

  createAuditLog({
    action: "REDEEM",
    entity: "Points",
    details: { data: { customerId, points, invoiceNumber } },
  }).catch(() => {});

  revalidatePath("/customers");
}

// ===========================
// Point history
// ===========================

export async function getPointHistory(customerId: string, params?: { page?: number; perPage?: number }) {
  const { page = 1, perPage = 15 } = params || {};
  const companyId = await getCurrentCompanyId();

  const [history, total] = await Promise.all([
    prisma.customerPointHistory.findMany({
      where: { customerId, customer: { companyId } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.customerPointHistory.count({ where: { customerId, customer: { companyId } } }),
  ]);

  return { history, total, totalPages: Math.ceil(total / perPage) };
}

// ===========================
// Manual adjust points (admin)
// ===========================

export async function adjustPoints(customerId: string, points: number, reason: string) {
  if (!reason) return { error: "Alasan wajib diisi" };
  const companyId = await getCurrentCompanyId();

  const customer = await prisma.customer.findUnique({ where: { id: customerId, companyId } });
  if (!customer) return { error: "Customer tidak ditemukan" };

  const newPoints = customer.points + points;
  if (newPoints < 0) return { error: "Poin tidak boleh negatif" };

  await prisma.$transaction(async (tx) => {
    await tx.customerPointHistory.create({
      data: { customerId, points, type: "ADJUST", description: reason },
    });
    await tx.customer.update({
      where: { id: customerId },
      data: { points: newPoints },
    });
  }, { timeout: 15000 });

  revalidatePath("/customers");
  return { success: true };
}
