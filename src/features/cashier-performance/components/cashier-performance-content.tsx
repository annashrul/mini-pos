"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { useBranch } from "@/components/providers/branch-provider";
import { getCashierPerformanceList, getCashierDailyTrend, getCashierDetailStats } from "@/server/actions/cashier-performance";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar,
} from "recharts";
import {
    Users, TrendingUp, ArrowUpRight, ArrowDownRight,
    Trophy, ShoppingCart, Package, DollarSign, BarChart3, UserCheck,
    Percent, Receipt, Calendar, Clock, AlertTriangle, Zap,
    CreditCard,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Period = "today" | "week" | "month";

type CashierData = {
    userId: string;
    name: string;
    email: string;
    role: string;
    branchName: string | null;
    joinedAt: Date | string;
    tenure: string;
    current: {
        revenue: number;
        cost: number;
        profit: number;
        discount: number;
        transactions: number;
        itemsSold: number;
        averageTicket: number;
    };
    previous: {
        revenue: number;
        profit: number;
        transactions: number;
        itemsSold: number;
    };
    growth: {
        revenue: number;
        profit: number;
        transactions: number;
        itemsSold: number;
    };
    shiftsWorked: number;
    averageShiftDuration: number;
    voidCount: number;
    refundCount: number;
    voidRate: number;
    largestTransaction: number;
    peakHour: number;
    achievements: string[];
};

type SummaryData = {
    totalCashiers: number;
    totalRevenue: number;
    revenueGrowth: number;
    totalTransactions: number;
    topPerformer: string;
};

type TrendData = {
    date: string;
    label: string;
    revenue: number;
    transactions: number;
};

type DetailStats = {
    user: { id: string; name: string; email: string; role: string; branchName: string | null };
    lifetimeStats: {
        totalRevenue: number;
        totalDiscount: number;
        totalTax: number;
        totalTransactions: number;
        averageTransaction: number;
        largestTransaction: number;
        voidedTransactions: number;
        refundedTransactions: number;
        joinedAt: Date | string;
        tenure: string;
    };
    monthlyTrend: { month: string; label: string; revenue: number; transactions: number }[];
    topProducts: { productId: string; productName: string; productCode: string; totalQty: number; totalRevenue: number }[];
    paymentBreakdown: { method: string; count: number; total: number; percentage: number }[];
    shiftHistory: {
        id: string;
        openedAt: Date | string;
        closedAt: Date | string | null;
        durationHours: number;
        openingCash: number;
        closingCash: number | null;
        expectedCash: number | null;
        cashDifference: number | null;
        totalSales: number | null;
        totalTransactions: number | null;
        notes: string | null;
    }[];
    hourlyDistribution: { hour: number; count: number }[];
};

// ── Period pills ───────────────────────────────────────────────────────────────
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
    { value: "today", label: "Hari Ini" },
    { value: "week", label: "Minggu Ini" },
    { value: "month", label: "Bulan Ini" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const avatarColors = [
    "from-indigo-500 to-violet-600",
    "from-violet-500 to-purple-600",
    "from-fuchsia-500 to-pink-600",
    "from-purple-500 to-indigo-600",
    "from-blue-500 to-indigo-600",
    "from-cyan-500 to-blue-600",
];

function CashierAvatar({ name }: { name: string }) {
    const initial = name.charAt(0).toUpperCase();
    const colorIndex = name.charCodeAt(0) % avatarColors.length;
    return (
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColors[colorIndex]} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md`}>
            {initial}
        </div>
    );
}

function GrowthBadge({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
    const isPositive = value >= 0;
    const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
    const sizeClasses = size === "md" ? "text-xs px-2 py-1 gap-1" : "text-[10px] px-1.5 py-0.5 gap-0.5";
    return (
        <span className={`inline-flex items-center font-semibold rounded-full ${sizeClasses} ${
            isPositive
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-600 border border-red-200"
        }`}>
            <Icon className={size === "md" ? "w-3.5 h-3.5" : "w-3 h-3"} />
            {Math.abs(value)}%
        </span>
    );
}

function MetricBlock({ label, value, growth, icon: Icon }: {
    label: string; value: string; growth: number; icon: React.ElementType;
}) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                <Icon className="w-3 h-3" />
                {label}
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800 tabular-nums">{value}</span>
                <GrowthBadge value={growth} />
            </div>
        </div>
    );
}

// ── Loading Skeleton ───────────────────────────────────────────────────────────
function LoadingSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header skeleton */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-2xl" />
                    <div>
                        <div className="h-7 w-48 bg-slate-200 rounded-lg" />
                        <div className="h-4 w-64 bg-slate-100 rounded-lg mt-2" />
                    </div>
                </div>
                <div className="flex gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-9 w-24 bg-slate-200 rounded-full" />
                    ))}
                </div>
            </div>
            {/* Summary cards skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border/30 bg-white p-6 space-y-3">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <div className="h-3 w-24 bg-slate-100 rounded" />
                                <div className="h-8 w-20 bg-slate-200 rounded-lg" />
                                <div className="h-3 w-32 bg-slate-100 rounded" />
                            </div>
                            <div className="w-12 h-12 bg-slate-100 rounded-xl" />
                        </div>
                    </div>
                ))}
            </div>
            {/* Cashier cards skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border/30 bg-white p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-slate-200 rounded-xl" />
                            <div className="space-y-2 flex-1">
                                <div className="h-4 w-36 bg-slate-200 rounded" />
                                <div className="h-3 w-48 bg-slate-100 rounded" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 4 }).map((_, j) => (
                                <div key={j} className="space-y-1">
                                    <div className="h-3 w-16 bg-slate-100 rounded" />
                                    <div className="h-5 w-24 bg-slate-200 rounded" />
                                </div>
                            ))}
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function CashierPerformanceContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { selectedBranchId, branchReady } = useBranch();

    const periodParam = searchParams.get("period") as Period | null;
    const activePeriod: Period = (["today", "week", "month"] as Period[]).includes(periodParam as Period)
        ? (periodParam as Period)
        : "month";

    const [loading, setLoading] = useState(true);
    const [cashiers, setCashiers] = useState<CashierData[]>([]);
    const [summary, setSummary] = useState<SummaryData>({
        totalCashiers: 0, totalRevenue: 0, revenueGrowth: 0, totalTransactions: 0, topPerformer: "-",
    });
    const [detailCashier, setDetailCashier] = useState<CashierData | null>(null);
    const [trendData, setTrendData] = useState<TrendData[]>([]);
    const [detailStats, setDetailStats] = useState<DetailStats | null>(null);
    const [trendLoading, startTrendTransition] = useTransition();

    const didFetchRef = useRef(false);
    const prevBranchRef = useRef<string | null | undefined>(undefined);
    const prevPeriodRef = useRef<Period | null>(null);

    // ── Fetch data ─────────────────────────────────────────────────────────────
    const fetchData = useCallback(async (period: Period, branchId?: string) => {
        setLoading(true);
        try {
            const result = await getCashierPerformanceList({
                period,
                ...(branchId ? { branchId } : {}),
            });
            setCashiers(result.cashiers);
            setSummary(result.summary);
        } catch {
            setCashiers([]);
            setSummary({ totalCashiers: 0, totalRevenue: 0, revenueGrowth: 0, totalTransactions: 0, topPerformer: "-" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!branchReady) return;
        const branchChanged = prevBranchRef.current !== selectedBranchId;
        const periodChanged = prevPeriodRef.current !== activePeriod;
        if (!didFetchRef.current || branchChanged || periodChanged) {
            didFetchRef.current = true;
            prevBranchRef.current = selectedBranchId;
            prevPeriodRef.current = activePeriod;
            fetchData(activePeriod, selectedBranchId || undefined);
        }
    }, [branchReady, selectedBranchId, activePeriod, fetchData]);

    // ── Period change ──────────────────────────────────────────────────────────
    const handlePeriodChange = useCallback((period: Period) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("period", period);
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [searchParams, router]);


    // ── Detail dialog ──────────────────────────────────────────────────────────
    const handleOpenDetail = useCallback((cashier: CashierData) => {
        setDetailCashier(cashier);
        setTrendData([]);
        setDetailStats(null);
        startTrendTransition(async () => {
            try {
                const [trendResult, statsResult] = await Promise.all([
                    getCashierDailyTrend(cashier.userId, 14, selectedBranchId || undefined),
                    getCashierDetailStats(cashier.userId, selectedBranchId || undefined),
                ]);
                setTrendData(trendResult);
                setDetailStats(statsResult);
            } catch {
                setTrendData([]);
                setDetailStats(null);
            }
        });
    }, [selectedBranchId]);

    // ── Render ─────────────────────────────────────────────────────────────────
    if (loading) return <LoadingSkeleton />;

    return (
        <div className="space-y-8">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                        <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Performa Kasir</h1>
                        <p className="text-slate-500 text-sm mt-0.5">Analisis performa dan tren penjualan per kasir</p>
                    </div>
                </div>
                {/* Period pills */}
                <div className="flex items-center gap-2">
                    {PERIOD_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handlePeriodChange(opt.value)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                                activePeriod === opt.value
                                    ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25"
                                    : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Summary Stats ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Kasir Aktif */}
                <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/10 group-hover:from-indigo-500/10 group-hover:to-violet-500/15 transition-colors duration-300" />
                    <CardContent className="pt-6 pb-5 relative">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Kasir Aktif</p>
                                <p className="text-3xl font-bold text-slate-900 tabular-nums">{summary.totalCashiers}</p>
                                <p className="text-xs text-slate-400">Periode ini</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Total Revenue */}
                <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/10 group-hover:from-emerald-500/10 group-hover:to-green-500/15 transition-colors duration-300" />
                    <CardContent className="pt-6 pb-5 relative">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Revenue</p>
                                <p className="text-2xl font-bold text-emerald-600 tabular-nums">{formatCurrency(summary.totalRevenue)}</p>
                                <div className="flex items-center gap-1.5">
                                    <GrowthBadge value={summary.revenueGrowth} size="sm" />
                                    <span className="text-[10px] text-slate-400">vs periode lalu</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                <DollarSign className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Total Transaksi */}
                <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/10 group-hover:from-purple-500/10 group-hover:to-fuchsia-500/15 transition-colors duration-300" />
                    <CardContent className="pt-6 pb-5 relative">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Transaksi</p>
                                <p className="text-3xl font-bold text-purple-600 tabular-nums">{summary.totalTransactions.toLocaleString()}</p>
                                <p className="text-xs text-slate-400">Semua kasir</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                                <ShoppingCart className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Top Performer */}
                <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/10 group-hover:from-amber-500/10 group-hover:to-orange-500/15 transition-colors duration-300" />
                    <CardContent className="pt-6 pb-5 relative">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Top Performer</p>
                                <p className="text-xl font-bold text-amber-700 truncate max-w-[160px]">{summary.topPerformer}</p>
                                <p className="text-xs text-slate-400">Revenue tertinggi</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                                <Trophy className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Cashier Cards Grid ─────────────────────────────────────── */}
            {cashiers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <UserCheck className="w-10 h-10 text-slate-300" />
                    </div>
                    <p className="text-base font-medium text-slate-400">Belum ada data performa kasir</p>
                    <p className="text-sm text-slate-300 mt-1">Data akan muncul setelah ada transaksi pada periode ini</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {cashiers.map((c, index) => {
                        const profitMargin = c.current.revenue > 0
                            ? Math.round((c.current.profit / c.current.revenue) * 100)
                            : 0;

                        return (
                            <Card
                                key={c.userId}
                                className="rounded-2xl shadow-sm border-border/30 hover:shadow-lg transition-all duration-300 overflow-hidden relative group"
                            >
                                {/* Rank badge for top 3 */}
                                {index < 3 && (
                                    <div className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                                        index === 0
                                            ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                                            : index === 1
                                            ? "bg-gradient-to-br from-slate-300 to-slate-400 text-white"
                                            : "bg-gradient-to-br from-orange-300 to-orange-400 text-white"
                                    }`}>
                                        {index + 1}
                                    </div>
                                )}

                                <CardContent className="p-5 space-y-4">
                                    {/* Cashier info header */}
                                    <div className="flex items-center gap-3">
                                        <CashierAvatar name={c.name} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm truncate">{c.name}</p>
                                            <p className="text-xs text-slate-400 truncate">{c.email}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                                                    {c.role}
                                                </span>
                                                {c.branchName && (
                                                    <span className="text-[10px] font-medium text-slate-400 truncate">
                                                        {c.branchName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4 metric blocks */}
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                        <MetricBlock
                                            label="Revenue"
                                            value={formatCurrency(c.current.revenue)}
                                            growth={c.growth.revenue}
                                            icon={DollarSign}
                                        />
                                        <MetricBlock
                                            label="Profit"
                                            value={formatCurrency(c.current.profit)}
                                            growth={c.growth.profit}
                                            icon={TrendingUp}
                                        />
                                        <MetricBlock
                                            label="Transaksi"
                                            value={c.current.transactions.toLocaleString()}
                                            growth={c.growth.transactions}
                                            icon={Receipt}
                                        />
                                        <MetricBlock
                                            label="Item Terjual"
                                            value={c.current.itemsSold.toLocaleString()}
                                            growth={c.growth.itemsSold}
                                            icon={Package}
                                        />
                                    </div>

                                    {/* Achievements */}
                                    {c.achievements.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                                            {c.achievements.map((a) => (
                                                <span key={a} className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 border border-amber-200/50">
                                                    🏆 {a}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Extra compact stats */}
                                    <div className="grid grid-cols-4 gap-2 text-center">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground">Shift</p>
                                            <p className="text-xs font-bold">{c.shiftsWorked}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground">Void</p>
                                            <p className={`text-xs font-bold ${c.voidRate > 5 ? "text-red-500" : "text-slate-700"}`}>{c.voidCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground">Peak</p>
                                            <p className="text-xs font-bold">{c.peakHour}:00</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground">Max Trx</p>
                                            <p className="text-xs font-bold">{formatCurrency(c.largestTransaction)}</p>
                                        </div>
                                    </div>

                                    {/* Tenure info */}
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                        <Calendar className="w-3 h-3" />
                                        <span>Bekerja sejak: <span className="font-medium text-slate-600">{c.tenure}</span></span>
                                        {c.voidRate > 5 && (
                                            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-red-500">
                                                <AlertTriangle className="w-3 h-3" />
                                                Void {c.voidRate}%
                                            </span>
                                        )}
                                    </div>

                                    {/* Avg ticket + discount */}
                                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                                        <div className="flex items-center gap-1.5">
                                            <ShoppingCart className="w-3 h-3 text-slate-400" />
                                            <span>Avg Ticket: <span className="font-semibold text-slate-700">{formatCurrency(c.current.averageTicket)}</span></span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Percent className="w-3 h-3 text-slate-400" />
                                            <span>Diskon: <span className="font-semibold text-slate-700">{formatCurrency(c.current.discount)}</span></span>
                                        </div>
                                    </div>

                                    {/* Profit margin bar */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-slate-400 font-medium">Profit Margin</span>
                                            <span className={`font-bold ${
                                                profitMargin >= 30 ? "text-emerald-600" : profitMargin >= 15 ? "text-amber-600" : "text-red-500"
                                            }`}>{profitMargin}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${
                                                    profitMargin >= 30
                                                        ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                                                        : profitMargin >= 15
                                                        ? "bg-gradient-to-r from-amber-400 to-amber-500"
                                                        : "bg-gradient-to-r from-red-400 to-red-500"
                                                }`}
                                                style={{ width: `${Math.min(profitMargin, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Trend chart — always visible */}
                                    <div className="pt-3 border-t border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tren 14 Hari</p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 h-6 px-2"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenDetail(c);
                                                }}
                                            >
                                                Detail
                                            </Button>
                                        </div>
                                        <ExpandedTrendChart userId={c.userId} {...(selectedBranchId ? { branchId: selectedBranchId } : {})} />
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ── Detail Dialog ──────────────────────────────────────────── */}
            <Dialog open={!!detailCashier} onOpenChange={(open) => { if (!open) { setDetailCashier(null); setDetailStats(null); } }}>
                <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] flex flex-col">
                    {detailCashier && (
                        <>
                            {/* a) Header section */}
                            <DialogHeader>
                                <div className="flex items-start gap-4">
                                    <CashierAvatar name={detailCashier.name} />
                                    <div className="flex-1 min-w-0">
                                        <DialogTitle className="text-lg font-bold text-slate-900">
                                            {detailCashier.name}
                                        </DialogTitle>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                                                {detailCashier.role}
                                            </span>
                                            {detailCashier.branchName && (
                                                <span className="text-xs text-slate-400">{detailCashier.branchName}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                                            <span className="inline-flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                Bekerja sejak: <span className="font-medium text-slate-600">{detailCashier.tenure}</span>
                                            </span>
                                        </div>
                                        {detailCashier.achievements.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                {detailCashier.achievements.map((a) => (
                                                    <span key={a} className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 border border-amber-200/50">
                                                        🏆 {a}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </DialogHeader>

                            <DialogBody className="space-y-6 py-4 overflow-y-auto">
                                {/* b) KPI summary grid (4 cols) */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-indigo-50/80 rounded-xl p-3 space-y-1">
                                        <p className="text-[10px] font-medium text-indigo-500 uppercase tracking-wider">Revenue</p>
                                        <p className="text-base font-bold text-indigo-700 tabular-nums">{formatCurrency(detailCashier.current.revenue)}</p>
                                        <GrowthBadge value={detailCashier.growth.revenue} />
                                    </div>
                                    <div className="bg-emerald-50/80 rounded-xl p-3 space-y-1">
                                        <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">Profit</p>
                                        <p className="text-base font-bold text-emerald-700 tabular-nums">{formatCurrency(detailCashier.current.profit)}</p>
                                        <GrowthBadge value={detailCashier.growth.profit} />
                                    </div>
                                    <div className="bg-purple-50/80 rounded-xl p-3 space-y-1">
                                        <p className="text-[10px] font-medium text-purple-500 uppercase tracking-wider">Avg Ticket</p>
                                        <p className="text-base font-bold text-purple-700 tabular-nums">{formatCurrency(detailCashier.current.averageTicket)}</p>
                                    </div>
                                    <div className="bg-amber-50/80 rounded-xl p-3 space-y-1">
                                        <p className="text-[10px] font-medium text-amber-500 uppercase tracking-wider">Item Terjual</p>
                                        <p className="text-base font-bold text-amber-700 tabular-nums">{detailCashier.current.itemsSold.toLocaleString()}</p>
                                        <GrowthBadge value={detailCashier.growth.itemsSold} />
                                    </div>
                                </div>

                                {/* c) Additional stats row */}
                                <div className="grid grid-cols-5 gap-2">
                                    <div className="text-center p-2.5 bg-slate-50 rounded-xl">
                                        <Clock className="w-3.5 h-3.5 mx-auto text-slate-400 mb-1" />
                                        <p className="text-[10px] text-slate-400">Shifts</p>
                                        <p className="text-sm font-bold text-slate-700">{detailCashier.shiftsWorked}</p>
                                    </div>
                                    <div className="text-center p-2.5 bg-slate-50 rounded-xl">
                                        <AlertTriangle className={`w-3.5 h-3.5 mx-auto mb-1 ${detailCashier.voidRate > 5 ? "text-red-400" : "text-slate-400"}`} />
                                        <p className="text-[10px] text-slate-400">Void Rate</p>
                                        <p className={`text-sm font-bold ${detailCashier.voidRate > 5 ? "text-red-500" : "text-slate-700"}`}>{detailCashier.voidRate}%</p>
                                    </div>
                                    <div className="text-center p-2.5 bg-slate-50 rounded-xl">
                                        <Receipt className="w-3.5 h-3.5 mx-auto text-slate-400 mb-1" />
                                        <p className="text-[10px] text-slate-400">Refund</p>
                                        <p className="text-sm font-bold text-slate-700">{detailCashier.refundCount}</p>
                                    </div>
                                    <div className="text-center p-2.5 bg-slate-50 rounded-xl">
                                        <Zap className="w-3.5 h-3.5 mx-auto text-slate-400 mb-1" />
                                        <p className="text-[10px] text-slate-400">Peak Hour</p>
                                        <p className="text-sm font-bold text-slate-700">{detailCashier.peakHour}:00</p>
                                    </div>
                                    <div className="text-center p-2.5 bg-slate-50 rounded-xl">
                                        <DollarSign className="w-3.5 h-3.5 mx-auto text-slate-400 mb-1" />
                                        <p className="text-[10px] text-slate-400">Max Trx</p>
                                        <p className="text-sm font-bold text-slate-700">{formatCurrency(detailCashier.largestTransaction)}</p>
                                    </div>
                                </div>

                                {/* d) Monthly trend chart (BarChart) */}
                                <div>
                                    <p className="text-sm font-semibold text-slate-700 mb-3">Tren Revenue 6 Bulan Terakhir</p>
                                    {trendLoading ? (
                                        <div className="h-48 bg-slate-50 rounded-xl animate-pulse flex items-center justify-center">
                                            <p className="text-xs text-slate-400">Memuat chart...</p>
                                        </div>
                                    ) : detailStats?.monthlyTrend && detailStats.monthlyTrend.length > 0 ? (
                                        <div className="h-48">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={detailStats.monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                                                        formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                                                        labelStyle={{ fontWeight: 600, color: "#334155" }}
                                                    />
                                                    <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="h-48 bg-slate-50 rounded-xl flex items-center justify-center">
                                            <p className="text-xs text-slate-400">Tidak ada data tren bulanan</p>
                                        </div>
                                    )}
                                </div>

                                {/* Daily trend chart (original) */}
                                <div>
                                    <p className="text-sm font-semibold text-slate-700 mb-3">Tren Revenue 14 Hari Terakhir</p>
                                    {trendLoading ? (
                                        <div className="h-40 bg-slate-50 rounded-xl animate-pulse flex items-center justify-center">
                                            <p className="text-xs text-slate-400">Memuat chart...</p>
                                        </div>
                                    ) : trendData.length === 0 ? (
                                        <div className="h-40 bg-slate-50 rounded-xl flex items-center justify-center">
                                            <p className="text-xs text-slate-400">Tidak ada data tren</p>
                                        </div>
                                    ) : (
                                        <div className="h-40">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="dialogGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                                                        formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                                                        labelStyle={{ fontWeight: 600, color: "#334155" }}
                                                    />
                                                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#dialogGradient)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>

                                {/* e) Top 10 Products */}
                                {detailStats?.topProducts && detailStats.topProducts.length > 0 && (
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700 mb-3">Top 10 Produk Terjual</p>
                                        <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                            {detailStats.topProducts.map((p, i) => (
                                                <div key={p.productId} className="flex items-center gap-3 px-3 py-2 bg-slate-50/80 rounded-lg hover:bg-slate-100 transition-colors">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                                        i < 3 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                                                    }`}>
                                                        {i + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-slate-700 truncate">{p.productName}</p>
                                                        <p className="text-[10px] text-slate-400">{p.productCode}</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-xs font-bold text-slate-700 tabular-nums">{p.totalQty} pcs</p>
                                                        <p className="text-[10px] text-slate-400 tabular-nums">{formatCurrency(p.totalRevenue)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* f) Payment method breakdown */}
                                {detailStats?.paymentBreakdown && detailStats.paymentBreakdown.length > 0 && (
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700 mb-3">Metode Pembayaran</p>
                                        <div className="space-y-2">
                                            {detailStats.paymentBreakdown.map((pm) => {
                                                const maxTotal = detailStats.paymentBreakdown[0]?.total || 1;
                                                const widthPercent = Math.max((pm.total / maxTotal) * 100, 4);
                                                return (
                                                    <div key={pm.method} className="space-y-1">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                                                                <CreditCard className="w-3 h-3 text-slate-400" />
                                                                {pm.method}
                                                            </span>
                                                            <span className="text-slate-500 tabular-nums">
                                                                {pm.count}x &middot; {formatCurrency(pm.total)} ({pm.percentage}%)
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all duration-500"
                                                                style={{ width: `${widthPercent}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* g) Recent shifts */}
                                {detailStats?.shiftHistory && detailStats.shiftHistory.length > 0 && (
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700 mb-3">Shift Terakhir</p>
                                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                                            {detailStats.shiftHistory.map((s) => (
                                                <div key={s.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50/80 rounded-lg">
                                                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-slate-700">
                                                            {new Date(s.openedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">
                                                            {s.durationHours > 0 ? `${s.durationHours} jam` : "Masih buka"}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-xs font-bold text-slate-700 tabular-nums">{s.totalTransactions || 0} trx</p>
                                                        <p className="text-[10px] text-slate-400 tabular-nums">{formatCurrency(s.totalSales || 0)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* h) Hourly distribution chart */}
                                {detailStats?.hourlyDistribution && detailStats.hourlyDistribution.some(h => h.count > 0) && (
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700 mb-3">Distribusi Jam Transaksi</p>
                                        <div className="h-40">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={detailStats.hourlyDistribution} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                    <XAxis
                                                        dataKey="hour"
                                                        tick={{ fontSize: 9, fill: "#94a3b8" }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tickFormatter={(v) => `${v}`}
                                                    />
                                                    <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "11px" }}
                                                        formatter={(value) => [`${value} transaksi`, "Jumlah"]}
                                                        labelFormatter={(label) => `Jam ${label}:00`}
                                                    />
                                                    <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </DialogBody>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => { setDetailCashier(null); setDetailStats(null); }} className="rounded-xl">
                                    Tutup
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── Expanded Trend Chart (inline in card) ──────────────────────────────────────
function ExpandedTrendChart({ userId, branchId }: { userId: string; branchId?: string }) {
    const [data, setData] = useState<TrendData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const result = await getCashierDailyTrend(userId, 14, branchId);
                if (!cancelled) setData(result);
            } catch {
                if (!cancelled) setData([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [userId, branchId]);

    if (loading) {
        return (
            <div className="h-36 bg-slate-50 rounded-xl animate-pulse flex items-center justify-center">
                <p className="text-[11px] text-slate-400">Memuat tren...</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="h-36 bg-slate-50 rounded-xl flex items-center justify-center">
                <p className="text-[11px] text-slate-400">Tidak ada data</p>
            </div>
        );
    }

    return (
        <div className="h-36" onClick={(e) => e.stopPropagation()}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`expandGrad-${userId}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                        contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "11px" }}
                        formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#818cf8" strokeWidth={2} fill={`url(#expandGrad-${userId})`} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
