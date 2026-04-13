"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { useBranch } from "@/components/providers/branch-provider";
import { Card, CardContent } from "@/components/ui/card";
import { ExportMenu } from "@/components/ui/export-menu";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
    TrendingDown, PackageX, DollarSign, Snail, BarChart3, SlidersHorizontal, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { TAB_CONFIG } from "@/features/analytics/utils";
import { useMarginAnalysis } from "@/features/analytics/hooks/use-margin-analysis";
import { useDeadStock } from "@/features/analytics/hooks/use-dead-stock";
import { usePeakHours } from "@/features/analytics/hooks/use-peak-hours";
import { useFraudDetection } from "@/features/analytics/hooks/use-fraud-detection";
import { useProfitAnalysis } from "@/features/analytics/hooks/use-profit-analysis";
import { useSupplierAnalysis } from "@/features/analytics/hooks/use-supplier-analysis";
import { usePromoAnalysis } from "@/features/analytics/hooks/use-promo-analysis";

import { AnalyticsLoadingSkeleton, TabLoadingSkeleton } from "./analytics-shared";
import { AnalyticsMarginSection } from "./analytics-margin-section";
import { AnalyticsInventorySection } from "./analytics-inventory-section";
import { AnalyticsPeakHoursSection } from "./analytics-peak-hours-section";
import { AnalyticsFraudSection } from "./analytics-fraud-section";
import { AnalyticsProfitSection } from "./analytics-profit-section";
import { AnalyticsSupplierSection } from "./analytics-supplier-section";
import { AnalyticsPromoSection } from "./analytics-promo-section";

export function AnalyticsContent() {
    return (
        <Suspense fallback={<AnalyticsLoadingSkeleton />}>
            <AnalyticsContentInner />
        </Suspense>
    );
}

function AnalyticsContentInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const tabParam = searchParams.get("tab") || "margin";
    const [activeTab, setActiveTab] = useState(tabParam);
    const [tabSheetOpen, setTabSheetOpen] = useState(false);

    const [loading, setLoading] = useState(true);
    const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef<string | null | undefined>(undefined);

    // Hooks
    const margin = useMarginAnalysis();
    const inventory = useDeadStock();
    const peakHours = usePeakHours();
    const fraud = useFraudDetection();
    const profit = useProfitAnalysis();
    const supplier = useSupplierAnalysis();
    const promo = usePromoAnalysis();

    const loadTabData = useCallback(async (tab: string, branchId?: string) => {
        setLoading(true);
        try {
            switch (tab) {
                case "margin":
                    await margin.loadMarginData(branchId);
                    break;
                case "category":
                    await margin.loadCategoryMargins(branchId);
                    break;
                case "deadstock":
                    await inventory.loadDeadStock(branchId);
                    break;
                case "slowmoving":
                    await inventory.loadSlowMoving(branchId);
                    break;
                case "peakhours":
                    await peakHours.loadPeakHours(branchId);
                    break;
                case "fraud":
                    await fraud.loadVoidAbuse(branchId);
                    break;
                case "cashier":
                    await promo.loadCashierPerformance(branchId);
                    break;
                case "dailyprofit":
                    await profit.loadDailyProfit(branchId);
                    break;
                case "shiftprofit":
                    await profit.loadShiftProfit(branchId);
                    break;
                case "supplierintel":
                    await supplier.loadSupplierData(branchId);
                    break;
                case "promo":
                    await promo.loadPromoEffectiveness(branchId);
                    break;
                case "reorder":
                    await inventory.loadReorderRecommendations(branchId);
                    break;
                case "unusualdiscount":
                    await fraud.loadUnusualDiscounts(branchId);
                    break;
            }
            setLoadedTabs((prev) => new Set(prev).add(tab));
        } finally {
            setLoading(false);
        }
    }, [margin, inventory, peakHours, fraud, profit, supplier, promo]);

    const handleTabChange = useCallback((tab: string) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tab);
        router.replace(`?${params.toString()}`, { scroll: false });
        if (!loadedTabs.has(tab)) {
            loadTabData(tab, selectedBranchId || undefined);
        }
    }, [searchParams, router, loadedTabs, loadTabData, selectedBranchId]);

    useEffect(() => {
        setActiveTab(tabParam);
    }, [tabParam]);

    // On mount or branch change, reset and load the active tab
    useEffect(() => {
        if (!branchReady) return;
        const branchChanged = prevBranchRef.current !== undefined && prevBranchRef.current !== selectedBranchId;
        if (prevBranchRef.current === selectedBranchId) return;
        prevBranchRef.current = selectedBranchId;
        if (branchChanged) {
            margin.reset();
            inventory.reset();
            peakHours.reset();
            fraud.reset();
            profit.reset();
            supplier.reset();
            promo.reset();
            setLoadedTabs(new Set());
        }
        loadTabData(tabParam, selectedBranchId || undefined);
    }, [branchReady, selectedBranchId, tabParam, loadTabData, margin, inventory, peakHours, fraud, profit, supplier, promo]);

    const negativeMargins = margin.marginData.filter((p) => p.margin <= 0);

    // Show full-page skeleton only on initial load (no tabs loaded yet)
    if (loading && loadedTabs.size === 0) {
        return <AnalyticsLoadingSkeleton />;
    }

    const isTabLoading = loading && !loadedTabs.has(activeTab);

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <BarChart3 className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Business Intelligence</h1>
                            <p className="text-slate-400 text-xs sm:text-sm">Analisis profit, stok, dan performa bisnis</p>
                        </div>
                    </div>
                </div>
                <div className="hidden sm:block">
                    <ExportMenu module="reports" />
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                {/* Negative Margins */}
                <Card className="rounded-xl sm:rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-rose-500/10 group-hover:from-red-500/10 group-hover:to-rose-500/15 transition-colors duration-300" />
                    <CardContent className="p-2.5 sm:p-5 relative">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">Margin Negatif</p>
                                <p className="text-sm sm:text-xl font-bold text-slate-900 tabular-nums">{negativeMargins.length}</p>
                                <p className="text-[10px] sm:text-xs text-slate-400">produk merugi</p>
                            </div>
                            <div className="flex w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-red-500 to-rose-600 items-center justify-center shadow-md sm:shadow-lg shadow-red-500/25 shrink-0">
                                <TrendingDown className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Dead Stock Count */}
                <Card className="rounded-xl sm:rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/10 group-hover:from-orange-500/10 group-hover:to-amber-500/15 transition-colors duration-300" />
                    <CardContent className="p-2.5 sm:p-5 relative">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">Dead Stock (30 hari)</p>
                                <p className="text-sm sm:text-xl font-bold text-orange-600 tabular-nums">{inventory.deadStock.length}</p>
                                <p className="text-[10px] sm:text-xs text-slate-400">produk tidak terjual</p>
                            </div>
                            <div className="flex w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 items-center justify-center shadow-md sm:shadow-lg shadow-orange-500/25 shrink-0">
                                <PackageX className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Dead Stock Value */}
                <Card className="rounded-xl sm:rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-yellow-500/10 group-hover:from-amber-500/10 group-hover:to-yellow-500/15 transition-colors duration-300" />
                    <CardContent className="p-2.5 sm:p-5 relative">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">Nilai Dead Stock</p>
                                <p className="text-sm sm:text-xl font-bold text-amber-600 tabular-nums">{formatCurrency(inventory.deadStockValue)}</p>
                                <p className="text-[10px] sm:text-xs text-slate-400">modal tertahan</p>
                            </div>
                            <div className="flex w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 items-center justify-center shadow-md sm:shadow-lg shadow-amber-500/25 shrink-0">
                                <DollarSign className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Slow Moving */}
                <Card className="rounded-xl sm:rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-violet-500/10 group-hover:from-purple-500/10 group-hover:to-violet-500/15 transition-colors duration-300" />
                    <CardContent className="p-2.5 sm:p-5 relative">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">Slow Moving</p>
                                <p className="text-sm sm:text-xl font-bold text-purple-600 tabular-nums">{inventory.slowMoving.length}</p>
                                <p className="text-[10px] sm:text-xs text-slate-400">produk lambat terjual</p>
                            </div>
                            <div className="flex w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 items-center justify-center shadow-md sm:shadow-lg shadow-purple-500/25 shrink-0">
                                <Snail className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 sm:space-y-6">
                {/* Mobile: button to open tab sheet */}
                {(() => {
                    const activeConfig = TAB_CONFIG.find((t) => t.value === activeTab);
                    const ActiveIcon = activeConfig?.icon || BarChart3;
                    return (
                        <div className="sm:hidden">
                            <Button
                                variant="outline"
                                className="w-full justify-between rounded-xl h-9"
                                onClick={() => setTabSheetOpen(true)}
                            >
                                <span className="flex items-center gap-2">
                                    <ActiveIcon className="w-3.5 h-3.5 text-blue-600" />
                                    <span className="text-xs font-medium">{activeConfig?.label || "Pilih analisis"}</span>
                                </span>
                                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                            <Sheet open={tabSheetOpen} onOpenChange={setTabSheetOpen}>
                                <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                                    <div className="shrink-0">
                                        <div className="flex justify-center pt-3 pb-2">
                                            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                                        </div>
                                        <SheetHeader className="px-4 pb-3 pt-0">
                                            <SheetTitle className="text-base font-bold">Pilih Analisis</SheetTitle>
                                        </SheetHeader>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                                        {TAB_CONFIG.map(({ value, label, icon: Icon }) => {
                                            const isActive = activeTab === value;
                                            return (
                                                <button
                                                    key={value}
                                                    onClick={() => { handleTabChange(value); setTabSheetOpen(false); }}
                                                    className={cn(
                                                        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                                        isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"
                                                    )}
                                                >
                                                    <span className="flex items-center gap-2.5">
                                                        <Icon className={cn("w-4 h-4", isActive ? "text-background" : "text-muted-foreground")} />
                                                        {label}
                                                    </span>
                                                    {isActive && <Check className="w-4 h-4" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    );
                })()}

                {/* Desktop: horizontal tabs */}
                <div className="hidden sm:block overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                    <TabsList className="inline-flex h-12 items-center gap-1 rounded-xl bg-slate-100/80 p-1 min-w-max">
                        {TAB_CONFIG.map(({ value, label, icon: Icon }) => (
                            <TabsTrigger
                                key={value}
                                value={value}
                                className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm whitespace-nowrap"
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {/* Show skeleton while loading tab data */}
                {isTabLoading && <TabLoadingSkeleton />}

                {/* Section components */}
                <AnalyticsMarginSection
                    marginData={margin.marginData}
                    categoryMargins={margin.categoryMargins}
                />
                <AnalyticsInventorySection
                    deadStock={inventory.deadStock}
                    slowMoving={inventory.slowMoving}
                    reorderRecommendations={inventory.reorderRecommendations}
                    deadStockValue={inventory.deadStockValue}
                />
                <AnalyticsPeakHoursSection peakHours={peakHours.peakHours} />
                <AnalyticsFraudSection
                    voidAbuse={fraud.voidAbuse}
                    unusualDiscounts={fraud.unusualDiscounts}
                    suspiciousCount={fraud.suspiciousCount}
                />
                <AnalyticsProfitSection
                    dailyProfit={profit.dailyProfit}
                    shiftProfit={profit.shiftProfit}
                    cashierPerf={promo.cashierPerf}
                />
                <AnalyticsSupplierSection
                    supplierRanking={supplier.supplierRanking}
                    supplierDebt={supplier.supplierDebt}
                />
                <AnalyticsPromoSection promoEffectiveness={promo.promoEffectiveness} />
            </Tabs>
        </div>
    );
}
