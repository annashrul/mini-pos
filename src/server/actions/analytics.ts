"use server";

import { prisma } from "@/lib/prisma";

// Margin analyzer per product
export async function getMarginAnalysis(_branchId?: string) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      purchasePrice: true,
      sellingPrice: true,
      stock: true,
      category: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  return products.map((p: (typeof products)[number]) => ({
    ...p,
    margin: p.sellingPrice - p.purchasePrice,
    marginPercent:
      p.purchasePrice > 0
        ? ((p.sellingPrice - p.purchasePrice) / p.purchasePrice) * 100
        : 0,
  }));
}

// Margin analyzer per category
export async function getCategoryMarginAnalysis(_branchId?: string) {
  const categories = await prisma.category.findMany({
    include: {
      products: {
        where: { isActive: true },
        select: { purchasePrice: true, sellingPrice: true, stock: true },
      },
    },
  });

  return categories.map((c) => {
    const totalCost = c.products.reduce((sum, p) => sum + p.purchasePrice, 0);
    const totalSell = c.products.reduce((sum, p) => sum + p.sellingPrice, 0);
    const avgMargin =
      c.products.length > 0
        ? c.products.reduce(
            (sum, p) => sum + (p.sellingPrice - p.purchasePrice),
            0,
          ) / c.products.length
        : 0;
    const totalStock = c.products.reduce((sum, p) => sum + p.stock, 0);

    return {
      name: c.name,
      productCount: c.products.length,
      avgCost: c.products.length > 0 ? totalCost / c.products.length : 0,
      avgSell: c.products.length > 0 ? totalSell / c.products.length : 0,
      avgMargin,
      avgMarginPercent:
        totalCost > 0 ? ((totalSell - totalCost) / totalCost) * 100 : 0,
      totalStock,
    };
  });
}

// Dead stock detection (no sales in 30 days)
export async function getDeadStock(_branchId?: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const allProducts = await prisma.product.findMany({
    where: { isActive: true, stock: { gt: 0 } },
    select: {
      id: true,
      name: true,
      code: true,
      stock: true,
      sellingPrice: true,
      category: { select: { name: true } },
    },
  });

  const recentSales = await prisma.transactionItem.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { productId: true },
    distinct: ["productId"],
  });

  const soldProductIds = new Set(recentSales.map((s) => s.productId));

  return allProducts
    .filter((p: (typeof allProducts)[number]) => !soldProductIds.has(p.id))
    .map((p: (typeof allProducts)[number]) => ({
      ...p,
      stockValue: p.stock * p.sellingPrice,
    }));
}

// Slow moving products (sold < 5 in 30 days)
export async function getSlowMoving(branchId?: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const slowRows = await prisma.$queryRawUnsafe<
    { productId: string; soldQty: number }[]
  >(
    `
    SELECT
      ti."productId",
      COALESCE(SUM(ti.quantity), 0)::int AS "soldQty"
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti."transactionId"
    WHERE t.status = 'COMPLETED'
      AND t."createdAt" >= $1
      ${branchId ? `AND t."branchId" = $2` : ""}
    GROUP BY ti."productId"
    HAVING COALESCE(SUM(ti.quantity), 0) < 5
    ORDER BY "soldQty" ASC
    LIMIT 50
    `,
    thirtyDaysAgo,
    ...(branchId ? [branchId] : []),
  );

  const slowIds = slowRows.map((r) => r.productId);

  if (slowIds.length === 0) return [];

  const qtyMap = new Map(slowRows.map((r) => [r.productId, r.soldQty]));
  const products = await prisma.product.findMany({
    where: { id: { in: slowIds }, isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      stock: true,
      category: { select: { name: true } },
    },
  });

  return products.map((p: (typeof products)[number]) => ({
    ...p,
    soldQty: qtyMap.get(p.id) ?? 0,
  }));
}

// Peak hours analysis
export async function getPeakHours(branchId?: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const params: unknown[] = [thirtyDaysAgo];
  const branchCond = branchId
    ? `AND "branchId" = $${params.push(branchId)}`
    : "";

  const rows = await prisma.$queryRawUnsafe<
    { h: number; count: bigint; revenue: bigint }[]
  >(
    `
    SELECT EXTRACT(HOUR FROM "createdAt")::int as h, COUNT(*)::bigint as count,COALESCE(SUM("grandTotal"), 0) as revenue
    FROM transactions
    WHERE status = 'COMPLETED' AND "createdAt" >= $1 ${branchCond}
    GROUP BY EXTRACT(HOUR FROM "createdAt")
    ORDER BY h
    `,
    ...params,
  );

  const hourMap = new Map(
    rows.map((r) => [
      r.h,
      { count: Number(r.count), revenue: Number(r.revenue) },
    ]),
  );

  return Array.from({ length: 24 }, (_, h) => {
    const data = hourMap.get(h) || { count: 0, revenue: 0 };
    return {
      hour: `${String(h).padStart(2, "0")}:00`,
      transactions: data.count,
      revenue: data.revenue,
    };
  });
}

// Smart reorder alerts
export async function getReorderAlerts(_branchId?: string) {
  return prisma.$queryRaw<
    {
      id: string;
      name: string;
      code: string;
      stock: number;
      minStock: number;
      supplierName: string | null;
    }[]
  >`
    SELECT p.id, p.name, p.code, p.stock, p."minStock",
           s.name as "supplierName"
    FROM products p
    LEFT JOIN suppliers s ON p."supplierId" = s.id
    WHERE p."isActive" = true AND p.stock <= p."minStock"
    ORDER BY (p.stock::float / NULLIF(p."minStock", 0)) ASC
    LIMIT 20
  `;
}

// Fraud detection - void abuse
export async function getVoidAbuseDetection(_branchId?: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await prisma.$queryRawUnsafe<
    { name: string; role: string; voidCount: number }[]
  >(
    `
      SELECT u.name, u.role, COUNT(t.id)::int AS "voidCount"
      FROM transactions t
      JOIN users u ON u.id = t."userId"
      WHERE t.status = 'VOIDED' AND t."createdAt" >= $1
      GROUP BY u.id, u.name, u.role
      ORDER BY "voidCount" DESC
      `,
    sevenDaysAgo,
  );

  return rows.map((r) => ({
    userName: r.name,
    role: r.role,
    voidCount: r.voidCount,
    suspicious: r.voidCount > 5,
  }));
}

// Daily profit (last 30 days)
export async function getDailyProfit(_branchId?: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await prisma.$queryRawUnsafe<
    { d: Date; revenue: bigint; cost: bigint }[]
  >(
    `
    SELECT DATE_TRUNC('day', t."createdAt") as d,
           COALESCE(SUM(t."grandTotal"), 0) as revenue,
           COALESCE(SUM(ti.quantity * p."purchasePrice"), 0) as cost
    FROM transactions t
    JOIN transaction_items ti ON ti."transactionId" = t.id
    JOIN products p ON p.id = ti."productId"
    WHERE t.status = 'COMPLETED' AND t."createdAt" >= $1
    GROUP BY DATE_TRUNC('day', t."createdAt")
    ORDER BY d ASC
  `,
    thirtyDaysAgo,
  );

  return rows.map((r) => ({
    date: new Date(r.d).toISOString().split("T")[0] ?? "",
    revenue: Number(r.revenue),
    cost: Number(r.cost),
    profit: Number(r.revenue) - Number(r.cost),
  }));
}

// Profit per shift
export async function getShiftProfit(_branchId?: string) {
  const shifts = await prisma.cashierShift.findMany({
    where: { isOpen: false, closedAt: { not: null } },
    include: { user: { select: { name: true } } },
    orderBy: { closedAt: "desc" },
    take: 30,
  });
  if (shifts.length === 0) return [];
  const rows = await prisma.$queryRawUnsafe<
    { shiftId: string; revenue: number; txCount: number }[]
  >(
    `SELECT cs.id as "shiftId", COALESCE(SUM(t."grandTotal"), 0)::float AS revenue, COUNT(t.id)::int AS "txCount"
    FROM cashier_shifts cs
    LEFT JOIN transactions t ON t."userId" = cs."userId" AND t.status = 'COMPLETED' AND t."createdAt" >= cs."openedAt" AND t."createdAt" <= cs."closedAt"
    WHERE cs.id = ANY($1)
    GROUP BY cs.id`,
    shifts.map((s) => s.id),
  );
  const rowMap = new Map(rows.map((r) => [r.shiftId, r]));
  return shifts.map((shift) => {
    const agg = rowMap.get(shift.id) ?? { revenue: 0, txCount: 0 };
    return {
      shiftId: shift.id,
      cashier: shift.user.name,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt!.toISOString(),
      revenue: agg.revenue,
      transactions: agg.txCount,
    };
  });
}

// Supplier ranking
export async function getSupplierRanking(_branchId?: string) {
  return prisma.$queryRaw<
    {
      name: string;
      productCount: number;
      totalPOValue: number;
      poCount: number;
    }[]
  >`
    SELECT s.name,COUNT(DISTINCT p.id)::int AS "productCount",COALESCE(SUM(po."totalAmount"), 0)::float AS "totalPOValue",COUNT(DISTINCT po.id)::int AS "poCount"
    FROM suppliers s
    LEFT JOIN products p ON p."supplierId" = s.id AND p."isActive" = true
    LEFT JOIN purchase_orders po ON po."supplierId" = s.id
    WHERE s."isActive" = true
    GROUP BY s.id, s.name
    ORDER BY "totalPOValue" DESC
  `;
}

// Supplier debt tracking
export async function getSupplierDebt(_branchId?: string) {
  return prisma.$queryRaw<
    {
      supplierName: string;
      totalPO: number;
      totalPaid: number;
      debt: number;
    }[]
  >`
    SELECT
      s.name as "supplierName",
      COALESCE((
        SELECT SUM(po."totalAmount")
        FROM purchase_orders po
        WHERE po."supplierId" = s.id
          AND po.status = 'RECEIVED'
      ), 0)::float as "totalPO",
      COALESCE((
        SELECT SUM(sp.amount)
        FROM supplier_payments sp
        WHERE sp."supplierId" = s.id
      ), 0)::float as "totalPaid",
      (
        COALESCE((
          SELECT SUM(po."totalAmount")
          FROM purchase_orders po
          WHERE po."supplierId" = s.id
            AND po.status = 'RECEIVED'
        ), 0) -
        COALESCE((
          SELECT SUM(sp.amount)
          FROM supplier_payments sp
          WHERE sp."supplierId" = s.id
        ), 0)
      )::float as debt
    FROM suppliers s
    WHERE s."isActive" = true
    ORDER BY debt DESC
  `;
}

// Unusual discount detection
export async function getUnusualDiscounts(_branchId?: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Filter discountPercent > 20% langsung di DB — tidak perlu fetch semua dulu
  const transactions = await prisma.$queryRawUnsafe<
    {
      invoiceNumber: string;
      cashierName: string;
      role: string;
      subtotal: number;
      discountAmount: number;
      grandTotal: number;
      createdAt: string;
    }[]
  >(
    `
    SELECT t."invoiceNumber",u.name AS "cashierName", u.role,t.subtotal, t."discountAmount",t."grandTotal",t."createdAt"::text
    FROM transactions t
    JOIN users u ON u.id = t."userId"
    WHERE t.status = 'COMPLETED' AND t."createdAt" >= $1 AND t."discountAmount" > 0 AND t.subtotal > 0 AND (t."discountAmount" / t.subtotal) * 100 > 20
    ORDER BY t."discountAmount" DESC
    `,
    sevenDaysAgo,
  );

  return transactions.map((tx) => ({
    invoiceNumber: tx.invoiceNumber,
    cashier: tx.cashierName,
    role: tx.role,
    subtotal: tx.subtotal,
    discountAmount: tx.discountAmount,
    discountPercent: (tx.discountAmount / tx.subtotal) * 100,
    grandTotal: tx.grandTotal,
    createdAt: tx.createdAt,
  }));
}

// Promo effectiveness report
export async function getPromoEffectiveness(_branchId?: string) {
  const [promotions, txAgg] = await Promise.all([
    prisma.promotion.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.$queryRaw<
      { promoApplied: string; usageCount: number; totalDiscount: number }[]
    >`
        SELECT "promoApplied",COUNT(*)::int AS "usageCount",COALESCE(SUM("discountAmount"), 0)::float AS "totalDiscount"
        FROM transactions
        WHERE status = 'COMPLETED' AND "promoApplied" IS NOT NULL
        GROUP BY "promoApplied"
    `,
  ]);

  // Build lookup: promoApplied string → { usageCount, totalDiscount }
  const txMap = new Map(txAgg.map((r) => [r.promoApplied, r]));

  return promotions
    .map((promo) => {
      const key = promo.voucherCode ?? promo.name;
      const agg = txMap.get(key) ?? { usageCount: 0, totalDiscount: 0 };
      return {
        promoName: promo.name,
        type: promo.type,
        usageCount: Math.max(agg.usageCount, promo.usageCount),
        totalDiscount: agg.totalDiscount,
        isActive: promo.isActive && new Date(promo.endDate) >= new Date(),
      };
    })
    .sort((a, b) => b.usageCount - a.usageCount);
}

// Auto reorder recommendation
export async function getReorderRecommendations(_branchId?: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Use raw query for the stock <= minStock filter since Prisma doesn't support field-to-field comparison
  const lowStockProducts = await prisma.$queryRaw<
    {
      id: string;
      name: string;
      code: string;
      stock: number;
      minStock: number;
      supplierName: string | null;
    }[]
  >`
    SELECT p.id, p.name, p.code, p.stock, p."minStock",
           s.name as "supplierName"
    FROM products p
    LEFT JOIN suppliers s ON p."supplierId" = s.id
    WHERE p."isActive" = true AND p.stock <= p."minStock"
    ORDER BY (p.stock::float / NULLIF(p."minStock", 0)) ASC
  `;

  // Get avg daily sales for ALL low stock products in a single query
  const productIds = lowStockProducts.map((p) => p.id);
  const salesAgg =
    productIds.length > 0
      ? await prisma.transactionItem.groupBy({
          by: ["productId"],
          where: {
            productId: { in: productIds },
            createdAt: { gte: thirtyDaysAgo },
            transaction: { status: "COMPLETED" },
          },
          _sum: { quantity: true },
        })
      : [];

  const salesMap = new Map(
    salesAgg.map((s) => [s.productId, s._sum.quantity || 0]),
  );

  const results = lowStockProducts.map((p) => {
    const totalSold = salesMap.get(p.id) || 0;
    const avgDailySales = totalSold / 30;
    const daysUntilOut =
      avgDailySales > 0
        ? Math.round(p.stock / avgDailySales)
        : p.stock > 0
          ? 999
          : 0;
    const recommendedQty = Math.max(p.minStock * 2 - p.stock, 0);

    return {
      product: p.name,
      code: p.code,
      currentStock: p.stock,
      minStock: p.minStock,
      avgDailySales: Math.round(avgDailySales * 100) / 100,
      daysUntilOut,
      recommendedQty,
      supplier: p.supplierName || "-",
    };
  });

  return results.sort((a, b) => a.daysUntilOut - b.daysUntilOut);
}

// Cashier performance
export async function getCashierPerformance(_branchId?: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return prisma.$queryRawUnsafe<
    {
      name: string;
      transactions: number;
      revenue: number;
      avgTransaction: number;
    }[]
  >(
    `
    SELECT u.name,
           COUNT(t.id)::int AS transactions,
           COALESCE(SUM(t."grandTotal"), 0)::float AS revenue,
           COALESCE(AVG(t."grandTotal"), 0)::float AS "avgTransaction"
    FROM transactions t
    JOIN users u ON u.id = t."userId"
    WHERE t.status = 'COMPLETED' AND t."createdAt" >= $1
    GROUP BY u.id, u.name
    ORDER BY revenue DESC
    `,
    thirtyDaysAgo,
  );
}
