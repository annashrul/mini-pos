"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentCompanyId } from "@/lib/company";

// Helper: format tenure from a date to now
function formatTenure(joinDate: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - joinDate.getTime();
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (totalDays < 1) return "Hari ini";

    const years = Math.floor(totalDays / 365);
    const remainingDaysAfterYears = totalDays % 365;
    const months = Math.floor(remainingDaysAfterYears / 30);
    const days = remainingDaysAfterYears % 30;

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} tahun`);
    if (months > 0) parts.push(`${months} bulan`);
    if (parts.length === 0 && days > 0) parts.push(`${days} hari`);
    // Only show days if less than 1 month
    if (parts.length === 0) parts.push("Hari ini");

    return parts.join(" ");
}

// Get all cashier performance with comparison to previous period
export async function getCashierPerformanceList(params?: {
    branchId?: string;
    period?: "today" | "week" | "month"; // default "month"
}) {
    const period = params?.period || "month";
    const branchId = params?.branchId;
    const companyId = await getCurrentCompanyId();

    // Calculate current and previous date ranges based on period
    const now = new Date();
    let currentStart: Date, currentEnd: Date, prevStart: Date, prevEnd: Date;

    if (period === "today") {
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        currentEnd = now;
        prevStart = new Date(currentStart); prevStart.setDate(prevStart.getDate() - 1);
        prevEnd = new Date(currentStart);
    } else if (period === "week") {
        currentStart = new Date(now); currentStart.setDate(now.getDate() - 7);
        currentEnd = now;
        prevStart = new Date(currentStart); prevStart.setDate(prevStart.getDate() - 7);
        prevEnd = new Date(currentStart);
    } else { // month
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = now;
        prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    // Build where for current and previous periods
    const baseWhere: Record<string, unknown> = { status: "COMPLETED" };
    if (branchId) baseWhere.branchId = branchId;

    const currentCostParams: unknown[] = [currentStart, currentEnd];
    const prevCostParams: unknown[] = [prevStart, prevEnd];
    let costBranchCondition = "";
    if (branchId) {
        currentCostParams.push(branchId);
        costBranchCondition = `AND t."branchId" = $${currentCostParams.length}`;
        prevCostParams.push(branchId);
    }
    const hourlyParams: unknown[] = [currentStart, currentEnd];
    const hourlyBranchCondition = branchId ? `AND t."branchId" = $3` : "";
    if (branchId) hourlyParams.push(branchId);

    // Use groupBy + raw SQL for cost instead of loading all transactions with items
    const [
        currentAgg, prevAgg, currentCostData, prevCostData,
        allUsers, largestTxAgg, hourlyAgg, shifts,
        voidAgg, refundAgg
    ] = await Promise.all([
        // Current period: revenue, discount, transactions per user
        prisma.transaction.groupBy({
            by: ["userId"],
            where: { ...baseWhere, createdAt: { gte: currentStart, lte: currentEnd } },
            _sum: { grandTotal: true, discountAmount: true },
            _count: true,
        }),
        // Previous period: same
        prisma.transaction.groupBy({
            by: ["userId"],
            where: { ...baseWhere, createdAt: { gte: prevStart, lte: prevEnd } },
            _sum: { grandTotal: true, discountAmount: true },
            _count: true,
        }),
        // Current period: cost + itemsSold per user via raw SQL
        prisma.$queryRawUnsafe<{ userId: string; cost: bigint; itemsSold: bigint }[]>(`
            SELECT t."userId",
                   COALESCE(SUM(ti.quantity * p."purchasePrice"), 0) as cost,
                   COALESCE(SUM(ti.quantity), 0) as "itemsSold"
            FROM transactions t
            JOIN transaction_items ti ON ti."transactionId" = t.id
            JOIN products p ON p.id = ti."productId"
            WHERE t.status = 'COMPLETED'
              AND t."createdAt" >= $1 AND t."createdAt" <= $2
              ${costBranchCondition}
            GROUP BY t."userId"
        `, ...currentCostParams),
        // Previous period: cost + itemsSold
        prisma.$queryRawUnsafe<{ userId: string; cost: bigint; itemsSold: bigint }[]>(`
            SELECT t."userId",
                   COALESCE(SUM(ti.quantity * p."purchasePrice"), 0) as cost,
                   COALESCE(SUM(ti.quantity), 0) as "itemsSold"
            FROM transactions t
            JOIN transaction_items ti ON ti."transactionId" = t.id
            JOIN products p ON p.id = ti."productId"
            WHERE t.status = 'COMPLETED'
              AND t."createdAt" >= $1 AND t."createdAt" <= $2
              ${costBranchCondition}
            GROUP BY t."userId"
        `, ...prevCostParams),
        prisma.user.findMany({
            where: { role: { in: ["CASHIER", "SUPER_ADMIN", "ADMIN", "MANAGER"] }, isActive: true, companyId },
            select: {
                id: true, name: true, email: true, role: true, branchId: true, createdAt: true,
                branch: { select: { name: true } },
            },
        }),
        prisma.transaction.groupBy({
            by: ["userId"],
            where: { ...baseWhere, createdAt: { gte: currentStart, lte: currentEnd } },
            _max: { grandTotal: true },
        }),
        prisma.$queryRawUnsafe<{ userId: string; hour: number; count: number }[]>(`
            SELECT
              t."userId" as "userId",
              EXTRACT(HOUR FROM t."createdAt")::int as hour,
              COUNT(*)::int as count
            FROM transactions t
            WHERE t.status = 'COMPLETED'
              AND t."createdAt" >= $1 AND t."createdAt" <= $2
              ${hourlyBranchCondition}
            GROUP BY t."userId", EXTRACT(HOUR FROM t."createdAt")
        `, ...hourlyParams),
        prisma.cashierShift.findMany({
            where: {
                ...(branchId ? { branchId } : {}),
                isOpen: false,
                openedAt: { gte: currentStart, lte: currentEnd },
            },
            select: { userId: true, openedAt: true, closedAt: true },
        }),
        prisma.transaction.groupBy({
            by: ["userId"],
            where: {
                status: "VOIDED",
                createdAt: { gte: currentStart, lte: currentEnd },
                ...(branchId ? { branchId } : {}),
            },
            _count: { _all: true },
        }),
        prisma.transaction.groupBy({
            by: ["userId"],
            where: {
                status: "REFUNDED",
                createdAt: { gte: currentStart, lte: currentEnd },
                ...(branchId ? { branchId } : {}),
            },
            _count: { _all: true },
        }),
    ]);

    // Build aggregated maps
    function buildMap(agg: typeof currentAgg, costData: typeof currentCostData) {
        const map = new Map<string, { revenue: number; cost: number; discount: number; transactions: number; itemsSold: number }>();
        const costMap = new Map(costData.map(c => [c.userId, { cost: Number(c.cost), itemsSold: Number(c.itemsSold) }]));
        for (const row of agg) {
            const cd = costMap.get(row.userId) || { cost: 0, itemsSold: 0 };
            map.set(row.userId, {
                revenue: row._sum.grandTotal || 0,
                discount: row._sum.discountAmount || 0,
                transactions: row._count,
                cost: cd.cost,
                itemsSold: cd.itemsSold,
            });
        }
        return map;
    }

    const currentMap = buildMap(currentAgg, currentCostData);
    const prevMap = buildMap(prevAgg, prevCostData);

    // Build shift stats per user
    const shiftStatsMap = new Map<string, { count: number; totalDurationHours: number }>();
    for (const shift of shifts) {
        if (!shiftStatsMap.has(shift.userId)) shiftStatsMap.set(shift.userId, { count: 0, totalDurationHours: 0 });
        const s = shiftStatsMap.get(shift.userId)!;
        s.count += 1;
        if (shift.closedAt) {
            const durationMs = new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime();
            s.totalDurationHours += durationMs / (1000 * 60 * 60);
        }
    }

    // Build void/refund counts per user
    const voidCountMap = new Map<string, number>();
    for (const row of voidAgg) {
        voidCountMap.set(row.userId, row._count._all);
    }
    const refundCountMap = new Map<string, number>();
    for (const row of refundAgg) {
        refundCountMap.set(row.userId, row._count._all);
    }

    // Build largest transaction and peak hour per user
    const largestTxMap = new Map<string, number>();
    const hourlyCountMap = new Map<string, Map<number, number>>();
    for (const row of largestTxAgg) {
        largestTxMap.set(row.userId, row._max.grandTotal || 0);
    }
    for (const row of hourlyAgg) {
        if (!hourlyCountMap.has(row.userId)) hourlyCountMap.set(row.userId, new Map());
        hourlyCountMap.get(row.userId)!.set(row.hour, row.count);
    }

    // Calculate growth percentage
    function growth(current: number, previous: number): number {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    }

    // Calculate overall average ticket for achievements
    let totalRevAll = 0;
    let totalTxAll = 0;
    for (const [, v] of currentMap) {
        totalRevAll += v.revenue;
        totalTxAll += v.transactions;
    }
    const overallAverageTicket = totalTxAll > 0 ? totalRevAll / totalTxAll : 0;

    // Build result
    const result = allUsers.map((user) => {
        const curr = currentMap.get(user.id) || { revenue: 0, cost: 0, discount: 0, transactions: 0, itemsSold: 0 };
        const prev = prevMap.get(user.id) || { revenue: 0, cost: 0, discount: 0, transactions: 0, itemsSold: 0 };
        const profit = curr.revenue - curr.cost;
        const prevProfit = prev.revenue - prev.cost;
        const averageTicket = curr.transactions > 0 ? Math.round(curr.revenue / curr.transactions) : 0;

        const shiftStats = shiftStatsMap.get(user.id) || { count: 0, totalDurationHours: 0 };
        const voidCount = voidCountMap.get(user.id) || 0;
        const refundCount = refundCountMap.get(user.id) || 0;
        const totalTxIncludingVoidRefund = curr.transactions + voidCount + refundCount;
        const voidRate = totalTxIncludingVoidRefund > 0 ? Math.round((voidCount / totalTxIncludingVoidRefund) * 10000) / 100 : 0;

        // Peak hour
        const hourMap = hourlyCountMap.get(user.id);
        let peakHour = 0;
        if (hourMap && hourMap.size > 0) {
            let maxCount = 0;
            for (const [hour, count] of hourMap) {
                if (count > maxCount) { maxCount = count; peakHour = hour; }
            }
        }

        const growthRevenue = growth(curr.revenue, prev.revenue);

        return {
            userId: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            branchName: user.branch?.name || null,
            joinedAt: user.createdAt,
            tenure: formatTenure(user.createdAt),
            current: {
                revenue: curr.revenue,
                cost: curr.cost,
                profit,
                discount: curr.discount,
                transactions: curr.transactions,
                itemsSold: curr.itemsSold,
                averageTicket,
            },
            previous: {
                revenue: prev.revenue,
                profit: prevProfit,
                transactions: prev.transactions,
                itemsSold: prev.itemsSold,
            },
            growth: {
                revenue: growthRevenue,
                profit: growth(profit, prevProfit),
                transactions: growth(curr.transactions, prev.transactions),
                itemsSold: growth(curr.itemsSold, prev.itemsSold),
            },
            shiftsWorked: shiftStats.count,
            averageShiftDuration: shiftStats.count > 0
                ? Math.round((shiftStats.totalDurationHours / shiftStats.count) * 100) / 100
                : 0,
            voidCount,
            refundCount,
            voidRate,
            largestTransaction: largestTxMap.get(user.id) || 0,
            peakHour,
            // achievements will be computed after sorting
            achievements: [] as string[],
        };
    }).sort((a, b) => b.current.revenue - a.current.revenue);

    // Compute achievements after sorting (need rank info and cross-cashier comparisons)
    const maxItemsSold = Math.max(...result.map(r => r.current.itemsSold), 0);
    const maxShiftsWorked = Math.max(...result.map(r => r.shiftsWorked), 0);

    for (let i = 0; i < result.length; i++) {
        const r = result[i]!;
        const badges: string[] = [];

        if (i === 0 && r.current.revenue > 0) badges.push("Top Seller");
        if (r.growth.revenue >= 0 && r.current.transactions > 0) badges.push("Konsisten");
        if (r.voidCount === 0 && r.current.transactions > 0) badges.push("Tanpa Void");
        if (r.current.averageTicket > overallAverageTicket && r.current.transactions > 0) badges.push("Rata-rata Tinggi");
        if (r.current.itemsSold === maxItemsSold && maxItemsSold > 0) badges.push("Penjual Terbanyak");
        if (r.shiftsWorked === maxShiftsWorked && maxShiftsWorked > 0) badges.push("Rajin");

        r.achievements = badges;
    }

    // Summary
    const totalCurrentRevenue = result.reduce((s, r) => s + r.current.revenue, 0);
    const totalPrevRevenue = result.reduce((s, r) => s + r.previous.revenue, 0);

    return {
        cashiers: result,
        summary: {
            totalCashiers: result.filter(r => r.current.transactions > 0).length,
            totalRevenue: totalCurrentRevenue,
            revenueGrowth: growth(totalCurrentRevenue, totalPrevRevenue),
            totalTransactions: result.reduce((s, r) => s + r.current.transactions, 0),
            topPerformer: result[0]?.name || "-",
        },
        period,
    };
}

// Get daily trend for a specific cashier
export async function getCashierDailyTrend(userId: string, days: number = 14, branchId?: string) {
    const companyId = await getCurrentCompanyId();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: Record<string, unknown> = {
        branch: { companyId },
        userId,
        status: "COMPLETED",
        createdAt: { gte: startDate },
    };
    if (branchId) where.branchId = branchId;

    const transactions = await prisma.transaction.findMany({
        where,
        select: {
            grandTotal: true,
            createdAt: true,
            items: { select: { quantity: true } },
        },
        orderBy: { createdAt: "asc" },
    });

    // Group by date
    const dailyMap = new Map<string, { revenue: number; transactions: number; itemsSold: number }>();
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split("T")[0]!;
        dailyMap.set(key, { revenue: 0, transactions: 0, itemsSold: 0 });
    }
    for (const tx of transactions) {
        const key = new Date(tx.createdAt).toISOString().split("T")[0]!;
        const day = dailyMap.get(key);
        if (day) {
            day.revenue += tx.grandTotal;
            day.transactions += 1;
            for (const item of tx.items) {
                day.itemsSold += item.quantity;
            }
        }
    }

    return Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        label: new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        ...data,
    }));
}

// Get comprehensive detail stats for a single cashier (for detail dialog)
export async function getCashierDetailStats(userId: string, branchId?: string) {
    const companyId = await getCurrentCompanyId();
    const branchFilter: Record<string, unknown> = { branch: { companyId } };
    if (branchId) branchFilter.branchId = branchId;

    // Date for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [
        user,
        lifetimeAgg,
        lifetimeCount,
        recentTransactions,
        allTimeTxsForHourly,
        topProductItems,
        paymentBreakdownTxs,
        recentShifts,
    ] = await Promise.all([
        // User info
        prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                branchId: true,
                branch: { select: { name: true } },
            },
        }),

        // Lifetime aggregate: total revenue
        prisma.transaction.aggregate({
            where: { userId, status: "COMPLETED", ...branchFilter },
            _sum: { grandTotal: true, discountAmount: true, taxAmount: true },
            _count: { id: true },
            _avg: { grandTotal: true },
            _max: { grandTotal: true },
        }),

        // Lifetime transaction count (all statuses for context)
        prisma.transaction.groupBy({
            by: ["status"],
            where: { userId, ...branchFilter },
            _count: { id: true },
        }),

        // Transactions for monthly trend (last 6 months)
        prisma.transaction.findMany({
            where: {
                userId,
                status: "COMPLETED",
                createdAt: { gte: sixMonthsAgo },
                ...branchFilter,
            },
            select: { grandTotal: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        }),

        // Transactions for hourly distribution (last 3 months for relevance)
        prisma.transaction.findMany({
            where: {
                userId,
                status: "COMPLETED",
                createdAt: { gte: new Date(new Date().setMonth(new Date().getMonth() - 3)) },
                ...branchFilter,
            },
            select: { createdAt: true },
        }),

        // Top products: use groupBy instead of loading all items
        prisma.transactionItem.groupBy({
            by: ["productId", "productName", "productCode"],
            where: {
                transaction: { userId, status: "COMPLETED", ...branchFilter },
            },
            _sum: { quantity: true, subtotal: true },
            orderBy: { _sum: { quantity: "desc" } },
            take: 10,
        }),

        // Payment method breakdown: use groupBy instead of loading all transactions
        prisma.transaction.groupBy({
            by: ["paymentMethod"],
            where: { userId, status: "COMPLETED", ...branchFilter },
            _sum: { grandTotal: true },
            _count: true,
        }),

        // Recent shifts (last 10 closed)
        prisma.cashierShift.findMany({
            where: {
                userId,
                isOpen: false,
                ...(branchId ? { branchId } : {}),
            },
            select: {
                id: true,
                openedAt: true,
                closedAt: true,
                openingCash: true,
                closingCash: true,
                expectedCash: true,
                cashDifference: true,
                totalSales: true,
                totalTransactions: true,
                notes: true,
            },
            orderBy: { openedAt: "desc" },
            take: 10,
        }),
    ]);

    if (!user) {
        return null;
    }

    // --- Lifetime stats ---
    const statusCounts: Record<string, number> = {};
    for (const sc of lifetimeCount) {
        statusCounts[sc.status] = sc._count.id;
    }
    const lifetimeStats = {
        totalRevenue: lifetimeAgg._sum.grandTotal || 0,
        totalDiscount: lifetimeAgg._sum.discountAmount || 0,
        totalTax: lifetimeAgg._sum.taxAmount || 0,
        totalTransactions: lifetimeAgg._count.id || 0,
        averageTransaction: lifetimeAgg._avg.grandTotal || 0,
        largestTransaction: lifetimeAgg._max.grandTotal || 0,
        voidedTransactions: statusCounts["VOIDED"] || 0,
        refundedTransactions: statusCounts["REFUNDED"] || 0,
        joinedAt: user.createdAt,
        tenure: formatTenure(user.createdAt),
    };

    // --- Monthly trend (last 6 months) ---
    const monthlyMap = new Map<string, { revenue: number; transactions: number }>();
    // Pre-fill last 6 months
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap.set(key, { revenue: 0, transactions: 0 });
    }
    for (const tx of recentTransactions) {
        const d = new Date(tx.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const entry = monthlyMap.get(key);
        if (entry) {
            entry.revenue += tx.grandTotal;
            entry.transactions += 1;
        }
    }
    const monthlyTrend = Array.from(monthlyMap.entries()).map(([month, data]) => {
        const [year, m] = month.split("-");
        const d = new Date(Number(year), Number(m) - 1, 1);
        return {
            month,
            label: d.toLocaleDateString("id-ID", { month: "short", year: "numeric" }),
            ...data,
        };
    });

    // --- Top 10 products (already grouped by DB) ---
    const topProducts = topProductItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        totalQty: item._sum.quantity || 0,
        totalRevenue: item._sum.subtotal || 0,
    }));

    // --- Payment method breakdown (already grouped by DB) ---
    const totalPaymentCount = paymentBreakdownTxs.reduce((s, r) => s + r._count, 0);
    const paymentBreakdown = paymentBreakdownTxs
        .map(r => ({
            method: r.paymentMethod,
            count: r._count,
            total: r._sum.grandTotal || 0,
            percentage: totalPaymentCount > 0 ? Math.round((r._count / totalPaymentCount) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);

    // --- Shift history (last 10 shifts with computed duration) ---
    const shiftHistory = recentShifts.map((shift) => {
        const durationMs = shift.closedAt
            ? new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime()
            : 0;
        const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;

        return {
            id: shift.id,
            openedAt: shift.openedAt,
            closedAt: shift.closedAt,
            durationHours,
            openingCash: shift.openingCash,
            closingCash: shift.closingCash,
            expectedCash: shift.expectedCash,
            cashDifference: shift.cashDifference,
            totalSales: shift.totalSales,
            totalTransactions: shift.totalTransactions,
            notes: shift.notes,
        };
    });

    // --- Hourly distribution ---
    const hourlyBuckets: { hour: number; count: number }[] = [];
    const hourCounts = new Map<number, number>();
    for (const tx of allTimeTxsForHourly) {
        const hour = new Date(tx.createdAt).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
    for (let h = 0; h < 24; h++) {
        hourlyBuckets.push({ hour: h, count: hourCounts.get(h) || 0 });
    }

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            branchName: user.branch?.name || null,
        },
        lifetimeStats,
        monthlyTrend,
        topProducts,
        paymentBreakdown,
        shiftHistory,
        hourlyDistribution: hourlyBuckets,
    };
}
