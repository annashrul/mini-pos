"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryParams } from "@/hooks/use-query-params";
import { formatCurrency, cn } from "@/lib/utils";
import { useBranch } from "@/components/providers/branch-provider";
import {
    getProfitOverview,
    getProfitByCategory,
    getProfitByProduct,
    getProfitByBranch,
    getProfitTrend,
    getMarginDistribution,
} from "@/server/actions/profit-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmartTable, type SmartColumn } from "@/components/ui/smart-table";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
    TrendingUp, TrendingDown, DollarSign, Package, Receipt,
    BarChart3, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight,
    Building2, CalendarDays, Check,
} from "lucide-react";
import {
    Area, BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type Period = "today" | "week" | "month" | "year";

const PERIOD_TABS: { value: Period; label: string; trendDays: number }[] = [
    { value: "today", label: "Hari Ini", trendDays: 7 },
    { value: "week", label: "Minggu Ini", trendDays: 14 },
    { value: "month", label: "Bulan Ini", trendDays: 30 },
    { value: "year", label: "Tahun Ini", trendDays: 365 },
];

const DONUT_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

function GrowthIndicator({ value }: { value: number }) {
    if (value === 0) return <span className="text-[10px] sm:text-xs text-muted-foreground">--</span>;
    const isPositive = value > 0;
    return (
        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold ${isPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
            {isPositive ? <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
            {Math.abs(value)}%
        </span>
    );
}

function formatCompact(value: number): string {
    if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
}

interface ProfitOverview {
    revenue: number; cogs: number; grossProfit: number; grossMargin: number;
    expenses: number; netProfit: number; netMargin: number;
    revenueGrowth: number; grossProfitGrowth: number; netProfitGrowth: number;
    cogsGrowth: number; expensesGrowth: number; transactionCount: number;
}
interface CategoryProfit {
    category: string; revenue: number; cost: number; profit: number;
    margin: number; contribution: number; units: number;
}
interface ProductProfit {
    productName: string; productCode: string; unitsSold: number;
    revenue: number; cost: number; profit: number; margin: number;
}
interface BranchProfit {
    branchId: string; branchName: string; revenue: number; cost: number;
    grossProfit: number; expenses: number; netProfit: number;
    grossMargin: number; netMargin: number; contribution: number;
}
interface TrendPoint { date: string; revenue: number; cost: number; profit: number; }
interface MarginBracket { label: string; count: number; revenue: number; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltipContent({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border bg-white p-2.5 sm:p-3 shadow-lg text-[10px] sm:text-xs space-y-1">
            <p className="font-medium text-muted-foreground mb-1">{label}</p>
            {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-muted-foreground">{entry.name}:</span>
                    <span className="font-semibold">{formatCurrency(entry.value)}</span>
                </div>
            ))}
        </div>
    );
}

/* ── Product columns for SmartTable ──────────────────────────────────── */
function getProductColumns(type: "top" | "bottom"): SmartColumn<ProductProfit>[] {
    return [
        {
            key: "productName",
            header: "Produk",
            render: (p) => (
                <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-medium truncate max-w-[160px]">{p.productName}</div>
                    <div className="text-[10px] text-muted-foreground">{p.productCode}</div>
                </div>
            ),
        },
        { key: "unitsSold", header: "Qty", align: "right" as const, render: (p) => <span className="text-xs sm:text-sm">{p.unitsSold}</span> },
        { key: "revenue", header: "Revenue", align: "right" as const, render: (p) => <span className="text-xs sm:text-sm font-mono tabular-nums">{formatCurrency(p.revenue)}</span> },
        {
            key: "profit", header: "Profit", align: "right" as const,
            render: (p) => <span className={`text-xs sm:text-sm font-semibold font-mono tabular-nums ${p.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(p.profit)}</span>,
        },
        {
            key: "margin", header: "Margin", align: "right" as const,
            render: (p) => {
                const cls = type === "top"
                    ? (p.margin >= 30 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : p.margin >= 15 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700")
                    : (p.margin < 0 ? "border-red-200 bg-red-50 text-red-700" : p.margin < 15 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700");
                return <Badge variant="outline" className={`text-[10px] sm:text-[11px] ${cls}`}>{p.margin}%</Badge>;
            },
        },
    ];
}

function productMobileRender(p: ProductProfit) {
    return (
        <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{p.productName}</p>
                <p className="text-[10px] text-muted-foreground">{p.productCode} · {p.unitsSold} qty</p>
            </div>
            <div className="text-right shrink-0">
                <p className={`text-xs font-semibold font-mono tabular-nums ${p.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(p.profit)}</p>
                <p className="text-[10px] text-muted-foreground">{p.margin}%</p>
            </div>
        </div>
    );
}

export function ProfitDashboardContent() {
    const { selectedBranchId } = useBranch();
    const qp = useQueryParams({ filters: { period: "month" } });
    const period = (qp.filters.period || "month") as Period;
    const setPeriod = (p: Period) => qp.setFilter("period", p);
    const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const [overview, setOverview] = useState<ProfitOverview | null>(null);
    const [categoryData, setCategoryData] = useState<CategoryProfit[]>([]);
    const [topProducts, setTopProducts] = useState<ProductProfit[]>([]);
    const [bottomProducts, setBottomProducts] = useState<ProductProfit[]>([]);
    const [branchData, setBranchData] = useState<BranchProfit[]>([]);
    const [trendData, setTrendData] = useState<TrendPoint[]>([]);
    const [marginDist, setMarginDist] = useState<MarginBracket[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const trendDays = PERIOD_TABS.find((t) => t.value === period)?.trendDays ?? 30;
            const branchArg = selectedBranchId || undefined;
            const [ov, cats, top, bottom, trend, margin, branches] = await Promise.all([
                getProfitOverview(period, branchArg),
                getProfitByCategory(period, branchArg),
                getProfitByProduct(period, branchArg, 10, "top"),
                getProfitByProduct(period, branchArg, 10, "bottom"),
                getProfitTrend(trendDays, branchArg),
                getMarginDistribution(branchArg),
                !branchArg ? getProfitByBranch(period) : Promise.resolve([]),
            ]);
            setOverview(ov); setCategoryData(cats); setTopProducts(top);
            setBottomProducts(bottom); setTrendData(trend); setMarginDist(margin); setBranchData(branches);
        } catch (error) {
            console.error("Failed to load profit dashboard:", error);
        } finally {
            setLoading(false);
        }
    }, [period, selectedBranchId]);

    useEffect(() => { fetchData(); }, [fetchData]);


    const totalMarginProducts = marginDist.reduce((s, m) => s + m.count, 0);
    const activePeriodLabel = PERIOD_TABS.find((t) => t.value === period)?.label || "Bulan Ini";

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
                        <BarChart3 className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Profit Dashboard</h1>
                        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Analisis profitabilitas bisnis</p>
                    </div>
                </div>

                {/* Desktop: inline period tabs */}
                <div className="hidden sm:flex items-center bg-muted/50 rounded-xl p-1 gap-0.5">
                    {PERIOD_TABS.map((tab) => (
                        <button key={tab.value} onClick={() => setPeriod(tab.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === tab.value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Mobile: period filter button + bottom sheet */}
            <div className="sm:hidden">
                <Button variant="outline" className="w-full justify-between rounded-xl" onClick={() => setPeriodSheetOpen(true)}>
                    <span className="flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs font-medium">{activePeriodLabel}</span>
                    </span>
                </Button>
                <Sheet open={periodSheetOpen} onOpenChange={setPeriodSheetOpen}>
                    <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                        <div className="shrink-0">
                            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-muted-foreground/20" /></div>
                            <SheetHeader className="px-4 pb-3 pt-0"><SheetTitle className="text-base font-bold">Pilih Periode</SheetTitle></SheetHeader>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                            {PERIOD_TABS.map((tab) => (
                                <button key={tab.value} onClick={() => { setPeriod(tab.value); setPeriodSheetOpen(false); }}
                                    className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                        period === tab.value ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted")}>
                                    <span>{tab.label}</span>
                                    {period === tab.value && <Check className="w-4 h-4" />}
                                </button>
                            ))}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {
                loading ? <div className="space-y-4 sm:space-y-6">

                    {/* Mobile period skeleton */}
                    <Skeleton className="sm:hidden h-9 w-full rounded-xl" />
                    {/* KPI cards skeleton */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-24 sm:h-32 rounded-xl sm:rounded-2xl" />
                        ))}
                    </div>
                    {/* Chart skeleton */}
                    <Skeleton className="h-[220px] sm:h-[360px] rounded-xl sm:rounded-2xl" />
                    {/* Two column skeleton */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
                        <Skeleton className="lg:col-span-3 h-[300px] sm:h-[400px] rounded-xl sm:rounded-2xl" />
                        <Skeleton className="lg:col-span-2 h-[300px] sm:h-[400px] rounded-xl sm:rounded-2xl" />
                    </div>
                    {/* Product tables skeleton */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        <Skeleton className="h-[280px] sm:h-[350px] rounded-xl sm:rounded-2xl" />
                        <Skeleton className="h-[280px] sm:h-[350px] rounded-xl sm:rounded-2xl" />
                    </div>
                </div> : <>
                    {/* KPI Cards */}
                    {overview && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
                            <KPICard title="Revenue" value={overview.revenue} growth={overview.revenueGrowth} icon={<DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />} color="blue" />
                            <KPICard title="HPP" value={overview.cogs} growth={overview.cogsGrowth} icon={<Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />} color="orange" invertGrowth />
                            <KPICard title="Gross Profit" value={overview.grossProfit} growth={overview.grossProfitGrowth} icon={<TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />} color="green" subtitle={`${overview.grossMargin}%`} />
                            <KPICard title="Expenses" value={overview.expenses} growth={overview.expensesGrowth} icon={<Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />} color="red" invertGrowth />
                            <KPICard title="Net Profit" value={overview.netProfit} growth={overview.netProfitGrowth} icon={overview.netProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />} color={overview.netProfit >= 0 ? "green" : "red"} subtitle={`${overview.netMargin}%`} highlight />
                        </div>
                    )}

                    {/* Profit Trend Chart */}
                    {trendData.length > 0 && (
                        <Card className="rounded-xl sm:rounded-2xl shadow-sm border py-0 gap-0">
                            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                                <CardTitle className="text-xs sm:text-base font-semibold flex items-center gap-2">
                                    <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                                    Tren Profit
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-1 sm:px-6 pb-3 sm:pb-6">
                                <div className="h-[200px] sm:h-[320px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} width={40} />
                                            <Tooltip content={<ChartTooltipContent />} />
                                            <Legend verticalAlign="top" height={28} formatter={(value: string) => <span className="text-[10px] sm:text-xs text-muted-foreground">{value}</span>} />
                                            <Area type="monotone" dataKey="cost" name="HPP" fill="url(#costGrad)" stroke="#f97316" strokeWidth={1.5} dot={false} />
                                            <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                            <Area type="monotone" dataKey="profit" name="Profit" fill="url(#profitGrad)" stroke="#22c55e" strokeWidth={2} dot={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Category + Margin Distribution */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
                        <Card className="lg:col-span-3 rounded-xl sm:rounded-2xl shadow-sm border py-0 gap-0">
                            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                                <CardTitle className="text-xs sm:text-base font-semibold flex items-center gap-2">
                                    <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                                    Profit per Kategori
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-1 sm:px-6 pb-3 sm:pb-6 space-y-3 sm:space-y-4">
                                {categoryData.length > 0 && (
                                    <div className="h-[180px] sm:h-[220px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={categoryData.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
                                                <YAxis type="category" dataKey="category" width={80} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                                                <Tooltip content={<ChartTooltipContent />} />
                                                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
                                                <Bar dataKey="profit" name="Profit" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={12} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                                <SmartTable<CategoryProfit>
                                    data={categoryData}
                                    columns={[
                                        { key: "category", header: "Kategori", render: (c) => <span className="text-xs sm:text-sm font-medium">{c.category}</span> },
                                        { key: "revenue", header: "Revenue", align: "right", render: (c) => <span className="text-xs sm:text-sm font-mono tabular-nums">{formatCurrency(c.revenue)}</span> },
                                        { key: "profit", header: "Profit", align: "right", render: (c) => <span className={`text-xs sm:text-sm font-semibold font-mono tabular-nums ${c.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(c.profit)}</span> },
                                        { key: "margin", header: "Margin", align: "right", render: (c) => <Badge variant="outline" className="text-[10px] sm:text-[11px]">{c.margin}%</Badge> },
                                    ] as SmartColumn<CategoryProfit>[]}
                                    totalItems={categoryData.length} totalPages={1} currentPage={1} pageSize={categoryData.length || 10}
                                    searchPlaceholder="Cari kategori..." onSearch={() => { }} onPageChange={() => { }} onPageSizeChange={() => { }}
                                    emptyTitle="Belum ada data" emptyDescription="Data akan muncul saat ada transaksi"
                                    mobileRender={(c) => (
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-medium truncate">{c.category}</span>
                                            <div className="text-right shrink-0">
                                                <span className={`text-xs font-semibold font-mono tabular-nums ${c.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(c.profit)}</span>
                                                <span className="text-[10px] text-muted-foreground ml-1.5">{c.margin}%</span>
                                            </div>
                                        </div>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2 rounded-xl sm:rounded-2xl shadow-sm border py-0 gap-0">
                            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                                <CardTitle className="text-xs sm:text-base font-semibold flex items-center gap-2">
                                    <PieChartIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                                    Distribusi Margin
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 space-y-3 sm:space-y-4">
                                {totalMarginProducts > 0 && (
                                    <div className="h-[160px] sm:h-[220px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={marginDist.filter((m) => m.count > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="count" nameKey="label">
                                                    {marginDist.filter((m) => m.count > 0).map((_, i) => (<Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length] || "#8884d8"} />))}
                                                </Pie>
                                                <Tooltip formatter={((value: number, name: string) => [`${value} produk`, name]) as never} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                                <div className="space-y-1.5 sm:space-y-2">
                                    {marginDist.map((bracket, i) => (
                                        <div key={bracket.label} className="flex items-center justify-between text-xs sm:text-sm">
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                                                <span className="text-muted-foreground text-[11px] sm:text-sm">{bracket.label}</span>
                                            </div>
                                            <span className="font-medium text-[11px] sm:text-sm">{bracket.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Product Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        <SmartTable<ProductProfit>
                            data={topProducts}
                            columns={getProductColumns("top")}
                            totalItems={topProducts.length} totalPages={1} currentPage={1} pageSize={topProducts.length || 10}
                            title="Top 10 Produk Untung"
                            titleIcon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
                            searchPlaceholder="Cari produk..." onSearch={() => { }} onPageChange={() => { }} onPageSizeChange={() => { }}
                            emptyTitle="Belum ada data" emptyDescription=""
                            mobileRender={productMobileRender}
                        />
                        <SmartTable<ProductProfit>
                            data={bottomProducts}
                            columns={getProductColumns("bottom")}
                            totalItems={bottomProducts.length} totalPages={1} currentPage={1} pageSize={bottomProducts.length || 10}
                            title="Bottom 10 Produk Rugi"
                            titleIcon={<TrendingDown className="w-4 h-4 text-red-500" />}
                            searchPlaceholder="Cari produk..." onSearch={() => { }} onPageChange={() => { }} onPageSizeChange={() => { }}
                            emptyTitle="Belum ada data" emptyDescription=""
                            mobileRender={productMobileRender}
                        />
                    </div>

                    {/* Branch Comparison */}
                    {!selectedBranchId && branchData.length > 0 && (
                        <SmartTable<BranchProfit>
                            data={branchData}
                            columns={[
                                { key: "branchName", header: "Cabang", render: (b) => <span className="text-xs sm:text-sm font-medium">{b.branchName}</span> },
                                { key: "revenue", header: "Revenue", align: "right", render: (b) => <span className="text-xs sm:text-sm font-mono tabular-nums">{formatCurrency(b.revenue)}</span> },
                                { key: "grossProfit", header: "Gross", align: "right", render: (b) => <span className={`text-xs sm:text-sm font-semibold font-mono tabular-nums ${b.grossProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(b.grossProfit)}</span> },
                                { key: "netProfit", header: "Net", align: "right", render: (b) => <span className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${b.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(b.netProfit)}</span> },
                                { key: "netMargin", header: "Margin", align: "right", render: (b) => <Badge variant="outline" className={`text-[10px] sm:text-[11px] ${b.netMargin >= 20 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : b.netMargin >= 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}`}>{b.netMargin}%</Badge> },
                            ] as SmartColumn<BranchProfit>[]}
                            totalItems={branchData.length} totalPages={1} currentPage={1} pageSize={branchData.length || 10}
                            title="Profit Antar Cabang"
                            titleIcon={<Building2 className="w-4 h-4 text-muted-foreground" />}
                            searchPlaceholder="Cari cabang..." onSearch={() => { }} onPageChange={() => { }} onPageSizeChange={() => { }}
                            emptyTitle="Belum ada data" emptyDescription=""
                            mobileRender={(b) => (
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium truncate">{b.branchName}</span>
                                    <div className="text-right shrink-0">
                                        <span className={`text-xs font-bold font-mono tabular-nums ${b.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(b.netProfit)}</span>
                                        <Badge variant="outline" className={`ml-1.5 text-[9px] ${b.netMargin >= 20 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : b.netMargin >= 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}`}>{b.netMargin}%</Badge>
                                    </div>
                                </div>
                            )}
                        />
                    )}</>
            }


        </div>
    );
}

/* ---------- KPI Card ---------- */
interface KPICardProps {
    title: string; value: number; growth: number; icon: React.ReactNode;
    color: "blue" | "green" | "orange" | "red";
    subtitle?: string; invertGrowth?: boolean; highlight?: boolean;
}

const COLOR_MAP = {
    blue: { icon: "bg-blue-100 text-blue-600" },
    green: { icon: "bg-emerald-100 text-emerald-600" },
    orange: { icon: "bg-orange-100 text-orange-600" },
    red: { icon: "bg-red-100 text-red-600" },
};

function KPICard({ title, value, growth, icon, color, subtitle, invertGrowth, highlight }: KPICardProps) {
    const c = COLOR_MAP[color];
    const displayGrowth = invertGrowth ? -growth : growth;

    return (
        <Card className={`rounded-xl sm:rounded-2xl shadow-sm border py-0 gap-0 ${highlight ? "ring-2 ring-emerald-200 border-emerald-100" : ""}`}>
            <CardContent className="pt-3 sm:pt-5 pb-2.5 sm:pb-4 px-3 sm:px-5">
                <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                    <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center ${c.icon}`}>
                        {icon}
                    </div>
                    <GrowthIndicator value={displayGrowth} />
                </div>
                <div className={`text-sm sm:text-xl font-bold tracking-tight font-mono tabular-nums ${value < 0 ? "text-red-600" : ""}`}>
                    {formatCurrency(value)}
                </div>
                <div className="flex items-center justify-between mt-0.5 sm:mt-1">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">{title}</span>
                    {subtitle && <span className={`text-[10px] sm:text-[11px] font-medium text-muted-foreground`}>{subtitle}</span>}
                </div>
            </CardContent>
        </Card>
    );
}
