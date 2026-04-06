"use server";

import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = "CRITICAL" | "WARNING" | "LOW" | "SAFE";
export type SalesTrend = "INCREASING" | "STABLE" | "DECREASING";

export interface ForecastProduct {
  productId: string;
  productName: string;
  productCode: string;
  categoryName: string;
  supplierName: string | null;
  supplierId: string | null;
  currentStock: number;
  minStock: number;
  purchasePrice: number;
  sellingPrice: number;
  avgDailySales: number;
  daysUntilStockout: number;
  recommendedReorderQty: number;
  trend: SalesTrend;
  riskLevel: RiskLevel;
  totalSold30d: number;
  activeDays30d: number;
}

export interface ForecastSummary {
  criticalCount: number;
  warningCount: number;
  lowCount: number;
  safeCount: number;
  totalStockValueAtRisk: number;
  productsNeedingReorder: number;
  totalProducts: number;
}

export interface DailySalesPoint {
  date: string;
  quantity: number;
}

export interface ReorderItem {
  productId: string;
  productName: string;
  productCode: string;
  currentStock: number;
  avgDailySales: number;
  daysUntilStockout: number;
  recommendedQty: number;
  estimatedCost: number;
  purchasePrice: number;
  riskLevel: RiskLevel;
}

export interface SupplierReorderGroup {
  supplierId: string;
  supplierName: string;
  supplierContact: string | null;
  supplierEmail: string | null;
  items: ReorderItem[];
  totalEstimatedCost: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_LEAD_TIME_DAYS = 7;

function classifyRisk(daysLeft: number): RiskLevel {
  if (daysLeft < 3) return "CRITICAL";
  if (daysLeft < 7) return "WARNING";
  if (daysLeft < 14) return "LOW";
  return "SAFE";
}

function classifyTrend(recentAvg: number, priorAvg: number): SalesTrend {
  if (priorAvg === 0 && recentAvg === 0) return "STABLE";
  if (priorAvg === 0) return "INCREASING";
  const ratio = recentAvg / priorAvg;
  if (ratio > 1.15) return "INCREASING";
  if (ratio < 0.85) return "DECREASING";
  return "STABLE";
}

// ─── Main Forecast ────────────────────────────────────────────────────────────

interface ForecastParams {
  branchId?: string | undefined;
  riskLevel?: RiskLevel | undefined;
  search?: string | undefined;
  categoryId?: string | undefined;
  supplierId?: string | undefined;
  sortBy?: "daysLeft" | "avgSales" | "stock" | "name" | undefined;
  sortDir?: "asc" | "desc" | undefined;
  leadTimeDays?: number | undefined;
}

export async function getInventoryForecast(params: ForecastParams = {}): Promise<ForecastProduct[]> {
  const {
    branchId,
    riskLevel,
    search,
    categoryId,
    supplierId,
    sortBy = "daysLeft",
    sortDir = "asc",
    leadTimeDays = DEFAULT_LEAD_TIME_DAYS,
  } = params;

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fifteenDaysAgo = new Date(now);
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  // Build branch filter for SQL
  const branchCondition = branchId ? `AND t."branchId" = '${branchId}'` : "";

  // 1) Sales data for last 30 days
  const salesData = await prisma.$queryRawUnsafe<
    { productId: string; total_sold: bigint; active_days: bigint }[]
  >(`
    SELECT ti."productId",
           SUM(ti.quantity) as total_sold,
           COUNT(DISTINCT DATE_TRUNC('day', t."createdAt")) as active_days
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti."transactionId"
    WHERE t.status = 'COMPLETED'
      AND t."createdAt" >= $1
      ${branchCondition}
    GROUP BY ti."productId"
  `, thirtyDaysAgo);

  // 2) Sales for recent 15 days (for trend)
  const recentSalesData = await prisma.$queryRawUnsafe<
    { productId: string; total_sold: bigint }[]
  >(`
    SELECT ti."productId",
           SUM(ti.quantity) as total_sold
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti."transactionId"
    WHERE t.status = 'COMPLETED'
      AND t."createdAt" >= $1
      ${branchCondition}
    GROUP BY ti."productId"
  `, fifteenDaysAgo);

  // 3) Sales for prior 15 days (day -30 to day -15)
  const priorSalesData = await prisma.$queryRawUnsafe<
    { productId: string; total_sold: bigint }[]
  >(`
    SELECT ti."productId",
           SUM(ti.quantity) as total_sold
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti."transactionId"
    WHERE t.status = 'COMPLETED'
      AND t."createdAt" >= $1
      AND t."createdAt" < $2
      ${branchCondition}
    GROUP BY ti."productId"
  `, thirtyDaysAgo, fifteenDaysAgo);

  // Build maps
  const salesMap = new Map(salesData.map(r => [r.productId, { totalSold: Number(r.total_sold), activeDays: Number(r.active_days) }]));
  const recentMap = new Map(recentSalesData.map(r => [r.productId, Number(r.total_sold)]));
  const priorMap = new Map(priorSalesData.map(r => [r.productId, Number(r.total_sold)]));

  // 4) All active products
  const productWhere: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (categoryId) productWhere.categoryId = categoryId;
  if (supplierId) productWhere.supplierId = supplierId;
  if (search) {
    productWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }

  const products = await prisma.product.findMany({
    where: productWhere,
    include: {
      category: { select: { name: true } },
      supplier: { select: { id: true, name: true } },
    },
  });

  // Build forecast rows
  let results: ForecastProduct[] = products.map(p => {
    const sales = salesMap.get(p.id) || { totalSold: 0, activeDays: 0 };
    const avgDaily = sales.activeDays > 0 ? sales.totalSold / 30 : 0;
    const daysLeft = avgDaily > 0 ? Math.round(p.stock / avgDaily) : 9999;
    const reorderQty = Math.max(0, Math.ceil(avgDaily * (leadTimeDays + 14) - p.stock));

    const recentTotal = recentMap.get(p.id) || 0;
    const priorTotal = priorMap.get(p.id) || 0;
    const recentAvg = recentTotal / 15;
    const priorAvg = priorTotal / 15;

    return {
      productId: p.id,
      productName: p.name,
      productCode: p.code,
      categoryName: p.category.name,
      supplierName: p.supplier?.name || null,
      supplierId: p.supplier?.id || null,
      currentStock: p.stock,
      minStock: p.minStock,
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      avgDailySales: Math.round(avgDaily * 100) / 100,
      daysUntilStockout: daysLeft,
      recommendedReorderQty: reorderQty,
      trend: classifyTrend(recentAvg, priorAvg),
      riskLevel: classifyRisk(daysLeft),
      totalSold30d: sales.totalSold,
      activeDays30d: sales.activeDays,
    };
  });

  // Filter by risk
  if (riskLevel) {
    results = results.filter(r => r.riskLevel === riskLevel);
  }

  // Sort
  results.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "daysLeft": cmp = a.daysUntilStockout - b.daysUntilStockout; break;
      case "avgSales": cmp = a.avgDailySales - b.avgDailySales; break;
      case "stock": cmp = a.currentStock - b.currentStock; break;
      case "name": cmp = a.productName.localeCompare(b.productName); break;
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  return results;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export async function getForecastSummary(branchId?: string | undefined): Promise<ForecastSummary> {
  const all = await getInventoryForecast({ branchId });

  let criticalCount = 0;
  let warningCount = 0;
  let lowCount = 0;
  let safeCount = 0;
  let totalStockValueAtRisk = 0;
  let productsNeedingReorder = 0;

  for (const p of all) {
    switch (p.riskLevel) {
      case "CRITICAL": criticalCount++; break;
      case "WARNING": warningCount++; break;
      case "LOW": lowCount++; break;
      case "SAFE": safeCount++; break;
    }
    if (p.riskLevel === "CRITICAL" || p.riskLevel === "WARNING") {
      totalStockValueAtRisk += p.currentStock * p.purchasePrice;
    }
    if (p.recommendedReorderQty > 0) {
      productsNeedingReorder++;
    }
  }

  return {
    criticalCount,
    warningCount,
    lowCount,
    safeCount,
    totalStockValueAtRisk,
    productsNeedingReorder,
    totalProducts: all.length,
  };
}

// ─── Product Sales Trend ──────────────────────────────────────────────────────

export async function getProductSalesTrend(
  productId: string,
  days: number = 30,
  branchId?: string | undefined,
): Promise<DailySalesPoint[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const branchCondition = branchId ? `AND t."branchId" = '${branchId}'` : "";

  const rows = await prisma.$queryRawUnsafe<
    { sale_date: Date; daily_qty: bigint }[]
  >(`
    SELECT DATE_TRUNC('day', t."createdAt") as sale_date,
           SUM(ti.quantity) as daily_qty
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti."transactionId"
    WHERE t.status = 'COMPLETED'
      AND ti."productId" = $1
      AND t."createdAt" >= $2
      ${branchCondition}
    GROUP BY DATE_TRUNC('day', t."createdAt")
    ORDER BY sale_date ASC
  `, productId, startDate);

  // Fill all days
  const result: DailySalesPoint[] = [];
  const salesMap = new Map(
    rows.map(r => [new Date(r.sale_date).toISOString().split("T")[0] ?? "", Number(r.daily_qty)])
  );

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().split("T")[0] ?? "";
    result.push({
      date: key,
      quantity: salesMap.get(key) ?? 0,
    });
  }

  return result;
}

// ─── Auto Reorder List ────────────────────────────────────────────────────────

export async function generateAutoReorderList(branchId?: string | undefined): Promise<SupplierReorderGroup[]> {
  const all = await getInventoryForecast({ branchId, sortBy: "daysLeft", sortDir: "asc" });

  // Only products needing reorder (critical + warning + products below reorder point)
  const needsReorder = all.filter(p => p.recommendedReorderQty > 0 && p.daysUntilStockout < 14);

  // Group by supplier
  const groups = new Map<string, { supplier: { id: string; name: string; contact: string | null; email: string | null }; items: ReorderItem[] }>();

  // Fetch supplier details for items with suppliers
  const supplierIds = [...new Set(needsReorder.filter(p => p.supplierId).map(p => p.supplierId!))];
  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: supplierIds } },
    select: { id: true, name: true, contact: true, email: true },
  });
  const supplierMap = new Map(suppliers.map(s => [s.id, s]));

  for (const p of needsReorder) {
    const suppId = p.supplierId || "unassigned";
    const supp = p.supplierId ? supplierMap.get(p.supplierId) : null;

    if (!groups.has(suppId)) {
      groups.set(suppId, {
        supplier: {
          id: suppId,
          name: supp?.name || "Tanpa Supplier",
          contact: supp?.contact || null,
          email: supp?.email || null,
        },
        items: [],
      });
    }

    groups.get(suppId)!.items.push({
      productId: p.productId,
      productName: p.productName,
      productCode: p.productCode,
      currentStock: p.currentStock,
      avgDailySales: p.avgDailySales,
      daysUntilStockout: p.daysUntilStockout,
      recommendedQty: p.recommendedReorderQty,
      estimatedCost: p.recommendedReorderQty * p.purchasePrice,
      purchasePrice: p.purchasePrice,
      riskLevel: p.riskLevel,
    });
  }

  return Array.from(groups.values()).map(g => ({
    supplierId: g.supplier.id,
    supplierName: g.supplier.name,
    supplierContact: g.supplier.contact,
    supplierEmail: g.supplier.email,
    items: g.items,
    totalEstimatedCost: g.items.reduce((sum, i) => sum + i.estimatedCost, 0),
  })).sort((a, b) => {
    // Groups with critical items first
    const aCrit = a.items.filter(i => i.riskLevel === "CRITICAL").length;
    const bCrit = b.items.filter(i => i.riskLevel === "CRITICAL").length;
    return bCrit - aCrit;
  });
}
