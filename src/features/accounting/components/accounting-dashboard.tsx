"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Wallet,
    TrendingUp,
    CreditCard,
    Landmark,
    Plus,
    BookOpen,
    FileSpreadsheet,
    BarChart3,
    ArrowRight,
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from "recharts";
import { useAccountingDashboard } from "../hooks";
import { formatCurrency } from "@/lib/utils";

/* ── Helpers ───────────────────────────────────────────────────────────── */

function fmtCompact(value: number): string {
    if (Math.abs(value) >= 1_000_000_000)
        return `Rp ${(value / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(value) >= 1_000_000)
        return `Rp ${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000)
        return `Rp ${(value / 1_000).toFixed(1)}K`;
    return formatCurrency(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltipContent({ active, payload, label, valueLabel }: any) {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="rounded-xl border border-border/40 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-xl">
            <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
            {payload.map((entry: { color: string; value: number }, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-slate-600">{valueLabel}:</span>
                    <span className="font-semibold tabular-nums">
                        {formatCurrency(entry.value)}
                    </span>
                </div>
            ))}
        </div>
    );
}

/* ── Quick Action Card ─────────────────────────────────────────────────── */

interface QuickActionProps {
    href: string;
    icon: React.ElementType;
    label: string;
    gradient: string;
    shadowColor: string;
}

function QuickActionCard({ href, icon: Icon, label, gradient, shadowColor }: QuickActionProps) {
    return (
        <Link href={href}>
            <Card className="rounded-2xl border-0 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 group cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                    <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md ${shadowColor} group-hover:shadow-lg transition-shadow`}
                    >
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-700">{label}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </CardContent>
            </Card>
        </Link>
    );
}

/* ── KPI Stat Card ─────────────────────────────────────────────────────── */

interface KpiCardProps {
    label: string;
    value: number;
    icon: React.ElementType;
    gradient: string;
    shadowColor: string;
    valueColor: string;
}

function KpiCard({ label, value, icon: Icon, gradient, shadowColor, valueColor }: KpiCardProps) {
    return (
        <Card className="rounded-2xl border-0 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 group">
            <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md ${shadowColor} group-hover:shadow-lg transition-shadow`}
                    >
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                </div>
                <p className={`text-2xl font-extrabold font-mono tabular-nums tracking-tight ${valueColor}`}>
                    {fmtCompact(value)}
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-1.5">
                    {label}
                </p>
            </CardContent>
        </Card>
    );
}

/* ── Section Header ────────────────────────────────────────────────────── */

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <div className="w-1 h-5 bg-primary rounded-full" />
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            </div>
            {action}
        </div>
    );
}

/* ── Type badge color mapping ──────────────────────────────────────────── */

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
    MANUAL: { label: "Manual", className: "bg-slate-50 text-slate-600 border-slate-200" },
    SALE: { label: "Penjualan", className: "bg-blue-50 text-blue-600 border-blue-200" },
    PURCHASE: { label: "Pembelian", className: "bg-amber-50 text-amber-600 border-amber-200" },
    EXPENSE: { label: "Beban", className: "bg-rose-50 text-rose-600 border-rose-200" },
    ADJUSTMENT: { label: "Penyesuaian", className: "bg-violet-50 text-violet-600 border-violet-200" },
};

/* ── Loading Skeleton ──────────────────────────────────────────────────── */

function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Header skeleton */}
            <div>
                <div className="h-7 w-56 bg-slate-200 rounded-lg" />
                <div className="h-4 w-72 bg-slate-100 rounded-lg mt-2" />
            </div>
            {/* Quick actions skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white p-4 flex items-center gap-3">
                        <div className="w-11 h-11 bg-slate-100 rounded-xl" />
                        <div className="h-4 w-24 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>
            {/* KPI cards skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border/30 bg-white p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="w-11 h-11 bg-slate-100 rounded-xl" />
                        </div>
                        <div className="h-8 w-32 bg-slate-200 rounded-lg" />
                        <div className="h-3 w-20 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>
            {/* Charts skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-2xl border border-border/30 bg-white p-6 space-y-4">
                    <div className="h-5 w-48 bg-slate-200 rounded" />
                    <div className="h-[260px] bg-slate-50 rounded-xl" />
                </div>
                <div className="rounded-2xl border border-border/30 bg-white p-6 space-y-4">
                    <div className="h-5 w-40 bg-slate-200 rounded" />
                    <div className="h-[260px] bg-slate-50 rounded-xl" />
                </div>
            </div>
            {/* Table skeleton */}
            <div className="rounded-2xl border border-border/30 bg-white p-6 space-y-4">
                <div className="h-5 w-36 bg-slate-200 rounded" />
                {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-4">
                        <div className="h-4 w-20 bg-slate-100 rounded" />
                        <div className="h-4 w-16 bg-slate-50 rounded" />
                        <div className="flex-1 h-4 bg-slate-50 rounded" />
                        <div className="h-5 w-16 bg-slate-100 rounded-full" />
                        <div className="h-4 w-24 bg-slate-100 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Main Component ────────────────────────────────────────────────────── */

export function AccountingDashboard() {
    const { data, isPending } = useAccountingDashboard();

    if (isPending && !data) {
        return <DashboardSkeleton />;
    }

    if (!data) return null;

    return (
        <div className="space-y-6">
            {/* ===== Header ===== */}
            <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    Dashboard Akuntansi
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Ringkasan keuangan dan aktivitas akuntansi terkini
                </p>
            </div>

            {/* ===== Quick Action Cards ===== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <QuickActionCard
                    href="/accounting/journals"
                    icon={Plus}
                    label="Jurnal Umum"
                    gradient="from-blue-500 to-blue-600"
                    shadowColor="shadow-blue-200"
                />
                <QuickActionCard
                    href="/accounting/coa"
                    icon={BookOpen}
                    label="Bagan Akun"
                    gradient="from-emerald-500 to-teal-600"
                    shadowColor="shadow-emerald-200"
                />
                <QuickActionCard
                    href="/accounting/reports"
                    icon={BarChart3}
                    label="Laporan Keuangan"
                    gradient="from-violet-500 to-purple-600"
                    shadowColor="shadow-violet-200"
                />
                <QuickActionCard
                    href="/accounting/ledger"
                    icon={FileSpreadsheet}
                    label="Buku Besar"
                    gradient="from-amber-500 to-orange-600"
                    shadowColor="shadow-amber-200"
                />
            </div>

            {/* ===== KPI Stat Cards ===== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Total Kas"
                    value={data.totalCash}
                    icon={Wallet}
                    gradient="from-blue-500 to-blue-600"
                    shadowColor="shadow-blue-200"
                    valueColor="text-blue-600"
                />
                <KpiCard
                    label="Piutang"
                    value={data.totalReceivable}
                    icon={TrendingUp}
                    gradient="from-emerald-500 to-teal-600"
                    shadowColor="shadow-emerald-200"
                    valueColor="text-emerald-600"
                />
                <KpiCard
                    label="Hutang"
                    value={data.totalPayable}
                    icon={CreditCard}
                    gradient="from-rose-500 to-pink-600"
                    shadowColor="shadow-rose-200"
                    valueColor="text-rose-600"
                />
                <KpiCard
                    label="Laba Bulan Ini"
                    value={data.monthProfit}
                    icon={Landmark}
                    gradient={
                        data.monthProfit >= 0
                            ? "from-violet-500 to-purple-600"
                            : "from-red-500 to-rose-600"
                    }
                    shadowColor={data.monthProfit >= 0 ? "shadow-violet-200" : "shadow-red-200"}
                    valueColor={data.monthProfit >= 0 ? "text-violet-600" : "text-red-600"}
                />
            </div>

            {/* ===== Charts Section ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Revenue Trend - wider */}
                <Card className="lg:col-span-2 rounded-2xl border-0 shadow-sm bg-white hover:shadow-md transition-shadow duration-300">
                    <CardHeader className="pb-2">
                        <SectionHeader title="Tren Pendapatan 7 Hari Terakhir" />
                    </CardHeader>
                    <CardContent>
                        {data.revenueTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <AreaChart data={data.revenueTrend}>
                                    <defs>
                                        <linearGradient id="accRevGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#f1f5f9"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tickFormatter={(v: number) => fmtCompact(v)}
                                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        content={<ChartTooltipContent valueLabel="Pendapatan" />}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="amount"
                                        stroke="#3b82f6"
                                        fill="url(#accRevGrad)"
                                        strokeWidth={2.5}
                                        dot={false}
                                        activeDot={{
                                            r: 5,
                                            fill: "#3b82f6",
                                            stroke: "#fff",
                                            strokeWidth: 2,
                                        }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                                    <BarChart3 className="w-6 h-6 text-slate-300" />
                                </div>
                                <p className="text-sm text-muted-foreground">Belum ada data pendapatan</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Top Expenses */}
                <Card className="rounded-2xl border-0 shadow-sm bg-white hover:shadow-md transition-shadow duration-300">
                    <CardHeader className="pb-2">
                        <SectionHeader title="Top 5 Beban Bulan Ini" />
                    </CardHeader>
                    <CardContent>
                        {data.topExpenses.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={data.topExpenses} layout="vertical">
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#f1f5f9"
                                        horizontal={false}
                                    />
                                    <XAxis
                                        type="number"
                                        tickFormatter={(v: number) => fmtCompact(v)}
                                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="accountName"
                                        width={110}
                                        tick={{ fontSize: 10, fill: "#64748b" }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        content={<ChartTooltipContent valueLabel="Beban" />}
                                    />
                                    <Bar
                                        dataKey="amount"
                                        fill="url(#expenseBarGrad)"
                                        radius={[0, 6, 6, 0]}
                                    />
                                    <defs>
                                        <linearGradient id="expenseBarGrad" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.8} />
                                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={1} />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                                    <BarChart3 className="w-6 h-6 text-slate-300" />
                                </div>
                                <p className="text-sm text-muted-foreground">Belum ada data beban</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ===== Recent Journals ===== */}
            <Card className="rounded-2xl border-0 shadow-sm bg-white hover:shadow-md transition-shadow duration-300">
                <CardHeader className="pb-2">
                    <SectionHeader
                        title="Jurnal Terbaru"
                        action={
                            <Link href="/accounting/journals">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-primary hover:text-primary/80 gap-1"
                                >
                                    Lihat Semua
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Button>
                            </Link>
                        }
                    />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-slate-400">
                                        No. Jurnal
                                    </th>
                                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-slate-400">
                                        Tanggal
                                    </th>
                                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-slate-400">
                                        Deskripsi
                                    </th>
                                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-slate-400">
                                        Tipe
                                    </th>
                                    <th className="text-right px-5 py-3 font-semibold text-xs uppercase tracking-wider text-slate-400">
                                        Jumlah
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.recentJournals.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                                    <FileSpreadsheet className="w-5 h-5 text-slate-300" />
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    Belum ada jurnal
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    data.recentJournals.map((j) => {
                                        const badge = TYPE_BADGE[j.referenceType || "MANUAL"] ?? TYPE_BADGE.MANUAL;
                                        return (
                                            <tr
                                                key={j.id}
                                                className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                                            >
                                                <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-700">
                                                    {j.entryNumber}
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-slate-500">
                                                    {new Date(j.date).toLocaleDateString("id-ID", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-slate-600 truncate max-w-[240px]">
                                                    {j.description}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] font-semibold border ${badge?.className ?? ""}`}
                                                    >
                                                        {badge?.label ?? j.referenceType ?? "Manual"}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-slate-700">
                                                    {formatCurrency(j.totalDebit)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
