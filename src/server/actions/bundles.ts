"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

export async function getBundles(params?: {
  search?: string;
  categoryId?: string;
  branchId?: string;
  isActive?: boolean;
  page?: number;
  perPage?: number;
}) {
  const companyId = await getCurrentCompanyId();
  const { search, categoryId, branchId, isActive, page = 1, perPage = 20 } = params || {};
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = { companyId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (branchId) where.branchId = branchId;
  if (isActive !== undefined) where.isActive = isActive;

  const [rawBundles, total] = await Promise.all([
    prisma.productBundle.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true, code: true, name: true, sellingPrice: true, purchasePrice: true, stock: true, unit: true, imageUrl: true,
                ...(branchId ? {
                  branchPrices: { where: { branchId }, select: { sellingPrice: true, purchasePrice: true }, take: 1 },
                  branchStocks: { where: { branchId }, select: { quantity: true }, take: 1 },
                } : {}),
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        category: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.productBundle.count({ where }),
  ]);

  // Override product prices/stock with branch-specific data
  const bundles = branchId
    ? rawBundles.map((bundle) => ({
        ...bundle,
        items: bundle.items.map((item) => {
          const p = item.product as Record<string, unknown>;
          const bp = (p.branchPrices as Array<{ sellingPrice: number; purchasePrice: number | null }> | undefined)?.[0];
          const bs = (p.branchStocks as Array<{ quantity: number }> | undefined)?.[0];
          return {
            ...item,
            product: {
              id: item.product.id,
              code: item.product.code,
              name: item.product.name,
              sellingPrice: bp?.sellingPrice ?? item.product.sellingPrice,
              purchasePrice: bp?.purchasePrice ?? item.product.purchasePrice,
              stock: bs?.quantity ?? item.product.stock,
              unit: item.product.unit,
              imageUrl: item.product.imageUrl,
            },
          };
        }),
      }))
    : rawBundles;

  return { bundles, total, totalPages: Math.ceil(total / perPage), currentPage: page };
}

export async function getBundleById(id: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.productBundle.findFirst({
    where: { id, companyId },
    include: {
      items: {
        include: {
          product: { select: { id: true, code: true, name: true, sellingPrice: true, purchasePrice: true, stock: true, unit: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      category: { select: { id: true, name: true } },
    },
  });
}

export async function createBundle(data: {
  code: string;
  name: string;
  description?: string;
  sellingPrice: number;
  categoryId?: string;
  barcode?: string;
  branchId?: string;
  imageUrl?: string;
  items: { productId: string; quantity: number }[];
}) {
  await assertMenuActionAccess("products", "create");
  const companyId = await getCurrentCompanyId();

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

  // Calculate total base price
  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId },
    select: { id: true, sellingPrice: true },
  });
  const priceMap = new Map(products.map((p) => [p.id, p.sellingPrice]));
  const totalBasePrice = data.items.reduce((sum, item) => {
    return sum + (priceMap.get(item.productId) ?? 0) * item.quantity;
  }, 0);

  let lastBundle = null;
  for (const bid of targetBranchIds) {
    // Generate unique code per branch if multi-branch
    const bundleCode = targetBranchIds.length > 1 ? `${data.code}-${bid.slice(-4)}` : data.code;
    const bundle = await prisma.productBundle.create({
      data: {
        code: bundleCode,
        name: data.name,
        description: data.description || null,
        sellingPrice: data.sellingPrice,
        totalBasePrice,
        categoryId: data.categoryId && data.categoryId !== "none" ? data.categoryId : null,
        barcode: data.barcode || null,
        branchId: bid,
        companyId,
        imageUrl: data.imageUrl || null,
        items: {
          create: data.items.map((item, idx) => ({
            productId: item.productId,
            quantity: item.quantity,
            sortOrder: idx,
          })),
        },
      },
      include: { items: true },
    });
    lastBundle = bundle;

    createAuditLog({ action: "CREATE", entity: "ProductBundle", entityId: bundle.id, details: { code: bundleCode, name: data.name, itemCount: data.items.length }, branchId: bid }).catch(() => {});
  }

  revalidatePath("/products");
  revalidatePath("/pos");
  return { bundle: lastBundle };
}

export async function updateBundle(id: string, data: {
  code?: string;
  name?: string;
  description?: string;
  sellingPrice?: number;
  categoryId?: string;
  barcode?: string;
  branchId?: string;
  isActive?: boolean;
  imageUrl?: string;
  items?: { productId: string; quantity: number }[];
}) {
  await assertMenuActionAccess("products", "update");
  const companyId = await getCurrentCompanyId();

  // Verify bundle belongs to company
  const existing = await prisma.productBundle.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!existing) return { error: "Bundle tidak ditemukan" };

  let totalBasePrice: number | undefined;
  if (data.items) {
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, companyId },
      select: { id: true, sellingPrice: true },
    });
    const priceMap = new Map(products.map((p) => [p.id, p.sellingPrice]));
    totalBasePrice = data.items.reduce((sum, item) => sum + (priceMap.get(item.productId) ?? 0) * item.quantity, 0);
  }

  const bundle = await prisma.$transaction(async (tx) => {
    if (data.items) {
      await tx.productBundleItem.deleteMany({ where: { bundleId: id } });
      await tx.productBundleItem.createMany({
        data: data.items.map((item, idx) => ({
          bundleId: id,
          productId: item.productId,
          quantity: item.quantity,
          sortOrder: idx,
        })),
      });
    }

    return tx.productBundle.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.sellingPrice !== undefined ? { sellingPrice: data.sellingPrice } : {}),
        ...(totalBasePrice !== undefined ? { totalBasePrice } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId && data.categoryId !== "none" ? data.categoryId : null } : {}),
        ...(data.barcode !== undefined ? { barcode: data.barcode || null } : {}),
        ...(data.branchId !== undefined ? { branchId: data.branchId || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      },
      include: {
        items: { include: { product: { select: { id: true, code: true, name: true, sellingPrice: true } } }, orderBy: { sortOrder: "asc" } },
      },
    });
  }, { timeout: 15000 });

  createAuditLog({ action: "UPDATE", entity: "ProductBundle", entityId: id, details: { name: data.name } }).catch(() => {});
  revalidatePath("/products");
  revalidatePath("/pos");
  return { bundle };
}

export async function deleteBundle(id: string) {
  await assertMenuActionAccess("products", "delete");
  const companyId = await getCurrentCompanyId();
  const existing = await prisma.productBundle.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!existing) return { error: "Bundle tidak ditemukan" };
  await prisma.productBundle.delete({ where: { id } });
  createAuditLog({ action: "DELETE", entity: "ProductBundle", entityId: id }).catch(() => {});
  revalidatePath("/products");
  return { success: true };
}

// Get active bundles for POS
export async function getActiveBundles(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.productBundle.findMany({
    where: {
      isActive: true,
      companyId,
      ...(branchId ? { branchId } : {}),
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, code: true, name: true, sellingPrice: true, purchasePrice: true, stock: true, unit: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }],
  });
}

// ─── Import Bundles ───

interface ImportBundleRow {
  code: string;
  name: string;
  description: string;
  sellingPrice: number;
  categoryName: string;
  barcode: string;
  /** Comma-separated "productCode:qty" pairs, e.g. "PRD-001:2,PRD-002:1" */
  items: string;
}

export async function importBundles(rows: ImportBundleRow[], branchId?: string) {
  await assertMenuActionAccess("products", "create");
  const companyId = await getCurrentCompanyId();

  // Lookup data
  const [allCategories, allProducts, existingCodes, activeBranches] = await Promise.all([
    prisma.category.findMany({ where: { companyId }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { companyId }, select: { id: true, code: true, sellingPrice: true } }),
    prisma.productBundle.findMany({ where: { companyId }, select: { code: true } }),
    prisma.branch.findMany({ where: { companyId, isActive: true, ...(branchId ? { id: branchId } : {}) }, select: { id: true } }),
  ]);

  const categoryMap = new Map(allCategories.map((c) => [c.name.toLowerCase().trim(), c.id]));
  const productMap = new Map(allProducts.map((p) => [p.code.toLowerCase().trim(), p]));
  const usedCodes = new Set(existingCodes.map((b) => b.code.toLowerCase()));
  const branchIds = activeBranches.map((b) => b.id);

  type ResultItem = { row: number; success: boolean; name: string; error?: string };
  const results: ResultItem[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;

    if (!row.name?.trim()) {
      results.push({ row: rowNum, success: false, name: row.name || `Baris ${rowNum}`, error: "Nama paket wajib diisi" });
      continue;
    }
    if (!row.items?.trim()) {
      results.push({ row: rowNum, success: false, name: row.name, error: "Item paket wajib diisi" });
      continue;
    }
    if (row.sellingPrice <= 0) {
      results.push({ row: rowNum, success: false, name: row.name, error: "Harga jual harus lebih dari 0" });
      continue;
    }

    const code = row.code?.trim() || `BDL-${Date.now().toString(36).toUpperCase()}-${i}`;
    if (usedCodes.has(code.toLowerCase())) {
      results.push({ row: rowNum, success: false, name: row.name, error: `Kode "${code}" sudah ada` });
      continue;
    }

    // Parse items: "PRD-001:2,PRD-002:1"
    const itemPairs = row.items.split(",").map((s) => s.trim()).filter(Boolean);
    const parsedItems: { productId: string; quantity: number; price: number }[] = [];
    let itemError = false;

    for (const pair of itemPairs) {
      const [productCode, qtyStr] = pair.split(":").map((s) => s.trim());
      if (!productCode) { itemError = true; break; }
      const product = productMap.get(productCode!.toLowerCase());
      if (!product) {
        results.push({ row: rowNum, success: false, name: row.name, error: `Produk "${productCode}" tidak ditemukan` });
        itemError = true;
        break;
      }
      parsedItems.push({ productId: product.id, quantity: Number(qtyStr) || 1, price: product.sellingPrice });
    }
    if (itemError) continue;

    const categoryId = row.categoryName?.trim() ? categoryMap.get(row.categoryName.toLowerCase().trim()) ?? null : null;
    const totalBasePrice = parsedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    try {
      for (const bid of branchIds) {
        const bundleCode = branchIds.length > 1 ? `${code}-${bid.slice(-4)}` : code;
        await prisma.productBundle.create({
          data: {
            code: bundleCode,
            name: row.name.trim(),
            description: row.description?.trim() || null,
            sellingPrice: row.sellingPrice,
            totalBasePrice,
            categoryId,
            barcode: row.barcode?.trim() || null,
            branchId: bid,
            companyId,
            items: {
              create: parsedItems.map((item, idx) => ({
                productId: item.productId,
                quantity: item.quantity,
                sortOrder: idx,
              })),
            },
          },
        });
      }
      usedCodes.add(code.toLowerCase());
      results.push({ row: rowNum, success: true, name: row.name });
    } catch {
      results.push({ row: rowNum, success: false, name: row.name, error: "Gagal menyimpan (kode duplikat)" });
    }
  }

  revalidatePath("/products");
  revalidatePath("/pos");

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  return { results, successCount, failedCount };
}

const BUNDLE_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { header: "Kode Paket", width: 16, sampleValues: ["BDL-001", "BDL-002"] },
  { header: "Nama Paket *", width: 25, sampleValues: ["Paket Hemat A", "Paket Combo B"] },
  { header: "Deskripsi", width: 25, sampleValues: ["Paket hemat makan siang", "Combo minuman"] },
  { header: "Harga Jual *", width: 14, sampleValues: ["25000", "15000"] },
  { header: "Kategori", width: 15, sampleValues: ["Makanan", "Minuman"] },
  { header: "Barcode", width: 16, sampleValues: ["", ""] },
  { header: "Item (kode:qty) *", width: 30, sampleValues: ["PRD-00001:2,PRD-00002:1", "PRD-00003:3"] },
];

export async function downloadBundleImportTemplate(format: "csv" | "excel" | "docx") {
  const companyId = await getCurrentCompanyId();
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ where: { companyId }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { companyId, isActive: true }, select: { code: true, name: true }, orderBy: { code: "asc" }, take: 20 }),
  ]);

  const notes = [
    `Kategori: ${categories.map((c) => c.name).join(", ") || "-"}`,
    `Produk (kode): ${products.map((p) => `${p.code} (${p.name})`).join(", ") || "-"}`,
    "Kolom Item diisi dengan format kode_produk:jumlah dipisah koma. Contoh: PRD-00001:2,PRD-00002:1",
    "Kolom dengan tanda * wajib diisi",
  ];

  const result = await generateImportTemplate(BUNDLE_TEMPLATE_COLUMNS, 2, notes, format);
  return {
    data: result.data,
    filename: `template-import-paket.${format === "excel" ? "xlsx" : format}`,
    mimeType: result.mimeType,
  };
}

export async function bulkDeleteBundles(ids: string[]) {
  await assertMenuActionAccess("bundles", "delete");
  const companyId = await getCurrentCompanyId();
  const result = await prisma.productBundle.deleteMany({ where: { id: { in: ids }, companyId } });
  revalidatePath("/bundles");
  return { count: result.count };
}
