"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { getCurrentCompanyId } from "@/lib/company";

export async function getGoodsReceipts(params?: {
  search?: string;
  page?: number;
  perPage?: number;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  purchaseOrderId?: string;
}) {
  const {
    search,
    page = 1,
    perPage = 10,
    dateFrom,
    dateTo,
    branchId,
    purchaseOrderId,
  } = params || {};
  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { companyId };

  if (search) {
    where.OR = [
      { receiptNumber: { contains: search, mode: "insensitive" } },
      { purchaseOrder: { orderNumber: { contains: search, mode: "insensitive" } } },
      { purchaseOrder: { supplier: { name: { contains: search, mode: "insensitive" } } } },
      { receivedByName: { contains: search, mode: "insensitive" } },
    ];
  }
  if (dateFrom || dateTo) {
    const receivedAt: Record<string, Date> = {};
    if (dateFrom) receivedAt.gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) receivedAt.lte = new Date(dateTo + "T23:59:59");
    where.receivedAt = receivedAt;
  }
  if (branchId && branchId !== "ALL") where.branchId = branchId;
  if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;

  const [receipts, total] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        purchaseOrder: {
          select: { orderNumber: true, supplier: { select: { name: true } }, totalAmount: true, status: true },
        },
        branch: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.goodsReceipt.count({ where }),
  ]);

  return { receipts, total, totalPages: Math.ceil(total / perPage) };
}

export async function getGoodsReceiptById(id: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.goodsReceipt.findFirst({
    where: { id, companyId },
    include: {
      purchaseOrder: {
        select: {
          orderNumber: true,
          orderDate: true,
          status: true,
          totalAmount: true,
          supplier: { select: { name: true, contact: true, address: true } },
        },
      },
      branch: { select: { name: true } },
      items: true,
    },
  });
}

export async function getGoodsReceiptsByPO(purchaseOrderId: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.goodsReceipt.findMany({
    where: { purchaseOrderId, companyId },
    orderBy: { receivedAt: "desc" },
    include: {
      items: true,
      branch: { select: { name: true } },
    },
  });
}

export async function getGoodsReceiptStats(params?: { branchId?: string }) {
  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { companyId };
  if (params?.branchId && params.branchId !== "ALL") where.branchId = params.branchId;

  const [total, today, thisMonth] = await Promise.all([
    prisma.goodsReceipt.count({ where }),
    prisma.goodsReceipt.count({
      where: { ...where, receivedAt: { gte: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00") } },
    }),
    prisma.goodsReceipt.count({
      where: {
        ...where,
        receivedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  return { total, today, thisMonth };
}

export async function deleteGoodsReceipt(id: string) {
  await assertMenuActionAccess("goods-receipts", "delete");
  const companyId = await getCurrentCompanyId();
  const gr = await prisma.goodsReceipt.findFirst({ where: { id, companyId } });
  if (!gr) return { error: "Bukti penerimaan tidak ditemukan" };

  await prisma.goodsReceipt.delete({ where: { id } });
  revalidatePath("/goods-receipts");
  return { success: true };
}

export async function bulkDeleteGoodsReceipts(ids: string[]) {
  await assertMenuActionAccess("goods-receipts", "delete");
  const companyId = await getCurrentCompanyId();
  await prisma.goodsReceipt.deleteMany({ where: { id: { in: ids }, companyId } });
  revalidatePath("/goods-receipts");
  return { success: true };
}
