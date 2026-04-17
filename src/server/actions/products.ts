"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";

import { productSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";
import { checkActionAccess } from "@/server/actions/plan";
import {
  branchPriceSchema,
  productUnitSchema,
  tierPriceSchema,
} from "@/shared/schemas/product";
import { serverCache, cacheKey } from "@/lib/server-cache";

interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: string;
  stockStatus?: string;
  branchId?: string;
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

// ─── View-based product queries ───────────────────────────────
// Uses vw_product_branch for branch-resolved prices and stock

interface ProductBranchRow {
  product_id: string;
  product_code: string;
  product_name: string;
  category_id: string | null;
  category_name: string | null;
  brand_id: string | null;
  company_id: string;
  base_unit: string;
  is_active: boolean;
  image_url: string | null;
  barcode: string | null;
  description: string | null;
  branch_id: string;
  branch_name: string;
  branch_code: string | null;
  selling_price: number;
  purchase_price: number;
  stock: number;
  min_stock: number;
  has_branch_stock: boolean;
  has_branch_price: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function queryProductsByBranch(params: {
  companyId: string;
  branchId?: string | undefined;
  search?: string | undefined;
  categoryId?: string | undefined;
  brandId?: string | undefined;
  isActive?: boolean | undefined;
  stockStatus?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  onlyWithStock?: boolean | undefined;
}) {
  const {
    companyId,
    branchId,
    search,
    categoryId,
    brandId,
    isActive,
    stockStatus,
    limit = 20,
    offset = 0,
    onlyWithStock = false,
  } = params;

  const conditions: string[] = ["company_id = $1"];
  const values: unknown[] = [companyId];
  let paramIdx = 2;

  if (branchId) {
    conditions.push(`branch_id = $${paramIdx}`);
    values.push(branchId);
    paramIdx++;
  }
  if (search) {
    conditions.push(
      `(product_name ILIKE $${paramIdx} OR product_code ILIKE $${paramIdx} OR barcode ILIKE $${paramIdx})`,
    );
    values.push(`%${search}%`);
    paramIdx++;
  }
  if (categoryId) {
    conditions.push(`category_id = $${paramIdx}`);
    values.push(categoryId);
    paramIdx++;
  }
  if (brandId) {
    conditions.push(`brand_id = $${paramIdx}`);
    values.push(brandId);
    paramIdx++;
  }
  if (isActive !== undefined) {
    conditions.push(`is_active = $${paramIdx}`);
    values.push(isActive);
    paramIdx++;
  }
  if (stockStatus === "out") {
    conditions.push("stock = 0");
  } else if (stockStatus === "low") {
    conditions.push("stock > 0 AND stock <= 10");
  } else if (stockStatus === "available") {
    conditions.push("stock > 0");
  }
  if (onlyWithStock) {
    conditions.push("has_branch_stock = true");
  }

  const whereClause = conditions.join(" AND ");
  const countQuery = `SELECT COUNT(DISTINCT product_id)::int AS total FROM vw_product_branch WHERE ${whereClause}`;

  let paginatedQuery: string;
  if (branchId) {
    // Single branch — direct filter, 1 row per product guaranteed
    paginatedQuery = `SELECT * FROM vw_product_branch WHERE ${whereClause} ORDER BY product_name ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  } else {
    // No branch filter — aggregate stock across all branches, use product-level prices
    paginatedQuery = `
      SELECT
        product_id, product_code, product_name, category_id, category_name,
        brand_id, company_id, base_unit, is_active, image_url, barcode, description,
        MIN(branch_id) AS branch_id, '' AS branch_name, '' AS branch_code,
        (SELECT p."sellingPrice" FROM products p WHERE p.id = product_id)::float8 AS selling_price,
        (SELECT p."purchasePrice" FROM products p WHERE p.id = product_id)::float8 AS purchase_price,
        (SELECT p.stock FROM products p WHERE p.id = product_id)::int4 AS stock,
        (SELECT p."minStock" FROM products p WHERE p.id = product_id)::int4 AS min_stock,
        bool_or(has_branch_stock) AS has_branch_stock,
        bool_or(has_branch_price) AS has_branch_price,
        MIN(created_at) AS created_at, MAX(updated_at) AS updated_at
      FROM vw_product_branch
      WHERE ${whereClause}
      GROUP BY product_id, product_code, product_name, category_id, category_name,
               brand_id, company_id, base_unit, is_active, image_url, barcode, description
      ORDER BY product_name ASC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
  }
  values.push(limit, offset);

  const [countResult, rawRows] = await Promise.all([
    prisma.$queryRawUnsafe<[{ total: number | bigint }]>(countQuery,
      ...values.slice(0, -2),
    ),
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(paginatedQuery, ...values),
  ]);

  // Prisma raw queries return BigInt/Decimal — normalize to plain numbers
  const rows: ProductBranchRow[] = rawRows.map((r) => ({
    product_id: String(r.product_id),
    product_code: String(r.product_code ?? ""),
    product_name: String(r.product_name ?? ""),
    category_id: r.category_id ? String(r.category_id) : null,
    category_name: r.category_name ? String(r.category_name) : null,
    brand_id: r.brand_id ? String(r.brand_id) : null,
    company_id: String(r.company_id),
    base_unit: String(r.base_unit ?? "pcs"),
    is_active: Boolean(r.is_active),
    image_url: r.image_url ? String(r.image_url) : null,
    barcode: r.barcode ? String(r.barcode) : null,
    description: r.description ? String(r.description) : null,
    branch_id: String(r.branch_id),
    branch_name: String(r.branch_name ?? ""),
    branch_code: r.branch_code ? String(r.branch_code) : null,
    selling_price: Number(r.selling_price ?? 0),
    purchase_price: Number(r.purchase_price ?? 0),
    stock: Number(r.stock ?? 0),
    min_stock: Number(r.min_stock ?? 0),
    has_branch_stock: Boolean(r.has_branch_stock),
    has_branch_price: Boolean(r.has_branch_price),
    created_at: r.created_at as Date,
    updated_at: r.updated_at as Date,
  }));

  return { rows, total: Number(countResult[0]?.total ?? 0) };
}

/** Server action for ProductPicker — searches products with branch-specific data */
export async function searchProductsByBranch(params: {
  branchId?: string | undefined;
  branchIds?: string[] | undefined;
  categoryId?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  /** If true, don't filter by BranchStock — show all products (useful for PO) */
  skipBranchStockFilter?: boolean | undefined;
}) {
  const companyId = await getCurrentCompanyId();
  const { branchId, branchIds, categoryId, search, page = 1, limit = 10, skipBranchStockFilter = false } = params;

  // Resolve effective branch filter
  const effectiveIds = branchId ? [branchId] : (branchIds ?? []).filter(Boolean);
  const hasBranch = effectiveIds.length > 0;

  const where: Record<string, unknown> = { companyId, isActive: true };
  if (categoryId) where.categoryId = categoryId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ];
  }
  // Only filter by BranchStock if not skipped (e.g. POS needs stock filter, PO doesn't)
  if (hasBranch && !skipBranchStockFilter) {
    where.branchStocks = { some: { branchId: { in: effectiveIds } } };
  }

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      sellingPrice: true,
      purchasePrice: true,
      stock: true,
      ...(hasBranch ? {
        branchStocks: { where: { branchId: { in: effectiveIds } }, select: { quantity: true } },
        branchPrices: { where: { branchId: { in: effectiveIds } }, select: { sellingPrice: true, purchasePrice: true }, take: 1 },
      } : {}),
    },
    orderBy: { name: "asc" },
    skip: (page - 1) * limit,
    take: limit + 1, // fetch 1 extra to check hasMore
  });

  const hasMore = products.length > limit;
  const sliced = hasMore ? products.slice(0, limit) : products;

  const items = sliced.map((p) => {
    if (hasBranch) {
      const bsArr = (p as Record<string, unknown>).branchStocks as Array<{ quantity: number }> | undefined;
      const bp = ((p as Record<string, unknown>).branchPrices as Array<{ sellingPrice: number; purchasePrice: number | null }> | undefined)?.[0];
      // Sum stock across selected branches
      const totalStock = bsArr?.length ? bsArr.reduce((sum, bs) => sum + bs.quantity, 0) : 0;
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        sellingPrice: bp?.sellingPrice ?? p.sellingPrice,
        purchasePrice: bp?.purchasePrice ?? p.purchasePrice,
        stock: totalStock,
      };
    }
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      sellingPrice: p.sellingPrice,
      purchasePrice: p.purchasePrice,
      stock: p.stock,
    };
  });

  return { items, hasMore };
}

export async function getProducts(params: GetProductsParams = {}) {
  const companyId = await getCurrentCompanyId();
  const {
    page = 1,
    limit = 10,
    search,
    categoryId,
    brandId,
    status,
    stockStatus,
    branchId,
    sortBy,
    sortDir = "desc",
  } = params;

  const key = cacheKey(`products:${companyId}`, { page, limit, search, categoryId, brandId, status, stockStatus, branchId, sortBy, sortDir });
  return serverCache.get(key, async () => {

  const esc = (v: string) => v.replace(/'/g, "''");
  const conditions: string[] = [`p."companyId" = '${esc(companyId)}'`, `p."deletedAt" IS NULL`];

  if (search) conditions.push(`(p.name ILIKE '%${esc(search)}%' OR p.code ILIKE '%${esc(search)}%' OR p.barcode ILIKE '%${esc(search)}%')`);
  if (categoryId) conditions.push(`p."categoryId" = '${esc(categoryId)}'`);
  if (brandId) conditions.push(`p."brandId" = '${esc(brandId)}'`);
  if (status === "active") conditions.push(`p."isActive" = true`);
  if (status === "inactive") conditions.push(`p."isActive" = false`);
  const stockCol = branchId ? `COALESCE(bs.quantity, 0)` : `p.stock`;
  if (stockStatus === "out") conditions.push(`${stockCol} = 0`);
  if (stockStatus === "low") conditions.push(`${stockCol} > 0 AND ${stockCol} <= 10`);
  if (stockStatus === "available") conditions.push(`${stockCol} > 0`);

  const whereClause = conditions.join(" AND ");
  const dir = sortDir === "asc" ? "ASC" : "DESC";
  const orderColumn =
    sortBy === "code" ? `p.code ${dir}`
    : sortBy === "name" ? `p.name ${dir}`
    : sortBy === "category" ? `c.name ${dir}`
    : sortBy === "purchasePrice" ? `p."purchasePrice" ${dir}`
    : sortBy === "sellingPrice" ? `p."sellingPrice" ${dir}`
    : sortBy === "stock" ? `${stockCol} ${dir}`
    : `p."createdAt" ${dir}`;

  const offset = (page - 1) * limit;

  const dataQuery = `
    SELECT
      p.id, p.code, p.name, p."categoryId", p."brandId", p."supplierId",
      p."purchasePrice"::float8, p."sellingPrice"::float8, p.stock::int4, p."minStock"::int4,
      p.barcode, p.unit, p.description, p."isActive", p."imageUrl",
      p."createdAt", p."updatedAt",
      c.id AS cat_id, c.name AS cat_name,
      br.id AS brand_id, br.name AS brand_name,
      s.id AS supplier_id, s.name AS supplier_name
      ${branchId ? `, bp."sellingPrice"::float8 AS bp_selling, bp."purchasePrice"::float8 AS bp_purchase, bs.quantity::int4 AS bs_qty, bs."minStock"::int4 AS bs_min` : ""}
    FROM products p
    LEFT JOIN categories c ON c.id = p."categoryId"
    LEFT JOIN brands br ON br.id = p."brandId"
    LEFT JOIN suppliers s ON s.id = p."supplierId"
    ${branchId ? `LEFT JOIN branch_product_prices bp ON bp."productId" = p.id AND bp."branchId" = '${esc(branchId)}'` : ""}
    ${branchId ? `LEFT JOIN branch_stocks bs ON bs."productId" = p.id AND bs."branchId" = '${esc(branchId)}'` : ""}
    WHERE ${whereClause}
    ORDER BY ${orderColumn}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [rawRows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(dataQuery),
    prisma.$queryRawUnsafe<[{ total: number }]>(`SELECT COUNT(*)::int4 AS total FROM products p WHERE ${whereClause}`),
  ]);

  const total = Number(countResult[0]?.total ?? 0);

  const products = rawRows.map((r) => ({
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    categoryId: r.categoryId as string,
    category: { id: (r.cat_id as string) || "", name: (r.cat_name as string) || "" },
    brandId: r.brandId as string | null,
    brand: r.brand_name ? { id: r.brand_id as string, name: r.brand_name as string } : null,
    supplierId: r.supplierId as string | null,
    supplier: r.supplier_name ? { id: r.supplier_id as string, name: r.supplier_name as string } : null,
    purchasePrice: branchId && r.bp_purchase != null ? Number(r.bp_purchase) : Number(r.purchasePrice),
    sellingPrice: branchId && r.bp_selling != null ? Number(r.bp_selling) : Number(r.sellingPrice),
    stock: branchId ? Number(r.bs_qty ?? 0) : Number(r.stock),
    minStock: branchId ? Number(r.bs_min ?? r.minStock) : Number(r.minStock),
    barcode: r.barcode as string | null,
    unit: r.unit as string,
    description: r.description as string | null,
    isActive: r.isActive as boolean,
    imageUrl: r.imageUrl as string | null,
    createdAt: r.createdAt as Date,
    updatedAt: r.updatedAt as Date,
  }));

  return {
    products,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };

  }, { ttl: 30, tags: [`products:${companyId}`] });
}

export async function getProductStats(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const key = cacheKey(`product-stats:${companyId}`, { branchId });

  return serverCache.get(key, async () => {
    if (branchId) {
      const result = await prisma.$queryRaw<[{ total: bigint; active: bigint; low_stock: bigint; out_of_stock: bigint }]>`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE p."isActive" = true)::int AS active,
          COUNT(*) FILTER (WHERE COALESCE(bs.quantity, 0) > 0 AND COALESCE(bs.quantity, 0) <= 10)::int AS low_stock,
          COUNT(*) FILTER (WHERE COALESCE(bs.quantity, 0) = 0)::int AS out_of_stock
        FROM products p
        LEFT JOIN branch_stocks bs ON bs."productId" = p.id AND bs."branchId" = ${branchId}
        WHERE p."companyId" = ${companyId} AND p."deletedAt" IS NULL
      `;
      const r = result[0];
      return { total: Number(r.total), active: Number(r.active), lowStock: Number(r.low_stock), outOfStock: Number(r.out_of_stock) };
    }

    const result = await prisma.$queryRaw<[{ total: bigint; active: bigint; low_stock: bigint; out_of_stock: bigint }]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "isActive" = true)::int AS active,
        COUNT(*) FILTER (WHERE stock > 0 AND stock <= 10)::int AS low_stock,
        COUNT(*) FILTER (WHERE stock = 0)::int AS out_of_stock
      FROM products
      WHERE "companyId" = ${companyId} AND "deletedAt" IS NULL
    `;
    const r = result[0];
    return { total: Number(r.total), active: Number(r.active), lowStock: Number(r.low_stock), outOfStock: Number(r.out_of_stock) };
  }, { ttl: 30, tags: [`products:${companyId}`] });
}

export async function getProductById(id: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.product.findFirst({
    where: { id, companyId },
    include: { category: true, tierPrices: { orderBy: { minQty: "asc" } } },
  });
}

async function checkProductPlanFeatures(
  formData: FormData,
): Promise<string | null> {
  const branchPrices = formData.get("branchPrices") as string | null;
  const productUnits = formData.get("productUnits") as string | null;
  const tierPrices = formData.get("tierPrices") as string | null;
  const imageUrl = formData.get("imageUrl") as string | null;

  if (
    branchPrices &&
    branchPrices !== "[]" &&
    !(await checkActionAccess("products", "branch_prices"))
  )
    return "Fitur Harga Per Cabang memerlukan upgrade ke plan PRO";
  if (
    productUnits &&
    productUnits !== "[]" &&
    !(await checkActionAccess("products", "multi_unit"))
  )
    return "Fitur Multi Satuan memerlukan upgrade ke plan PRO";
  if (
    tierPrices &&
    tierPrices !== "[]" &&
    !(await checkActionAccess("products", "tier_prices"))
  )
    return "Fitur Harga Bertingkat memerlukan upgrade ke plan PRO";
  if (imageUrl && !(await checkActionAccess("products", "upload_image")))
    return "Fitur Upload Gambar memerlukan upgrade ke plan PRO";
  return null;
}

export async function createProduct(formData: FormData) {
  await assertMenuActionAccess("products", "create");
  const companyId = await getCurrentCompanyId();
  const brandIdRaw = (formData.get("brandId") as string) || "";
  const supplierIdRaw = (formData.get("supplierId") as string) || "";
  const imageUrl = (formData.get("imageUrl") as string) || null;
  const data = {
    code: (formData.get("code") as string) || "", // empty → DB trigger auto-generates
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

  const planError = await checkProductPlanFeatures(formData);
  if (planError) return { error: planError };

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
      ...(supplierIdRaw ? { supplierId: supplierIdRaw } : { supplierId: null }),
      imageUrl,
      companyId,
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

    // Save branch prices + create branch stock for each branch
    if (branchPricesResult.data.length > 0) {
      await prisma.branchProductPrice.createMany({
        data: branchPricesResult.data.map((bp) => ({
          branchId: bp.branchId,
          productId: product.id,
          sellingPrice: bp.sellingPrice,
          purchasePrice: bp.purchasePrice,
        })),
      });

      // Create branch stock for each branch with per-branch stock
      await prisma.branchStock.createMany({
        data: branchPricesResult.data.map((bp) => ({
          branchId: bp.branchId,
          productId: product.id,
          quantity: bp.stock ?? parsed.data.stock,
          minStock: bp.minStock ?? parsed.data.minStock,
        })),
      });

      // Create stock movement per branch
      const branchMovements = branchPricesResult.data
        .filter((bp) => (bp.stock ?? parsed.data.stock) > 0)
        .map((bp) => ({
          productId: product.id,
          branchId: bp.branchId,
          type: "IN" as const,
          quantity: bp.stock ?? parsed.data.stock,
          note: "Stok awal cabang",
          reference: "INIT",
        }));
      if (branchMovements.length > 0) {
        await prisma.stockMovement.createMany({ data: branchMovements });
      }
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
    serverCache.invalidate(`products:${companyId}`);

    createAuditLog({
      action: "CREATE",
      entity: "Product",
      entityId: product.id,
      details: {
        data: {
          name: parsed.data.name,
          code: parsed.data.code,
          categoryId: parsed.data.categoryId ?? null,
          brandId: brandIdRaw || null,
          unit: parsed.data.unit,
          purchasePrice: parsed.data.purchasePrice,
          sellingPrice: parsed.data.sellingPrice,
          stock: parsed.data.stock,
          minStock: parsed.data.minStock,
          barcode: parsed.data.barcode ?? null,
          description: parsed.data.description ?? null,
          isActive: parsed.data.isActive,
        },
      },
    }).catch(() => {});

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
  const companyId = await getCurrentCompanyId();
  const brandIdRaw = (formData.get("brandId") as string) || "";
  const supplierIdRaw = (formData.get("supplierId") as string) || "";
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

  const planError2 = await checkProductPlanFeatures(formData);
  if (planError2) return { error: planError2 };

  try {
    const oldProduct = await prisma.product.findFirst({
      where: { id, companyId },
      select: {
        name: true,
        code: true,
        sellingPrice: true,
        purchasePrice: true,
        unit: true,
        stock: true,
        minStock: true,
        barcode: true,
        isActive: true,
        categoryId: true,
        brandId: true,
        description: true,
      },
    });

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
      ...(supplierIdRaw ? { supplierId: supplierIdRaw } : { supplierId: null }),
      imageUrl,
    };
    await prisma.product.update({ where: { id, companyId }, data });

    // Update branch prices + branch stock
    await prisma.branchProductPrice.deleteMany({ where: { productId: id } });
    if (branchPricesResult.data.length > 0) {
      await prisma.branchProductPrice.createMany({
        data: branchPricesResult.data.map((bp) => ({
          branchId: bp.branchId,
          productId: id,
          sellingPrice: bp.sellingPrice,
          purchasePrice: bp.purchasePrice,
        })),
      });

      // Upsert branch stock for each branch
      for (const bp of branchPricesResult.data) {
        const existing = await prisma.branchStock.findFirst({
          where: { branchId: bp.branchId, productId: id },
        });
        if (existing) {
          await prisma.branchStock.update({
            where: { id: existing.id },
            data: { minStock: bp.minStock ?? parsed.data.minStock },
          });
        } else {
          await prisma.branchStock.create({
            data: {
              branchId: bp.branchId,
              productId: id,
              quantity: bp.stock ?? parsed.data.stock,
              minStock: bp.minStock ?? parsed.data.minStock,
            },
          });
        }
      }

      // Remove branch stock for branches no longer in the list
      const branchIds = branchPricesResult.data.map((bp) => bp.branchId);
      await prisma.branchStock.deleteMany({
        where: { productId: id, branchId: { notIn: branchIds } },
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
    serverCache.invalidate(`products:${companyId}`);

    createAuditLog({
      action: "UPDATE",
      entity: "Product",
      entityId: id,
      details: {
        before: oldProduct,
        after: {
          name: parsed.data.name,
          code: parsed.data.code,
          sellingPrice: parsed.data.sellingPrice,
          purchasePrice: parsed.data.purchasePrice,
          unit: parsed.data.unit,
          stock: parsed.data.stock,
          minStock: parsed.data.minStock,
          barcode: parsed.data.barcode ?? null,
          isActive: parsed.data.isActive,
          categoryId: parsed.data.categoryId ?? null,
          brandId: brandIdRaw || null,
          description: parsed.data.description ?? null,
        },
      },
    }).catch(() => {});

    return { success: true };
  } catch (err) {
    console.error("[updateProduct] Error:", err);
    const message =
      err instanceof Error ? err.message : "Gagal mengupdate produk";
    return { error: message };
  }
}

/** Product code is auto-generated by database trigger (trg_generate_product_code).
 *  Format: {COMPANY_SLUG}-{SEQ}, e.g. TOKO-0001
 *  If code is empty/null on INSERT, the trigger fills it automatically.
 */

export async function checkProductCodeExists(
  code: string,
  excludeId?: string,
): Promise<boolean> {
  const companyId = await getCurrentCompanyId();
  const found = await prisma.product.findFirst({
    where: {
      companyId,
      code: { equals: code, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !!found;
}

export async function getProductBranchPrices(productId: string) {
  const companyId = await getCurrentCompanyId();
  const product = await prisma.product.findFirst({
    where: { id: productId, companyId },
    select: { stock: true, sellingPrice: true },
  });

  const [branches, prices, stocks] = await Promise.all([
    prisma.branch.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.branchProductPrice.findMany({
      where: { productId },
      include: { branch: { select: { name: true } } },
    }),
    prisma.branchStock.findMany({
      where: { productId },
      select: { branchId: true, quantity: true, minStock: true },
    }),
  ]);

  const priceMap = new Map(prices.map((p) => [p.branchId, p]));
  const stockMap = new Map(stocks.map((s) => [s.branchId, s]));

  // Return ALL company branches — merge price + stock data
  return branches.map((b) => {
    const price = priceMap.get(b.id);
    const bs = stockMap.get(b.id);
    return {
      id: price?.id ?? "",
      branchId: b.id,
      productId,
      sellingPrice: price?.sellingPrice ?? product?.sellingPrice ?? 0,
      purchasePrice: price?.purchasePrice ?? null,
      branch: { name: b.name },
      stock: bs?.quantity ?? 0,
      minStock: bs?.minStock ?? 5,
    };
  });
}

export async function deleteProduct(id: string) {
  await assertMenuActionAccess("products", "delete");
  const companyId = await getCurrentCompanyId();
  try {
    const oldProduct = await prisma.product.findFirst({
      where: { id, companyId },
      select: { name: true, code: true },
    });

    await prisma.product.delete({ where: { id, companyId } });
    revalidatePath("/products");
    serverCache.invalidate(`products:${companyId}`);

    createAuditLog({
      action: "DELETE",
      entity: "Product",
      entityId: id,
      details: { deleted: oldProduct },
    }).catch(() => {});

    return { success: true };
  } catch {
    return {
      error: "Produk tidak bisa dihapus karena sudah digunakan dalam transaksi",
    };
  }
}

export async function searchProducts(
  query: string,
  branchId?: string | null,
  categoryId?: string | null,
) {
  if (!query || query.length < 1) return [];
  const companyId = await getCurrentCompanyId();

  const products = await prisma.product.findMany({
    where: {
      companyId,
      isActive: true,
      ...(categoryId ? { categoryId } : {}),
      ...(branchId ? { branchStocks: { some: { branchId } } } : {}),
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
      ...(branchId
        ? {
            branchPrices: { where: { branchId }, take: 1 },
            branchStocks: { where: { branchId }, take: 1 },
          }
        : {}),
    },
    take: 10,
  });

  // Overlay branch prices and stock if available
  return products.map((p) => {
    const ext = p as Record<string, unknown>;
    const bpArr = ext.branchPrices as
      | { sellingPrice: number; purchasePrice: number | null }[]
      | undefined;
    const bsArr = ext.branchStocks as { quantity: number }[] | undefined;
    const bp = bpArr?.[0];
    const bs = bsArr?.[0];
    return {
      ...p,
      ...(bp
        ? {
            sellingPrice: bp.sellingPrice,
            purchasePrice: bp.purchasePrice ?? p.purchasePrice,
          }
        : {}),
      ...(bs !== undefined ? { stock: bs.quantity } : {}),
      branchPrices: undefined,
      branchStocks: undefined,
    };
  });
}

export async function findByBarcode(barcode: string, branchId?: string | null) {
  if (!barcode) return null;
  const companyId = await getCurrentCompanyId();

  // First check product barcode/code
  const product = await prisma.product.findFirst({
    where: {
      companyId,
      isActive: true,
      OR: [{ barcode }, { code: barcode }],
    },
    include: {
      category: true,
      units: { orderBy: { conversionQty: "asc" } },
      tierPrices: { orderBy: { minQty: "asc" } },
      ...(branchId
        ? {
            branchPrices: { where: { branchId }, take: 1 },
            branchStocks: { where: { branchId }, take: 1 },
          }
        : {}),
    },
  });

  if (product) {
    const ext = product as Record<string, unknown>;
    const bpArr = ext.branchPrices as
      | { sellingPrice: number; purchasePrice: number | null }[]
      | undefined;
    const bsArr = ext.branchStocks as { quantity: number }[] | undefined;
    const bp = bpArr?.[0];
    const bs = bsArr?.[0];
    const result = {
      ...product,
      sellingPrice: bp?.sellingPrice ?? product.sellingPrice,
      purchasePrice: bp?.purchasePrice ?? product.purchasePrice,
      ...(bs !== undefined ? { stock: bs.quantity } : {}),
      branchPrices: undefined,
      branchStocks: undefined,
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
  const companyId = await getCurrentCompanyId();
  const items = await prisma.transactionItem.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId, isActive: true },
    include: { category: true },
  });

  return items
    .map((i) =>
      products.find((p: (typeof products)[number]) => p.id === i.productId),
    )
    .filter(Boolean);
}

export async function getProductsByCategory(categoryId: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.product.findMany({
    where: { companyId, categoryId, isActive: true, stock: { gt: 0 } },
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
  const companyId = await getCurrentCompanyId();
  const { categoryId, mode = "all", page = 1, perPage = 20, branchId } = params;

  // Helper to overlay branch prices + stock
  const applyBranchOverlay = async <
    T extends {
      id: string;
      sellingPrice: number;
      purchasePrice: number;
      stock: number;
    },
  >(
    products: T[],
  ): Promise<T[]> => {
    if (!branchId || products.length === 0) return products;
    const ids = products.map((p) => p.id);
    const [branchPrices, branchStocks] = await Promise.all([
      prisma.branchProductPrice.findMany({
        where: { branchId, productId: { in: ids } },
      }),
      prisma.branchStock.findMany({
        where: { branchId, productId: { in: ids } },
      }),
    ]);
    const priceMap = new Map(branchPrices.map((bp) => [bp.productId, bp]));
    const stockMap = new Map(
      branchStocks.map((bs) => [bs.productId, bs.quantity]),
    );
    return products.map((p) => {
      const bp = priceMap.get(p.id);
      const bsQty = stockMap.get(p.id);
      return {
        ...p,
        ...(bp
          ? {
              sellingPrice: bp.sellingPrice,
              purchasePrice: bp.purchasePrice ?? p.purchasePrice,
            }
          : {}),
        ...(bsQty !== undefined ? { stock: bsQty } : {}),
      };
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
      where: { id: { in: productIds }, companyId, isActive: true },
      include: {
        category: true,
        tierPrices: { orderBy: { minQty: "asc" } },
        units: { orderBy: { conversionQty: "asc" } },
      },
    });

    const sorted = items
      .map((i) =>
        products.find((p: (typeof products)[number]) => p.id === i.productId),
      )
      .filter(Boolean);

    return {
      products: await applyBranchOverlay(sorted as typeof products),
      total: totalAgg.length,
      hasMore: page * perPage < totalAgg.length,
    };
  }

  const where: Record<string, unknown> = { companyId, isActive: true };
  if (categoryId) where.categoryId = categoryId;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        tierPrices: { orderBy: { minQty: "asc" } },
        units: { orderBy: { conversionQty: "asc" } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: await applyBranchOverlay(products),
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

interface ValidatedRow {
  rowNum: number;
  code: string;
  name: string;
  categoryId: string;
  brandId: string | null;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  barcode: string | null;
  description: string | null;
}

type ImportResultItem = {
  row: number;
  success: boolean;
  name: string;
  error?: string;
};

const SQL_CHUNK = 5000; // rows per raw INSERT statement

export async function importProducts(
  rows: ImportProductRow[],
  branchId?: string,
) {
  await assertMenuActionAccess("products", "create");

  if (!(await checkActionAccess("products", "import"))) {
    return {
      results: [
        {
          row: 1,
          success: false,
          name: "",
          error: "Fitur Import memerlukan upgrade ke plan PRO",
        },
      ],
      successCount: 0,
      failedCount: rows.length,
    };
  }

  const companyId = await getCurrentCompanyId();

  // ── Pre-fetch semua lookup data sekaligus ──────────────────────────────────
  const [
    allCategories,
    allBrands,
    existingProducts,
    activeBranches,
    productCount,
  ] = await Promise.all([
    prisma.category.findMany({
      where: { companyId },
      select: { id: true, name: true },
    }),
    prisma.brand.findMany({
      where: { companyId },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({ where: { companyId }, select: { code: true } }),
    prisma.branch.findMany({
      where: {
        companyId,
        isActive: true,
        ...(branchId ? { id: branchId } : {}),
      },
      select: { id: true },
    }),
    prisma.product.count({ where: { companyId } }),
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
  const branchIds = activeBranches.map((b) => b.id);

  let autoCodeCounter = productCount;

  // ── Phase 1: Validasi semua row ────────────────────────────────────────────
  const results: ImportResultItem[] = [];
  const validRows: ValidatedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;

    if (!row.name?.trim()) {
      results.push({
        row: rowNum,
        success: false,
        name: row.name || `Baris ${rowNum}`,
        error: "Nama produk wajib diisi",
      });
      continue;
    }

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

    let code = row.code?.trim();
    if (!code) {
      autoCodeCounter++;
      code = `PRD-${String(autoCodeCounter).padStart(5, "0")}`;
    }

    if (existingCodes.has(code.toLowerCase())) {
      results.push({
        row: rowNum,
        success: false,
        name: row.name,
        error: `Kode "${code}" sudah ada`,
      });
      continue;
    }

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

    // Tandai kode sebagai sudah dipakai agar row berikutnya tidak duplikat
    existingCodes.add(code.toLowerCase());

    validRows.push({
      rowNum,
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
    });
  }

  if (validRows.length === 0) {
    results.sort((a, b) => a.row - b.row);
    return { results, successCount: 0, failedCount: results.length };
  }

  // ── Phase 2: Raw SQL bulk insert in single transaction ─────────────────────
  const esc = (v: string) => `'${v.replace(/'/g, "''")}'`;
  const allCodes = validRows.map((r) => esc(r.code)).join(",");

  try {
    await prisma.$transaction(async (tx) => {
      // 1. INSERT products in chunks (PostgreSQL param limit)
      for (let i = 0; i < validRows.length; i += SQL_CHUNK) {
        const chunk = validRows.slice(i, i + SQL_CHUNK);
        const values = chunk.map((r) =>
          `(gen_random_uuid(), ${esc(r.code)}, ${esc(r.name)}, ${esc(r.categoryId)}, ${r.brandId ? esc(r.brandId) : "NULL"}, ${esc(r.unit)}, ${r.purchasePrice}, ${r.sellingPrice}, ${r.stock}, ${r.minStock}, ${r.barcode ? esc(r.barcode) : "NULL"}, ${r.description ? esc(r.description) : "NULL"}, true, ${esc(companyId)}, NOW(), NOW())`
        ).join(",");

        await tx.$executeRawUnsafe(`
          INSERT INTO products (id, code, name, "categoryId", "brandId", unit, "purchasePrice", "sellingPrice", stock, "minStock", barcode, description, "isActive", "companyId", "createdAt", "updatedAt")
          VALUES ${values}
          ON CONFLICT DO NOTHING
        `);
      }

      // 2. INSERT stock movements for all imported products with stock > 0 (single query)
      await tx.$executeRawUnsafe(`
        INSERT INTO stock_movements (id, "productId", type, quantity, note, reference, "createdAt")
        SELECT gen_random_uuid(), p.id, 'IN', p.stock, 'Stok awal (import)', 'IMPORT', NOW()
        FROM products p
        WHERE p."companyId" = ${esc(companyId)}
          AND p.stock > 0
          AND p.code IN (${allCodes})
          AND NOT EXISTS (SELECT 1 FROM stock_movements sm WHERE sm."productId" = p.id AND sm.reference = 'IMPORT')
      `);

      // 3. INSERT branch stocks via CROSS JOIN (single query)
      if (branchIds.length > 0) {
        const branchArray = branchIds.map((id) => esc(id)).join(",");
        await tx.$executeRawUnsafe(`
          INSERT INTO branch_stocks (id, "branchId", "productId", quantity, "minStock", "createdAt", "updatedAt")
          SELECT gen_random_uuid(), b.bid, p.id, p.stock, p."minStock", NOW(), NOW()
          FROM products p
          CROSS JOIN (SELECT unnest(ARRAY[${branchArray}]::text[]) AS bid) b
          WHERE p."companyId" = ${esc(companyId)}
            AND p.code IN (${allCodes})
          ON CONFLICT ("branchId", "productId") DO NOTHING
        `);
      }
    }, { timeout: 300000 }); // 5 min timeout

    // Transaction succeeded — mark all valid rows as success
    for (const r of validRows) {
      results.push({ row: r.rowNum, success: true, name: r.name });
    }
  } catch (err) {
    console.error("[Import] Transaction error:", err);
    // Transaction rolled back — all failed, no partial data
    for (const r of validRows) {
      results.push({ row: r.rowNum, success: false, name: r.name, error: "Gagal menyimpan data" });
    }
  }

  results.sort((a, b) => a.row - b.row);
  revalidatePath("/products");

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  return { results, successCount, failedCount };
}

export async function getImportTemplate() {
  const companyId = await getCurrentCompanyId();
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      where: { companyId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.brand.findMany({
      where: { companyId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    headers: [
      "code", "name", "categoryName", "brandName", "unit",
      "purchasePrice", "sellingPrice", "stock", "minStock", "barcode", "description",
    ],
    headerLabels: [
      "Kode Produk", "Nama Produk *", "Kategori *", "Brand", "Satuan *",
      "Harga Beli *", "Harga Jual *", "Stok", "Stok Minimum", "Barcode", "Deskripsi",
    ],
    categories: categories.map((c) => c.name),
    brands: brands.map((b) => b.name),
    sampleRows: [
      ["PRD-00001", "Indomie Goreng", categories[0]?.name ?? "Makanan", brands[0]?.name ?? "", "PCS", "2500", "3500", "100", "10", "8991234567890", "Mi instan goreng"],
      ["PRD-00002", "Aqua 600ml", categories[0]?.name ?? "Minuman", brands[0]?.name ?? "", "PCS", "3000", "4000", "200", "20", "8997654321098", "Air mineral 600ml"],
    ],
  };
}

// ─── File-based import (backend parsing) ───

import { parseFormDataPreview, parseFormDataAllRows, generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

const PRODUCT_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { header: "Kode Produk", width: 16, sampleValues: ["PRD-00001", "PRD-00002"] },
  { header: "Nama Produk *", width: 22, sampleValues: ["Indomie Goreng", "Aqua 600ml"] },
  { header: "Kategori *", width: 16, sampleValues: ["Makanan", "Minuman"] },
  { header: "Brand", width: 14, sampleValues: ["Indofood", "Danone"] },
  { header: "Satuan *", width: 10, sampleValues: ["PCS", "PCS"] },
  { header: "Harga Beli *", width: 14, sampleValues: ["2500", "3000"] },
  { header: "Harga Jual *", width: 14, sampleValues: ["3500", "4000"] },
  { header: "Stok", width: 10, sampleValues: ["100", "200"] },
  { header: "Stok Minimum", width: 14, sampleValues: ["10", "20"] },
  { header: "Barcode", width: 18, sampleValues: ["8991234567890", "8997654321098"] },
  { header: "Deskripsi", width: 24, sampleValues: ["Mi instan goreng", "Air mineral 600ml"] },
];

export async function previewProductImportFile(formData: FormData) {
  const fileName = formData.get("fileName") as string;
  if (!fileName) throw new Error("File tidak ditemukan");
  console.log(`[Import Preview] File: ${fileName}`);
  try {
    return await parseFormDataPreview(formData, 20);
  } catch (err) {
    console.error("[Import Preview] Error:", err);
    throw new Error(`Gagal membaca file: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

export async function loadAllProductImportRows(formData: FormData) {
  const fileName = formData.get("fileName") as string;
  if (!fileName) throw new Error("File tidak ditemukan");
  try {
    return await parseFormDataPreview(formData, 999999);
  } catch (err) {
    console.error("[Import LoadAll] Error:", err);
    throw new Error(`Gagal memuat data: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

export async function importProductsFromFile(formData: FormData) {
  const fileName = formData.get("fileName") as string;
  if (!fileName) throw new Error("File tidak ditemukan");
  const branchId = (formData.get("branchId") as string) || undefined;

  const { rows } = await parseFormDataAllRows(formData);

  const mapped: ImportProductRow[] = rows.map((row) => ({
    code: row[0] || "",
    name: row[1] || "",
    categoryName: row[2] || "",
    brandName: row[3] || "",
    unit: row[4] || "PCS",
    purchasePrice: Number(row[5]) || 0,
    sellingPrice: Number(row[6]) || 0,
    stock: Number(row[7]) || 0,
    minStock: Number(row[8]) || 0,
    barcode: row[9] || "",
    description: row[10] || "",
  }));

  return importProducts(mapped, branchId);
}

export async function downloadProductImportTemplate(format: "csv" | "excel" | "docx") {
  const companyId = await getCurrentCompanyId();
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ where: { companyId }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ where: { companyId }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const notes = [
    `Kategori yang tersedia: ${categories.map((c) => c.name).join(", ") || "-"}`,
    `Brand yang tersedia: ${brands.map((b) => b.name).join(", ") || "-"}`,
    "Kolom dengan tanda * wajib diisi",
    "Kode produk otomatis jika dikosongkan",
  ];

  const result = await generateImportTemplate(PRODUCT_TEMPLATE_COLUMNS, 2, notes, format);
  return {
    data: result.data,
    filename: `template-import-produk.${format === "excel" ? "xlsx" : format}`,
    mimeType: result.mimeType,
  };
}

export async function bulkDeleteProducts(ids: string[]) {
  await assertMenuActionAccess("products", "delete");
  const companyId = await getCurrentCompanyId();
  const result = await prisma.product.deleteMany({ where: { id: { in: ids }, companyId } });
  revalidatePath("/products");
  serverCache.invalidate(`products:${companyId}`);
  return { count: result.count };
}
