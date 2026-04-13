"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { getCurrentCompanyId } from "@/lib/company";

function generateGiftCardCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = [];
  for (let s = 0; s < 3; s++) {
    let segment = "";
    for (let i = 0; i < 4; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return `GIFT-${segments.join("-")}`;
}

export async function getGiftCards(params?: {
  search?: string;
  status?: string;
  branchId?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const {
    search,
    status,
    branchId,
    page = 1,
    perPage = 10,
    sortBy,
    sortDir = "desc",
  } = params || {};

  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = {
    OR: [
      { branch: { companyId } },
      { AND: [{ branchId: null }, { createdByUser: { companyId } }] },
    ],
  };

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { purchasedBy: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status && status !== "ALL") {
    where.status = status;
  }
  if (branchId && branchId !== "ALL") {
    where.branchId = branchId;
  }

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  let orderBy: Prisma.GiftCardOrderByWithRelationInput = { createdAt: direction };
  if (sortBy === "code") orderBy = { code: direction };
  else if (sortBy === "currentBalance") orderBy = { currentBalance: direction };
  else if (sortBy === "initialBalance") orderBy = { initialBalance: direction };
  else if (sortBy === "status") orderBy = { status: direction };
  else if (sortBy === "expiresAt") orderBy = { expiresAt: direction };

  const [giftCards, total] = await Promise.all([
    prisma.giftCard.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
        _count: { select: { transactions: true } },
      },
    }),
    prisma.giftCard.count({ where }),
  ]);

  return { giftCards, total, totalPages: Math.ceil(total / perPage) };
}

export async function getGiftCardByCode(code: string) {
  const companyId = await getCurrentCompanyId();
  const giftCard = await prisma.giftCard.findFirst({
    where: {
      code,
      OR: [
        { branch: { companyId } },
        { AND: [{ branchId: null }, { createdByUser: { companyId } }] },
      ],
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      branch: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, name: true } },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
  if (!giftCard) return { error: "Gift card tidak ditemukan" };
  return { giftCard };
}

export async function getGiftCardById(id: string) {
  const companyId = await getCurrentCompanyId();
  const giftCard = await prisma.giftCard.findFirst({
    where: {
      id,
      OR: [
        { branch: { companyId } },
        { AND: [{ branchId: null }, { createdByUser: { companyId } }] },
      ],
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      branch: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, name: true } },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
  if (!giftCard) return { error: "Gift card tidak ditemukan" };
  return { giftCard };
}

export async function createGiftCard(data: {
  amount: number;
  purchasedBy?: string;
  customerId?: string;
  expiresAt?: string;
  branchId?: string;
}) {
  await assertMenuActionAccess("gift-cards", "create");
  const session = await auth();
  const companyId = await getCurrentCompanyId();
  if (!session?.user?.id) return { error: "Unauthorized" };

  if (!data.amount || data.amount <= 0) {
    return { error: "Nominal harus lebih dari 0" };
  }

  // Generate unique code with retry
  let code = "";
  let attempts = 0;
  while (attempts < 10) {
    code = generateGiftCardCode();
    const existing = await prisma.giftCard.findUnique({ where: { code } });
    if (!existing) break;
    attempts++;
  }
  if (attempts >= 10) return { error: "Gagal membuat kode gift card" };

  try {
    // Determine target branches
    let targetBranchIds: string[];
    if (data.branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: data.branchId, companyId }, select: { id: true } });
      if (!branch) return { error: "Cabang tidak ditemukan" };
      targetBranchIds = [data.branchId];
    } else {
      const branches = await prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true } });
      targetBranchIds = branches.map((b) => b.id);
      if (targetBranchIds.length === 0) return { error: "Tidak ada cabang aktif" };
    }

    for (const bid of targetBranchIds) {
      // Generate unique code per branch
      const cardCode = targetBranchIds.length > 1 ? generateGiftCardCode() : code;

      const giftCard = await prisma.giftCard.create({
        data: {
          code: cardCode,
          initialBalance: data.amount,
          currentBalance: data.amount,
          status: "ACTIVE",
          purchasedBy: data.purchasedBy || null,
          customerId: data.customerId || null,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          branchId: bid,
          companyId,
          createdBy: session.user.id,
        },
      });

      // Create initial purchase transaction
      await prisma.giftCardTransaction.create({
        data: {
          giftCardId: giftCard.id,
          type: "PURCHASE",
          amount: data.amount,
          balanceBefore: 0,
          balanceAfter: data.amount,
          reference: `Initial purchase`,
        },
      });

      createAuditLog({
        action: "CREATE",
        entity: "GiftCard",
        entityId: giftCard.id,
        details: { code: cardCode, amount: data.amount, purchasedBy: data.purchasedBy ?? null },
        branchId: bid,
      }).catch(() => {});
    }

    revalidatePath("/gift-cards");
    return { success: true };
  } catch {
    return { error: "Gagal membuat gift card" };
  }
}

export async function topUpGiftCard(id: string, amount: number) {
  await assertMenuActionAccess("gift-cards", "update");
  const companyId = await getCurrentCompanyId();

  if (!amount || amount <= 0) {
    return { error: "Nominal top up harus lebih dari 0" };
  }

  try {
    const giftCard = await prisma.giftCard.findFirst({
      where: {
        id,
        OR: [
          { branch: { companyId } },
          { AND: [{ branchId: null }, { createdByUser: { companyId } }] },
        ],
      },
    });
    if (!giftCard) return { error: "Gift card tidak ditemukan" };
    if (giftCard.status !== "ACTIVE") return { error: "Gift card tidak aktif" };
    if (giftCard.expiresAt && new Date(giftCard.expiresAt) < new Date()) {
      return { error: "Gift card sudah expired" };
    }

    const balanceBefore = giftCard.currentBalance;
    const balanceAfter = balanceBefore + amount;

    await prisma.$transaction([
      prisma.giftCard.update({
        where: { id },
        data: { currentBalance: balanceAfter },
      }),
      prisma.giftCardTransaction.create({
        data: {
          giftCardId: id,
          type: "TOPUP",
          amount,
          balanceBefore,
          balanceAfter,
          reference: "Top up saldo",
        },
      }),
    ]);

    createAuditLog({
      action: "UPDATE",
      entity: "GiftCard",
      entityId: id,
      details: { action: "TOPUP", amount, balanceBefore, balanceAfter },
    }).catch(() => {});

    revalidatePath("/gift-cards");
    return { success: true, balanceAfter };
  } catch {
    return { error: "Gagal top up gift card" };
  }
}

export async function redeemGiftCard(
  code: string,
  amount: number,
  reference?: string
) {
  const companyId = await getCurrentCompanyId();
  if (!amount || amount <= 0) {
    return { error: "Nominal redeem harus lebih dari 0" };
  }

  try {
    const giftCard = await prisma.giftCard.findFirst({
      where: {
        code,
        OR: [
          { branch: { companyId } },
          { AND: [{ branchId: null }, { createdByUser: { companyId } }] },
        ],
      },
    });
    if (!giftCard) return { error: "Gift card tidak ditemukan" };
    if (giftCard.status !== "ACTIVE")
      return { error: "Gift card tidak aktif" };
    if (giftCard.expiresAt && new Date(giftCard.expiresAt) < new Date()) {
      // Auto-expire
      await prisma.giftCard.update({
        where: { id: giftCard.id },
        data: { status: "EXPIRED" },
      });
      return { error: "Gift card sudah expired" };
    }
    if (giftCard.currentBalance < amount) {
      return {
        error: `Saldo tidak cukup. Saldo tersedia: ${giftCard.currentBalance}`,
      };
    }

    const balanceBefore = giftCard.currentBalance;
    const balanceAfter = balanceBefore - amount;
    const newStatus = balanceAfter === 0 ? "USED" : "ACTIVE";

    await prisma.$transaction([
      prisma.giftCard.update({
        where: { id: giftCard.id },
        data: { currentBalance: balanceAfter, status: newStatus },
      }),
      prisma.giftCardTransaction.create({
        data: {
          giftCardId: giftCard.id,
          type: "REDEEM",
          amount,
          balanceBefore,
          balanceAfter,
          reference: reference || null,
        },
      }),
    ]);

    createAuditLog({
      action: "UPDATE",
      entity: "GiftCard",
      entityId: giftCard.id,
      details: { action: "REDEEM", amount, balanceBefore, balanceAfter, reference },
    }).catch(() => {});

    revalidatePath("/gift-cards");
    return { success: true, balanceAfter, status: newStatus };
  } catch {
    return { error: "Gagal redeem gift card" };
  }
}

export async function disableGiftCard(id: string) {
  await assertMenuActionAccess("gift-cards", "update");
  const companyId = await getCurrentCompanyId();

  try {
    const giftCard = await prisma.giftCard.findFirst({
      where: {
        id,
        OR: [
          { branch: { companyId } },
          { AND: [{ branchId: null }, { createdByUser: { companyId } }] },
        ],
      },
    });
    if (!giftCard) return { error: "Gift card tidak ditemukan" };

    await prisma.giftCard.update({
      where: { id },
      data: { status: "DISABLED" },
    });

    createAuditLog({
      action: "UPDATE",
      entity: "GiftCard",
      entityId: id,
      details: { action: "DISABLE", code: giftCard.code, remainingBalance: giftCard.currentBalance },
    }).catch(() => {});

    revalidatePath("/gift-cards");
    return { success: true };
  } catch {
    return { error: "Gagal menonaktifkan gift card" };
  }
}

export async function getGiftCardStats(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = {
    OR: [
      { branch: { companyId } },
      { AND: [{ branchId: null }, { createdByUser: { companyId } }] },
    ],
  };
  if (branchId && branchId !== "ALL") {
    where.branchId = branchId;
  }

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [activeCards, allCards, expiringSoon] = await Promise.all([
    prisma.giftCard.findMany({
      where: { ...where, status: "ACTIVE" },
      select: { currentBalance: true },
    }),
    prisma.giftCard.findMany({
      where,
      select: { initialBalance: true, currentBalance: true },
    }),
    prisma.giftCard.count({
      where: {
        ...where,
        status: "ACTIVE",
        expiresAt: { gte: now, lte: thirtyDaysFromNow },
      },
    }),
  ]);

  const totalActiveCards = activeCards.length;
  const totalBalanceOutstanding = activeCards.reduce(
    (sum, c) => sum + c.currentBalance,
    0
  );
  const totalRedeemed = allCards.reduce(
    (sum, c) => sum + (c.initialBalance - c.currentBalance),
    0
  );

  return {
    totalActiveCards,
    totalBalanceOutstanding,
    totalRedeemed,
    expiringSoon,
  };
}
