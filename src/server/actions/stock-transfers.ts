"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";

interface GetStockTransfersParams {
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

export async function getStockTransfers(params: GetStockTransfersParams = {}) {
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
  const companyId = await getCurrentCompanyId();

  const where: Record<string, unknown> = { companyId };
  if (branchId && branchId !== "ALL") {
    where.OR = [
      { fromBranchId: branchId },
      { toBranchId: branchId },
    ];
  }
  if (search) {
    const searchCondition = [
      { transferNumber: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ];
    if (where.OR) {
      // Combine branch filter AND search: must match branch AND search
      where.AND = [{ OR: where.OR }, { OR: searchCondition }];
      delete where.OR;
    } else {
      where.OR = searchCondition;
    }
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

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "transferNumber"
      ? { transferNumber: direction }
      : sortBy === "fromBranch"
        ? { fromBranch: { name: direction } }
        : sortBy === "toBranch"
          ? { toBranch: { name: direction } }
          : { createdAt: direction };

  const [transfers, total] = await Promise.all([
    prisma.stockTransfer.findMany({
      where,
      include: {
        fromBranch: { select: { name: true } },
        toBranch: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.stockTransfer.count({ where }),
  ]);

  return {
    transfers,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
}

/** Helper: validate transfer belongs to company via branch relationship */
async function validateTransferOwnership(id: string, companyId: string) {
  return prisma.stockTransfer.findFirst({
    where: { id, companyId },
  });
}

export async function getStockTransferById(id: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.stockTransfer.findFirst({
    where: { id, companyId },
    include: {
      fromBranch: { select: { name: true } },
      toBranch: { select: { name: true } },
      items: true,
    },
  });
}

interface TransferItem {
  productId: string;
  productName: string;
  quantity: number;
}

export async function createStockTransfer(data: {
  fromBranchId: string;
  toBranchId: string;
  items: TransferItem[];
  notes?: string;
}) {
  await assertMenuActionAccess("stock-transfers", "create");
  const companyId = await getCurrentCompanyId();

  if (!data.fromBranchId) return { error: "Cabang asal wajib dipilih" };
  if (!data.toBranchId) return { error: "Cabang tujuan wajib dipilih" };
  if (data.fromBranchId === data.toBranchId)
    return { error: "Cabang asal dan tujuan tidak boleh sama" };
  if (!data.items.length) return { error: "Minimal 1 item untuk transfer" };

  // Validate both branches belong to company
  const [fromBranch, toBranch] = await Promise.all([
    prisma.branch.findFirst({ where: { id: data.fromBranchId, companyId } }),
    prisma.branch.findFirst({ where: { id: data.toBranchId, companyId } }),
  ]);
  if (!fromBranch) return { error: "Cabang asal tidak ditemukan" };
  if (!toBranch) return { error: "Cabang tujuan tidak ditemukan" };

  try {
    const today = new Date();
    const prefix = `TRF-${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;
    const last = await prisma.stockTransfer.findFirst({
      where: { transferNumber: { startsWith: prefix } },
      orderBy: { transferNumber: "desc" },
    });
    let seq = 1;
    if (last) {
      const lastSeq = parseInt(last.transferNumber.split("-").pop() || "0");
      seq = lastSeq + 1;
    }
    const transferNumber = `${prefix}-${String(seq).padStart(4, "0")}`;

    await prisma.stockTransfer.create({
      data: {
        transferNumber,
        fromBranchId: data.fromBranchId,
        toBranchId: data.toBranchId,
        companyId,
        notes: data.notes || null,
        status: "PENDING",
        items: {
          create: data.items.map((item) => ({
            productId: item.productId || "manual",
            productName: item.productName,
            quantity: item.quantity,
          })),
        },
      },
    });

    createAuditLog({
      action: "CREATE",
      entity: "StockTransfer",
      entityId: transferNumber,
      details: { data: { fromBranchId: data.fromBranchId, toBranchId: data.toBranchId, itemCount: data.items.length } },
    }).catch(() => {});

    revalidatePath("/stock-transfers");
    return { success: true };
  } catch {
    return { error: "Gagal membuat transfer stok" };
  }
}

export async function approveStockTransfer(id: string) {
  await assertMenuActionAccess("stock-transfers", "approve");
  const companyId = await getCurrentCompanyId();
  try {
    const transfer = await validateTransferOwnership(id, companyId);
    if (!transfer) return { error: "Transfer tidak ditemukan" };
    if (transfer.status !== "PENDING")
      return { error: "Hanya transfer PENDING yang bisa diapprove" };

    await prisma.stockTransfer.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date() },
    });

    createAuditLog({
      action: "UPDATE",
      entity: "StockTransfer",
      entityId: id,
      details: { data: { transferId: id, status: "APPROVED" } },
    }).catch(() => {});

    revalidatePath("/stock-transfers");
    return { success: true };
  } catch {
    return { error: "Gagal meng-approve transfer" };
  }
}

export async function receiveStockTransfer(id: string) {
  await assertMenuActionAccess("stock-transfers", "receive");
  const companyId = await getCurrentCompanyId();
  try {
    // Pre-validate ownership before transaction
    const check = await validateTransferOwnership(id, companyId);
    if (!check) return { error: "Transfer tidak ditemukan" };

    await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!transfer) throw new Error("Transfer tidak ditemukan");
      if (transfer.status !== "APPROVED")
        throw new Error("Transfer harus di-approve terlebih dahulu");

      // Update stock for each item
      for (const item of transfer.items) {
        if (item.productId === "manual") continue;

        // Decrease stock from source (OUT)
        const product = await tx.product.findFirst({
          where: { id: item.productId, companyId },
        });
        if (!product) continue;

        if (product.stock < item.quantity) {
          throw new Error(
            `Stok ${item.productName} tidak mencukupi (sisa: ${product.stock})`,
          );
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "TRANSFER",
            quantity: item.quantity,
            note: `Transfer keluar ${transfer.transferNumber}`,
            reference: transfer.transferNumber,
            branchId: transfer.fromBranchId,
            companyId,
          },
        });

        // Create incoming stock movement for destination
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "TRANSFER",
            quantity: item.quantity,
            note: `Transfer masuk ${transfer.transferNumber}`,
            reference: transfer.transferNumber,
            branchId: transfer.toBranchId,
            companyId,
          },
        });

        // Update received qty
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { receivedQty: item.quantity },
        });
      }

      await tx.stockTransfer.update({
        where: { id },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });
    }, { timeout: 15000 });

    createAuditLog({
      action: "UPDATE",
      entity: "StockTransfer",
      entityId: id,
      details: { data: { transferId: id, status: "RECEIVED" } },
    }).catch(() => {});

    revalidatePath("/stock-transfers");
    revalidatePath("/products");
    revalidatePath("/stock");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal menerima transfer",
    };
  }
}

export async function rejectStockTransfer(id: string, reason?: string) {
  await assertMenuActionAccess("stock-transfers", "approve");
  const companyId = await getCurrentCompanyId();
  try {
    const transfer = await validateTransferOwnership(id, companyId);
    if (!transfer) return { error: "Transfer tidak ditemukan" };
    if (transfer.status !== "PENDING" && transfer.status !== "APPROVED") {
      return { error: "Transfer tidak bisa ditolak" };
    }

    await prisma.stockTransfer.update({
      where: { id },
      data: {
        status: "REJECTED",
        notes: reason
          ? `${transfer.notes || ""}\nAlasan ditolak: ${reason}`.trim()
          : transfer.notes,
      },
    });

    createAuditLog({
      action: "UPDATE",
      entity: "StockTransfer",
      entityId: id,
      details: { data: { transferId: id, status: "REJECTED" } },
    }).catch(() => {});

    revalidatePath("/stock-transfers");
    return { success: true };
  } catch {
    return { error: "Gagal menolak transfer" };
  }
}
