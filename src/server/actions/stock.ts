"use server";

import { prisma } from "@/lib/prisma";
import type { StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { emitEvent, EVENTS } from "@/lib/socket-emit";
import { getCurrentCompanyId } from "@/lib/company";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

interface GetStockMovementsParams {
  page?: number;
  perPage?: number;
  limit?: number;
  search?: string;
  productId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function getStockMovements(params: GetStockMovementsParams = {}) {
  const {
    page = 1,
    search,
    productId,
    type,
    dateFrom,
    dateTo,
    branchId,
    sortBy,
    sortDir = "desc",
  } = params;
  const perPage = params.perPage || params.limit || 10;
  const skip = (page - 1) * perPage;

  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { product: { companyId } };
  if (productId) where.productId = productId;
  if (branchId) where.branchId = branchId;
  if (type && type !== "ALL") where.type = type;
  if (search) {
    where.product = {
      companyId,
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ],
    };
  }
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59");
    where.createdAt = createdAt;
  }

  const direction = sortDir === "asc" ? ("asc" as const) : ("desc" as const);
  const orderBy =
    sortBy === "product"
      ? { product: { name: direction } }
      : sortBy === "type"
        ? { type: direction }
        : sortBy === "quantity"
          ? { quantity: direction }
          : { createdAt: direction };

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { name: true, code: true, stock: true } },
        branch: { select: { name: true } },
      },
      orderBy,
      skip,
      take: perPage,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return {
    movements,
    total,
    totalPages: Math.ceil(total / perPage),
    currentPage: page,
  };
}

export async function getStockMovementStats(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const branchFilter = branchId && branchId !== "ALL" ? `AND sm."branchId" = '${branchId}'` : "";
  const results = await prisma.$queryRawUnsafe<Array<{ type: string; count: number }>>(`
    SELECT sm.type, COUNT(*)::int AS count
    FROM stock_movements sm
    JOIN products p ON p.id = sm."productId"
    WHERE (sm."companyId" = '${companyId}' OR (sm."companyId" IS NULL AND p."companyId" = '${companyId}'))
    ${branchFilter}
    GROUP BY sm.type
  `);
  const map = new Map(results.map((r) => [r.type, r.count]));
  return {
    inCount: map.get("IN") ?? 0,
    outCount: map.get("OUT") ?? 0,
    adjCount: map.get("ADJUSTMENT") ?? 0,
    transferCount: map.get("TRANSFER") ?? 0,
    opnameCount: map.get("OPNAME") ?? 0,
  };
}

export async function createStockMovement(formData: FormData) {
  await assertMenuActionAccess("stock", "create");
  const companyId = await getCurrentCompanyId();

  // Support multiple items via JSON "items" field
  const itemsRaw = formData.get("items") as string | null;
  const items: { productId: string; quantity: number; type?: string }[] = itemsRaw ? JSON.parse(itemsRaw) : [];

  // Backward compat: single productId + quantity
  if (items.length === 0) {
    const pid = formData.get("productId") as string;
    const qty = Number(formData.get("quantity"));
    if (pid && qty > 0) items.push({ productId: pid, quantity: qty });
  }

  const globalType = (formData.get("type") as string) || "IN";
  const note = ((formData.get("note") as string) || null);
  const branchIdsRaw = (formData.get("branchIds") as string) || "";
  const branchIds: string[] = branchIdsRaw ? JSON.parse(branchIdsRaw) : [];
  const singleBranchId = (formData.get("branchId") as string) || null;
  if (singleBranchId && branchIds.length === 0) branchIds.push(singleBranchId);

  if (items.length === 0) return { error: "Pilih minimal 1 produk" };

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const item of items) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, companyId },
          });
          if (!product) throw new Error("Produk tidak ditemukan");
          if (item.quantity < 1) throw new Error(`Quantity minimal 1 untuk ${product.name}`);

          // Per-item type (fallback to global type)
          const itemType = (item.type && ["IN", "OUT", "ADJUSTMENT"].includes(item.type) ? item.type : globalType) as StockMovementType;
          const stockChange = itemType === "IN" ? item.quantity : itemType === "OUT" ? -item.quantity : 0;

          if (branchIds.length > 0) {
            for (const bid of branchIds) {
              const bs = await tx.branchStock.upsert({
                where: { branchId_productId: { branchId: bid, productId: item.productId } },
                update: {},
                create: { branchId: bid, productId: item.productId, quantity: 0 },
              });

              if (itemType === "OUT" && bs.quantity < item.quantity) {
                const branchName = (await tx.branch.findUnique({ where: { id: bid }, select: { name: true } }))?.name ?? bid;
                throw new Error(`Stok ${product.name} di ${branchName} tidak mencukupi (sisa: ${bs.quantity})`);
              }

              if (itemType === "ADJUSTMENT") {
                await tx.branchStock.update({ where: { id: bs.id }, data: { quantity: item.quantity } });
              } else {
                await tx.branchStock.update({ where: { id: bs.id }, data: { quantity: { increment: stockChange } } });
              }

              await tx.stockMovement.create({
                data: { productId: item.productId, type: itemType, quantity: item.quantity, note: note ?? null, reference: "MANUAL_STOCK", branchId: bid, companyId },
              });
            }
          } else {
            if (itemType === "OUT" && product.stock < item.quantity) {
              throw new Error(`Stok ${product.name} tidak mencukupi (sisa: ${product.stock})`);
            }
            await tx.stockMovement.create({
              data: { productId: item.productId, type: itemType, quantity: item.quantity, note: note ?? null, companyId },
            });
          }

          // Update global product stock
          if (itemType === "ADJUSTMENT") {
            await tx.product.update({ where: { id: item.productId }, data: { stock: item.quantity } });
          } else {
            await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: stockChange } } });
          }
        }
      },
      { timeout: 15000 },
    );

    revalidatePath("/stock");
    revalidatePath("/products");

    createAuditLog({
      action: "CREATE",
      entity: "StockMovement",
      details: {
        data: {
          globalType,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, type: i.type ?? globalType })),
          note,
          ...(branchIds.length > 0
            ? { branchId: branchIds.length === 1 ? branchIds[0] : branchIds }
            : {}),
        },
      },
    }).catch(() => {});

    // Emit stock updated event for each branch, or globally
    const productIds = items.map((i) => i.productId);
    if (branchIds.length > 0) {
      for (const bid of branchIds) {
        for (const pid of productIds) {
          emitEvent(EVENTS.STOCK_UPDATED, { productId: pid }, bid);
        }
      }
    } else {
      for (const pid of productIds) {
        emitEvent(EVENTS.STOCK_UPDATED, { productId: pid });
      }
    }

    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Gagal menyimpan pergerakan stok",
    };
  }
}

export async function getProductsForSelect(params?: {
  branchIds?: string[];
  search?: string;
  page?: number;
  limit?: number;
}) {
  const companyId = await getCurrentCompanyId();
  const { branchIds, search, page = 1, limit = 20 } = params ?? {};
  const offset = (page - 1) * limit;
  const hasBranch = branchIds && branchIds.length > 0;

  // Single branch — use view for clean query
  if (hasBranch && branchIds.length === 1) {
    const { queryProductsByBranch } = await import("@/server/actions/products");
    const result = await queryProductsByBranch({
      companyId,
      branchId: branchIds[0],
      search,
      isActive: true,
      limit,
      offset,
      onlyWithStock: true,
    });
    return {
      items: result.rows.map((r) => ({ id: r.product_id, name: r.product_name, code: r.product_code, stock: r.stock })),
      hasMore: page < Math.ceil(result.total / limit),
    };
  }

  // Multiple branches or no branch — use Prisma ORM
  const where: Record<string, unknown> = { isActive: true, companyId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  if (hasBranch) {
    where.branchStocks = { some: { branchId: { in: branchIds } } };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true, name: true, code: true, stock: true,
        ...(hasBranch ? { branchStocks: { where: { branchId: { in: branchIds } }, select: { quantity: true } } } : {}),
      },
      where,
      orderBy: { name: "asc" },
      skip: offset,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  const items = hasBranch
    ? products.map((p) => {
        const stocks = (p as Record<string, unknown>).branchStocks as Array<{ quantity: number }>;
        return { id: p.id, name: p.name, code: p.code, stock: stocks.reduce((s, bs) => s + bs.quantity, 0) };
      })
    : products.map((p) => ({ id: p.id, name: p.name, code: p.code, stock: p.stock }));

  return { items, hasMore: page < Math.ceil(total / limit) };
}

// ─── Import Stock Movements ───

export async function importStockMovements(rows: { productCode: string; type: string; quantity: number; note: string }[], branchId?: string) {
  await assertMenuActionAccess("stock", "create");
  const companyId = await getCurrentCompanyId();
  const products = await prisma.product.findMany({ where: { companyId }, select: { id: true, code: true } });
  const productMap = new Map(products.map((p) => [p.code.toLowerCase(), p.id]));

  type R = { row: number; success: boolean; name: string; error?: string };
  const results: R[] = [];
  const validMovements: { productId: string; type: "IN" | "OUT"; quantity: number; note: string; rowNum: number; code: string }[] = [];

  // Phase 1: Validate
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    const productId = productMap.get((row.productCode || "").toLowerCase().trim());
    if (!productId) { results.push({ row: rowNum, success: false, name: row.productCode || `Baris ${rowNum}`, error: `Produk "${row.productCode}" tidak ditemukan` }); continue; }
    if (!row.quantity || row.quantity <= 0) { results.push({ row: rowNum, success: false, name: row.productCode, error: "Jumlah harus lebih dari 0" }); continue; }
    const type = row.type?.toUpperCase().trim() === "OUT" ? "OUT" as const : "IN" as const;
    validMovements.push({ productId, type, quantity: row.quantity, note: row.note?.trim() || "Import", rowNum, code: row.productCode });
  }

  // Phase 2: Bulk insert movements + batch update stock
  if (validMovements.length > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        // Bulk insert all movements
        await tx.stockMovement.createMany({
          data: validMovements.map((m) => ({ productId: m.productId, type: m.type, quantity: m.quantity, note: m.note, reference: "IMPORT", companyId, branchId: branchId || null })),
        });

        // Aggregate stock changes per product then batch update
        const stockChanges = new Map<string, number>();
        for (const m of validMovements) {
          const delta = m.type === "IN" ? m.quantity : -m.quantity;
          stockChanges.set(m.productId, (stockChanges.get(m.productId) ?? 0) + delta);
        }
        for (const [productId, delta] of stockChanges) {
          if (delta > 0) await tx.product.update({ where: { id: productId }, data: { stock: { increment: delta } } });
          else if (delta < 0) await tx.product.update({ where: { id: productId }, data: { stock: { decrement: Math.abs(delta) } } });
        }
      });
      for (const m of validMovements) results.push({ row: m.rowNum, success: true, name: `${m.code} ${m.type} ${m.quantity}` });
    } catch {
      for (const m of validMovements) results.push({ row: m.rowNum, success: false, name: m.code, error: "Gagal menyimpan" });
    }
  }

  results.sort((a, b) => a.row - b.row);
  revalidatePath("/stock");
  return { results, successCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length };
}

const STOCK_TEMPLATE_COLS: TemplateColumn[] = [
  { header: "Kode Produk *", width: 16, sampleValues: ["PRD-00001", "PRD-00002"] },
  { header: "Tipe (IN/OUT) *", width: 14, sampleValues: ["IN", "OUT"] },
  { header: "Jumlah *", width: 10, sampleValues: ["50", "10"] },
  { header: "Catatan", width: 25, sampleValues: ["Restok dari supplier", "Barang rusak"] },
];

export async function downloadStockImportTemplate(format: "csv" | "excel" | "docx") {
  const companyId = await getCurrentCompanyId();
  const products = await prisma.product.findMany({ where: { companyId, isActive: true }, select: { code: true, name: true }, take: 20, orderBy: { code: "asc" } });
  const notes = [`Produk: ${products.map((p) => `${p.code} (${p.name})`).join(", ") || "-"}`, "Tipe: IN (masuk) atau OUT (keluar)", "Kolom dengan tanda * wajib diisi"];
  const result = await generateImportTemplate(STOCK_TEMPLATE_COLS, 2, notes, format);
  return { data: result.data, filename: `template-import-stok.${format === "excel" ? "xlsx" : format}`, mimeType: result.mimeType };
}
