"use client";

import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import { getSalesReport, getTopProductsReport, getProfitLossReport } from "@/features/reports";
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
} from "recharts";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Download, Printer, Filter, Loader2 } from "lucide-react";
import { exportToCSV, printReport } from "@/lib/export";
import type { SalesData, TopProduct, ProfitLoss } from "@/types";

interface Props {
    dailySales: SalesData[];
    monthlySales: SalesData[];
    topProducts: TopProduct[];
    profitLoss: ProfitLoss;
}

export function ReportsContent({ dailySales: initialDaily, monthlySales: initialMonthly, topProducts: initialTop, profitLoss: initialPL }: Props) {
    const [dailySales, setDailySales] = useState(initialDaily);
    const [monthlySales, setMonthlySales] = useState(initialMonthly);
    const [topProducts, setTopProducts] = useState(initialTop);
    const [profitLoss, setProfitLoss] = useState(initialPL);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [isFiltering, startTransition] = useTransition();

    const applyDateFilter = () => {
        startTransition(async () => {
            const [daily, monthly, top, pl] = await Promise.all([
                getSalesReport("daily", dateFrom || undefined, dateTo || undefined),
                getSalesReport("monthly"),
                getTopProductsReport(10, dateFrom || undefined, dateTo || undefined),
                getProfitLossReport(dateFrom || undefined, dateTo || undefined),
            ]);
            setDailySales(daily);
            setMonthlySales(monthly);
            setTopProducts(top);
            setProfitLoss(pl);
        });
    };

    const resetDateFilter = () => {
        setDateFrom("");
        setDateTo("");
        startTransition(async () => {
            const [daily, monthly, top, pl] = await Promise.all([
                getSalesReport("daily"),
                getSalesReport("monthly"),
                getTopProductsReport(),
                getProfitLossReport(),
            ]);
            setDailySales(daily);
            setMonthlySales(monthly);
            setTopProducts(top);
            setProfitLoss(pl);
        });
    };

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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Laporan</h1>
                    <p className="text-muted-foreground text-sm">Analisis bisnis Anda</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="rounded-lg" onClick={handleExportDaily}>
                        <Download className="w-4 h-4 mr-2" /> Export CSV
                    </Button>
                    <Button variant="outline" className="rounded-lg" onClick={handlePrintProfitLoss}>
                        <Printer className="w-4 h-4 mr-2" /> Print Laba Rugi
                    </Button>
                </div>
            </div>

            {/* Date Range Filter */}
            <Card className="rounded-2xl shadow-sm border border-border/40">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-muted-foreground shrink-0">Periode:</span>
                        <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Dari tanggal" className="w-[180px]" />
                        <span className="text-xs text-muted-foreground">s/d</span>
                        <DatePicker value={dateTo} onChange={setDateTo} placeholder="Sampai tanggal" className="w-[180px]" />
                        <Button size="sm" className="rounded-lg h-8" onClick={applyDateFilter} disabled={isFiltering}>
                            {isFiltering ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                            Terapkan
                        </Button>
                        {(dateFrom || dateTo) && (
                            <Button size="sm" variant="ghost" className="rounded-lg h-8 text-xs text-muted-foreground" onClick={resetDateFilter}>
                                Reset
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Profit/Loss Summary */}
            <Card className="rounded-2xl shadow-sm border-0">
                <CardHeader>
                    <CardTitle className="text-lg">Laba Rugi - {profitLoss.period}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-blue-600 mb-1">
                                <DollarSign className="w-4 h-4" />
                                <span className="text-sm">Pendapatan</span>
                            </div>
                            <p className="text-xl font-bold text-blue-700">{formatCurrency(profitLoss.revenue)}</p>
                        </div>
                        <div className="bg-red-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-red-600 mb-1">
                                <TrendingDown className="w-4 h-4" />
                                <span className="text-sm">Modal</span>
                            </div>
                            <p className="text-xl font-bold text-red-700">{formatCurrency(profitLoss.cost)}</p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-green-600 mb-1">
                                <TrendingUp className="w-4 h-4" />
                                <span className="text-sm">Laba Kotor</span>
                            </div>
                            <p className="text-xl font-bold text-green-700">{formatCurrency(profitLoss.grossProfit)}</p>
                        </div>
                        <div className={`rounded-xl p-4 ${profitLoss.netProfit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                            <div className={`flex items-center gap-2 mb-1 ${profitLoss.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                <BarChart3 className="w-4 h-4" />
                                <span className="text-sm">Laba Bersih</span>
                            </div>
                            <p className={`text-xl font-bold ${profitLoss.netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                {formatCurrency(profitLoss.netProfit)}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Sales Charts */}
            <Tabs defaultValue="daily" className="space-y-4">
                <TabsList className="rounded-xl">
                    <TabsTrigger value="daily" className="rounded-lg">Harian (30 Hari)</TabsTrigger>
                    <TabsTrigger value="monthly" className="rounded-lg">Bulanan (12 Bulan)</TabsTrigger>
                </TabsList>

                <TabsContent value="daily">
                    <Card className="rounded-2xl shadow-sm border-0">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Grafik Penjualan Harian</CardTitle>
                                <Button variant="ghost" size="sm" className="rounded-lg" onClick={handleExportDaily}>
                                    <Download className="w-4 h-4 mr-1" /> Export
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={dailySales}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Penjualan"]}
                                        contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }} />
                                    <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="monthly">
                    <Card className="rounded-2xl shadow-sm border-0">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Grafik Penjualan Bulanan</CardTitle>
                                <Button variant="ghost" size="sm" className="rounded-lg" onClick={handleExportMonthly}>
                                    <Download className="w-4 h-4 mr-1" /> Export
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={350}>
                                <LineChart data={monthlySales}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Penjualan"]}
                                        contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }} />
                                    <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6" }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Top Products */}
            <Card className="rounded-2xl shadow-sm border-0">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <ShoppingCart className="w-5 h-5" />
                            Produk Terlaris
                        </CardTitle>
                        <Button variant="ghost" size="sm" className="rounded-lg" onClick={handleExportTopProducts}>
                            <Download className="w-4 h-4 mr-1" /> Export
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Produk</TableHead>
                                <TableHead>Kode</TableHead>
                                <TableHead className="text-right">Qty Terjual</TableHead>
                                <TableHead className="text-right">Total Penjualan</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {topProducts.map((product, i) => (
                                <TableRow key={product.productCode}>
                                    <TableCell className="font-bold text-primary">{i + 1}</TableCell>
                                    <TableCell className="font-medium">{product.productName}</TableCell>
                                    <TableCell className="font-mono text-sm text-slate-500">{product.productCode}</TableCell>
                                    <TableCell className="text-right">{product._sum.quantity}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(product._sum.subtotal || 0)}</TableCell>
                                </TableRow>
                            ))}
                            {topProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-400">Belum ada data</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
