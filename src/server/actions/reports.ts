"use server";

import { prisma } from "@/lib/prisma";

function buildTransactionDateWhere(dateFrom?: string, dateTo?: string) {
  const createdAt: Record<string, Date> = {};
  if (dateFrom) createdAt.gte = new Date(dateFrom);
  if (dateTo) {
    const to = new Date(dateTo);
    to.setDate(to.getDate() + 1);
    createdAt.lt = to;
  }
  return Object.keys(createdAt).length > 0 ? { createdAt } : {};
}

export async function getSalesReport(
  period: "daily" | "monthly" = "daily",
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const now = new Date();
  const results = [];

  const branchCondition = branchId ? `AND "branchId" = '${branchId}'` : "";

  if (period === "daily") {
    const startDate = dateFrom
      ? new Date(dateFrom)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);
    const endDate = dateTo ? new Date(dateTo) : now;
    const endNext = new Date(endDate);
    endNext.setDate(endNext.getDate() + 1);
    endNext.setHours(0, 0, 0, 0);

    const rows = await prisma.$queryRawUnsafe<{ d: Date; sales: bigint; discount: bigint; tax: bigint; count: bigint }[]>(`
      SELECT DATE_TRUNC('day', "createdAt") as d,
             COALESCE(SUM("grandTotal"), 0) as sales,
             COALESCE(SUM("discountAmount"), 0) as discount,
             COALESCE(SUM("taxAmount"), 0) as tax,
             COUNT(*)::bigint as count
      FROM transactions
      WHERE "createdAt" >= $1 AND "createdAt" < $2
        AND "status" = 'COMPLETED'
        ${branchCondition}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY d ASC
    `, startDate, endNext);

    const salesMap = new Map<string, { sales: number; discount: number; tax: number; count: number }>();
    for (const row of rows) {
      const key = new Date(row.d).toISOString().slice(0, 10);
      salesMap.set(key, { sales: Number(row.sales), discount: Number(row.discount), tax: Number(row.tax), count: Number(row.count) });
    }

    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString().slice(0, 10);
      const data = salesMap.get(key) || { sales: 0, discount: 0, tax: 0, count: 0 };
      results.push({
        label: date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        sales: data.sales,
        discount: data.discount,
        tax: data.tax,
        transactions: data.count,
      });
    }
  } else {
    const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const rows = await prisma.$queryRawUnsafe<{ y: number; m: number; sales: bigint; discount: bigint; tax: bigint; count: bigint }[]>(`
      SELECT EXTRACT(YEAR FROM "createdAt")::int as y,
             EXTRACT(MONTH FROM "createdAt")::int as m,
             COALESCE(SUM("grandTotal"), 0) as sales,
             COALESCE(SUM("discountAmount"), 0) as discount,
             COALESCE(SUM("taxAmount"), 0) as tax,
             COUNT(*)::bigint as count
      FROM transactions
      WHERE "createdAt" >= $1 AND "createdAt" < $2
        AND "status" = 'COMPLETED'
        ${branchCondition}
      GROUP BY EXTRACT(YEAR FROM "createdAt"), EXTRACT(MONTH FROM "createdAt")
      ORDER BY y, m
    `, startMonth, endMonth);

    const salesMap = new Map<string, { sales: number; discount: number; tax: number; count: number }>();
    for (const row of rows) {
      salesMap.set(`${row.y}-${row.m}`, { sales: Number(row.sales), discount: Number(row.discount), tax: Number(row.tax), count: Number(row.count) });
    }

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const data = salesMap.get(key) || { sales: 0, discount: 0, tax: 0, count: 0 };
      results.push({
        label: date.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
        sales: data.sales,
        discount: data.discount,
        tax: data.tax,
        transactions: data.count,
      });
    }
  }

  return results;
}

export async function getTopProductsReport(
  limit: number = 10,
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const items = await prisma.transactionItem.groupBy({
    by: ["productName", "productCode"],
    where: {
      transaction: {
        status: "COMPLETED",
        ...(branchId ? { branchId } : {}),
        ...buildTransactionDateWhere(dateFrom, dateTo),
      },
    },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  return items;
}

export async function getProfitLossReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const now = new Date();
  const monthStart = dateFrom
    ? new Date(dateFrom)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = dateTo
    ? (() => {
        const d = new Date(dateTo);
        d.setDate(d.getDate() + 1);
        return d;
      })()
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const branchCondition = branchId ? `AND t."branchId" = '${branchId}'` : "";

  const [totals, costResult] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        createdAt: { gte: monthStart, lt: monthEnd },
        status: "COMPLETED",
        ...(branchId ? { branchId } : {}),
      },
      _sum: { grandTotal: true, discountAmount: true, taxAmount: true },
      _count: true,
    }),
    prisma.$queryRawUnsafe<{ cost: bigint }[]>(`
      SELECT COALESCE(SUM(ti.quantity * p."purchasePrice"), 0) as cost
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti."transactionId"
      JOIN products p ON p.id = ti."productId"
      WHERE t."createdAt" >= $1 AND t."createdAt" < $2
        AND t.status = 'COMPLETED'
        ${branchCondition}
    `, monthStart, monthEnd),
  ]);

  const totalRevenue = totals._sum.grandTotal || 0;
  const totalDiscount = totals._sum.discountAmount || 0;
  const totalTax = totals._sum.taxAmount || 0;
  const totalCost = Number(costResult[0]?.cost || 0);

  const periodLabel =
    dateFrom && dateTo
      ? `${new Date(dateFrom).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} - ${new Date(dateTo).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}`
      : `${monthStart.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`;

  return {
    revenue: totalRevenue,
    cost: totalCost,
    grossProfit: totalRevenue - totalCost,
    discount: totalDiscount,
    tax: totalTax,
    netProfit: totalRevenue - totalCost - totalTax,
    transactionCount: totals._count,
    period: periodLabel,
  };
}

export async function getPaymentMethodReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const grouped = await prisma.transaction.groupBy({
    by: ["paymentMethod"],
    where: {
      status: "COMPLETED",
      ...(branchId ? { branchId } : {}),
      ...buildTransactionDateWhere(dateFrom, dateTo),
    },
    _sum: { grandTotal: true },
    _count: true,
    orderBy: { _sum: { grandTotal: "desc" } },
  });

  return grouped.map((item) => ({
    method: item.paymentMethod,
    total: item._sum.grandTotal || 0,
    transactions: item._count,
  }));
}

export async function getHourlySalesReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const now = new Date();
  const start = dateFrom
    ? new Date(dateFrom)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const end = dateTo ? new Date(dateTo) : new Date();
  end.setHours(23, 59, 59, 999);

  const transactions = await prisma.transaction.findMany({
    where: {
      status: "COMPLETED",
      ...(branchId ? { branchId } : {}),
      createdAt: { gte: start, lte: end },
    },
    select: { createdAt: true, grandTotal: true },
  });

  const bucket: Record<number, { total: number; transactions: number }> = {};
  for (let hour = 0; hour < 24; hour += 1) {
    bucket[hour] = { total: 0, transactions: 0 };
  }
  transactions.forEach((tx) => {
    const hour = new Date(tx.createdAt).getHours();
    if (!bucket[hour]) return;
    bucket[hour].total += tx.grandTotal;
    bucket[hour].transactions += 1;
  });

  return Object.entries(bucket).map(([hour, value]) => ({
    hour: `${hour.toString().padStart(2, "0")}:00`,
    total: value.total,
    transactions: value.transactions,
  }));
}

export async function getCategorySalesReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const where: Record<string, unknown> = {
    transaction: { status: "COMPLETED" },
  };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom)
      (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1);
      (where.createdAt as Record<string, unknown>).lt = to;
    }
  }
  if (branchId)
    where.transaction = { ...(where.transaction as object), branchId };

  const items = await prisma.transactionItem.findMany({
    where,
    select: {
      quantity: true,
      unitPrice: true,
      subtotal: true,
      product: {
        select: {
          id: true,
          name: true,
          categoryId: true,
          category: { select: { id: true, name: true } },
          purchasePrice: true,
        },
      },
    },
  });

  const categoryMap = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      totalQuantity: number;
      totalRevenue: number;
      totalCost: number;
      profit: number;
      transactionCount: number;
      products: Map<string, { name: string; quantity: number; revenue: number }>;
    }
  >();

  for (const item of items) {
    const catId = item.product.categoryId;
    const catName = item.product.category?.name || "Tanpa Kategori";

    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        categoryId: catId,
        categoryName: catName,
        totalQuantity: 0,
        totalRevenue: 0,
        totalCost: 0,
        profit: 0,
        transactionCount: 0,
        products: new Map(),
      });
    }
    const cat = categoryMap.get(catId)!;
    cat.totalQuantity += item.quantity;
    cat.totalRevenue += item.subtotal;
    cat.totalCost += item.product.purchasePrice * item.quantity;
    cat.transactionCount += 1;

    const prodKey = item.product.id;
    if (!cat.products.has(prodKey)) {
      cat.products.set(prodKey, {
        name: item.product.name,
        quantity: 0,
        revenue: 0,
      });
    }
    const prod = cat.products.get(prodKey)!;
    prod.quantity += item.quantity;
    prod.revenue += item.subtotal;
  }

  return Array.from(categoryMap.values())
    .map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      totalQuantity: cat.totalQuantity,
      totalRevenue: cat.totalRevenue,
      totalCost: cat.totalCost,
      profit: cat.totalRevenue - cat.totalCost,
      transactionCount: cat.transactionCount,
      topProducts: Array.from(cat.products.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export async function getSupplierSalesReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const where: Record<string, unknown> = {
    transaction: { status: "COMPLETED" },
  };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom)
      (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1);
      (where.createdAt as Record<string, unknown>).lt = to;
    }
  }
  if (branchId)
    where.transaction = { ...(where.transaction as object), branchId };

  const items = await prisma.transactionItem.findMany({
    where,
    select: {
      quantity: true,
      unitPrice: true,
      subtotal: true,
      product: {
        select: {
          id: true,
          name: true,
          supplierId: true,
          supplier: { select: { id: true, name: true } },
          purchasePrice: true,
        },
      },
    },
  });

  const supplierMap = new Map<
    string,
    {
      supplierId: string | null;
      supplierName: string;
      totalQuantity: number;
      totalRevenue: number;
      totalCost: number;
      profit: number;
      products: Map<string, { name: string; quantity: number; revenue: number }>;
    }
  >();

  const NO_SUPPLIER_KEY = "__no_supplier__";

  for (const item of items) {
    const supId = item.product.supplierId;
    const supName = item.product.supplier?.name || "Tanpa Supplier";
    const mapKey = supId || NO_SUPPLIER_KEY;

    if (!supplierMap.has(mapKey)) {
      supplierMap.set(mapKey, {
        supplierId: supId,
        supplierName: supName,
        totalQuantity: 0,
        totalRevenue: 0,
        totalCost: 0,
        profit: 0,
        products: new Map(),
      });
    }
    const sup = supplierMap.get(mapKey)!;
    sup.totalQuantity += item.quantity;
    sup.totalRevenue += item.subtotal;
    sup.totalCost += item.product.purchasePrice * item.quantity;

    const prodKey = item.product.id;
    if (!sup.products.has(prodKey)) {
      sup.products.set(prodKey, {
        name: item.product.name,
        quantity: 0,
        revenue: 0,
      });
    }
    const prod = sup.products.get(prodKey)!;
    prod.quantity += item.quantity;
    prod.revenue += item.subtotal;
  }

  return Array.from(supplierMap.values())
    .map((sup) => ({
      supplierId: sup.supplierId,
      supplierName: sup.supplierName,
      totalQuantity: sup.totalQuantity,
      totalRevenue: sup.totalRevenue,
      totalCost: sup.totalCost,
      profit: sup.totalRevenue - sup.totalCost,
      productCount: sup.products.size,
      topProducts: Array.from(sup.products.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export async function getReportOverview(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const where = {
    status: "COMPLETED" as const,
    ...(branchId ? { branchId } : {}),
    ...buildTransactionDateWhere(dateFrom, dateTo),
  };

  const [totals, topCashiersRaw, itemRows] = await Promise.all([
    prisma.transaction.aggregate({
      where,
      _sum: { grandTotal: true, discountAmount: true, taxAmount: true },
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ["userId"],
      where,
      _sum: { grandTotal: true },
      _count: true,
      orderBy: { _sum: { grandTotal: "desc" } },
      take: 5,
    }),
    prisma.transactionItem.findMany({
      where: { transaction: where },
      select: {
        quantity: true,
        subtotal: true,
        product: { select: { category: { select: { name: true } } } },
      },
    }),
  ]);

  const users = await prisma.user.findMany({
    where: { id: { in: topCashiersRaw.map((item) => item.userId) } },
    select: { id: true, name: true },
  });

  const totalItemsSold = itemRows.reduce((sum, row) => sum + row.quantity, 0);
  const categoryMap = new Map<string, { total: number; quantity: number }>();
  itemRows.forEach((row) => {
    const categoryName = row.product.category.name;
    const current = categoryMap.get(categoryName) ?? { total: 0, quantity: 0 };
    current.total += row.subtotal;
    current.quantity += row.quantity;
    categoryMap.set(categoryName, current);
  });

  return {
    revenue: totals._sum.grandTotal || 0,
    transactions: totals._count,
    totalItemsSold,
    averageTicket:
      totals._count > 0 ? (totals._sum.grandTotal || 0) / totals._count : 0,
    totalDiscount: totals._sum.discountAmount || 0,
    totalTax: totals._sum.taxAmount || 0,
    topCashiers: topCashiersRaw.map((item) => ({
      userId: item.userId,
      name: users.find((user) => user.id === item.userId)?.name || "Unknown",
      transactions: item._count,
      revenue: item._sum.grandTotal || 0,
    })),
    categorySales: Array.from(categoryMap.entries())
      .map(([category, value]) => ({
        category,
        total: value.total,
        quantity: value.quantity,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
  };
}

// ===========================
// CASHIER SALES REPORT
// ===========================

export async function getCashierSalesReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string
) {
  const where: Record<string, unknown> = { status: "COMPLETED" };
  const dateFilter = buildTransactionDateWhere(dateFrom, dateTo);
  if (dateFilter) where.createdAt = dateFilter;
  if (branchId) where.branchId = branchId;

  const items = await prisma.transactionItem.findMany({
    where: { transaction: where },
    select: {
      quantity: true,
      subtotal: true,
      discount: true,
      product: { select: { purchasePrice: true } },
      transaction: { select: { userId: true } },
    },
  });

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      userId: true,
      grandTotal: true,
      discountAmount: true,
      createdAt: true,
    },
  });

  const userIds = [...new Set(transactions.map((t) => t.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, role: true },
  });

  const cashierMap = new Map<string, {
    userId: string;
    name: string;
    email: string;
    role: string;
    totalRevenue: number;
    totalCost: number;
    profit: number;
    totalDiscount: number;
    transactionCount: number;
    itemsSold: number;
    averageTicket: number;
    topProducts: Map<string, { name: string; quantity: number; revenue: number }>;
  }>();

  // Init cashier map from users
  for (const user of users) {
    cashierMap.set(user.id, {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      totalRevenue: 0,
      totalCost: 0,
      profit: 0,
      totalDiscount: 0,
      transactionCount: 0,
      itemsSold: 0,
      averageTicket: 0,
      topProducts: new Map(),
    });
  }

  // Aggregate transactions
  for (const tx of transactions) {
    const c = cashierMap.get(tx.userId);
    if (!c) continue;
    c.totalRevenue += tx.grandTotal;
    c.totalDiscount += tx.discountAmount;
    c.transactionCount += 1;
  }

  // Aggregate items
  for (const item of items) {
    const c = cashierMap.get(item.transaction.userId);
    if (!c) continue;
    c.itemsSold += item.quantity;
    c.totalCost += item.product.purchasePrice * item.quantity;
  }

  return Array.from(cashierMap.values())
    .map((c) => ({
      userId: c.userId,
      name: c.name,
      email: c.email,
      role: c.role,
      totalRevenue: c.totalRevenue,
      totalCost: c.totalCost,
      profit: c.totalRevenue - c.totalCost,
      totalDiscount: c.totalDiscount,
      transactionCount: c.transactionCount,
      itemsSold: c.itemsSold,
      averageTicket: c.transactionCount > 0 ? Math.round(c.totalRevenue / c.transactionCount) : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}
