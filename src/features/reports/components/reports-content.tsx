"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Download, Printer, Filter, Loader2 } from "lucide-react";
import { exportToCSV, printReport } from "@/lib/export";
import { useReportsData } from "../hooks";
import { VALID_REPORT_TABS } from "../types";
import type { ReportTab } from "../types";
import { ReportsSkeleton } from "./reports-skeleton";
import { ReportsOverviewSection } from "./reports-overview-section";
import { ReportsSalesTab } from "./reports-sales-tab";
import { ReportsCategoryTab } from "./reports-category-tab";
import { ReportsSupplierTab } from "./reports-supplier-tab";
import { ReportsCashierTab } from "./reports-cashier-tab";
import { ReportsBottomSection } from "./reports-bottom-section";

export function ReportsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const tabParam = searchParams.get("tab");
    const activeTab: ReportTab = VALID_REPORT_TABS.includes(tabParam as ReportTab) ? (tabParam as ReportTab) : "daily";

    const handleTabChange = useCallback((tab: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tab);
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [searchParams, router]);

    const {
        dailySales,
        monthlySales,
        topProducts,
        profitLoss,
        paymentMethods,
        hourlySales,
        overview,
        categorySales,
        supplierSales,
        cashierSales,
        dateFrom,
        dateTo,
        setDateFrom,
        setDateTo,
        isFiltering,
        hasData,
        applyDateFilter,
        resetDateFilter,
    } = useReportsData();

    const handleExportDaily = () => {
        exportToCSV(
            dailySales.map((d) => ({ Tanggal: d.label, Penjualan: d.sales, Transaksi: d.transactions, Diskon: d.discount, Pajak: d.tax })),
            "laporan-penjualan-harian"
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

    if (isFiltering && !hasData) {
        return <ReportsSkeleton />;
    }

    return (
        <div className={`space-y-4 sm:space-y-8 transition-opacity duration-300 ${isFiltering ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
                <div className="space-y-1">
                    <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
                        Analytics & Reports
                    </h1>
                    <p className="text-muted-foreground text-xs sm:text-sm">
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
            <Card className="rounded-xl sm:rounded-2xl shadow-sm border border-border/40 bg-white/80 backdrop-blur-sm">
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

            {/* P&L + KPI Overview */}
            <ReportsOverviewSection profitLoss={profitLoss} overview={overview} />

            {/* Sales Charts with Tabs */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 sm:space-y-5">
                <div className="overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                    <TabsList className="inline-flex rounded-2xl bg-slate-100/80 p-1 h-10 sm:h-11 gap-0.5 min-w-max">
                        <TabsTrigger
                            value="daily"
                            className="rounded-xl px-3 sm:px-5 text-xs sm:text-sm font-semibold whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                        >
                            <span className="hidden sm:inline">Harian (30 Hari)</span>
                            <span className="sm:hidden">Harian</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="monthly"
                            className="rounded-xl px-3 sm:px-5 text-xs sm:text-sm font-semibold whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                        >
                            <span className="hidden sm:inline">Bulanan (12 Bulan)</span>
                            <span className="sm:hidden">Bulanan</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="category"
                            className="rounded-xl px-3 sm:px-5 text-xs sm:text-sm font-semibold whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                        >
                            Kategori
                        </TabsTrigger>
                        <TabsTrigger
                            value="supplier"
                            className="rounded-xl px-3 sm:px-5 text-xs sm:text-sm font-semibold whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                        >
                            Supplier
                        </TabsTrigger>
                        <TabsTrigger
                            value="cashier"
                            className="rounded-xl px-3 sm:px-5 text-xs sm:text-sm font-semibold whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                        >
                            Kasir
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="daily" className="mt-0">
                    <ReportsSalesTab dailySales={dailySales} monthlySales={monthlySales} variant="daily" />
                </TabsContent>

                <TabsContent value="monthly" className="mt-0">
                    <ReportsSalesTab dailySales={dailySales} monthlySales={monthlySales} variant="monthly" />
                </TabsContent>

                <TabsContent value="category" className="mt-0">
                    <ReportsCategoryTab categorySales={categorySales} />
                </TabsContent>

                <TabsContent value="supplier" className="mt-0">
                    <ReportsSupplierTab supplierSales={supplierSales} />
                </TabsContent>

                <TabsContent value="cashier" className="mt-0">
                    <ReportsCashierTab cashierSales={cashierSales} />
                </TabsContent>
            </Tabs>

            {/* Payment, Hourly, Cashier Performance, Category, Top Products */}
            <ReportsBottomSection
                paymentMethods={paymentMethods}
                hourlySales={hourlySales}
                topProducts={topProducts}
                overview={overview}
            />
        </div>
    );
}
