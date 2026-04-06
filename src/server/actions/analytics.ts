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
export async function getSlowMoving(_branchId?: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sales = await prisma.transactionItem.groupBy({
    by: ["productId"],
    where: { createdAt: { gte: thirtyDaysAgo } },
    _sum: { quantity: true },
  });

  const slowIds = sales
    .filter((s) => (s._sum.quantity || 0) < 5)
    .map((s) => s.productId);

  if (slowIds.length === 0) return [];

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

  return products.map((p: (typeof products)[number]) => {
    const sale = sales.find((s) => s.productId === p.id);
    return { ...p, soldQty: sale?._sum.quantity || 0 };
  });
}

// Peak hours analysis
export async function getPeakHours(_branchId?: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await prisma.$queryRawUnsafe<{ h: number; count: bigint; revenue: bigint }[]>(`
    SELECT EXTRACT(HOUR FROM "createdAt")::int as h,
           COUNT(*)::bigint as count,
           COALESCE(SUM("grandTotal"), 0) as revenue
    FROM transactions
    WHERE status = 'COMPLETED' AND "createdAt" >= $1
    GROUP BY EXTRACT(HOUR FROM "createdAt")
    ORDER BY h
  `, thirtyDaysAgo);

  const hourMap = new Map(rows.map(r => [r.h, { count: Number(r.count), revenue: Number(r.revenue) }]));

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

  const voidsByUser = await prisma.transaction.groupBy({
    by: ["userId"],
    where: { status: "VOIDED", createdAt: { gte: sevenDaysAgo } },
    _count: true,
  });

  const userIds = voidsByUser.map((v) => v.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, role: true },
  });

  return voidsByUser
    .map((v) => {
      const user = users.find((u) => u.id === v.userId);
      return {
        userName: user?.name || "Unknown",
        role: user?.role || "",
        voidCount: v._count,
        suspicious: v._count > 5,
      };
    })
    .sort((a, b) => b.voidCount - a.voidCount);
}

// Daily profit (last 30 days)
export async function getDailyProfit(_branchId?: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await prisma.$queryRawUnsafe<{ d: Date; revenue: bigint; cost: bigint }[]>(`
    SELECT DATE_TRUNC('day', t."createdAt") as d,
           COALESCE(SUM(t."grandTotal"), 0) as revenue,
           COALESCE(SUM(ti.quantity * p."purchasePrice"), 0) as cost
    FROM transactions t
    JOIN transaction_items ti ON ti."transactionId" = t.id
    JOIN products p ON p.id = ti."productId"
    WHERE t.status = 'COMPLETED' AND t."createdAt" >= $1
    GROUP BY DATE_TRUNC('day', t."createdAt")
    ORDER BY d ASC
  `, thirtyDaysAgo);

  return rows.map(r => ({
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

  const results = await Promise.all(
    shifts.map(async (shift) => {
      const txAgg = await prisma.transaction.aggregate({
        where: {
          status: "COMPLETED",
          userId: shift.userId,
          createdAt: { gte: shift.openedAt, lte: shift.closedAt! },
        },
        _sum: { grandTotal: true },
        _count: true,
      });
      return {
        shiftId: shift.id,
        cashier: shift.user.name,
        openedAt: shift.openedAt.toISOString(),
        closedAt: shift.closedAt!.toISOString(),
        revenue: txAgg._sum.grandTotal || 0,
        transactions: txAgg._count,
      };
    }),
  );

  return results;
}

// Supplier ranking
export async function getSupplierRanking(_branchId?: string) {
  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    include: {
      products: { select: { id: true } },
      purchaseOrders: {
        select: { totalAmount: true },
      },
    },
  });

  return suppliers
    .map((s) => ({
      name: s.name,
      productCount: s.products.length,
      totalPOValue: s.purchaseOrders.reduce(
        (sum, po) => sum + po.totalAmount,
        0,
      ),
      poCount: s.purchaseOrders.length,
    }))
    .sort((a, b) => b.totalPOValue - a.totalPOValue);
}

// Supplier debt tracking
export async function getSupplierDebt(_branchId?: string) {
  const rows = await prisma.$queryRawUnsafe<{ name: string; totalPO: bigint; totalPaid: bigint }[]>(`
    SELECT s.name,
           COALESCE((SELECT SUM(po."totalAmount") FROM purchase_orders po WHERE po."supplierId" = s.id AND po.status = 'RECEIVED'), 0) as "totalPO",
           COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp."supplierId" = s.id), 0) as "totalPaid"
    FROM suppliers s
    WHERE s."isActive" = true
    ORDER BY s.name
  `);

  return rows
    .map(r => ({
      supplierName: r.name,
      totalPO: Number(r.totalPO),
      totalPaid: Number(r.totalPaid),
      debt: Number(r.totalPO) - Number(r.totalPaid),
    }))
    .filter(s => s.totalPO > 0)
    .sort((a, b) => b.debt - a.debt);
}

// Unusual discount detection
export async function getUnusualDiscounts(_branchId?: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: sevenDaysAgo },
      status: "COMPLETED",
      discountAmount: { gt: 0 },
    },
    include: {
      user: { select: { name: true, role: true } },
    },
    orderBy: { discountAmount: "desc" },
  });

  return transactions
    .filter(
      (tx) => tx.subtotal > 0 && (tx.discountAmount / tx.subtotal) * 100 > 20,
    )
    .map((tx) => ({
      invoiceNumber: tx.invoiceNumber,
      cashier: tx.user.name,
      role: tx.user.role,
      subtotal: tx.subtotal,
      discountAmount: tx.discountAmount,
      discountPercent: (tx.discountAmount / tx.subtotal) * 100,
      grandTotal: tx.grandTotal,
      createdAt: tx.createdAt.toISOString(),
    }));
}

// Promo effectiveness report
export async function getPromoEffectiveness(_branchId?: string) {
  const promotions = await prisma.promotion.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Single query: get all COMPLETED transactions that have promoApplied set
  const promoTransactions = await prisma.transaction.findMany({
    where: {
      status: "COMPLETED",
      promoApplied: { not: null },
    },
    select: { promoApplied: true, discountAmount: true },
  });

  const results = promotions.map((promo) => {
    let usageCount = 0;
    let totalDiscount = 0;
    for (const tx of promoTransactions) {
      if (tx.promoApplied?.includes(promo.name) || (promo.voucherCode && tx.promoApplied?.includes(promo.voucherCode))) {
        usageCount++;
        totalDiscount += tx.discountAmount;
      }
    }
    return {
      promoName: promo.name,
      type: promo.type,
      usageCount: Math.max(usageCount, promo.usageCount),
      totalDiscount,
      isActive: promo.isActive && new Date(promo.endDate) >= new Date(),
    };
  });

  return results.sort((a, b) => b.usageCount - a.usageCount);
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
  const productIds = lowStockProducts.map(p => p.id);
  const salesAgg = productIds.length > 0 ? await prisma.transactionItem.groupBy({
    by: ["productId"],
    where: {
      productId: { in: productIds },
      createdAt: { gte: thirtyDaysAgo },
      transaction: { status: "COMPLETED" },
    },
    _sum: { quantity: true },
  }) : [];

  const salesMap = new Map(salesAgg.map(s => [s.productId, s._sum.quantity || 0]));

  const results = lowStockProducts.map((p) => {
    const totalSold = salesMap.get(p.id) || 0;
    const avgDailySales = totalSold / 30;
    const daysUntilOut = avgDailySales > 0 ? Math.round(p.stock / avgDailySales) : p.stock > 0 ? 999 : 0;
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const performance = await prisma.transaction.groupBy({
    by: ["userId"],
    where: { status: "COMPLETED", createdAt: { gte: thirtyDaysAgo } },
    _count: true,
    _sum: { grandTotal: true },
  });

  const userIds = performance.map(
    (p: (typeof performance)[number]) => p.userId,
  );
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });

  return performance
    .map((p: (typeof performance)[number]) => {
      const user = users.find((u) => u.id === p.userId);
      return {
        name: user?.name || "Unknown",
        transactions: p._count,
        revenue: p._sum.grandTotal || 0,
        avgTransaction: p._count > 0 ? (p._sum.grandTotal || 0) / p._count : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}
