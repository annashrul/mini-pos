"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

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

  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { companyId };
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
  const companyId = await getCurrentCompanyId();
  return prisma.stockOpname.findFirst({
    where: { id, companyId },
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
  const companyId = await getCurrentCompanyId();

  // Validate branch belongs to company
  if (branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: branchId, companyId } });
    if (!branch) return { error: "Cabang tidak ditemukan" };
  }

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
      where: { isActive: true, companyId },
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
        companyId,
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

/** Helper: validate opname belongs to company */
async function validateOpnameOwnership(id: string, companyId: string) {
  return prisma.stockOpname.findFirst({
    where: { id, companyId },
  });
}

export async function updateOpnameItems(
  opnameId: string,
  items: { productId: string; actualStock: number }[],
) {
  await assertMenuActionAccess("stock-opname", "update");
  const companyId = await getCurrentCompanyId();
  try {
    const opname = await validateOpnameOwnership(opnameId, companyId);
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
    }, { timeout: 15000 });

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
  const companyId = await getCurrentCompanyId();
  try {
    // Pre-validate ownership
    const check = await validateOpnameOwnership(id, companyId);
    if (!check) throw new Error("Stock opname tidak ditemukan");

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
              branchId: opname.branchId,
              companyId,
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
    }, { timeout: 15000 });

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
  const companyId = await getCurrentCompanyId();
  try {
    const opname = await validateOpnameOwnership(id, companyId);
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

/** Load all active products with branch stock for opname form */
export async function getProductsForOpname(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { isActive: true, companyId };
  if (branchId) {
    where.branchStocks = { some: { branchId } };
  }

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      code: true,
      stock: true,
      ...(branchId ? { branchStocks: { where: { branchId }, select: { quantity: true }, take: 1 } } : {}),
    },
    orderBy: { name: "asc" },
  });

  return products.map((p) => {
    const bs = branchId ? ((p as Record<string, unknown>).branchStocks as Array<{ quantity: number }> | undefined)?.[0] : null;
    return { id: p.id, name: p.name, code: p.code, systemStock: bs?.quantity ?? p.stock };
  });
}

/** Create opname and set actual stock in one call — supports multiple branches */
export async function createStockOpnameWithItems(params: {
  branchIds: string[];
  notes?: string | undefined;
  items: { productId: string; systemStock: number; actualStock: number }[];
}) {
  await assertMenuActionAccess("stock-opname", "create");
  const companyId = await getCurrentCompanyId();

  if (params.items.length === 0) return { error: "Tidak ada produk untuk di-opname" };
  if (params.branchIds.length === 0) return { error: "Pilih minimal 1 lokasi" };

  // Validate all branches
  const validBranches = await prisma.branch.findMany({
    where: { id: { in: params.branchIds }, companyId },
    select: { id: true },
  });
  if (validBranches.length !== params.branchIds.length) return { error: "Cabang tidak ditemukan" };

  try {
    for (const branchId of params.branchIds) {
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

      await prisma.stockOpname.create({
        data: {
          opnameNumber,
          branchId,
          companyId,
          notes: params.notes || null,
          status: "IN_PROGRESS",
          items: {
            create: params.items.map((item) => ({
              productId: item.productId,
              systemStock: item.systemStock,
              actualStock: item.actualStock,
              difference: item.actualStock - item.systemStock,
            })),
          },
        },
      });

      createAuditLog({
        action: "CREATE",
        entity: "StockOpname",
        entityId: opnameNumber,
        details: { data: { opnameNumber, branchId, itemCount: params.items.length } },
        branchId,
      }).catch(() => {});
    }

    revalidatePath("/stock-opname");
    return { success: true };
  } catch {
    return { error: "Gagal membuat stock opname" };
  }
}

// ─── Import Stock Opname ───

export async function importStockOpname(rows: { productCode: string; actualQty: number; note: string }[], branchId?: string) {
  await assertMenuActionAccess("stock-opname", "create");
  const companyId = await getCurrentCompanyId();
  const products = await prisma.product.findMany({ where: { companyId }, select: { id: true, code: true, stock: true } });
  const productMap = new Map(products.map((p) => [p.code.toLowerCase(), p]));
  const counter = await prisma.stockOpname.count({ where: { companyId } });

  type R = { row: number; success: boolean; name: string; error?: string };
  const results: R[] = [];
  const items: { productId: string; systemStock: number; actualStock: number; difference: number; notes: string | null }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    const product = productMap.get((row.productCode || "").toLowerCase().trim());
    if (!product) { results.push({ row: rowNum, success: false, name: row.productCode || `Baris ${rowNum}`, error: `Produk "${row.productCode}" tidak ditemukan` }); continue; }
    items.push({ productId: product.id, systemStock: product.stock, actualStock: Number(row.actualQty) || 0, difference: (Number(row.actualQty) || 0) - product.stock, notes: row.note?.trim() || null });
    results.push({ row: rowNum, success: true, name: row.productCode });
  }

  if (items.length > 0) {
    try {
      await prisma.stockOpname.create({
        data: { opnameNumber: `OPN-${String(counter + 1).padStart(5, "0")}`, branchId: branchId || null, companyId, status: "DRAFT", startedAt: new Date(), items: { create: items } },
      });
    } catch { for (const r of results) if (r.success) { r.success = false; r.error = "Gagal menyimpan"; } }
  }

  revalidatePath("/stock-opname");
  return { results, successCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length };
}

const OPNAME_TEMPLATE_COLS: TemplateColumn[] = [
  { header: "Kode Produk *", width: 16, sampleValues: ["PRD-00001", "PRD-00002"] },
  { header: "Stok Aktual *", width: 12, sampleValues: ["95", "200"] },
  { header: "Catatan", width: 25, sampleValues: ["Selisih 5 pcs", "Sesuai"] },
];

export async function downloadOpnameImportTemplate(format: "csv" | "excel" | "docx") {
  const companyId = await getCurrentCompanyId();
  const products = await prisma.product.findMany({ where: { companyId, isActive: true }, select: { code: true, name: true, stock: true }, take: 20, orderBy: { code: "asc" } });
  const notes = [`Produk: ${products.map((p) => `${p.code} (${p.name}) stok: ${p.stock}`).join(", ") || "-"}`, "Semua item akan dibuat dalam 1 opname", "Kolom dengan tanda * wajib diisi"];
  const result = await generateImportTemplate(OPNAME_TEMPLATE_COLS, 2, notes, format);
  return { data: result.data, filename: `template-import-opname.${format === "excel" ? "xlsx" : format}`, mimeType: result.mimeType };
}
