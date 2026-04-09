"use server";

import { prisma } from "@/lib/prisma";
import { redisGetJson, redisSetJson } from "@/lib/redis";

const REPORTS_REDIS_TTL_SECONDS = 60;

function reportCacheKey(
  reportName: string,
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  return `reports:${reportName}:${dateFrom || "all"}:${dateTo || "all"}:${branchId || "all"}`;
}

type SupplierTopProduct = {
  name: string;
  quantity: number;
  revenue: number;
};

type SupplierSalesItem = {
  supplierId: string | null;
  supplierName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  productCount: number;
  profit: number;
  topProducts: SupplierTopProduct[];
};

type ReportOverview = {
  revenue: number;
  transactions: number;
  totalItemsSold: number;
  averageTicket: number;
  totalDiscount: number;
  totalTax: number;
  topCashiers: {
    userId: string;
    name: string;
    transactions: number;
    revenue: number;
  }[];
  categorySales: {
    category: string;
    total: number;
    quantity: number;
  }[];
};

type CashierSalesItem = {
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
};

type SalesReportPoint = {
  label: string;
  sales: number;
  discount: number;
  tax: number;
  transactions: number;
};

type TopProductsReportItem = {
  productName: string;
  productCode: string;
  _sum: {
    quantity: number | null;
    subtotal: number | null;
  };
};

type ProfitLossReport = {
  revenue: number;
  cost: number;
  grossProfit: number;
  discount: number;
  tax: number;
  netProfit: number;
  transactionCount: number;
  period: string;
};

type PaymentMethodReportItem = {
  method: string;
  total: number;
  transactions: number;
};

type HourlySalesReportItem = {
  hour: string;
  total: number;
  transactions: number;
};

type CategoryTopProduct = {
  name: string;
  quantity: number;
  revenue: number;
};

type CategorySalesReportItem = {
  categoryId: string;
  categoryName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  transactionCount: number;
  profit: number;
  topProducts: CategoryTopProduct[];
};

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
  const cacheKey = reportCacheKey(
    `sales-${period}`,
    dateFrom,
    dateTo,
    branchId,
  );
  const cached = await redisGetJson<SalesReportPoint[]>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const results: SalesReportPoint[] = [];

  if (period === "daily") {
    const startDate = dateFrom
      ? new Date(dateFrom)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);
    const endDate = dateTo ? new Date(dateTo) : now;
    const endNext = new Date(endDate);
    endNext.setDate(endNext.getDate() + 1);
    endNext.setHours(0, 0, 0, 0);

    const queryParams: unknown[] = [startDate, endNext];
    let branchCondition = "";
    if (branchId) {
      queryParams.push(branchId);
      branchCondition = `AND "branchId" = $${queryParams.length}`;
    }

    const rows = await prisma.$queryRawUnsafe<
      { d: Date; sales: bigint; discount: bigint; tax: bigint; count: bigint }[]
    >(
      `
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
    `,
      ...queryParams,
    );

    const salesMap = new Map<
      string,
      { sales: number; discount: number; tax: number; count: number }
    >();
    for (const row of rows) {
      const key = new Date(row.d).toISOString().slice(0, 10);
      salesMap.set(key, {
        sales: Number(row.sales),
        discount: Number(row.discount),
        tax: Number(row.tax),
        count: Number(row.count),
      });
    }

    const days =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString().slice(0, 10);
      const data = salesMap.get(key) || {
        sales: 0,
        discount: 0,
        tax: 0,
        count: 0,
      };
      results.push({
        label: date.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
        }),
        sales: data.sales,
        discount: data.discount,
        tax: data.tax,
        transactions: data.count,
      });
    }
  } else {
    const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const monthParams: unknown[] = [startMonth, endMonth];
    let monthBranchCondition = "";
    if (branchId) {
      monthParams.push(branchId);
      monthBranchCondition = `AND "branchId" = $${monthParams.length}`;
    }

    const rows = await prisma.$queryRawUnsafe<
      {
        y: number;
        m: number;
        sales: bigint;
        discount: bigint;
        tax: bigint;
        count: bigint;
      }[]
    >(
      `
      SELECT EXTRACT(YEAR FROM "createdAt")::int as y,
             EXTRACT(MONTH FROM "createdAt")::int as m,
             COALESCE(SUM("grandTotal"), 0) as sales,
             COALESCE(SUM("discountAmount"), 0) as discount,
             COALESCE(SUM("taxAmount"), 0) as tax,
             COUNT(*)::bigint as count
      FROM transactions
      WHERE "createdAt" >= $1 AND "createdAt" < $2
        AND "status" = 'COMPLETED'
        ${monthBranchCondition}
      GROUP BY EXTRACT(YEAR FROM "createdAt"), EXTRACT(MONTH FROM "createdAt")
      ORDER BY y, m
    `,
      ...monthParams,
    );

    const salesMap = new Map<
      string,
      { sales: number; discount: number; tax: number; count: number }
    >();
    for (const row of rows) {
      salesMap.set(`${row.y}-${row.m}`, {
        sales: Number(row.sales),
        discount: Number(row.discount),
        tax: Number(row.tax),
        count: Number(row.count),
      });
    }

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const data = salesMap.get(key) || {
        sales: 0,
        discount: 0,
        tax: 0,
        count: 0,
      };
      results.push({
        label: date.toLocaleDateString("id-ID", {
          month: "short",
          year: "2-digit",
        }),
        sales: data.sales,
        discount: data.discount,
        tax: data.tax,
        transactions: data.count,
      });
    }
  }

  await redisSetJson(cacheKey, results, REPORTS_REDIS_TTL_SECONDS);
  return results;
}

export async function getTopProductsReport(
  limit: number = 10,
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const cacheKey = reportCacheKey(
    `top-products-${limit}`,
    dateFrom,
    dateTo,
    branchId,
  );
  const cached = await redisGetJson<TopProductsReportItem[]>(cacheKey);
  if (cached) return cached;

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

  await redisSetJson(
    cacheKey,
    items as unknown as Record<string, unknown>[],
    REPORTS_REDIS_TTL_SECONDS,
  );
  return items;
}

export async function getProfitLossReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const cacheKey = reportCacheKey("profit-loss", dateFrom, dateTo, branchId);
  const cached = await redisGetJson<ProfitLossReport>(cacheKey);
  if (cached) return cached;

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

  const costParams: unknown[] = [monthStart, monthEnd];
  let costBranchCondition = "";
  if (branchId) {
    costParams.push(branchId);
    costBranchCondition = `AND t."branchId" = $${costParams.length}`;
  }

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
    prisma.$queryRawUnsafe<{ cost: bigint }[]>(
      `
      SELECT COALESCE(SUM(ti.quantity * p."purchasePrice"), 0) as cost
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti."transactionId"
      JOIN products p ON p.id = ti."productId"
      WHERE t."createdAt" >= $1 AND t."createdAt" < $2
        AND t.status = 'COMPLETED'
        ${costBranchCondition}
    `,
      ...costParams,
    ),
  ]);

  const totalRevenue = totals._sum.grandTotal || 0;
  const totalDiscount = totals._sum.discountAmount || 0;
  const totalTax = totals._sum.taxAmount || 0;
  const totalCost = Number(costResult[0]?.cost || 0);

  const periodLabel =
    dateFrom && dateTo
      ? `${new Date(dateFrom).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} - ${new Date(dateTo).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}`
      : `${monthStart.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`;

  const result: ProfitLossReport = {
    revenue: totalRevenue,
    cost: totalCost,
    grossProfit: totalRevenue - totalCost,
    discount: totalDiscount,
    tax: totalTax,
    netProfit: totalRevenue - totalCost - totalTax,
    transactionCount: totals._count,
    period: periodLabel,
  };
  await redisSetJson(cacheKey, result, REPORTS_REDIS_TTL_SECONDS);
  return result;
}

export async function getPaymentMethodReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const cacheKey = reportCacheKey("payment-method", dateFrom, dateTo, branchId);
  const cached = await redisGetJson<PaymentMethodReportItem[]>(cacheKey);
  if (cached) return cached;

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

  const result = grouped.map((item) => ({
    method: item.paymentMethod,
    total: item._sum.grandTotal || 0,
    transactions: item._count,
  }));
  await redisSetJson(cacheKey, result, REPORTS_REDIS_TTL_SECONDS);
  return result;
}

export async function getHourlySalesReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const cacheKey = reportCacheKey("hourly-sales", dateFrom, dateTo, branchId);
  const cached = await redisGetJson<HourlySalesReportItem[]>(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const start = dateFrom
    ? new Date(dateFrom)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const end = dateTo ? new Date(dateTo) : new Date();
  end.setHours(23, 59, 59, 999);

  const params: unknown[] = [start, end];
  const branchCond = branchId
    ? `AND "branchId" = $${params.push(branchId)}`
    : "";

  const rows = await prisma.$queryRawUnsafe<
    { h: number; total: bigint; count: bigint }[]
  >(
    `
      SELECT EXTRACT(HOUR FROM "createdAt")::int AS h,
             COALESCE(SUM("grandTotal"), 0) AS total,
             COUNT(*)::bigint AS count
      FROM transactions
      WHERE status = 'COMPLETED'
        AND "createdAt" >= $1 AND "createdAt" <= $2
        ${branchCond}
      GROUP BY EXTRACT(HOUR FROM "createdAt")
      ORDER BY h
      `,
    ...params,
  );

  const hourMap = new Map(
    rows.map((r) => [
      r.h,
      { total: Number(r.total), transactions: Number(r.count) },
    ]),
  );

  const result = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    ...(hourMap.get(h) ?? { total: 0, transactions: 0 }),
  }));
  await redisSetJson(cacheKey, result, REPORTS_REDIS_TTL_SECONDS);
  return result;
}

export async function getCategorySalesReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
) {
  const cacheKey = reportCacheKey("category-sales", dateFrom, dateTo, branchId);
  const cached = await redisGetJson<CategorySalesReportItem[]>(cacheKey);
  if (cached) return cached;

  const params: unknown[] = [];
  const conditions: string[] = ["t.status = 'COMPLETED'"];

  if (dateFrom)
    conditions.push(`t."createdAt" >= $${params.push(new Date(dateFrom))}`);
  if (dateTo) {
    const to = new Date(dateTo);
    to.setDate(to.getDate() + 1);
    conditions.push(`t."createdAt" < $${params.push(to)}`);
  }
  if (branchId) conditions.push(`t."branchId" = $${params.push(branchId)}`);

  const where = conditions.join(" AND ");

  // Agregasi utama per kategori
  const rows = await prisma.$queryRawUnsafe<
    {
      categoryId: string;
      categoryName: string;
      totalQuantity: number;
      totalRevenue: number;
      totalCost: number;
      transactionCount: number;
    }[]
  >(
    `
      SELECT
        COALESCE(c.id, 'no-cat') AS "categoryId",
        COALESCE(c.name, 'Tanpa Kategori') AS "categoryName",
        SUM(ti.quantity)::int AS "totalQuantity",
        COALESCE(SUM(ti.subtotal), 0)::float AS "totalRevenue",
        COALESCE(SUM(ti.quantity * p."purchasePrice"), 0)::float AS "totalCost",
        COUNT(DISTINCT t.id)::int AS "transactionCount"
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti."transactionId"
      JOIN products p ON p.id = ti."productId"
      LEFT JOIN categories c ON c.id = p."categoryId"
      WHERE ${where}
      GROUP BY c.id, c.name
      ORDER BY "totalRevenue" DESC
      `,
    ...params,
  );

  // Top 5 products per kategori — satu query, bukan N queries
  const topRows = await prisma.$queryRawUnsafe<
    {
      categoryId: string;
      productName: string;
      quantity: number;
      revenue: number;
      rn: number;
    }[]
  >(
    `
      SELECT * FROM (
        SELECT
          COALESCE(c.id, 'no-cat') AS "categoryId",
          p.name AS "productName",
          SUM(ti.quantity)::int AS quantity,
          COALESCE(SUM(ti.subtotal), 0)::float AS revenue,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(c.id, 'no-cat')
            ORDER BY SUM(ti.subtotal) DESC
          ) AS rn
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti."transactionId"
        JOIN products p ON p.id = ti."productId"
        LEFT JOIN categories c ON c.id = p."categoryId"
        WHERE ${where}
        GROUP BY c.id, p.id, p.name
      ) ranked
      WHERE rn <= 5
      `,
    ...params,
  );

  const topMap = new Map<
    string,
    { name: string; quantity: number; revenue: number }[]
  >();
  for (const r of topRows) {
    const list = topMap.get(r.categoryId) ?? [];
    list.push({
      name: r.productName,
      quantity: r.quantity,
      revenue: r.revenue,
    });
    topMap.set(r.categoryId, list);
  }

  const result = rows.map((cat) => ({
    ...cat,
    profit: cat.totalRevenue - cat.totalCost,
    topProducts: topMap.get(cat.categoryId) ?? [],
  }));
  await redisSetJson(cacheKey, result, REPORTS_REDIS_TTL_SECONDS);
  return result;
}

export async function getSupplierSalesReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
): Promise<SupplierSalesItem[]> {
  const cacheKey = reportCacheKey("supplier-sales", dateFrom, dateTo, branchId);
  const cached = await redisGetJson<SupplierSalesItem[]>(cacheKey);
  if (cached) return cached;

  const params: unknown[] = [];
  const conditions: string[] = ["t.status = 'COMPLETED'"];

  if (dateFrom)
    conditions.push(`t."createdAt" >= $${params.push(new Date(dateFrom))}`);
  if (dateTo) {
    const to = new Date(dateTo);
    to.setDate(to.getDate() + 1);
    conditions.push(`t."createdAt" < $${params.push(to)}`);
  }
  if (branchId) conditions.push(`t."branchId" = $${params.push(branchId)}`);

  const where = conditions.join(" AND ");

  const [rows, topRows] = await Promise.all([
    prisma.$queryRawUnsafe<
      {
        supplierId: string | null;
        supplierName: string;
        totalQuantity: number;
        totalRevenue: number;
        totalCost: number;
        productCount: number;
      }[]
    >(
      `
        SELECT
          s.id AS "supplierId",
          COALESCE(s.name, 'Tanpa Supplier') AS "supplierName",
          SUM(ti.quantity)::int AS "totalQuantity",
          COALESCE(SUM(ti.subtotal), 0)::float AS "totalRevenue",
          COALESCE(SUM(ti.quantity * p."purchasePrice"), 0)::float AS "totalCost",
          COUNT(DISTINCT p.id)::int AS "productCount"
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti."transactionId"
        JOIN products p ON p.id = ti."productId"
        LEFT JOIN suppliers s ON s.id = p."supplierId"
        WHERE ${where}
        GROUP BY s.id, s.name
        ORDER BY "totalRevenue" DESC
        `,
      ...params,
    ),
    prisma.$queryRawUnsafe<
      {
        supplierId: string | null;
        productName: string;
        quantity: number;
        revenue: number;
      }[]
    >(
      `
        SELECT * FROM (
          SELECT
            s.id AS "supplierId",
            p.name AS "productName",
            SUM(ti.quantity)::int AS quantity,
            COALESCE(SUM(ti.subtotal), 0)::float AS revenue,
            ROW_NUMBER() OVER (
              PARTITION BY s.id
              ORDER BY SUM(ti.subtotal) DESC
            ) AS rn
          FROM transaction_items ti
          JOIN transactions t ON t.id = ti."transactionId"
          JOIN products p ON p.id = ti."productId"
          LEFT JOIN suppliers s ON s.id = p."supplierId"
          WHERE ${where}
          GROUP BY s.id, p.id, p.name
        ) ranked WHERE rn <= 5
        `,
      ...params,
    ),
  ]);

  const topMap = new Map<
    string,
    { name: string; quantity: number; revenue: number }[]
  >();
  for (const r of topRows) {
    const key = r.supplierId ?? "null";
    const list = topMap.get(key) ?? [];
    list.push({
      name: r.productName,
      quantity: r.quantity,
      revenue: r.revenue,
    });
    topMap.set(key, list);
  }

  const result = rows.map((sup) => ({
    ...sup,
    profit: sup.totalRevenue - sup.totalCost,
    topProducts: topMap.get(sup.supplierId ?? "null") ?? [],
  }));
  await redisSetJson(cacheKey, result, REPORTS_REDIS_TTL_SECONDS);
  return result;
}

export async function getReportOverview(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
): Promise<ReportOverview> {
  const cacheKey = reportCacheKey("overview", dateFrom, dateTo, branchId);
  const cached = await redisGetJson<ReportOverview>(cacheKey);
  if (cached) return cached;

  const params: unknown[] = [];
  const conditions: string[] = ["t.status = 'COMPLETED'"];

  if (dateFrom)
    conditions.push(`t."createdAt" >= $${params.push(new Date(dateFrom))}`);
  if (dateTo) {
    const to = new Date(dateTo);
    to.setDate(to.getDate() + 1);
    conditions.push(`t."createdAt" < $${params.push(to)}`);
  }
  if (branchId) conditions.push(`t."branchId" = $${params.push(branchId)}`);

  const where = conditions.join(" AND ");

  const [totals, topCashiers, categoryRows, itemCount] = await Promise.all([
    // Agregasi utama transaksi
    prisma.$queryRawUnsafe<
      {
        revenue: number;
        discount: number;
        tax: number;
        txCount: number;
      }[]
    >(
      `
        SELECT
          COALESCE(SUM(t."grandTotal"), 0)::float AS revenue,
          COALESCE(SUM(t."discountAmount"), 0)::float AS discount,
          COALESCE(SUM(t."taxAmount"), 0)::float AS tax,
          COUNT(t.id)::int AS "txCount"
        FROM transactions t
        WHERE ${where}
        `,
      ...params,
    ),
    // Top 5 kasir langsung dengan JOIN ke users
    prisma.$queryRawUnsafe<
      {
        userId: string;
        name: string;
        transactions: number;
        revenue: number;
      }[]
    >(
      `
        SELECT
          u.id AS "userId", u.name,
          COUNT(t.id)::int AS transactions,
          COALESCE(SUM(t."grandTotal"), 0)::float AS revenue
        FROM transactions t
        JOIN users u ON u.id = t."userId"
        WHERE ${where}
        GROUP BY u.id, u.name
        ORDER BY revenue DESC
        LIMIT 5
        `,
      ...params,
    ),
    // Top 8 kategori dengan agregasi di DB
    prisma.$queryRawUnsafe<
      {
        category: string;
        total: number;
        quantity: number;
      }[]
    >(
      `
        SELECT
          COALESCE(c.name, 'Tanpa Kategori') AS category,
          COALESCE(SUM(ti.subtotal), 0)::float AS total,
          SUM(ti.quantity)::int AS quantity
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti."transactionId"
        JOIN products p ON p.id = ti."productId"
        LEFT JOIN categories c ON c.id = p."categoryId"
        WHERE ${where}
        GROUP BY c.name
        ORDER BY total DESC
        LIMIT 8
        `,
      ...params,
    ),
    // Total items sold
    prisma.$queryRawUnsafe<{ total: number }[]>(
      `
        SELECT COALESCE(SUM(ti.quantity), 0)::int AS total
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti."transactionId"
        WHERE ${where}
        `,
      ...params,
    ),
  ]);

  const agg = totals[0] ?? { revenue: 0, discount: 0, tax: 0, txCount: 0 };

  const result = {
    revenue: agg.revenue,
    transactions: agg.txCount,
    totalItemsSold: itemCount[0]?.total ?? 0,
    averageTicket: agg.txCount > 0 ? agg.revenue / agg.txCount : 0,
    totalDiscount: agg.discount,
    totalTax: agg.tax,
    topCashiers,
    categorySales: categoryRows,
  };
  await redisSetJson(cacheKey, result, REPORTS_REDIS_TTL_SECONDS);
  return result;
}

// ===========================
// CASHIER SALES REPORT
// ===========================

export async function getCashierSalesReport(
  dateFrom?: string,
  dateTo?: string,
  branchId?: string,
): Promise<CashierSalesItem[]> {
  const cacheKey = reportCacheKey("cashier-sales", dateFrom, dateTo, branchId);
  const cached = await redisGetJson<CashierSalesItem[]>(cacheKey);
  if (cached) return cached;

  const params: unknown[] = [];
  const conditions: string[] = ["t.status = 'COMPLETED'"];

  if (dateFrom)
    conditions.push(`t."createdAt" >= $${params.push(new Date(dateFrom))}`);
  if (dateTo) {
    const to = new Date(dateTo);
    to.setDate(to.getDate() + 1);
    conditions.push(`t."createdAt" < $${params.push(to)}`);
  }
  if (branchId) conditions.push(`t."branchId" = $${params.push(branchId)}`);

  const where = conditions.join(" AND ");

  const [txRows, itemRows] = await Promise.all([
    // Agregasi per kasir dari tabel transactions
    prisma.$queryRawUnsafe<
      {
        userId: string;
        name: string;
        email: string;
        role: string;
        totalRevenue: number;
        totalDiscount: number;
        transactionCount: number;
      }[]
    >(
      `
        SELECT
          u.id AS "userId", u.name, u.email, u.role,
          COALESCE(SUM(t."grandTotal"), 0)::float AS "totalRevenue",
          COALESCE(SUM(t."discountAmount"), 0)::float AS "totalDiscount",
          COUNT(t.id)::int AS "transactionCount"
        FROM transactions t
        JOIN users u ON u.id = t."userId"
        WHERE ${where}
        GROUP BY u.id, u.name, u.email, u.role
        `,
      ...params,
    ),
    // Agregasi items (cost + qty) per kasir
    prisma.$queryRawUnsafe<
      {
        userId: string;
        totalCost: number;
        itemsSold: number;
      }[]
    >(
      `
        SELECT
          t."userId",
          COALESCE(SUM(ti.quantity * p."purchasePrice"), 0)::float AS "totalCost",
          SUM(ti.quantity)::int AS "itemsSold"
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti."transactionId"
        JOIN products p ON p.id = ti."productId"
        WHERE ${where}
        GROUP BY t."userId"
        `,
      ...params,
    ),
  ]);

  const itemMap = new Map(itemRows.map((r) => [r.userId, r]));

  const result = txRows
    .map((c) => {
      const items = itemMap.get(c.userId) ?? { totalCost: 0, itemsSold: 0 };
      return {
        userId: c.userId,
        name: c.name,
        email: c.email,
        role: c.role,
        totalRevenue: c.totalRevenue,
        totalCost: items.totalCost,
        profit: c.totalRevenue - items.totalCost,
        totalDiscount: c.totalDiscount,
        transactionCount: c.transactionCount,
        itemsSold: items.itemsSold,
        averageTicket:
          c.transactionCount > 0
            ? Math.round(c.totalRevenue / c.transactionCount)
            : 0,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
  await redisSetJson(cacheKey, result, REPORTS_REDIS_TTL_SECONDS);
  return result;
}
