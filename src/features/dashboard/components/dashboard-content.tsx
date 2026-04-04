"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useBranch } from "@/components/providers/branch-provider";
import { getDashboardStats } from "@/server/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DollarSign, ShoppingCart, Package, TrendingUp,
    AlertTriangle, Users, CreditCard, Clock, BarChart3, ArrowUpRight, ArrowDownRight,
    CalendarDays, Wallet, Receipt, Tag, FileText, Trophy, Medal, Award, Zap, Building2,
} from "lucide-react";
import {
    BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import type { DashboardStats } from "@/types";
import { useDashboardRealtime } from "@/hooks/use-dashboard-socket";

const PAYMENT_LABELS: Record<string, string> = {
    CASH: "Cash", TRANSFER: "Transfer", QRIS: "QRIS",
    EWALLET: "E-Wallet", DEBIT: "Debit", CREDIT_CARD: "Kartu Kredit",
    TERMIN: "Termin",
};

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const STATUS_MAP: Record<string, { label: string; className: string }> = {
    COMPLETED: { label: "Selesai", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
    VOIDED: { label: "Void", className: "bg-red-50 text-red-700 border-red-200" },
    REFUNDED: { label: "Refund", className: "bg-slate-50 text-slate-700 border-slate-200" },
};

function GrowthBadge({ value }: { value: number }) {
    if (value === 0) return <span className="text-xs text-muted-foreground">--</span>;
    return (
        <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${value > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
            {value > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(value)}%
        </span>
    );
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 11) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 18) return "Selamat Sore";
    return "Selamat Malam";
}

function formatDate(): string {
    return new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function RankBadge({ rank }: { rank: number }) {
    if (rank === 0) return (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-sm shadow-amber-200 shrink-0">
            <Trophy className="w-4 h-4 text-white" />
        </div>
    );
    if (rank === 1) return (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center shadow-sm shadow-slate-200 shrink-0">
            <Medal className="w-4 h-4 text-white" />
        </div>
    );
    if (rank === 2) return (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center shadow-sm shadow-orange-200 shrink-0">
            <Award className="w-4 h-4 text-white" />
        </div>
    );
    return (
        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-400 shrink-0">
            {rank + 1}
        </div>
    );
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltipContent({ active, payload, label, valuePrefix }: any) {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="rounded-xl border border-border/40 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-xl">
            <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
            {payload.map((entry: { color: string; name: string; value: number }, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-slate-600">{entry.name}:</span>
                    <span className="font-semibold tabular-nums">{valuePrefix === "currency" ? formatCurrency(entry.value) : entry.value}</span>
                </div>
            ))}
        </div>
    );
}

type DashboardPeriod = "today" | "week" | "month" | "year";

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
    { value: "today", label: "Hari Ini" },
    { value: "week", label: "7 Hari" },
    { value: "month", label: "Bulan Ini" },
    { value: "year", label: "Tahun Ini" },
];

export function DashboardContent() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [period, setPeriod] = useState<DashboardPeriod>("today");
    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef<string | null | undefined>(undefined);
    const prevPeriodRef = useRef<DashboardPeriod>(period);

    const loadStats = (p: DashboardPeriod, branch?: string) => {
        getDashboardStats(branch || undefined, p).then(setStats);
    };

    const refreshStats = useCallback(() => {
        loadStats(period, selectedBranchId || undefined);
    }, [period, selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    useDashboardRealtime(refreshStats, selectedBranchId || undefined);

    useEffect(() => {
        if (!branchReady) return;
        const branchChanged = prevBranchRef.current !== selectedBranchId;
        const periodChanged = prevPeriodRef.current !== period;
        if (!branchChanged && !periodChanged) return;
        prevBranchRef.current = selectedBranchId;
        prevPeriodRef.current = period;
        loadStats(period, selectedBranchId || undefined);
    }, [selectedBranchId, branchReady, period]); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePeriodChange = (p: DashboardPeriod) => {
        setPeriod(p);
        loadStats(p, selectedBranchId || undefined);
    };

    if (!stats) return (
        <div className="space-y-6 animate-pulse">
            {/* Welcome header skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="h-7 w-48 bg-slate-200 rounded-lg" />
                    <div className="h-4 w-64 bg-slate-100 rounded-lg mt-2" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-9 w-28 bg-slate-200 rounded-full" />
                    <div className="h-9 w-28 bg-slate-100 rounded-full" />
                </div>
            </div>
            {/* Stat cards skeleton - 4 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border/30 bg-white p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="h-3 w-24 bg-slate-100 rounded" />
                            <div className="w-11 h-11 bg-slate-100 rounded-xl" />
                        </div>
                        <div className="h-8 w-32 bg-slate-200 rounded-lg" />
                        <div className="h-3 w-20 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>
            {/* Charts skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-border/30 bg-white p-6 space-y-4">
                    <div className="h-5 w-40 bg-slate-200 rounded" />
                    <div className="h-[260px] bg-slate-50 rounded-xl" />
                </div>
                <div className="rounded-2xl border border-border/30 bg-white p-6 space-y-4">
                    <div className="h-5 w-40 bg-slate-200 rounded" />
                    <div className="h-[260px] bg-slate-50 rounded-xl" />
                </div>
            </div>
            {/* Tables skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border/30 bg-white p-6 space-y-4">
                        <div className="h-5 w-36 bg-slate-200 rounded" />
                        {Array.from({ length: 5 }).map((_, j) => (
                            <div key={j} className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-100 rounded-xl" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3.5 w-3/4 bg-slate-100 rounded" />
                                    <div className="h-3 w-1/2 bg-slate-50 rounded" />
                                </div>
                                <div className="h-4 w-20 bg-slate-100 rounded" />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );

    const todayProfit = stats.todayProfit ?? 0;
    const avgTransactionValue = stats.avgTransactionValue ?? 0;
    const weekSales = stats.weekSales ?? 0;
    const activePromotions = stats.activePromotions ?? 0;
    const pendingPurchaseOrders = stats.pendingPurchaseOrders ?? 0;
    const refundCount = stats.refundCount ?? 0;
    const voidCount = stats.voidCount ?? 0;

    return (
        <div className="space-y-6">
            {/* ===== ROW 1: Welcome + Quick Actions ===== */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">{getGreeting()}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-sm text-slate-500">{formatDate()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/pos"
                        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-md shadow-blue-200 transition-all hover:shadow-lg hover:shadow-blue-300 hover:-translate-y-0.5"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        Buka POS
                    </Link>
                    <Link
                        href="/reports"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Lihat Laporan
                    </Link>
                </div>
            </div>

            {/* ===== FILTERED SECTION — affected by period ===== */}
            <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-b from-slate-50/50 to-white p-5 space-y-5">
                {/* Period filter header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        <h2 className="text-sm font-semibold text-foreground">Ringkasan Penjualan</h2>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {PERIOD_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => handlePeriodChange(opt.value)}
                                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all border ${period === opt.value
                                    ? "bg-primary text-white border-primary shadow-sm"
                                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ===== ROW 2: Main KPI Cards (3x2) ===== */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* 1. Penjualan Hari Ini */}
                    <Card className="rounded-2xl shadow-sm border-border/30 bg-white transition-shadow duration-300 hover:shadow-md group">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-200 group-hover:shadow-lg group-hover:shadow-blue-200 transition-shadow">
                                    <DollarSign className="w-5 h-5 text-white" />
                                </div>
                                <GrowthBadge value={stats.salesGrowthDay} />
                            </div>
                            <p className="text-3xl font-bold tabular-nums tracking-tight">{formatCurrency(stats.todaySales)}</p>
                            <p className="text-xs uppercase tracking-wider text-slate-500 mt-1.5 font-medium">Penjualan Hari Ini</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Kemarin: {formatCurrency(stats.yesterdaySales)}</p>
                        </CardContent>
                    </Card>

                    {/* 2. Transaksi Hari Ini */}
                    <Card className="rounded-2xl shadow-sm border-border/30 bg-white transition-shadow duration-300 hover:shadow-md group">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-200 group-hover:shadow-lg group-hover:shadow-emerald-200 transition-shadow">
                                    <ShoppingCart className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Avg. Value</p>
                                    <p className="text-xs font-semibold tabular-nums text-slate-600">{formatCurrency(avgTransactionValue)}</p>
                                </div>
                            </div>
                            <p className="text-3xl font-bold tabular-nums tracking-tight">{stats.todayTransactionCount}</p>
                            <p className="text-xs uppercase tracking-wider text-slate-500 mt-1.5 font-medium">Transaksi Hari Ini</p>
                            <div className="flex items-center gap-3 mt-0.5">
                                <p className="text-[11px] text-slate-400">Refund: {refundCount}</p>
                                <p className="text-[11px] text-slate-400">Void: {voidCount}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Profit Hari Ini */}
                    <Card className="rounded-2xl shadow-sm border-border/30 bg-white transition-shadow duration-300 hover:shadow-md group">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md transition-shadow ${todayProfit >= 0 ? "from-green-500 to-emerald-600 shadow-green-200 group-hover:shadow-lg group-hover:shadow-green-200" : "from-red-500 to-rose-600 shadow-red-200 group-hover:shadow-lg group-hover:shadow-red-200"}`}>
                                    <TrendingUp className="w-5 h-5 text-white" />
                                </div>
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${todayProfit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                                    {todayProfit >= 0 ? "Profit" : "Rugi"}
                                </span>
                            </div>
                            <p className={`text-3xl font-bold tabular-nums tracking-tight ${todayProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                {formatCurrency(Math.abs(todayProfit))}
                            </p>
                            <p className="text-xs uppercase tracking-wider text-slate-500 mt-1.5 font-medium">Profit Hari Ini</p>
                        </CardContent>
                    </Card>

                    {/* 4. Pendapatan Bulan Ini */}
                    <Card className="rounded-2xl shadow-sm border-border/30 bg-white transition-shadow duration-300 hover:shadow-md group">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-200 group-hover:shadow-lg group-hover:shadow-violet-200 transition-shadow">
                                    <Wallet className="w-5 h-5 text-white" />
                                </div>
                                <GrowthBadge value={stats.salesGrowthMonth} />
                            </div>
                            <p className="text-3xl font-bold tabular-nums tracking-tight">{formatCurrency(stats.monthRevenue)}</p>
                            <p className="text-xs uppercase tracking-wider text-slate-500 mt-1.5 font-medium">Pendapatan Bulan Ini</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{stats.monthTransactionCount} transaksi</p>
                        </CardContent>
                    </Card>

                    {/* 5. Penjualan Minggu Ini */}
                    <Card className="rounded-2xl shadow-sm border-border/30 bg-white transition-shadow duration-300 hover:shadow-md group">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center shadow-md shadow-cyan-200 group-hover:shadow-lg group-hover:shadow-cyan-200 transition-shadow">
                                    <Receipt className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold tabular-nums tracking-tight">{formatCurrency(weekSales)}</p>
                            <p className="text-xs uppercase tracking-wider text-slate-500 mt-1.5 font-medium">Penjualan Minggu Ini</p>
                        </CardContent>
                    </Card>

                    {/* 6. Total Produk + Customer */}
                    <Card className="rounded-2xl shadow-sm border-border/30 bg-white transition-shadow duration-300 hover:shadow-md group">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md shadow-orange-200 group-hover:shadow-lg group-hover:shadow-orange-200 transition-shadow">
                                    <Package className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold tabular-nums tracking-tight">{stats.totalProducts}</p>
                            <p className="text-xs uppercase tracking-wider text-slate-500 mt-1.5 font-medium">Total Produk Aktif</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <Users className="w-3 h-3 text-slate-400" />
                                <p className="text-[11px] text-slate-400">{stats.totalCustomers} customer terdaftar</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ===== Branch Performance (All Locations only) ===== */}
                {!selectedBranchId && stats.branchPerformance?.length > 0 && (() => {
                    const totalMonthRevenue = stats.branchPerformance.reduce((s, b) => s + b.periodSales, 0);
                    const gradients = [
                        "from-blue-50 to-indigo-50 border-blue-100",
                        "from-emerald-50 to-teal-50 border-emerald-100",
                        "from-violet-50 to-purple-50 border-violet-100",
                        "from-amber-50 to-orange-50 border-amber-100",
                        "from-cyan-50 to-sky-50 border-cyan-100",
                        "from-rose-50 to-pink-50 border-rose-100",
                    ];
                    const barColors = [
                        "from-blue-400 to-indigo-500",
                        "from-emerald-400 to-teal-500",
                        "from-violet-400 to-purple-500",
                        "from-amber-400 to-orange-500",
                        "from-cyan-400 to-sky-500",
                        "from-rose-400 to-pink-500",
                    ];
                    return (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                                    <Building2 className="w-4 h-4 text-white" />
                                </div>
                                <h2 className="text-base font-semibold text-foreground">Pencapaian per Lokasi</h2>
                            </div>
                            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                                {stats.branchPerformance.map((branch, idx) => {
                                    const pct = totalMonthRevenue > 0 ? Math.round((branch.periodSales / totalMonthRevenue) * 100) : 0;
                                    const prevSales = branch.prevPeriodSales;
                                    const salesGrowth = prevSales > 0 ? Math.round(((branch.periodSales - prevSales) / prevSales) * 100) : 0;
                                    return (
                                        <Card key={branch.branchId} className={`min-w-[220px] max-w-[260px] rounded-2xl border bg-gradient-to-br ${gradients[idx % gradients.length]} shadow-sm transition-shadow duration-300 hover:shadow-md shrink-0`}>
                                            <CardContent className="p-4">
                                                <p className="font-semibold text-sm text-slate-800 truncate">{branch.branchName}</p>
                                                <p className="text-2xl font-bold tabular-nums tracking-tight text-blue-700 mt-2">{formatCurrency(branch.periodSales)}</p>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">{branch.periodTransactions} transaksi</Badge>
                                                    {salesGrowth !== 0 && (
                                                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${salesGrowth > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                                            {salesGrowth > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                            {Math.abs(salesGrowth)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[10px] text-slate-400 font-medium">Kontribusi</span>
                                                        <span className="text-[10px] font-semibold text-slate-600">{pct}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 rounded-full bg-black/5">
                                                        <div className={`h-full rounded-full bg-gradient-to-r ${barColors[idx % barColors.length]} transition-all duration-500`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                {/* ===== ROW 3: Yearly Comparison (2/3) + Payment Methods (1/3) ===== */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Yearly Comparison Chart */}
                    <Card className="lg:col-span-3 rounded-2xl shadow-sm border-border/30 transition-shadow duration-300 hover:shadow-md">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                                        <BarChart3 className="w-4 h-4 text-white" />
                                    </div>
                                    Perbandingan Tahunan
                                </CardTitle>
                                <div className="flex items-center gap-4 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                        <span className="text-slate-500 font-medium">{new Date().getFullYear()}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                        <span className="text-slate-500 font-medium">{new Date().getFullYear() - 1}</span>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={stats.yearlyComparison} barGap={4}>
                                    <defs>
                                        <linearGradient id="barThisYear" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" />
                                            <stop offset="100%" stopColor="#6366f1" />
                                        </linearGradient>
                                        <linearGradient id="barLastYear" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" />
                                            <stop offset="100%" stopColor="#059669" />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                                    <Tooltip
                                        content={<ChartTooltipContent valuePrefix="currency" />}
                                    />
                                    <Bar dataKey="thisYear" name={`Tahun ${new Date().getFullYear()}`} fill="url(#barThisYear)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                                    <Bar dataKey="lastYear" name={`Tahun ${new Date().getFullYear() - 1}`} fill="url(#barLastYear)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                            {/* Summary */}
                            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border/20">
                                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-3.5">
                                    <p className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold">{new Date().getFullYear()}</p>
                                    <p className="text-lg font-bold tabular-nums text-blue-700 mt-0.5">{formatCurrency(stats.yearlyComparison.reduce((s, m) => s + m.thisYear, 0))}</p>
                                    <p className="text-xs text-blue-500 mt-0.5">{stats.yearlyComparison.reduce((s, m) => s + m.thisYearCount, 0)} transaksi</p>
                                </div>
                                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5">
                                    <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold">{new Date().getFullYear() - 1}</p>
                                    <p className="text-lg font-bold tabular-nums text-emerald-700 mt-0.5">{formatCurrency(stats.yearlyComparison.reduce((s, m) => s + m.lastYear, 0))}</p>
                                    <p className="text-xs text-emerald-500 mt-0.5">{stats.yearlyComparison.reduce((s, m) => s + m.lastYearCount, 0)} transaksi</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment Method Breakdown */}
                    <Card className="lg:col-span-2 rounded-2xl shadow-sm border-border/30 transition-shadow duration-300 hover:shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                                    <CreditCard className="w-4 h-4 text-white" />
                                </div>
                                Metode Pembayaran
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {stats.paymentBreakdown.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height={190}>
                                        <PieChart>
                                            <defs>
                                                {PIE_COLORS.map((color, i) => (
                                                    <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                                                        <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                                                        <stop offset="100%" stopColor={color} stopOpacity={1} />
                                                    </linearGradient>
                                                ))}
                                            </defs>
                                            <Pie data={stats.paymentBreakdown} dataKey="total" nameKey="method" cx="50%" cy="50%" innerRadius={50} outerRadius={80} strokeWidth={3} stroke="#fff">
                                                {stats.paymentBreakdown.map((_, i) => (
                                                    <Cell key={i} fill={`url(#pieGrad${i % PIE_COLORS.length})`} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value) => formatCurrency(Number(value))}
                                                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", fontSize: "12px", backdropFilter: "blur(8px)" }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="space-y-2.5 mt-3">
                                        {stats.paymentBreakdown.map((p, i) => {
                                            const totalPayments = stats.paymentBreakdown.reduce((s, pb) => s + pb.total, 0);
                                            const pct = totalPayments > 0 ? Math.round((p.total / totalPayments) * 100) : 0;
                                            return (
                                                <div key={p.method} className="flex items-center justify-between text-sm group/item">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                        <span className="text-slate-600 font-medium">{PAYMENT_LABELS[p.method] || p.method}</span>
                                                        <span className="text-[10px] text-slate-400 font-medium">{pct}%</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-semibold tabular-nums text-slate-700">{formatCurrency(p.total)}</span>
                                                        <span className="text-slate-400 text-xs ml-1.5">({p.count})</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <CreditCard className="w-10 h-10 text-slate-200 mb-3" />
                                    <p className="text-sm text-slate-400">Belum ada data pembayaran</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ===== ROW 4: Daily Trend (1/2) + Hourly Sales (1/2) ===== */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Daily Sales Trend (30 days) */}
                    <Card className="rounded-2xl shadow-sm border-border/30 transition-shadow duration-300 hover:shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                    <TrendingUp className="w-4 h-4 text-white" />
                                </div>
                                Tren Penjualan 30 Hari
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={240}>
                                <AreaChart data={stats.dailySales}>
                                    <defs>
                                        <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                                            <stop offset="50%" stopColor="#6366f1" stopOpacity={0.08} />
                                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={4} />
                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip
                                        content={<ChartTooltipContent valuePrefix="currency" />}
                                    />
                                    <Area type="monotone" dataKey="total" name="Penjualan" stroke="#3b82f6" strokeWidth={2.5} fill="url(#dailyGradient)" dot={false} activeDot={{ r: 5, stroke: "#3b82f6", strokeWidth: 2, fill: "#fff" }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Hourly Sales Today */}
                    <Card className="rounded-2xl shadow-sm border-border/30 transition-shadow duration-300 hover:shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                                    <Clock className="w-4 h-4 text-white" />
                                </div>
                                Penjualan Per Jam (Hari Ini)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={stats.hourlySales.filter((h) => h.count > 0 || (Number(h.hour.split(":")[0]) >= 6 && Number(h.hour.split(":")[0]) <= 22))}>
                                    <defs>
                                        <linearGradient id="hourlyGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" />
                                            <stop offset="100%" stopColor="#059669" />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip
                                        content={<ChartTooltipContent valuePrefix="currency" />}
                                    />
                                    <Bar dataKey="total" name="Penjualan" fill="url(#hourlyGradient)" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

            </div>{/* END FILTERED SECTION */}

            {/* ===== NON-FILTERED SECTION — always real-time ===== */}

            {/* ===== ROW 5: Alerts Row (3 cards) ===== */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Stok Menipis Alert */}
                <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 transition-shadow duration-300 hover:shadow-md">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200">
                                <AlertTriangle className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wider text-amber-600 font-semibold">Stok Menipis</p>
                                <p className="text-2xl font-bold tabular-nums text-amber-800 mt-0.5">{stats.lowStockProducts.length}</p>
                            </div>
                        </div>
                        <Link href="/products?filter=low-stock" className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors underline underline-offset-2">
                            Lihat Detail
                        </Link>
                    </div>
                </div>

                {/* Promo Aktif */}
                <div className="rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 transition-shadow duration-300 hover:shadow-md">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-200">
                                <Tag className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wider text-blue-600 font-semibold">Promo Aktif</p>
                                <p className="text-2xl font-bold tabular-nums text-blue-800 mt-0.5">{activePromotions}</p>
                            </div>
                        </div>
                        <Link href="/promotions" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors underline underline-offset-2">
                            Kelola
                        </Link>
                    </div>
                </div>

                {/* PO Pending */}
                <div className="rounded-2xl border border-orange-200/60 bg-gradient-to-br from-orange-50 to-rose-50 p-5 transition-shadow duration-300 hover:shadow-md">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-md shadow-orange-200">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wider text-orange-600 font-semibold">PO Pending</p>
                                <p className="text-2xl font-bold tabular-nums text-orange-800 mt-0.5">{pendingPurchaseOrders}</p>
                            </div>
                        </div>
                        <Link href="/purchases" className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors underline underline-offset-2">
                            Lihat Detail
                        </Link>
                    </div>
                </div>
            </div>

            {/* ===== ROW 6: Top Products (1/3) + Category (1/3) + Top Cashiers (1/3) ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Products */}
                <Card className="rounded-2xl shadow-sm border-border/30 transition-shadow duration-300 hover:shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                                <Trophy className="w-4 h-4 text-white" />
                            </div>
                            Produk Terlaris
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.topProducts.map((product, i) => (
                                <div key={product.productName} className="flex items-center gap-3 group/item p-2 -mx-2 rounded-xl hover:bg-slate-50 transition-colors">
                                    <RankBadge rank={i} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate text-slate-700">{product.productName}</p>
                                        <p className="text-xs text-slate-400">{product._sum.quantity} terjual</p>
                                    </div>
                                    <p className="text-sm font-semibold tabular-nums text-slate-700">{formatCurrency(product._sum.subtotal || 0)}</p>
                                </div>
                            ))}
                            {stats.topProducts.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <Package className="w-10 h-10 text-slate-200 mb-3" />
                                    <p className="text-sm text-slate-400">Belum ada data</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Category Breakdown */}
                <Card className="rounded-2xl shadow-sm border-border/30 transition-shadow duration-300 hover:shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-white" />
                            </div>
                            Penjualan per Kategori
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.categoryBreakdown.length > 0 ? (
                            <div className="space-y-3">
                                {stats.categoryBreakdown.slice(0, 8).map((cat, i) => {
                                    const maxTotal = stats.categoryBreakdown[0]?.total || 1;
                                    const percent = Math.round((cat.total / maxTotal) * 100);
                                    return (
                                        <div key={cat.name} className="group/cat">
                                            <div className="flex items-center justify-between text-sm mb-1.5">
                                                <span className="text-slate-600 font-medium truncate">{cat.name}</span>
                                                <span className="font-semibold tabular-nums text-slate-700 ml-2">{formatCurrency(cat.total)}</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500 ease-out"
                                                    style={{
                                                        width: `${percent}%`,
                                                        background: `linear-gradient(90deg, ${PIE_COLORS[i % PIE_COLORS.length]}, ${PIE_COLORS[(i + 1) % PIE_COLORS.length]})`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <BarChart3 className="w-10 h-10 text-slate-200 mb-3" />
                                <p className="text-sm text-slate-400">Belum ada data</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Top Cashiers */}
                <Card className="rounded-2xl shadow-sm border-border/30 transition-shadow duration-300 hover:shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center">
                                <Users className="w-4 h-4 text-white" />
                            </div>
                            Performa Kasir
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.topCashiers.map((cashier, i) => (
                                <div key={cashier.name} className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-slate-50 transition-colors">
                                    <RankBadge rank={i} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate text-slate-700">{cashier.name}</p>
                                        <p className="text-xs text-slate-400">{cashier.count} transaksi</p>
                                    </div>
                                    <p className="text-sm font-semibold tabular-nums text-slate-700">{formatCurrency(cashier.total)}</p>
                                </div>
                            ))}
                            {stats.topCashiers.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <Users className="w-10 h-10 text-slate-200 mb-3" />
                                    <p className="text-sm text-slate-400">Belum ada data</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ===== ROW 7: Recent Transactions (full width) ===== */}
            <Card className="rounded-2xl shadow-sm border-border/30 transition-shadow duration-300 hover:shadow-md">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                                <Receipt className="w-4 h-4 text-white" />
                            </div>
                            Transaksi Terakhir
                        </CardTitle>
                        <Link href="/transactions" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors underline underline-offset-2">
                            Lihat Semua
                        </Link>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border/30 hover:bg-transparent">
                                    <TableHead className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Invoice</TableHead>
                                    <TableHead className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Kasir</TableHead>
                                    <TableHead className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Pembayaran</TableHead>
                                    <TableHead className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Status</TableHead>
                                    <TableHead className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.recentTransactions.map((tx) => {
                                    const statusInfo = STATUS_MAP[tx.status] ?? { label: tx.status, className: "bg-slate-50 text-slate-600 border-slate-200" };
                                    return (
                                        <TableRow key={tx.id} className="border-border/20 hover:bg-slate-50/50 transition-colors">
                                            <TableCell>
                                                <div>
                                                    <p className="font-semibold text-sm text-slate-700">{tx.invoiceNumber}</p>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(tx.createdAt)}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-slate-600 font-medium">{tx.user.name}</span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
                                                    <CreditCard className="w-3 h-3" />
                                                    {PAYMENT_LABELS[tx.paymentMethod] ?? tx.paymentMethod}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center text-[11px] font-semibold rounded-full px-2.5 py-1 border ${statusInfo.className}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="font-bold text-sm tabular-nums text-slate-700">{formatCurrency(tx.grandTotal)}</span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {stats.recentTransactions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12">
                                            <Receipt className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                            <p className="text-sm text-slate-400">Belum ada transaksi hari ini</p>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* ===== Low Stock Detail Table ===== */}
            {stats.lowStockProducts.length > 0 && (
                <Card className="rounded-2xl shadow-sm border-border/30 transition-shadow duration-300 hover:shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-red-500 flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 text-white" />
                            </div>
                            Detail Stok Menipis
                            <Badge variant="secondary" className="ml-2 rounded-full text-xs tabular-nums bg-amber-100 text-amber-700 border-0">
                                {stats.lowStockProducts.length} produk
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border/30 hover:bg-transparent">
                                        <TableHead className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Produk</TableHead>
                                        <TableHead className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Kategori</TableHead>
                                        <TableHead className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold text-center">Min. Stok</TableHead>
                                        <TableHead className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold text-right">Stok Saat Ini</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.lowStockProducts.map((product) => (
                                        <TableRow key={product.id} className="border-border/20 hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="font-semibold text-sm text-slate-700">{product.name}</TableCell>
                                            <TableCell className="text-sm text-slate-500">{product.category.name}</TableCell>
                                            <TableCell className="text-center">
                                                <span className="text-xs text-slate-400 tabular-nums">{product.minStock}</span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge
                                                    variant={product.stock <= 3 ? "destructive" : "secondary"}
                                                    className={`rounded-full tabular-nums font-semibold text-xs px-3 ${product.stock <= 3 ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100" : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"}`}
                                                >
                                                    {product.stock}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
