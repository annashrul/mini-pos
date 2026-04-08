"use client";

import { useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import {
    Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Download, Printer, CalendarDays, Loader2, SlidersHorizontal, Check, BarChart3 } from "lucide-react";
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

const TAB_OPTIONS = [
    { value: "daily", label: "Harian", labelFull: "Harian (30 Hari)" },
    { value: "monthly", label: "Bulanan", labelFull: "Bulanan (12 Bulan)" },
    { value: "category", label: "Kategori", labelFull: "Kategori" },
    { value: "supplier", label: "Supplier", labelFull: "Supplier" },
    { value: "cashier", label: "Kasir", labelFull: "Kasir" },
] as const;

export function ReportsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const tabParam = searchParams.get("tab");
    const activeTab: ReportTab = VALID_REPORT_TABS.includes(tabParam as ReportTab) ? (tabParam as ReportTab) : "daily";

    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [tabSheetOpen, setTabSheetOpen] = useState(false);
    const [draftDateFrom, setDraftDateFrom] = useState("");
    const [draftDateTo, setDraftDateTo] = useState("");

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

    const openFilterSheet = () => {
        setDraftDateFrom(dateFrom);
        setDraftDateTo(dateTo);
        setFilterSheetOpen(true);
    };

    const applyMobileFilter = () => {
        setDateFrom(draftDateFrom);
        setDateTo(draftDateTo);
        setFilterSheetOpen(false);
        applyDateFilter();
    };



    const activeTabLabel = TAB_OPTIONS.find((t) => t.value === activeTab)?.label || "Harian";

    return (
        <div className="space-y-4 sm:space-y-8">
            {/* Header Section */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                        <BarChart3 className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
                            Laporan
                        </h1>
                        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                            Pantau performa bisnis
                        </p>
                    </div>
                </div>
                {/* Desktop: export/print buttons */}
                <div className="hidden sm:flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={handleExportDaily}>
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={handlePrintProfitLoss}>
                        <Printer className="w-3.5 h-3.5 mr-1.5" /> Print P&L
                    </Button>
                </div>
            </div>

            {/* Filter Section */}
            {/* Mobile: filter button + export/print buttons inline */}
            <div className="sm:hidden flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="flex-1 rounded-xl justify-start gap-1.5" onClick={openFilterSheet}>
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span className="text-xs truncate">
                        {dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : "Pilih periode"}
                    </span>
                </Button>
                <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={handleExportDaily}>
                    <Download className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={handlePrintProfitLoss}>
                    <Printer className="w-3.5 h-3.5" />
                </Button>
                <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                    <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                        <div className="shrink-0">
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                            </div>
                            <SheetHeader className="px-4 pb-3 pt-0">
                                <SheetTitle className="text-base font-bold">Filter Periode</SheetTitle>
                            </SheetHeader>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dari</label>
                                <DatePicker value={draftDateFrom} onChange={setDraftDateFrom} placeholder="Tanggal mulai" className="w-full rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sampai</label>
                                <DatePicker value={draftDateTo} onChange={setDraftDateTo} placeholder="Tanggal akhir" className="w-full rounded-xl" />
                            </div>
                        </div>
                        <SheetFooter className="shrink-0 border-t px-4 py-3 flex-row gap-2">
                            <Button variant="outline" className="flex-1 rounded-xl h-10 text-sm" onClick={() => { setDraftDateFrom(""); setDraftDateTo(""); }}>Reset</Button>
                            <Button className="flex-1 rounded-xl h-10 text-sm shadow-md" onClick={applyMobileFilter}>Terapkan</Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop: Date Range Filter */}
            <Card className="hidden sm:block rounded-2xl shadow-sm border border-border/40 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                            <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Periode</span>
                        </div>
                        <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Dari tanggal" className="w-[180px]" />
                        <span className="text-xs text-muted-foreground font-medium">s/d</span>
                        <DatePicker value={dateTo} onChange={setDateTo} placeholder="Sampai tanggal" className="w-[180px]" />
                        <Button size="sm" className="rounded-xl h-8 px-5 text-xs font-semibold shadow-sm" onClick={applyDateFilter} disabled={isFiltering}>
                            {isFiltering ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                            Terapkan
                        </Button>
                        {(dateFrom || dateTo) && (
                            <Button size="sm" variant="ghost" className="rounded-xl h-8 text-xs text-muted-foreground hover:text-foreground" onClick={resetDateFilter}>
                                Reset
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {
                isFiltering ? <ReportsSkeleton /> : <>
                    {/* P&L + KPI Overview */}
                    <ReportsOverviewSection profitLoss={profitLoss} overview={overview} />

                    {/* Sales Charts with Tabs */}
                    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-3 sm:space-y-5">
                        {/* Mobile: tab selector button + bottom sheet */}
                        <div className="sm:hidden">
                            <Button variant="outline" className="w-full justify-between rounded-xl" onClick={() => setTabSheetOpen(true)}>
                                <span className="text-xs font-medium">{activeTabLabel}</span>
                                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                            <Sheet open={tabSheetOpen} onOpenChange={setTabSheetOpen}>
                                <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                                    <div className="shrink-0">
                                        <div className="flex justify-center pt-3 pb-2">
                                            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                                        </div>
                                        <SheetHeader className="px-4 pb-3 pt-0">
                                            <SheetTitle className="text-base font-bold">Pilih Laporan</SheetTitle>
                                        </SheetHeader>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                                        {TAB_OPTIONS.map((opt) => {
                                            const isActive = activeTab === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => { handleTabChange(opt.value); setTabSheetOpen(false); }}
                                                    className={cn(
                                                        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                                        isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"
                                                    )}
                                                >
                                                    <span>{opt.labelFull}</span>
                                                    {isActive && <Check className="w-4 h-4" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>

                        {/* Desktop: horizontal tabs */}
                        <div className="hidden sm:block overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                            <TabsList className="inline-flex rounded-2xl bg-slate-100/80 p-1 h-11 gap-0.5 min-w-max">
                                {TAB_OPTIONS.map((opt) => (
                                    <TabsTrigger
                                        key={opt.value}
                                        value={opt.value}
                                        className="rounded-xl px-5 text-sm font-semibold whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
                                    >
                                        {opt.labelFull}
                                    </TabsTrigger>
                                ))}
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
                    /></>
            }


        </div>
    );
}
