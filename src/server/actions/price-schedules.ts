"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { assertMenuActionAccess } from "@/lib/access-control";
import { auth } from "@/lib/auth";
import { getCurrentCompanyId } from "@/lib/company";

// ─────────────────────────────────────────────
// List with pagination, search, filters
// ─────────────────────────────────────────────

export async function getPriceSchedules(params?: {
  search?: string;
  status?: string; // upcoming | active | expired | reverted
  branchId?: string;
  page?: number;
  perPage?: number;
}) {
  const { search, status, branchId, page = 1, perPage = 10 } = params || {};
  const companyId = await getCurrentCompanyId();

  const now = new Date();
  const where: Record<string, unknown> = { companyId };

  if (search) {
    where.product = { name: { contains: search, mode: "insensitive" } };
  }

  if (branchId) {
    where.branchId = branchId;
  }

  if (status === "upcoming") {
    where.appliedAt = null;
    where.startDate = { gt: now };
  } else if (status === "active") {
    where.appliedAt = { not: null };
    where.revertedAt = null;
    where.endDate = { gt: now };
  } else if (status === "expired") {
    where.revertedAt = { not: null };
  } else if (status === "reverted") {
    where.revertedAt = { not: null };
  }

  const [schedules, total] = await Promise.all([
    prisma.priceSchedule.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        product: { select: { id: true, name: true, code: true, sellingPrice: true } },
        branch: { select: { id: true, name: true } },
      },
    }),
    prisma.priceSchedule.count({ where }),
  ]);

  return { schedules, total, totalPages: Math.ceil(total / perPage) };
}

// ─────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────

export async function getPriceScheduleStats() {
  const companyId = await getCurrentCompanyId();
  const now = new Date();

  const [active, upcoming, expired, productsAffected] = await Promise.all([
    prisma.priceSchedule.count({
      where: { appliedAt: { not: null }, revertedAt: null, endDate: { gt: now }, companyId },
    }),
    prisma.priceSchedule.count({
      where: { appliedAt: null, startDate: { gt: now }, companyId },
    }),
    prisma.priceSchedule.count({
      where: { revertedAt: { not: null }, companyId },
    }),
    prisma.priceSchedule.groupBy({
      by: ["productId"],
      where: { appliedAt: { not: null }, revertedAt: null, companyId },
    }),
  ]);

  return { active, upcoming, expired, productsAffected: productsAffected.length };
}

// ─────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────

export async function createPriceSchedule(data: {
  productId: string;
  newPrice: number;
  startDate: string;
  endDate: string;
  reason?: string;
  branchId?: string;
}) {
  await assertMenuActionAccess("price-schedules", "create");
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const companyId = await getCurrentCompanyId();

  try {
    const product = await prisma.product.findUnique({
      where: { id: data.productId, companyId },
      select: { sellingPrice: true, name: true },
    });

    if (!product) return { error: "Produk tidak ditemukan" };

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate <= startDate) {
      return { error: "Tanggal selesai harus setelah tanggal mulai" };
    }

    // Determine target branches
    let targetBranchIds: string[];
    if (data.branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: data.branchId, companyId } });
      if (!branch) return { error: "Cabang tidak ditemukan" };
      targetBranchIds = [data.branchId];
    } else {
      const branches = await prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true } });
      targetBranchIds = branches.map((b) => b.id);
      if (targetBranchIds.length === 0) return { error: "Tidak ada cabang aktif" };
    }

    // Check overlapping per branch
    for (const bid of targetBranchIds) {
      const overlap = await prisma.priceSchedule.findFirst({
        where: {
          productId: data.productId,
          companyId,
          branchId: bid,
          revertedAt: null,
          OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
        },
      });
      if (overlap) {
        return { error: "Sudah ada jadwal harga yang tumpang tindih untuk produk ini" };
      }
    }

    // Create one schedule per branch
    for (const bid of targetBranchIds) {
      await prisma.priceSchedule.create({
        data: {
          productId: data.productId,
          newPrice: data.newPrice,
          originalPrice: product.sellingPrice,
          startDate,
          endDate,
          reason: data.reason || null,
          branchId: bid,
          companyId,
          createdBy: session.user.id,
          isActive: true,
        },
      });
    }

    await createAuditLog({
      action: "CREATE",
      entity: "PriceSchedule",
      details: {
        productName: product.name,
        originalPrice: product.sellingPrice,
        newPrice: data.newPrice,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });

    revalidatePath("/price-schedules");
    return { success: true };
  } catch (error) {
    console.error("createPriceSchedule error:", error);
    return { error: "Gagal membuat jadwal harga" };
  }
}

// ─────────────────────────────────────────────
// Delete (only if not yet applied)
// ─────────────────────────────────────────────

export async function deletePriceSchedule(id: string) {
  await assertMenuActionAccess("price-schedules", "delete");
  const companyId = await getCurrentCompanyId();

  try {
    const schedule = await prisma.priceSchedule.findFirst({
      where: { id, companyId },
      include: { product: { select: { name: true } } },
    });

    if (!schedule) return { error: "Jadwal tidak ditemukan" };
    if (schedule.appliedAt) return { error: "Jadwal sudah diterapkan, tidak bisa dihapus" };

    await prisma.priceSchedule.delete({ where: { id } });

    await createAuditLog({
      action: "DELETE",
      entity: "PriceSchedule",
      entityId: id,
      details: {
        productName: schedule.product.name,
        newPrice: schedule.newPrice,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
      },
    });

    revalidatePath("/price-schedules");
    return { success: true };
  } catch (error) {
    console.error("deletePriceSchedule error:", error);
    return { error: "Gagal menghapus jadwal harga" };
  }
}

// ─────────────────────────────────────────────
// Apply due price schedules
// ─────────────────────────────────────────────

export async function applyDuePriceSchedules() {
  await assertMenuActionAccess("price-schedules", "update");
  const companyId = await getCurrentCompanyId();

  const now = new Date();

  try {
    // Find schedules that should be applied (scoped to company)
    const dueSchedules = await prisma.priceSchedule.findMany({
      where: {
        isActive: true,
        appliedAt: null,
        startDate: { lte: now },
        companyId,
      },
      include: { product: { select: { name: true } } },
    });

    let appliedCount = 0;

    for (const schedule of dueSchedules) {
      await prisma.$transaction([
        prisma.product.update({
          where: { id: schedule.productId },
          data: { sellingPrice: schedule.newPrice },
        }),
        prisma.priceSchedule.update({
          where: { id: schedule.id },
          data: { appliedAt: now },
        }),
      ]);

      await createAuditLog({
        action: "APPLY_PRICE_SCHEDULE",
        entity: "PriceSchedule",
        entityId: schedule.id,
        details: {
          productName: schedule.product.name,
          originalPrice: schedule.originalPrice,
          newPrice: schedule.newPrice,
        },
      });

      appliedCount++;
    }

    // Also revert expired schedules (scoped to company)
    const expiredSchedules = await prisma.priceSchedule.findMany({
      where: {
        isActive: true,
        appliedAt: { not: null },
        revertedAt: null,
        endDate: { lte: now },
        companyId,
      },
      include: { product: { select: { name: true } } },
    });

    let revertedCount = 0;

    for (const schedule of expiredSchedules) {
      await prisma.$transaction([
        prisma.product.update({
          where: { id: schedule.productId },
          data: { sellingPrice: schedule.originalPrice },
        }),
        prisma.priceSchedule.update({
          where: { id: schedule.id },
          data: { revertedAt: now },
        }),
      ]);

      await createAuditLog({
        action: "REVERT_PRICE_SCHEDULE",
        entity: "PriceSchedule",
        entityId: schedule.id,
        details: {
          productName: schedule.product.name,
          revertedTo: schedule.originalPrice,
        },
      });

      revertedCount++;
    }

    revalidatePath("/price-schedules");
    return { success: true, appliedCount, revertedCount };
  } catch (error) {
    console.error("applyDuePriceSchedules error:", error);
    return { error: "Gagal menerapkan jadwal harga" };
  }
}

// ─────────────────────────────────────────────
// Revert expired price schedules
// ─────────────────────────────────────────────

export async function revertExpiredPriceSchedules() {
  await assertMenuActionAccess("price-schedules", "update");
  const companyId = await getCurrentCompanyId();

  const now = new Date();

  try {
    const expiredSchedules = await prisma.priceSchedule.findMany({
      where: {
        isActive: true,
        appliedAt: { not: null },
        revertedAt: null,
        endDate: { lte: now },
        companyId,
      },
      include: { product: { select: { name: true } } },
    });

    let revertedCount = 0;

    for (const schedule of expiredSchedules) {
      await prisma.$transaction([
        prisma.product.update({
          where: { id: schedule.productId },
          data: { sellingPrice: schedule.originalPrice },
        }),
        prisma.priceSchedule.update({
          where: { id: schedule.id },
          data: { revertedAt: now },
        }),
      ]);

      await createAuditLog({
        action: "REVERT_PRICE_SCHEDULE",
        entity: "PriceSchedule",
        entityId: schedule.id,
        details: {
          productName: schedule.product.name,
          revertedTo: schedule.originalPrice,
        },
      });

      revertedCount++;
    }

    revalidatePath("/price-schedules");
    return { success: true, revertedCount };
  } catch (error) {
    console.error("revertExpiredPriceSchedules error:", error);
    return { error: "Gagal mengembalikan harga" };
  }
}
