"use server";

import { prisma } from "@/lib/prisma";
import { stockMovementSchema } from "@/lib/validators";
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
  if (type && type !== "all") where.type = type;
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

export async function createStockMovement(formData: FormData) {
  await assertMenuActionAccess("stock", "create");
  const companyId = await getCurrentCompanyId();
  const data = {
    productId: formData.get("productId") as string,
    type: formData.get("type") as string,
    quantity: Number(formData.get("quantity")),
    note: (formData.get("note") as string) || null,
  };
  const branchIdsRaw = (formData.get("branchIds") as string) || "";
  const branchIds: string[] = branchIdsRaw ? JSON.parse(branchIdsRaw) : [];
  // For backward compat, also check single branchId
  const singleBranchId = (formData.get("branchId") as string) || null;
  if (singleBranchId && branchIds.length === 0) branchIds.push(singleBranchId);

  const parsed = stockMovementSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: parsed.data.productId, companyId },
        });
        if (!product) throw new Error("Produk tidak ditemukan");

        const stockChange =
          parsed.data.type === "IN"
            ? parsed.data.quantity
            : parsed.data.type === "OUT"
              ? -parsed.data.quantity
              : 0;

        if (branchIds.length > 0) {
          await tx.$executeRaw`
            select
              set_config('app.stock_note', ${parsed.data.note ?? `Manual ${parsed.data.type} stok`}, true),
              set_config('app.stock_reference', ${"MANUAL_STOCK"}, true)
          `;

          // Ensure ALL company branches have branchStock records for this product
          // Branches without a record get initialized from product.stock
          const allCompanyBranches = await tx.branch.findMany({
            where: { companyId, isActive: true },
            select: { id: true },
          });
          const existingStocks = await tx.branchStock.findMany({
            where: { productId: parsed.data.productId, branchId: { in: allCompanyBranches.map((b) => b.id) } },
            select: { branchId: true },
          });
          const existingSet = new Set(existingStocks.map((s) => s.branchId));
          const missingBranches = allCompanyBranches.filter((b) => !existingSet.has(b.id));
          if (missingBranches.length > 0) {
            await tx.branchStock.createMany({
              data: missingBranches.map((b) => ({
                branchId: b.id,
                productId: parsed.data.productId,
                quantity: product.stock, // Initialize from global product stock
              })),
            });
          }

          // Per-branch operation
          for (const bid of branchIds) {
            const bs = await tx.branchStock.findFirst({
              where: {
                branchId: bid,
                productId: parsed.data.productId,
              },
            });
            // bs is guaranteed to exist now (created above if missing)
            if (
              parsed.data.type === "OUT" &&
              (bs?.quantity ?? 0) < parsed.data.quantity
            ) {
              const branchName =
                (
                  await tx.branch.findUnique({
                    where: { id: bid },
                    select: { name: true },
                  })
                )?.name ?? bid;
              throw new Error(
                `Stok di ${branchName} tidak mencukupi (sisa: ${bs?.quantity ?? 0})`,
              );
            }

            if (parsed.data.type === "ADJUSTMENT") {
              await tx.branchStock.update({
                where: { id: bs!.id },
                data: { quantity: parsed.data.quantity },
              });
            } else {
              await tx.branchStock.update({
                where: { id: bs!.id },
                data: { quantity: { increment: stockChange } },
              });
            }
          }
        } else {
          // Global operation (no branch)
          if (
            parsed.data.type === "OUT" &&
            product.stock < parsed.data.quantity
          ) {
            throw new Error(`Stok tidak mencukupi (sisa: ${product.stock})`);
          }
          await tx.stockMovement.create({
            data: {
              productId: parsed.data.productId,
              type: parsed.data.type,
              quantity: parsed.data.quantity,
              note: parsed.data.note ?? null,
              companyId,
            },
          });
          if (parsed.data.type === "ADJUSTMENT") {
            await tx.product.update({
              where: { id: parsed.data.productId },
              data: { stock: parsed.data.quantity },
            });
          } else {
            await tx.product.update({
              where: { id: parsed.data.productId },
              data: { stock: { increment: stockChange } },
            });
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
          type: parsed.data.type,
          productId: parsed.data.productId,
          quantity: parsed.data.quantity,
          notes: parsed.data.note,
          ...(branchIds.length > 0
            ? { branchId: branchIds.length === 1 ? branchIds[0] : branchIds }
            : {}),
        },
      },
    }).catch(() => {});

    // Emit stock updated event for each branch, or globally
    if (branchIds.length > 0) {
      for (const bid of branchIds) {
        emitEvent(
          EVENTS.STOCK_UPDATED,
          { productId: parsed.data.productId },
          bid,
        );
      }
    } else {
      emitEvent(EVENTS.STOCK_UPDATED, { productId: parsed.data.productId });
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
