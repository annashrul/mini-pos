"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { productSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import {
  branchPriceSchema,
  productUnitSchema,
  tierPriceSchema,
} from "@/shared/schemas/product";

interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

function parseJsonArray<T>(
  json: string | null,
  schema: z.ZodType<T>,
  fallback: T,
): { data: T; error?: string } {
  if (!json) return { data: fallback };
  try {
    const parsedJson = JSON.parse(json);
    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      return {
        data: fallback,
        error: parsed.error.issues[0]?.message ?? "Data tidak valid",
      };
    }
    return { data: parsed.data };
  } catch {
    return { data: fallback, error: "Format data tidak valid" };
  }
}

export async function getProducts(params: GetProductsParams = {}) {
  const {
    page = 1,
    limit = 10,
    search,
    categoryId,
    status,
    sortBy,
    sortDir = "desc",
  } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ];
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "code"
      ? { code: direction }
      : sortBy === "name"
        ? { name: direction }
        : sortBy === "category"
          ? { category: { name: direction } }
          : sortBy === "purchasePrice"
            ? { purchasePrice: direction }
            : sortBy === "sellingPrice"
              ? { sellingPrice: direction }
              : sortBy === "stock"
                ? { stock: direction }
                : { createdAt: direction };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: { category: true, tierPrices: { orderBy: { minQty: "asc" } } },
  });
}

export async function createProduct(formData: FormData) {
  await assertMenuActionAccess("products", "create");
  const brandIdRaw = (formData.get("brandId") as string) || "";
  const imageUrl = (formData.get("imageUrl") as string) || null;
  const data = {
    code: formData.get("code") as string,
    name: formData.get("name") as string,
    categoryId: formData.get("categoryId") as string,
    brandId: brandIdRaw,
    purchasePrice: Number(formData.get("purchasePrice")),
    sellingPrice: Number(formData.get("sellingPrice")),
    stock: Number(formData.get("stock")),
    minStock: Number(formData.get("minStock")),
    barcode: (formData.get("barcode") as string) || null,
    unit: formData.get("unit") as string,
    isActive: formData.get("isActive") === "true",
    description: (formData.get("description") as string) || null,
  };

  const parsed = productSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  const branchPricesResult = parseJsonArray(
    formData.get("branchPrices") as string | null,
    z.array(branchPriceSchema),
    [] as z.infer<typeof branchPriceSchema>[],
  );
  if (branchPricesResult.error)
    return { error: `Harga cabang tidak valid: ${branchPricesResult.error}` };
  const productUnitsResult = parseJsonArray(
    formData.get("productUnits") as string | null,
    z.array(productUnitSchema),
    [] as z.infer<typeof productUnitSchema>[],
  );
  if (productUnitsResult.error)
    return { error: `Satuan produk tidak valid: ${productUnitsResult.error}` };
  const tierPricesResult = parseJsonArray(
    formData.get("tierPrices") as string | null,
    z.array(tierPriceSchema),
    [] as z.infer<typeof tierPriceSchema>[],
  );
  if (tierPricesResult.error)
    return { error: `Harga bertingkat tidak valid: ${tierPricesResult.error}` };

  try {
    const data = {
      code: parsed.data.code,
      name: parsed.data.name,
      purchasePrice: parsed.data.purchasePrice,
      sellingPrice: parsed.data.sellingPrice,
      stock: parsed.data.stock,
      minStock: parsed.data.minStock,
      barcode: parsed.data.barcode ?? null,
      unit: parsed.data.unit,
      isActive: parsed.data.isActive,
      description: parsed.data.description ?? null,
      ...(parsed.data.categoryId ? { categoryId: parsed.data.categoryId } : {}),
      ...(brandIdRaw ? { brandId: brandIdRaw } : { brandId: null }),
      imageUrl,
    };
    const product = await prisma.product.create({ data });

    // Create initial stock movement
    if (parsed.data.stock > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: "IN",
          quantity: parsed.data.stock,
          note: "Stok awal",
          reference: "INIT",
        },
      });
    }

    // Save branch prices if provided
    if (branchPricesResult.data.length > 0) {
      await prisma.branchProductPrice.createMany({
        data: branchPricesResult.data.map((bp) => ({
          branchId: bp.branchId,
          productId: product.id,
          sellingPrice: bp.sellingPrice,
          purchasePrice: bp.purchasePrice,
        })),
      });
    }

    // Save product units if provided
    if (productUnitsResult.data.length > 0) {
      await prisma.productUnit.createMany({
        data: productUnitsResult.data.map((unit, index) => ({
          productId: product.id,
          name: unit.name,
          conversionQty: unit.conversionQty,
          sellingPrice: unit.sellingPrice,
          purchasePrice: unit.purchasePrice ?? null,
          barcode: unit.barcode || null,
          sortOrder: index,
        })),
      });
    }
    if (tierPricesResult.data.length > 0) {
      await prisma.productTierPrice.createMany({
        data: tierPricesResult.data.map((tier) => ({
          productId: product.id,
          minQty: tier.minQty,
          price: tier.price,
        })),
      });
    }

    revalidatePath("/products");
    return {
      success: true,
      product: {
        id: product.id,
        name: product.name,
        code: product.code,
        purchasePrice: product.purchasePrice,
        unit: product.unit,
        stock: product.stock,
      },
    };
  } catch {
    return { error: "Kode produk atau barcode sudah digunakan" };
  }
}

export async function updateProduct(id: string, formData: FormData) {
  await assertMenuActionAccess("products", "update");
  const brandIdRaw = (formData.get("brandId") as string) || "";
  const imageUrl = (formData.get("imageUrl") as string) || null;
  const data = {
    code: formData.get("code") as string,
    name: formData.get("name") as string,
    categoryId: formData.get("categoryId") as string,
    brandId: brandIdRaw,
    purchasePrice: Number(formData.get("purchasePrice")),
    sellingPrice: Number(formData.get("sellingPrice")),
    stock: Number(formData.get("stock")),
    minStock: Number(formData.get("minStock")),
    barcode: (formData.get("barcode") as string) || null,
    unit: formData.get("unit") as string,
    isActive: formData.get("isActive") === "true",
    description: (formData.get("description") as string) || null,
  };

  const parsed = productSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  const branchPricesResult = parseJsonArray(
    formData.get("branchPrices") as string | null,
    z.array(branchPriceSchema),
    [] as z.infer<typeof branchPriceSchema>[],
  );
  if (branchPricesResult.error)
    return { error: `Harga cabang tidak valid: ${branchPricesResult.error}` };
  const productUnitsResult = parseJsonArray(
    formData.get("productUnits") as string | null,
    z.array(productUnitSchema),
    [] as z.infer<typeof productUnitSchema>[],
  );
  if (productUnitsResult.error)
    return { error: `Satuan produk tidak valid: ${productUnitsResult.error}` };
  const tierPricesResult = parseJsonArray(
    formData.get("tierPrices") as string | null,
    z.array(tierPriceSchema),
    [] as z.infer<typeof tierPriceSchema>[],
  );
  if (tierPricesResult.error)
    return { error: `Harga bertingkat tidak valid: ${tierPricesResult.error}` };

  try {
    const data = {
      code: parsed.data.code,
      name: parsed.data.name,
      purchasePrice: parsed.data.purchasePrice,
      sellingPrice: parsed.data.sellingPrice,
      stock: parsed.data.stock,
      minStock: parsed.data.minStock,
      barcode: parsed.data.barcode ?? null,
      unit: parsed.data.unit,
      isActive: parsed.data.isActive,
      description: parsed.data.description ?? null,
      ...(parsed.data.categoryId ? { categoryId: parsed.data.categoryId } : {}),
      ...(brandIdRaw ? { brandId: brandIdRaw } : { brandId: null }),
      imageUrl,
    };
    await prisma.product.update({ where: { id }, data });

    // Update branch prices if provided
    await prisma.branchProductPrice.deleteMany({
      where: { productId: id },
    });
    if (branchPricesResult.data.length > 0) {
      await prisma.branchProductPrice.createMany({
        data: branchPricesResult.data.map((bp) => ({
          branchId: bp.branchId,
          productId: id,
          sellingPrice: bp.sellingPrice,
          purchasePrice: bp.purchasePrice,
        })),
      });
    }

    // Update product units if provided
    await prisma.productUnit.deleteMany({ where: { productId: id } });
    if (productUnitsResult.data.length > 0) {
      await prisma.productUnit.createMany({
        data: productUnitsResult.data.map((unit, index) => ({
          productId: id,
          name: unit.name,
          conversionQty: unit.conversionQty,
          sellingPrice: unit.sellingPrice,
          purchasePrice: unit.purchasePrice ?? null,
          barcode: unit.barcode || null,
          sortOrder: index,
        })),
      });
    }
    await prisma.productTierPrice.deleteMany({ where: { productId: id } });
    if (tierPricesResult.data.length > 0) {
      await prisma.productTierPrice.createMany({
        data: tierPricesResult.data.map((tier) => ({
          productId: id,
          minQty: tier.minQty,
          price: tier.price,
        })),
      });
    }

    revalidatePath("/products");
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate produk" };
  }
}

export async function generateProductCode(): Promise<string> {
  const last = await prisma.product.findFirst({
    where: { code: { startsWith: "PRD" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let seq = 1;
  if (last?.code) {
    const num = parseInt(last.code.replace("PRD", ""), 10);
    if (!isNaN(num)) seq = num + 1;
  }
  return `PRD${String(seq).padStart(4, "0")}`;
}

export async function checkProductCodeExists(
  code: string,
  excludeId?: string,
): Promise<boolean> {
  const found = await prisma.product.findFirst({
    where: {
      code: { equals: code, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !!found;
}

export async function getProductBranchPrices(productId: string) {
  return prisma.branchProductPrice.findMany({
    where: { productId },
    include: { branch: { select: { name: true } } },
  });
}

export async function deleteProduct(id: string) {
  await assertMenuActionAccess("products", "delete");
  try {
    await prisma.product.delete({ where: { id } });
    revalidatePath("/products");
    return { success: true };
  } catch {
    return {
      error: "Produk tidak bisa dihapus karena sudah digunakan dalam transaksi",
    };
  }
}

export async function searchProducts(query: string, branchId?: string | null) {
  if (!query || query.length < 1) return [];

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      stock: { gt: 0 },
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
        { barcode: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      category: true,
      units: { orderBy: { conversionQty: "asc" } },
      tierPrices: { orderBy: { minQty: "asc" } },
      ...(branchId ? { branchPrices: { where: { branchId }, take: 1 } } : {}),
    },
    take: 10,
  });

  // Overlay branch prices if available
  return products.map((p) => {
    const bp = (
      p as typeof p & {
        branchPrices?: { sellingPrice: number; purchasePrice: number | null }[];
      }
    ).branchPrices?.[0];
    if (bp) {
      return {
        ...p,
        sellingPrice: bp.sellingPrice,
        purchasePrice: bp.purchasePrice ?? p.purchasePrice,
        branchPrices: undefined,
      };
    }
    return { ...p, branchPrices: undefined };
  });
}

export async function findByBarcode(barcode: string, branchId?: string | null) {
  if (!barcode) return null;

  // First check product barcode/code
  const product = await prisma.product.findFirst({
    where: {
      isActive: true,
      OR: [{ barcode }, { code: barcode }],
    },
    include: {
      category: true,
      units: { orderBy: { conversionQty: "asc" } },
      tierPrices: { orderBy: { minQty: "asc" } },
      ...(branchId ? { branchPrices: { where: { branchId }, take: 1 } } : {}),
    },
  });

  if (product) {
    const bp = (
      product as typeof product & {
        branchPrices?: { sellingPrice: number; purchasePrice: number | null }[];
      }
    ).branchPrices?.[0];
    const result = {
      ...product,
      sellingPrice: bp?.sellingPrice ?? product.sellingPrice,
      purchasePrice: bp?.purchasePrice ?? product.purchasePrice,
      branchPrices: undefined,
      // Include unit info
      matchedUnit: null as {
        name: string;
        conversionQty: number;
        sellingPrice: number;
      } | null,
    };
    return result;
  }

  // Check unit barcode
  const unitMatch = await prisma.productUnit.findFirst({
    where: { barcode },
    include: {
      product: {
        include: {
          category: true,
          units: { orderBy: { conversionQty: "asc" } },
          tierPrices: { orderBy: { minQty: "asc" } },
        },
      },
    },
  });

  if (unitMatch && unitMatch.product.isActive) {
    return {
      ...unitMatch.product,
      // Override price with unit price
      sellingPrice: unitMatch.sellingPrice,
      purchasePrice: unitMatch.purchasePrice ?? unitMatch.product.purchasePrice,
      matchedUnit: {
        name: unitMatch.name,
        conversionQty: unitMatch.conversionQty,
        sellingPrice: unitMatch.sellingPrice,
      },
    };
  }

  return null;
}

export async function getTopSellingProducts(limit = 8) {
  const items = await prisma.transactionItem.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { category: true },
  });

  return items
    .map((i) =>
      products.find((p: (typeof products)[number]) => p.id === i.productId),
    )
    .filter(Boolean);
}

export async function getProductsByCategory(categoryId: string) {
  return prisma.product.findMany({
    where: { categoryId, isActive: true, stock: { gt: 0 } },
    include: { category: true, tierPrices: { orderBy: { minQty: "asc" } } },
    take: 20,
    orderBy: { name: "asc" },
  });
}

export async function browseProducts(params: {
  categoryId?: string;
  mode?: "favorites" | "all" | "category";
  page?: number;
  perPage?: number;
  branchId?: string | null | undefined;
}) {
  const { categoryId, mode = "all", page = 1, perPage = 20, branchId } = params;

  // Helper to overlay branch prices
  const applyBranchPrices = async <
    T extends { id: string; sellingPrice: number; purchasePrice: number },
  >(
    products: T[],
  ): Promise<T[]> => {
    if (!branchId || products.length === 0) return products;
    const branchPrices = await prisma.branchProductPrice.findMany({
      where: { branchId, productId: { in: products.map((p) => p.id) } },
    });
    const priceMap = new Map(branchPrices.map((bp) => [bp.productId, bp]));
    return products.map((p) => {
      const bp = priceMap.get(p.id);
      if (bp)
        return {
          ...p,
          sellingPrice: bp.sellingPrice,
          purchasePrice: bp.purchasePrice ?? p.purchasePrice,
        };
      return p;
    });
  };

  if (mode === "favorites") {
    const items = await prisma.transactionItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: perPage,
      skip: (page - 1) * perPage,
    });

    const totalAgg = await prisma.transactionItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
    });

    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { category: true, tierPrices: { orderBy: { minQty: "asc" } } },
    });

    const sorted = items
      .map((i) =>
        products.find((p: (typeof products)[number]) => p.id === i.productId),
      )
      .filter(Boolean);

    return {
      products: await applyBranchPrices(sorted as typeof products),
      total: totalAgg.length,
      hasMore: page * perPage < totalAgg.length,
    };
  }

  const where: Record<string, unknown> = { isActive: true };
  if (categoryId) where.categoryId = categoryId;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true, tierPrices: { orderBy: { minQty: "asc" } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: await applyBranchPrices(products),
    total,
    hasMore: page * perPage < total,
  };
}

export async function getProductTierPrices(productId: string) {
  return prisma.productTierPrice.findMany({
    where: { productId },
    orderBy: { minQty: "asc" },
  });
}

// ===========================
// Import Products
// ===========================

interface ImportProductRow {
  code: string;
  name: string;
  categoryName: string;
  brandName?: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  barcode?: string;
  description?: string;
}

export async function importProducts(rows: ImportProductRow[]) {
  await assertMenuActionAccess("products", "create");

  const results: {
    row: number;
    success: boolean;
    name: string;
    error?: string;
  }[] = [];

  // Pre-fetch categories and brands to map by name
  const [allCategories, allBrands, existingProducts] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.brand.findMany({ select: { id: true, name: true } }),
    prisma.product.findMany({ select: { code: true } }),
  ]);
  const categoryMap = new Map(
    allCategories.map((c) => [c.name.toLowerCase().trim(), c.id]),
  );
  const brandMap = new Map(
    allBrands.map((b) => [b.name.toLowerCase().trim(), b.id]),
  );
  const existingCodes = new Set(
    existingProducts.map((p) => p.code.toLowerCase()),
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2; // +2 because row 1 is header, data starts at row 2

    // Validate required fields
    if (!row.name?.trim()) {
      results.push({
        row: rowNum,
        success: false,
        name: row.name || `Baris ${rowNum}`,
        error: "Nama produk wajib diisi",
      });
      continue;
    }

    // Find category
    const categoryId = categoryMap.get(
      (row.categoryName || "").toLowerCase().trim(),
    );
    if (!categoryId) {
      results.push({
        row: rowNum,
        success: false,
        name: row.name,
        error: `Kategori "${row.categoryName}" tidak ditemukan`,
      });
      continue;
    }

    // Generate code if empty
    let code = row.code?.trim();
    if (!code) {
      const count = await prisma.product.count();
      code = `PRD-${String(count + i + 1).padStart(5, "0")}`;
    }

    // Check duplicate code
    if (existingCodes.has(code.toLowerCase())) {
      results.push({
        row: rowNum,
        success: false,
        name: row.name,
        error: `Kode "${code}" sudah ada`,
      });
      continue;
    }

    // Find brand (optional)
    const brandName = (row.brandName || "").trim();
    const brandId = brandName
      ? (brandMap.get(brandName.toLowerCase()) ?? null)
      : null;
    if (brandName && !brandId) {
      results.push({
        row: rowNum,
        success: false,
        name: row.name,
        error: `Brand "${brandName}" tidak ditemukan`,
      });
      continue;
    }

    const purchasePrice = Number(row.purchasePrice) || 0;
    const sellingPrice = Number(row.sellingPrice) || 0;
    const stock = Math.floor(Number(row.stock) || 0);
    const minStock = Math.floor(Number(row.minStock) || 0);

    if (purchasePrice <= 0 || sellingPrice <= 0) {
      results.push({
        row: rowNum,
        success: false,
        name: row.name,
        error: "Harga beli dan harga jual harus lebih dari 0",
      });
      continue;
    }

    if (sellingPrice < purchasePrice) {
      results.push({
        row: rowNum,
        success: false,
        name: row.name,
        error: "Harga jual harus >= harga beli",
      });
      continue;
    }

    try {
      const product = await prisma.product.create({
        data: {
          code,
          name: row.name.trim(),
          categoryId,
          brandId,
          unit: row.unit?.trim() || "PCS",
          purchasePrice,
          sellingPrice,
          stock,
          minStock,
          barcode: row.barcode?.trim() || null,
          description: row.description?.trim() || null,
          isActive: true,
        },
      });

      if (stock > 0) {
        await prisma.stockMovement.create({
          data: {
            productId: product.id,
            type: "IN",
            quantity: stock,
            note: "Stok awal (import)",
            reference: "IMPORT",
          },
        });
      }

      existingCodes.add(code.toLowerCase());
      results.push({ row: rowNum, success: true, name: row.name });
    } catch {
      results.push({
        row: rowNum,
        success: false,
        name: row.name,
        error: "Gagal menyimpan (kode/barcode duplikat)",
      });
    }
  }

  revalidatePath("/products");

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  return { results, successCount, failedCount };
}

export async function getImportTemplate() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    headers: [
      "code",
      "name",
      "categoryName",
      "brandName",
      "unit",
      "purchasePrice",
      "sellingPrice",
      "stock",
      "minStock",
      "barcode",
      "description",
    ],
    headerLabels: [
      "Kode Produk",
      "Nama Produk *",
      "Kategori *",
      "Brand",
      "Satuan *",
      "Harga Beli *",
      "Harga Jual *",
      "Stok",
      "Stok Minimum",
      "Barcode",
      "Deskripsi",
    ],
    categories: categories.map((c) => c.name),
    brands: brands.map((b) => b.name),
    sampleRows: [
      [
        "PRD-00001",
        "Indomie Goreng",
        categories[0]?.name ?? "Makanan",
        brands[0]?.name ?? "",
        "PCS",
        "2500",
        "3500",
        "100",
        "10",
        "8991234567890",
        "Mi instan goreng",
      ],
      [
        "PRD-00002",
        "Aqua 600ml",
        categories[0]?.name ?? "Minuman",
        brands[0]?.name ?? "",
        "PCS",
        "3000",
        "4000",
        "200",
        "20",
        "8997654321098",
        "Air mineral 600ml",
      ],
    ],
  };
}
