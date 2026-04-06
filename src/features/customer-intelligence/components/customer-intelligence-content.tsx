"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { useBranch } from "@/components/providers/branch-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Repeat, Clock, Crown, Users, UserCheck, Zap, TrendingUp } from "lucide-react";
import { useRepeatCustomers } from "../hooks/use-repeat-customers";
import { useShoppingFrequency } from "../hooks/use-shopping-frequency";
import { useLoyaltySummary } from "../hooks/use-loyalty-summary";
import { RepeatCustomersTab } from "./repeat-customers-tab";
import { ShoppingFrequencyTab } from "./shopping-frequency-tab";
import { LoyaltySummaryTab } from "./loyalty-summary-tab";
import { VALID_TABS, type TabValue } from "../types";

export function CustomerIntelligenceContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const tabParam = searchParams.get("tab");
    const activeTab: TabValue = VALID_TABS.includes(tabParam as TabValue) ? (tabParam as TabValue) : "repeat";

    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef<string | null | undefined>(undefined);
    const loadedTabsRef = useRef<Set<TabValue>>(new Set());

    const { repeatCustomers, totalCustomers, repeatCount, loading: repeatLoading, load: loadRepeat } = useRepeatCustomers();
    const { shoppingFrequency, loading: freqLoading, load: loadFrequency } = useShoppingFrequency();
    const { loyaltySummary, totalPoints, totalSpendingAll, loading: loyaltyLoading, load: loadLoyalty } = useLoyaltySummary();

    const loadTabData = useCallback(async (tab: TabValue, branchId?: string) => {
        switch (tab) {
            case "repeat":
                await loadRepeat(branchId);
                break;
            case "frequency":
                await loadFrequency(branchId);
                break;
            case "loyalty":
                await loadLoyalty(branchId);
                break;
        }
        loadedTabsRef.current.add(tab);
    }, [loadRepeat, loadFrequency, loadLoyalty]);

    const handleTabChange = useCallback((tab: string) => {
        const newTab = tab as TabValue;
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", newTab);
        router.replace(`?${params.toString()}`, { scroll: false });

        if (!loadedTabsRef.current.has(newTab)) {
            loadTabData(newTab, selectedBranchId || undefined);
        }
    }, [searchParams, router, selectedBranchId, loadTabData]);

    useEffect(() => {
        if (!branchReady) return;
        if (prevBranchRef.current === selectedBranchId) return;
        prevBranchRef.current = selectedBranchId;
        loadedTabsRef.current = new Set();
        loadTabData(activeTab, selectedBranchId || undefined);
    }, [selectedBranchId, activeTab, loadTabData]); // eslint-disable-line react-hooks/exhaustive-deps

    const loading = repeatLoading || freqLoading || loyaltyLoading;

    if (loading && loadedTabsRef.current.size === 0) {
        return (
            <div className="space-y-8 animate-pulse">
                {/* Header skeleton */}
                <div>
                    <div className="h-7 w-56 bg-slate-200 rounded-lg" />
                    <div className="h-4 w-72 bg-slate-100 rounded-lg mt-2" />
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
                {/* Tabs skeleton */}
                <div className="flex gap-1 bg-slate-100/80 rounded-2xl p-1.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-10 w-40 bg-slate-200/60 rounded-xl" />
                    ))}
                </div>
                {/* Table skeleton */}
                <div className="rounded-2xl border border-border/30 bg-white p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-200 rounded-xl" />
                        <div>
                            <div className="h-5 w-32 bg-slate-200 rounded" />
                            <div className="h-3 w-44 bg-slate-100 rounded mt-1" />
                        </div>
                    </div>
                    <div className="space-y-3 mt-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="w-8 h-8 bg-slate-100 rounded-full shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3.5 w-36 bg-slate-100 rounded" />
                                    <div className="h-3 w-24 bg-slate-50 rounded" />
                                </div>
                                <div className="h-5 w-16 bg-slate-100 rounded-full" />
                                <div className="h-4 w-24 bg-slate-100 rounded" />
                                <div className="h-4 w-12 bg-slate-50 rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Intelligence</h1>
                <p className="text-slate-500 text-sm mt-1">Analisis pelanggan, loyalitas, dan pola belanja</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Customers */}
                <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/10 group-hover:from-violet-500/10 group-hover:to-purple-500/15 transition-colors duration-300" />
                    <CardContent className="pt-6 pb-5 relative">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Customer</p>
                                <p className="text-3xl font-bold text-slate-900 tabular-nums">{totalCustomers.toLocaleString()}</p>
                                <p className="text-xs text-slate-400">Semua pelanggan terdaftar</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Repeat Customers */}
                <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/10 group-hover:from-emerald-500/10 group-hover:to-green-500/15 transition-colors duration-300" />
                    <CardContent className="pt-6 pb-5 relative">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Repeat Customer</p>
                                <p className="text-3xl font-bold text-emerald-600 tabular-nums">{repeatCount.toLocaleString()}</p>
                                <p className="text-xs text-slate-400">
                                    {totalCustomers > 0 ? `${Math.round((repeatCount / totalCustomers) * 100)}% retention rate` : "Belum ada data"}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                <UserCheck className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Total Points */}
                <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/10 group-hover:from-purple-500/10 group-hover:to-fuchsia-500/15 transition-colors duration-300" />
                    <CardContent className="pt-6 pb-5 relative">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Poin Beredar</p>
                                <p className="text-3xl font-bold text-purple-600 tabular-nums">{totalPoints.toLocaleString()}</p>
                                <p className="text-xs text-slate-400">Akumulasi loyalty points</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Total Spending */}
                <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/10 group-hover:from-indigo-500/10 group-hover:to-violet-500/15 transition-colors duration-300" />
                    <CardContent className="pt-6 pb-5 relative">
                        <div className="flex items-start justify-between">
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Spending</p>
                                <p className="text-2xl font-bold text-indigo-600 tabular-nums">{formatCurrency(totalSpendingAll)}</p>
                                <p className="text-xs text-slate-400">Revenue dari member</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                <TabsList className="rounded-2xl bg-slate-100/80 p-1.5 h-auto">
                    <TabsTrigger value="repeat" className="rounded-xl px-5 py-2.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm gap-2">
                        <Repeat className="w-4 h-4" />
                        Repeat Customer
                    </TabsTrigger>
                    <TabsTrigger value="frequency" className="rounded-xl px-5 py-2.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm gap-2">
                        <Clock className="w-4 h-4" />
                        Shopping Frequency
                    </TabsTrigger>
                    <TabsTrigger value="loyalty" className="rounded-xl px-5 py-2.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm gap-2">
                        <Crown className="w-4 h-4" />
                        Loyalty Summary
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="repeat">
                    <RepeatCustomersTab repeatCustomers={repeatCustomers} />
                </TabsContent>

                <TabsContent value="frequency">
                    <ShoppingFrequencyTab shoppingFrequency={shoppingFrequency} />
                </TabsContent>

                <TabsContent value="loyalty">
                    <LoyaltySummaryTab loyaltySummary={loyaltySummary} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
