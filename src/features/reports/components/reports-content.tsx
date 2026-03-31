"use client";

import { useEffect, useState, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import { getSalesReport, getTopProductsReport, getProfitLossReport, getPaymentMethodReport, getHourlySalesReport, getReportOverview } from "@/features/reports";
import { useBranch } from "@/components/providers/branch-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area,
} from "recharts";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Download, Printer, Filter, Loader2, ReceiptText, Package } from "lucide-react";
import { exportToCSV, printReport } from "@/lib/export";
import type { SalesData, TopProduct, ProfitLoss, PaymentMethodReport, HourlySalesReport, ReportOverview } from "@/types";

interface Props {
    dailySales: SalesData[];
    monthlySales: SalesData[];
    topProducts: TopProduct[];
    profitLoss: ProfitLoss;
    paymentMethods: PaymentMethodReport[];
    hourlySales: HourlySalesReport[];
    overview: ReportOverview;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Cash",
    TRANSFER: "Transfer",
    QRIS: "QRIS",
    EWALLET: "E-Wallet",
    DEBIT: "Debit",
    CREDIT_CARD: "Kartu Kredit",
};

const chartTooltipStyle = {
    borderRadius: "16px",
    border: "none",
    boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
    padding: "12px 16px",
    fontSize: "13px",
    background: "white",
};

const chartAxisStyle = {
    fontSize: 11,
    fontFamily: "inherit",
    fill: "#94a3b8",
};

export function ReportsContent({
    dailySales: initialDaily,
    monthlySales: initialMonthly,
    topProducts: initialTop,
    profitLoss: initialPL,
    paymentMethods: initialPaymentMethods,
    hourlySales: initialHourlySales,
    overview: initialOverview,
}: Props) {
    const { selectedBranchId } = useBranch();
    const [dailySales, setDailySales] = useState(initialDaily);
    const [monthlySales, setMonthlySales] = useState(initialMonthly);
    const [topProducts, setTopProducts] = useState(initialTop);
    const [profitLoss, setProfitLoss] = useState(initialPL);
    const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods);
    const [hourlySales, setHourlySales] = useState(initialHourlySales);
    const [overview, setOverview] = useState(initialOverview);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [isFiltering, startTransition] = useTransition();

    const applyDateFilter = () => {
        startTransition(async () => {
            const [daily, monthly, top, pl, paymentMethodData, hourlyData, overviewData] = await Promise.all([
                getSalesReport("daily", dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
                getSalesReport("monthly", dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
                getTopProductsReport(10, dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
                getProfitLossReport(dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
                getPaymentMethodReport(dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
                getHourlySalesReport(dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
                getReportOverview(dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
            ]);
            setDailySales(daily);
            setMonthlySales(monthly);
            setTopProducts(top);
            setProfitLoss(pl);
            setPaymentMethods(paymentMethodData);
            setHourlySales(hourlyData);
            setOverview(overviewData);
        });
    };

    const resetDateFilter = () => {
        setDateFrom("");
        setDateTo("");
        startTransition(async () => {
            const [daily, monthly, top, pl, paymentMethodData, hourlyData, overviewData] = await Promise.all([
                getSalesReport("daily", undefined, undefined, selectedBranchId || undefined),
                getSalesReport("monthly", undefined, undefined, selectedBranchId || undefined),
                getTopProductsReport(10, undefined, undefined, selectedBranchId || undefined),
                getProfitLossReport(undefined, undefined, selectedBranchId || undefined),
                getPaymentMethodReport(undefined, undefined, selectedBranchId || undefined),
                getHourlySalesReport(undefined, undefined, selectedBranchId || undefined),
                getReportOverview(undefined, undefined, selectedBranchId || undefined),
            ]);
            setDailySales(daily);
            setMonthlySales(monthly);
            setTopProducts(top);
            setProfitLoss(pl);
            setPaymentMethods(paymentMethodData);
            setHourlySales(hourlyData);
            setOverview(overviewData);
        });
    };

    useEffect(() => {
        startTransition(async () => {
            const [daily, monthly, top, pl, paymentMethodData, hourlyData, overviewData] = await Promise.all([
                getSalesReport("daily", dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
                getSalesReport("monthly", dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
                getTopProductsReport(10, dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
                getProfitLossReport(dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
                getPaymentMethodReport(dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
                getHourlySalesReport(dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
                getReportOverview(dateFrom || undefined, dateTo || undefined, selectedBranchId || undefined),
            ]);
            setDailySales(daily);
            setMonthlySales(monthly);
            setTopProducts(top);
            setProfitLoss(pl);
            setPaymentMethods(paymentMethodData);
            setHourlySales(hourlyData);
            setOverview(overviewData);
        });
    }, [selectedBranchId]);

    const handleExportDaily = () => {
        exportToCSV(
            dailySales.map((d) => ({ Tanggal: d.label, Penjualan: d.sales, Transaksi: d.transactions, Diskon: d.discount, Pajak: d.tax })),
            "laporan-penjualan-harian"
        );
    };

    const handleExportMonthly = () => {
        exportToCSV(
            monthlySales.map((d) => ({ Bulan: d.label, Penjualan: d.sales, Transaksi: d.transactions, Diskon: d.discount, Pajak: d.tax })),
            "laporan-penjualan-bulanan"
        );
    };

    const handleExportTopProducts = () => {
        exportToCSV(
            topProducts.map((p, i) => ({ No: i + 1, Produk: p.productName, Kode: p.productCode, QtyTerjual: p._sum.quantity || 0, TotalPenjualan: p._sum.subtotal || 0 })),
            "produk-terlaris"
        );
    };

    const handlePrintProfitLoss = () => {
        printReport("Laporan Laba Rugi", `
      <table>
        <tr><td>Periode</td><td class="text-right font-bold">${profitLoss.period}</td></tr>
        <tr><td>Jumlah Transaksi</td><td class="text-right">${profitLoss.transactionCount}</td></tr>
        <tr><td>Pendapatan</td><td class="text-right">${formatCurrency(profitLoss.revenue)}</td></tr>
        <tr><td>Modal (HPP)</td><td class="text-right">${formatCurrency(profitLoss.cost)}</td></tr>
        <tr><td>Laba Kotor</td><td class="text-right font-bold">${formatCurrency(profitLoss.grossProfit)}</td></tr>
        <tr><td>Diskon</td><td class="text-right">${formatCurrency(profitLoss.discount)}</td></tr>
        <tr><td>Pajak</td><td class="text-right">${formatCurrency(profitLoss.tax)}</td></tr>
        <tr><td>Laba Bersih</td><td class="text-right font-bold">${formatCurrency(profitLoss.netProfit)}</td></tr>
      </table>
    `);
    };

    const marginPercent = profitLoss.revenue > 0
        ? ((profitLoss.grossProfit / profitLoss.revenue) * 100).toFixed(1)
        : "0.0";

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        Analytics & Reports
                    </h1>
                    <p className="text-muted-foreground text-[15px]">
                        Pantau performa bisnis Anda secara real-time
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl h-9 text-xs font-medium border-border/60 hover:bg-slate-50 transition-colors"
                        onClick={handleExportDaily}
                    >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Export CSV
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl h-9 text-xs font-medium border-border/60 hover:bg-slate-50 transition-colors"
                        onClick={handlePrintProfitLoss}
                    >
                        <Printer className="w-3.5 h-3.5 mr-1.5" />
                        Print P&L
                    </Button>
                </div>
            </div>

            {/* Date Range Filter */}
            <Card className="rounded-2xl shadow-sm border border-border/40 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                            <Filter className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Periode</span>
                        </div>
                        <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Dari tanggal" className="w-[180px]" />
                        <span className="text-xs text-muted-foreground font-medium">s/d</span>
                        <DatePicker value={dateTo} onChange={setDateTo} placeholder="Sampai tanggal" className="w-[180px]" />
                        <Button
                            size="sm"
                            className="rounded-xl h-8 px-5 text-xs font-semibold shadow-sm"
                            onClick={applyDateFilter}
                            disabled={isFiltering}
                        >
                            {isFiltering ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                            Terapkan
                        </Button>
                        {(dateFrom || dateTo) && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-xl h-8 text-xs text-muted-foreground hover:text-foreground"
                                onClick={resetDateFilter}
                            >
                                Reset
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* P&L Summary - Row 1: Primary Metrics */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-5 w-1 bg-primary rounded-full" />
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                        Laba Rugi &mdash; {profitLoss.period}
                    </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Revenue */}
                    <Card className="rounded-2xl shadow-sm border-0 bg-gradient-to-br from-blue-50 to-blue-50/30 overflow-hidden relative group hover:shadow-md transition-shadow duration-300">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2.5 bg-blue-100 rounded-xl">
                                    <DollarSign className="w-4.5 h-4.5 text-blue-600" />
                                </div>
                                <span className="text-[11px] font-semibold text-blue-600/70 bg-blue-100/80 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                    Revenue
                                </span>
                            </div>
                            <p className="text-3xl font-extrabold text-blue-900 tracking-tight">
                                {formatCurrency(profitLoss.revenue)}
                            </p>
                            <p className="text-xs text-blue-600/60 mt-2 font-medium">
                                Total pendapatan periode ini
                            </p>
                        </CardContent>
                    </Card>

                    {/* Cost / COGS */}
                    <Card className="rounded-2xl shadow-sm border-0 bg-gradient-to-br from-rose-50 to-rose-50/30 overflow-hidden relative group hover:shadow-md transition-shadow duration-300">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2.5 bg-rose-100 rounded-xl">
                                    <TrendingDown className="w-4.5 h-4.5 text-rose-600" />
                                </div>
                                <span className="text-[11px] font-semibold text-rose-600/70 bg-rose-100/80 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                    COGS
                                </span>
                            </div>
                            <p className="text-3xl font-extrabold text-rose-900 tracking-tight">
                                {formatCurrency(profitLoss.cost)}
                            </p>
                            <p className="text-xs text-rose-600/60 mt-2 font-medium">
                                Harga pokok penjualan
                            </p>
                        </CardContent>
                    </Card>

                    {/* Gross Profit */}
                    <Card className="rounded-2xl shadow-sm border-0 bg-gradient-to-br from-emerald-50 to-emerald-50/30 overflow-hidden relative group hover:shadow-md transition-shadow duration-300">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2.5 bg-emerald-100 rounded-xl">
                                    <TrendingUp className="w-4.5 h-4.5 text-emerald-600" />
                                </div>
                                <span className="text-[11px] font-semibold text-emerald-600/70 bg-emerald-100/80 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                    Gross Profit
                                </span>
                            </div>
                            <p className="text-3xl font-extrabold text-emerald-900 tracking-tight">
                                {formatCurrency(profitLoss.grossProfit)}
                            </p>
                            <p className="text-xs text-emerald-600/60 mt-2 font-medium">
                                Margin {marginPercent}%
                            </p>
                        </CardContent>
                    </Card>

                    {/* Net Profit */}
                    <Card className={`rounded-2xl shadow-sm border-0 overflow-hidden relative group hover:shadow-md transition-shadow duration-300 ${
                        profitLoss.netProfit >= 0
                            ? "bg-gradient-to-br from-teal-50 to-teal-50/30"
                            : "bg-gradient-to-br from-red-50 to-red-50/30"
                    }`}>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-2.5 rounded-xl ${profitLoss.netProfit >= 0 ? "bg-teal-100" : "bg-red-100"}`}>
                                    <BarChart3 className={`w-4.5 h-4.5 ${profitLoss.netProfit >= 0 ? "text-teal-600" : "text-red-600"}`} />
                                </div>
                                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                                    profitLoss.netProfit >= 0
                                        ? "text-teal-600/70 bg-teal-100/80"
                                        : "text-red-600/70 bg-red-100/80"
                                }`}>
                                    Net Profit
                                </span>
                            </div>
                            <p className={`text-3xl font-extrabold tracking-tight ${
                                profitLoss.netProfit >= 0 ? "text-teal-900" : "text-red-900"
                            }`}>
                                {formatCurrency(profitLoss.netProfit)}
                            </p>
                            <p className={`text-xs mt-2 font-medium ${
                                profitLoss.netProfit >= 0 ? "text-teal-600/60" : "text-red-600/60"
                            }`}>
                                Setelah diskon & pajak
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Overview KPI Cards - Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="rounded-2xl shadow-sm border border-border/30 bg-white hover:shadow-md transition-shadow duration-300">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-violet-50 rounded-xl">
                                <ReceiptText className="w-4 h-4 text-violet-600" />
                            </div>
                        </div>
                        <p className="text-[13px] text-muted-foreground font-medium mb-1">Jumlah Transaksi</p>
                        <p className="text-3xl font-extrabold tracking-tight text-foreground">
                            {overview.transactions.toLocaleString("id-ID")}
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm border border-border/30 bg-white hover:shadow-md transition-shadow duration-300">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-amber-50 rounded-xl">
                                <Package className="w-4 h-4 text-amber-600" />
                            </div>
                        </div>
                        <p className="text-[13px] text-muted-foreground font-medium mb-1">Item Terjual</p>
                        <p className="text-3xl font-extrabold tracking-tight text-foreground">
                            {overview.totalItemsSold.toLocaleString("id-ID")}
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm border border-border/30 bg-white hover:shadow-md transition-shadow duration-300">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-sky-50 rounded-xl">
                                <DollarSign className="w-4 h-4 text-sky-600" />
                            </div>
                        </div>
                        <p className="text-[13px] text-muted-foreground font-medium mb-1">Rata-rata Transaksi</p>
                        <p className="text-3xl font-extrabold tracking-tight text-foreground">
                            {formatCurrency(overview.averageTicket)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm border border-border/30 bg-white hover:shadow-md transition-shadow duration-300">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-rose-50 rounded-xl">
                                <TrendingDown className="w-4 h-4 text-rose-500" />
                            </div>
                        </div>
                        <p className="text-[13px] text-muted-foreground font-medium mb-1">Total Diskon</p>
                        <p className="text-3xl font-extrabold tracking-tight text-rose-600">
                            {formatCurrency(overview.totalDiscount)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Sales Charts with Tabs */}
            <Tabs defaultValue="daily" className="space-y-5">
                <div className="flex items-center justify-between">
                    <TabsList className="rounded-2xl bg-slate-100/80 p-1 h-11">
                        <TabsTrigger
                            value="daily"
                            className="rounded-xl px-5 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                        >
                            Harian (30 Hari)
                        </TabsTrigger>
                        <TabsTrigger
                            value="monthly"
                            className="rounded-xl px-5 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                        >
                            Bulanan (12 Bulan)
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="daily" className="mt-0">
                    <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold">Grafik Penjualan Harian</CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">Tren penjualan 30 hari terakhir</p>
                                </div>
                                <Button variant="ghost" size="sm" className="rounded-xl text-xs h-8 hover:bg-slate-100" onClick={handleExportDaily}>
                                    <Download className="w-3.5 h-3.5 mr-1.5" /> Export
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-2 pb-4">
                            <ResponsiveContainer width="100%" height={380}>
                                <AreaChart data={dailySales}>
                                    <defs>
                                        <linearGradient id="dailySalesGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="label" tick={chartAxisStyle} stroke="transparent" tickLine={false} />
                                    <YAxis tick={chartAxisStyle} stroke="transparent" tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip
                                        formatter={(value) => [formatCurrency(Number(value)), "Penjualan"]}
                                        contentStyle={chartTooltipStyle}
                                        cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "4 4" }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="sales"
                                        stroke="#6366f1"
                                        strokeWidth={2.5}
                                        fill="url(#dailySalesGradient)"
                                        dot={false}
                                        activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="monthly" className="mt-0">
                    <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold">Grafik Penjualan Bulanan</CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">Tren penjualan 12 bulan terakhir</p>
                                </div>
                                <Button variant="ghost" size="sm" className="rounded-xl text-xs h-8 hover:bg-slate-100" onClick={handleExportMonthly}>
                                    <Download className="w-3.5 h-3.5 mr-1.5" /> Export
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-2 pb-4">
                            <ResponsiveContainer width="100%" height={380}>
                                <AreaChart data={monthlySales}>
                                    <defs>
                                        <linearGradient id="monthlySalesGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.15} />
                                            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.01} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="label" tick={chartAxisStyle} stroke="transparent" tickLine={false} />
                                    <YAxis tick={chartAxisStyle} stroke="transparent" tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip
                                        formatter={(value) => [formatCurrency(Number(value)), "Penjualan"]}
                                        contentStyle={chartTooltipStyle}
                                        cursor={{ stroke: "#0ea5e9", strokeWidth: 1, strokeDasharray: "4 4" }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="sales"
                                        stroke="#0ea5e9"
                                        strokeWidth={2.5}
                                        fill="url(#monthlySalesGradient)"
                                        dot={{ r: 4, fill: "#0ea5e9", strokeWidth: 2, stroke: "#fff" }}
                                        activeDot={{ r: 6, fill: "#0ea5e9", strokeWidth: 2, stroke: "#fff" }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Payment Methods & Hourly Sales */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
                    <CardHeader className="pb-2">
                        <div>
                            <CardTitle className="text-base font-semibold">Metode Pembayaran</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Distribusi berdasarkan metode</p>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-2 pb-4">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={paymentMethods} barSize={36}>
                                <defs>
                                    <linearGradient id="paymentBarGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.7} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis
                                    dataKey="method"
                                    tickFormatter={(value) => PAYMENT_METHOD_LABELS[value] ?? value}
                                    tick={chartAxisStyle}
                                    stroke="transparent"
                                    tickLine={false}
                                />
                                <YAxis tick={chartAxisStyle} stroke="transparent" tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    formatter={(value, name) => [formatCurrency(Number(value)), name === "total" ? "Total Penjualan" : "Nilai"]}
                                    labelFormatter={(value) => PAYMENT_METHOD_LABELS[value] ?? value}
                                    contentStyle={chartTooltipStyle}
                                    cursor={{ fill: "rgba(16, 185, 129, 0.04)" }}
                                />
                                <Bar dataKey="total" fill="url(#paymentBarGradient)" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
                    <CardHeader className="pb-2">
                        <div>
                            <CardTitle className="text-base font-semibold">Jam Penjualan</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Distribusi transaksi per jam</p>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-2 pb-4">
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={hourlySales}>
                                <defs>
                                    <linearGradient id="hourlyGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.12} />
                                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.01} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="hour" tick={chartAxisStyle} stroke="transparent" tickLine={false} />
                                <YAxis tick={chartAxisStyle} stroke="transparent" tickLine={false} axisLine={false} />
                                <Tooltip
                                    formatter={(value, name) => [name === "total" ? formatCurrency(Number(value)) : Number(value), name === "total" ? "Total Penjualan" : "Jumlah Transaksi"]}
                                    contentStyle={chartTooltipStyle}
                                    cursor={{ stroke: "#8b5cf6", strokeWidth: 1, strokeDasharray: "4 4" }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="transactions"
                                    stroke="#8b5cf6"
                                    strokeWidth={2.5}
                                    fill="url(#hourlyGradient)"
                                    dot={false}
                                    activeDot={{ r: 5, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Cashier Performance & Category Sales */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
                    <CardHeader className="pb-3">
                        <div>
                            <CardTitle className="text-base font-semibold">Top Kasir</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Performa kasir terbaik</p>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border/30 hover:bg-transparent">
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kasir</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Transaksi</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {overview.topCashiers.map((cashier, index) => (
                                    <TableRow key={cashier.userId} className="border-border/20 hover:bg-slate-50/50">
                                        <TableCell className="py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 flex items-center justify-center text-xs font-bold text-violet-600">
                                                    {index + 1}
                                                </div>
                                                <span className="font-medium text-sm">{cashier.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-3.5">
                                            <span className="inline-flex items-center justify-center px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                                                {cashier.transactions}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right py-3.5 font-semibold text-sm">
                                            {formatCurrency(cashier.revenue)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {overview.topCashiers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-12">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                                                    <ReceiptText className="w-5 h-5 text-slate-400" />
                                                </div>
                                                <p className="text-sm text-slate-400 font-medium">Belum ada data kasir</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
                    <CardHeader className="pb-2">
                        <div>
                            <CardTitle className="text-base font-semibold">Penjualan per Kategori</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Breakdown berdasarkan kategori produk</p>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-2 pb-4">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={overview.categorySales} barSize={36}>
                                <defs>
                                    <linearGradient id="categoryBarGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.7} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="category" tick={chartAxisStyle} stroke="transparent" tickLine={false} />
                                <YAxis tick={chartAxisStyle} stroke="transparent" tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    formatter={(value, name) => [name === "total" ? formatCurrency(Number(value)) : Number(value), name === "total" ? "Penjualan" : "Qty"]}
                                    contentStyle={chartTooltipStyle}
                                    cursor={{ fill: "rgba(245, 158, 11, 0.04)" }}
                                />
                                <Bar dataKey="total" fill="url(#categoryBarGradient)" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Top Products */}
            <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-50 rounded-xl">
                                <ShoppingCart className="w-4.5 h-4.5 text-amber-600" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold">Produk Terlaris</CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">Top 10 produk berdasarkan quantity terjual</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-xs h-8 hover:bg-slate-100"
                            onClick={handleExportTopProducts}
                        >
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Export
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border/30 hover:bg-transparent">
                                <TableHead className="w-14 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rank</TableHead>
                                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produk</TableHead>
                                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kode</TableHead>
                                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Qty Terjual</TableHead>
                                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Penjualan</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {topProducts.map((product, i) => (
                                <TableRow key={product.productCode} className="border-border/20 hover:bg-slate-50/50">
                                    <TableCell className="py-3.5">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                                            i === 0
                                                ? "bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700"
                                                : i === 1
                                                    ? "bg-gradient-to-br from-slate-200 to-slate-100 text-slate-600"
                                                    : i === 2
                                                        ? "bg-gradient-to-br from-orange-100 to-orange-50 text-orange-700"
                                                        : "bg-slate-100 text-slate-500"
                                        }`}>
                                            {i + 1}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-sm py-3.5">{product.productName}</TableCell>
                                    <TableCell className="py-3.5">
                                        <code className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md font-mono">
                                            {product.productCode}
                                        </code>
                                    </TableCell>
                                    <TableCell className="text-right py-3.5">
                                        <span className="inline-flex items-center justify-center px-2.5 py-1 bg-emerald-50 rounded-lg text-xs font-semibold text-emerald-700">
                                            {product._sum.quantity}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right py-3.5 font-semibold text-sm">
                                        {formatCurrency(product._sum.subtotal || 0)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {topProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-16">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                                                <Package className="w-6 h-6 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-500 font-medium">Belum ada data</p>
                                                <p className="text-xs text-slate-400 mt-0.5">Data produk terlaris akan muncul di sini</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
