"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Sheet,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Loader2,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    FileBarChart,
    BarChart3,
    PieChart,
    Wallet,
    SlidersHorizontal,
    Search,
    Check,
    CalendarDays,
} from "lucide-react";
import {
    useAccountingReports,
    useTrialBalance,
    useIncomeStatement,
    useBalanceSheet,
    useCashFlow,
} from "../hooks";
import { formatAccountingCurrency } from "../utils";
import type { Tab } from "../types";

export function ReportsContent() {
    const {
        tab,
        setTab,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        asOfDate,
        setAsOfDate,
        selectedBranchId,
    } = useAccountingReports();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <FileBarChart className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Laporan Keuangan
                    </h1>
                    <p className="text-sm text-gray-500">
                        Neraca saldo, laba rugi, neraca, dan arus kas
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
            <Tabs
                value={tab}
                onValueChange={(v) => setTab(v as Tab)}
                className="space-y-6"
            >
                <TabsList className="bg-slate-100/80 rounded-2xl p-1 h-12 flex w-full gap-0.5 overflow-x-auto scrollbar-hide">
                    <TabsTrigger
                        value="trial-balance"
                        className="rounded-xl px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium shrink-0 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 transition-all"
                    >
                        <BarChart3 className="w-4 h-4" />
                        <span className="hidden sm:inline">Neraca </span>Saldo
                    </TabsTrigger>
                    <TabsTrigger
                        value="income"
                        className="rounded-xl px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium shrink-0 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 transition-all"
                    >
                        <TrendingUp className="w-4 h-4" />
                        <span className="hidden sm:inline">Laba </span>Rugi
                    </TabsTrigger>
                    <TabsTrigger
                        value="balance-sheet"
                        className="rounded-xl px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium shrink-0 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 transition-all"
                    >
                        <PieChart className="w-4 h-4" />
                        Neraca
                    </TabsTrigger>
                    <TabsTrigger
                        value="cash-flow"
                        className="rounded-xl px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium shrink-0 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 transition-all"
                    >
                        <Wallet className="w-4 h-4" />
                        <span className="hidden sm:inline">Arus </span>Kas
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="trial-balance" className="mt-0">
                    <TrialBalanceTab
                        date={asOfDate}
                        setDate={setAsOfDate}
                        branchId={selectedBranchId}
                    />
                </TabsContent>

                <TabsContent value="income" className="mt-0">
                    <IncomeStatementTab
                        dateFrom={dateFrom}
                        setDateFrom={setDateFrom}
                        dateTo={dateTo}
                        setDateTo={setDateTo}
                        branchId={selectedBranchId}
                    />
                </TabsContent>

                <TabsContent value="balance-sheet" className="mt-0">
                    <BalanceSheetTab
                        date={asOfDate}
                        setDate={setAsOfDate}
                        branchId={selectedBranchId}
                    />
                </TabsContent>

                <TabsContent value="cash-flow" className="mt-0">
                    <CashFlowTab
                        dateFrom={dateFrom}
                        setDateFrom={setDateFrom}
                        dateTo={dateTo}
                        setDateTo={setDateTo}
                        branchId={selectedBranchId}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ── Trial Balance ──────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Aset: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    Kewajiban: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
    Modal: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    Pendapatan: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    Beban: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

function TrialBalanceTab({ date, setDate, branchId }: {
    date: string; setDate: (v: string) => void; branchId?: string;
}) {
    const { data, isPending } = useTrialBalance(date, branchId);
    const [q, setQ] = useState("");

    const filtered = useMemo(() => {
        const rows = data?.rows ?? [];
        const query = q.trim().toLowerCase();
        if (!query) return rows;
        return rows.filter((r) =>
            `${r.accountCode} ${r.accountName} ${r.categoryName}`.toLowerCase().includes(query)
        );
    }, [data, q]);

    // Group by category
    const grouped = useMemo(() => {
        const map = new Map<string, typeof filtered>();
        for (const row of filtered) {
            const list = map.get(row.categoryName) ?? [];
            list.push(row);
            map.set(row.categoryName, list);
        }
        return Array.from(map.entries());
    }, [filtered]);

    const trialPresets = getSingleDatePresets();
    const [trialPresetKey, setTrialPresetKey] = useState<PresetKey>("today");
    const [trialSheetOpen, setTrialSheetOpen] = useState(false);
    const [draftTrialPreset, setDraftTrialPreset] = useState<PresetKey>("today");
    const [draftTrialDate, setDraftTrialDate] = useState(date);

    const handleTrialPreset = (p: Preset) => {
        setTrialPresetKey(p.key);
        setDate(p.to);
    };

    return (
        <div className="space-y-5">
            {/* Filter: search + date presets */}
            {/* Mobile */}
            <div className="sm:hidden space-y-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari akun..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all h-9"
                        />
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 rounded-xl h-9 gap-1.5" onClick={() => { setDraftTrialPreset(trialPresetKey); setDraftTrialDate(date); setTrialSheetOpen(true); }}>
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span className="text-xs">{trialPresets.find(p => p.key === trialPresetKey)?.label ?? "Custom"}</span>
                    </Button>
                    {isPending && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />}
                </div>
                {data && (
                    <Badge className={`gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${data.isBalanced ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                        {data.isBalanced ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {data.isBalanced ? "Balance" : "Selisih " + formatAccountingCurrency(data.difference)}
                    </Badge>
                )}
                <Sheet open={trialSheetOpen} onOpenChange={setTrialSheetOpen}>
                    <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                        <div className="shrink-0">
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                            </div>
                            <SheetHeader className="px-4 pb-3 pt-0">
                                <SheetTitle className="text-base font-bold">Pilih Periode</SheetTitle>
                            </SheetHeader>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 space-y-1">
                            {trialPresets.map((p) => {
                                const isActive = draftTrialPreset === p.key;
                                return (
                                    <button key={p.key} onClick={() => setDraftTrialPreset(p.key)}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}>
                                        <span>{p.label}</span>
                                        {isActive && <Check className="w-4 h-4" />}
                                    </button>
                                );
                            })}
                            <button onClick={() => setDraftTrialPreset("custom")}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${draftTrialPreset === "custom" ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}>
                                <span className="flex items-center gap-1.5"><SlidersHorizontal className="w-3.5 h-3.5" /> Custom</span>
                                {draftTrialPreset === "custom" && <Check className="w-4 h-4" />}
                            </button>
                            {draftTrialPreset === "custom" && (
                                <div className="pt-2">
                                    <p className="text-xs text-muted-foreground mb-1.5">Pilih tanggal</p>
                                    <DatePicker value={draftTrialDate} onChange={setDraftTrialDate} placeholder="Pilih tanggal" className="w-full rounded-xl h-10 text-sm" />
                                </div>
                            )}
                        </div>
                        <SheetFooter className="shrink-0 border-t px-4 py-3 flex-row gap-2">
                            <Button variant="outline" className="flex-1 rounded-xl h-10 text-sm" onClick={() => setDraftTrialPreset("today")}>
                                Reset
                            </Button>
                            <Button className="flex-1 rounded-xl h-10 text-sm shadow-md" onClick={() => {
                                if (draftTrialPreset !== "custom") {
                                    const p = trialPresets.find(pr => pr.key === draftTrialPreset);
                                    if (p) handleTrialPreset(p);
                                } else {
                                    setTrialPresetKey("custom");
                                    setDate(draftTrialDate);
                                }
                                setTrialSheetOpen(false);
                            }}>
                                Terapkan Filter
                            </Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop */}
            <Card className="hidden sm:block rounded-2xl border-0 shadow-sm bg-white">
                <CardContent className="px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cari kode atau nama akun..."
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all h-10"
                            />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {trialPresets.map((p) => (
                                <button key={p.key} type="button" onClick={() => handleTrialPreset(p)}
                                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${trialPresetKey === p.key ? "bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-200/50" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                                    {p.label}
                                </button>
                            ))}
                            <button type="button" onClick={() => setTrialPresetKey("custom")}
                                className={`flex items-center gap-1 shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${trialPresetKey === "custom" ? "bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-200/50" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                                <SlidersHorizontal className="w-3 h-3" />
                                Custom
                            </button>
                            {isPending && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />}
                            {data && (
                                <Badge className={`gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${data.isBalanced ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                                    {data.isBalanced ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                    {data.isBalanced ? "Balance" : "Selisih " + formatAccountingCurrency(data.difference)}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Custom date picker */}
                    {trialPresetKey === "custom" && (
                        <DatePicker value={date} onChange={setDate} placeholder="Pilih tanggal" className="w-[180px] rounded-xl h-8 text-xs" />
                    )}
                </CardContent>
            </Card>

            {/* Summary cards */}
            {data && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-50/30">
                        <CardContent className="p-5">
                            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest">Total Debit</p>
                            <p className="text-xl font-extrabold font-mono tabular-nums text-emerald-700 mt-1">{formatAccountingCurrency(data.totalDebit)}</p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-50/30">
                        <CardContent className="p-5">
                            <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-widest">Total Kredit</p>
                            <p className="text-xl font-extrabold font-mono tabular-nums text-rose-700 mt-1">{formatAccountingCurrency(data.totalCredit)}</p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-50/30">
                        <CardContent className="p-5">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Jumlah Akun</p>
                            <p className="text-xl font-extrabold font-mono tabular-nums text-slate-700 mt-1">{data.rows.length}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Loading */}
            {isPending && <LoadingState message="Memuat neraca saldo..." />}

            {/* Table grouped by category */}
            {!isPending && data && (
                <div className="space-y-4">
                    {grouped.length === 0 && (
                        <div className="text-center py-16">
                            <BarChart3 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-sm font-medium text-slate-400">Tidak ada data ditemukan</p>
                        </div>
                    )}
                    {grouped.map(([categoryName, rows]) => {
                        const colors = CATEGORY_COLORS[categoryName] ?? { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" };
                        const catDebit = rows.reduce((s, r) => s + r.debit, 0);
                        const catCredit = rows.reduce((s, r) => s + r.credit, 0);
                        return (
                            <Card key={categoryName} className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden">
                                {/* Category header */}
                                <div className={`px-3 sm:px-6 py-2.5 sm:py-3 ${colors.bg} border-b ${colors.border} flex items-center justify-between gap-2`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Badge className={`${colors.bg} ${colors.text} border ${colors.border} text-[10px] font-bold uppercase tracking-widest rounded-lg px-2 sm:px-2.5 py-0.5 shrink-0`}>
                                            {categoryName}
                                        </Badge>
                                        <span className="text-[10px] sm:text-[11px] text-slate-400 shrink-0">{rows.length}</span>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] font-mono tabular-nums shrink-0">
                                        {catDebit > 0 && <span className="text-emerald-600 font-semibold">D: {formatAccountingCurrency(catDebit)}</span>}
                                        {catCredit > 0 && <span className="text-rose-600 font-semibold">K: {formatAccountingCurrency(catCredit)}</span>}
                                    </div>
                                </div>
                                {/* Rows */}
                                <div className="divide-y divide-slate-50">
                                    {rows.map((r, i) => (
                                        <div key={i} className="flex items-baseline gap-2 px-3 sm:px-6 py-2.5 sm:py-3 hover:bg-slate-50/60 transition-colors">
                                            <span className="hidden sm:inline w-24 shrink-0 font-mono text-xs text-slate-400">{r.accountCode}</span>
                                            <span className="flex-1 text-xs sm:text-[13px] text-slate-700 font-medium min-w-0 truncate">{r.accountName}</span>
                                            <span className="shrink-0 text-right font-mono tabular-nums text-xs font-semibold text-emerald-600">
                                                {r.debit > 0 ? formatAccountingCurrency(r.debit) : <span className="text-slate-200">—</span>}
                                            </span>
                                            <span className="shrink-0 text-right font-mono tabular-nums text-xs font-semibold text-rose-600">
                                                {r.credit > 0 ? formatAccountingCurrency(r.credit) : <span className="text-slate-200">—</span>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        );
                    })}

                    {/* Grand total footer */}
                    {grouped.length > 0 && (
                        <Card className={`rounded-2xl overflow-hidden border-0 shadow-md ${data.isBalanced ? "bg-gradient-to-r from-emerald-500 to-teal-600" : "bg-gradient-to-r from-red-500 to-rose-600"}`}>
                            <CardContent className="py-3 sm:py-4 px-3 sm:px-6">
                                <div className="flex items-center justify-between gap-2 text-white">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {data.isBalanced ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" /> : <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />}
                                        <span className="font-bold text-xs sm:text-sm truncate">{data.isBalanced ? "Seimbang" : "Tidak Seimbang"}</span>
                                    </div>
                                    <div className="flex items-center gap-3 sm:gap-8 font-mono tabular-nums text-xs sm:text-sm font-bold shrink-0">
                                        <span>Debit: {formatAccountingCurrency(data.totalDebit)}</span>
                                        <span>Kredit: {formatAccountingCurrency(data.totalCredit)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Shared: Presets & Filters ──────────────────────────────────────────

type PresetKey = string;

interface Preset { key: PresetKey; label: string; from: string; to: string }

function getRangePresets(): Preset[] {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const fmt = (d: Date) => d.toISOString().split("T")[0]!;
    return [
        { key: "this-month", label: "Bulan Ini", from: fmt(new Date(y, m, 1)), to: fmt(now) },
        { key: "last-month", label: "Bulan Lalu", from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) },
        { key: "3-months", label: "3 Bulan", from: fmt(new Date(y, m - 2, 1)), to: fmt(now) },
        { key: "this-year", label: "Tahun Ini", from: fmt(new Date(y, 0, 1)), to: fmt(now) },
    ];
}

function getSingleDatePresets(): Preset[] {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const fmt = (d: Date) => d.toISOString().split("T")[0]!;
    return [
        { key: "today", label: "Hari Ini", from: fmt(now), to: fmt(now) },
        { key: "end-last-month", label: "Akhir Bulan Lalu", from: fmt(new Date(y, m, 0)), to: fmt(new Date(y, m, 0)) },
        { key: "end-2-months-ago", label: "2 Bulan Lalu", from: fmt(new Date(y, m - 1, 0)), to: fmt(new Date(y, m - 1, 0)) },
        { key: "end-last-year", label: "Akhir Tahun Lalu", from: fmt(new Date(y - 1, 11, 31)), to: fmt(new Date(y - 1, 11, 31)) },
    ];
}

function PresetTabs({ presets, activeKey, onSelect, onCustom }: {
    presets: Preset[]; activeKey: PresetKey; onSelect: (p: Preset) => void; onCustom: () => void;
}) {
    return (
        <div className="flex items-center bg-slate-100/80 rounded-xl p-1 gap-0.5 overflow-x-auto scrollbar-hide w-full sm:w-auto">
            {presets.map((p) => (
                <button key={p.key} type="button" onClick={() => onSelect(p)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap shrink-0 ${activeKey === p.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    {p.label}
                </button>
            ))}
            <button type="button" onClick={onCustom}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap shrink-0 ${activeKey === "custom" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <SlidersHorizontal className="w-3 h-3" />
                Custom
            </button>
        </div>
    );
}

function DateRangeFilter({ dateFrom, setDateFrom, dateTo, setDateTo, isPending }: {
    dateFrom: string; setDateFrom: (v: string) => void;
    dateTo: string; setDateTo: (v: string) => void;
    onGenerate: () => void; isPending: boolean; icon: React.ElementType;
}) {
    const presets = getRangePresets();
    const [selectedKey, setSelectedKey] = useState<PresetKey>("this-month");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [draftKey, setDraftKey] = useState<PresetKey>("this-month");
    const [draftFrom, setDraftFrom] = useState(dateFrom);
    const [draftTo, setDraftTo] = useState(dateTo);

    const handleSelect = (p: Preset) => {
        setSelectedKey(p.key);
        setDateFrom(p.from);
        setDateTo(p.to);
    };

    return (
        <>
            {/* Mobile */}
            <div className="sm:hidden flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-xl h-9 gap-1.5 justify-start" onClick={() => { setDraftKey(selectedKey); setDraftFrom(dateFrom); setDraftTo(dateTo); setSheetOpen(true); }}>
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span className="text-xs">{presets.find(p => p.key === selectedKey)?.label ?? "Custom"}</span>
                </Button>
                {isPending && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />}
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                        <div className="shrink-0">
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                            </div>
                            <SheetHeader className="px-4 pb-3 pt-0">
                                <SheetTitle className="text-base font-bold">Pilih Periode</SheetTitle>
                            </SheetHeader>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 space-y-1">
                            {presets.map((p) => {
                                const isActive = draftKey === p.key;
                                return (
                                    <button key={p.key} onClick={() => setDraftKey(p.key)}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}>
                                        <span>{p.label}</span>
                                        {isActive && <Check className="w-4 h-4" />}
                                    </button>
                                );
                            })}
                            <button onClick={() => setDraftKey("custom")}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${draftKey === "custom" ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}>
                                <span className="flex items-center gap-1.5"><SlidersHorizontal className="w-3.5 h-3.5" /> Custom</span>
                                {draftKey === "custom" && <Check className="w-4 h-4" />}
                            </button>
                            {draftKey === "custom" && (
                                <div className="pt-2 space-y-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1.5">Dari</p>
                                        <DatePicker value={draftFrom} onChange={setDraftFrom} placeholder="Tanggal mulai" className="w-full rounded-xl h-10 text-sm" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1.5">Sampai</p>
                                        <DatePicker value={draftTo} onChange={setDraftTo} placeholder="Tanggal akhir" className="w-full rounded-xl h-10 text-sm" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <SheetFooter className="shrink-0 border-t px-4 py-3 flex-row gap-2">
                            <Button variant="outline" className="flex-1 rounded-xl h-10 text-sm" onClick={() => setDraftKey("this-month")}>Reset</Button>
                            <Button className="flex-1 rounded-xl h-10 text-sm shadow-md" onClick={() => {
                                if (draftKey !== "custom") { const p = presets.find(pr => pr.key === draftKey); if (p) handleSelect(p); }
                                else { setSelectedKey("custom"); setDateFrom(draftFrom); setDateTo(draftTo); }
                                setSheetOpen(false);
                            }}>Terapkan Filter</Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
            </div>
            {/* Desktop */}
            <Card className="hidden sm:block rounded-2xl border-0 shadow-sm bg-white">
                <CardContent className="px-5 py-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <PresetTabs presets={presets} activeKey={selectedKey}
                            onSelect={handleSelect}
                            onCustom={() => setSelectedKey("custom")} />
                        {isPending && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />}
                    </div>

                    {selectedKey === "custom" && (
                        <div className="flex items-center gap-2">
                            <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Dari" className="w-[150px] rounded-xl h-8 text-xs" />
                            <span className="text-slate-300 text-xs">—</span>
                            <DatePicker value={dateTo} onChange={setDateTo} placeholder="Sampai" className="w-[150px] rounded-xl h-8 text-xs" />
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}

function SingleDateFilter({ date, setDate, isPending, badge }: {
    date: string; setDate: (v: string) => void;
    onGenerate: () => void; isPending: boolean; icon: React.ElementType;
    badge?: React.ReactNode;
}) {
    const presets = getSingleDatePresets();
    const [selectedKey, setSelectedKey] = useState<PresetKey>("today");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [draftKey, setDraftKey] = useState<PresetKey>("today");
    const [draftDate, setDraftDate] = useState(date);

    const handleSelect = (p: Preset) => {
        setSelectedKey(p.key);
        setDate(p.to);
    };

    return (
        <>
            {/* Mobile */}
            <div className="sm:hidden flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-xl h-9 gap-1.5 justify-start" onClick={() => { setDraftKey(selectedKey); setDraftDate(date); setSheetOpen(true); }}>
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span className="text-xs">{presets.find(p => p.key === selectedKey)?.label ?? "Custom"}</span>
                </Button>
                {isPending && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />}
                {badge}
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                        <div className="shrink-0">
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                            </div>
                            <SheetHeader className="px-4 pb-3 pt-0">
                                <SheetTitle className="text-base font-bold">Pilih Periode</SheetTitle>
                            </SheetHeader>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 space-y-1">
                            {presets.map((p) => {
                                const isActive = draftKey === p.key;
                                return (
                                    <button key={p.key} onClick={() => setDraftKey(p.key)}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}>
                                        <span>{p.label}</span>
                                        {isActive && <Check className="w-4 h-4" />}
                                    </button>
                                );
                            })}
                            <button onClick={() => setDraftKey("custom")}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${draftKey === "custom" ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}>
                                <span className="flex items-center gap-1.5"><SlidersHorizontal className="w-3.5 h-3.5" /> Custom</span>
                                {draftKey === "custom" && <Check className="w-4 h-4" />}
                            </button>
                            {draftKey === "custom" && (
                                <div className="pt-2">
                                    <p className="text-xs text-muted-foreground mb-1.5">Pilih tanggal</p>
                                    <DatePicker value={draftDate} onChange={setDraftDate} placeholder="Pilih tanggal" className="w-full rounded-xl h-10 text-sm" />
                                </div>
                            )}
                        </div>
                        <SheetFooter className="shrink-0 border-t px-4 py-3 flex-row gap-2">
                            <Button variant="outline" className="flex-1 rounded-xl h-10 text-sm" onClick={() => setDraftKey("today")}>Reset</Button>
                            <Button className="flex-1 rounded-xl h-10 text-sm shadow-md" onClick={() => {
                                if (draftKey !== "custom") { const p = presets.find(pr => pr.key === draftKey); if (p) handleSelect(p); }
                                else { setSelectedKey("custom"); setDate(draftDate); }
                                setSheetOpen(false);
                            }}>Terapkan Filter</Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
            </div>
            {/* Desktop */}
            <Card className="hidden sm:block rounded-2xl border-0 shadow-sm bg-white">
                <CardContent className="px-5 py-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <PresetTabs presets={presets} activeKey={selectedKey}
                            onSelect={handleSelect}
                            onCustom={() => setSelectedKey("custom")} />
                        {isPending && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />}
                        {badge}
                    </div>

                    {selectedKey === "custom" && (
                        <DatePicker value={date} onChange={setDate} placeholder="Pilih tanggal" className="w-[180px] rounded-xl h-8 text-xs" />
                    )}
                </CardContent>
            </Card>
        </>
    );
}

function LoadingState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center mb-4">
                <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
            </div>
            <p className="text-sm text-gray-400">{message}</p>
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AccountList({ items, color, totalLabel, total, totalBorderColor }: {
    items: any[]; color: string; totalLabel: string; total: number; totalBorderColor: string;
}) {
    return (
        <>
            <div className="divide-y divide-gray-100/80">
                {items.map((r: { accountName: string; amount?: number; balance?: number }, i: number) => {
                    const value = r.amount ?? r.balance ?? 0;
                    return (
                        <div key={i} className="flex justify-between items-baseline gap-2 py-2.5 sm:py-3 px-2 sm:px-3 hover:bg-gray-50/60 rounded-lg transition-colors -mx-1">
                            <span className="text-xs sm:text-[13px] text-gray-700 min-w-0 truncate">{r.accountName}</span>
                            <span className={`text-xs sm:text-[13px] font-mono tabular-nums font-semibold shrink-0 ${color}`}>
                                {formatAccountingCurrency(value)}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className={`flex justify-between items-center pt-3 sm:pt-4 mt-2 sm:mt-3 border-t-2 ${totalBorderColor} px-1`}>
                <span className={`text-xs sm:text-sm font-bold ${color}`}>{totalLabel}</span>
                <span className={`text-sm sm:text-base font-extrabold font-mono tabular-nums ${color}`}>
                    {formatAccountingCurrency(total)}
                </span>
            </div>
        </>
    );
}

// ── Income Statement ──────────────────────────────────────────────────

function IncomeStatementTab({ dateFrom, setDateFrom, dateTo, setDateTo, branchId }: {
    dateFrom: string; setDateFrom: (v: string) => void;
    dateTo: string; setDateTo: (v: string) => void; branchId?: string;
}) {
    const { data, isPending, load, netIncome, isProfit } = useIncomeStatement(dateFrom, dateTo, branchId);

    return (
        <div className="space-y-5">
            <DateRangeFilter dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} onGenerate={load} isPending={isPending} icon={TrendingUp} />

            {isPending ? <LoadingState message="Memuat laporan laba rugi..." /> : data && (
                <div className="space-y-5">
                    {/* Net Income Hero Card */}
                    <Card className={`rounded-xl sm:rounded-2xl overflow-hidden border-0 shadow-lg py-0 gap-0 ${isProfit ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-red-500 to-rose-600"}`}>
                        <CardContent className="py-4 px-4 sm:py-8 sm:px-8">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-white/70 text-[10px] sm:text-xs font-semibold uppercase tracking-widest mb-1 sm:mb-2">
                                        {isProfit ? "Laba Bersih" : "Rugi Bersih"}
                                    </p>
                                    <p className="text-2xl sm:text-4xl font-extrabold text-white font-mono tabular-nums tracking-tight">
                                        {formatAccountingCurrency(Math.abs(netIncome))}
                                    </p>
                                    <div className="flex items-center gap-2 sm:gap-4 mt-2 sm:mt-3 flex-wrap">
                                        <span className="text-white/60 text-[10px] sm:text-xs">Pendapatan: <span className="text-white font-semibold font-mono">{formatAccountingCurrency(data.totalRevenue)}</span></span>
                                        <span className="text-white/40 hidden sm:inline">|</span>
                                        <span className="text-white/60 text-[10px] sm:text-xs">Beban: <span className="text-white font-semibold font-mono">{formatAccountingCurrency(data.totalExpense)}</span></span>
                                    </div>
                                </div>
                                <div className={`w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 bg-white/20`}>
                                    {isProfit ? <ArrowUpRight className="w-5 h-5 sm:w-8 sm:h-8 text-white" /> : <ArrowDownRight className="w-5 h-5 sm:w-8 sm:h-8 text-white" />}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Revenue & Expense */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                        {/* Revenue */}
                        <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden min-w-0">
                            <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
                            <CardHeader className="pb-0 pt-4 sm:pt-5 px-4 sm:px-6">
                                <CardTitle className="text-xs font-bold text-emerald-700 flex items-center gap-2 uppercase tracking-widest">
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />
                                    </div>
                                    Pendapatan
                                    <Badge variant="secondary" className="ml-auto text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200 rounded-lg">{data.revenues.length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-5 pt-3 sm:pt-4">
                                <AccountList items={data.revenues} color="text-emerald-600" totalLabel="Total Pendapatan" total={data.totalRevenue} totalBorderColor="border-emerald-100" />
                            </CardContent>
                        </Card>

                        {/* Expense */}
                        <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden min-w-0">
                            <div className="h-1 bg-gradient-to-r from-orange-400 to-red-500" />
                            <CardHeader className="pb-0 pt-4 sm:pt-5 px-4 sm:px-6">
                                <CardTitle className="text-xs font-bold text-orange-700 flex items-center gap-2 uppercase tracking-widest">
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                                        <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-600" />
                                    </div>
                                    Beban
                                    <Badge variant="secondary" className="ml-auto text-[10px] bg-orange-50 text-orange-600 border-orange-200 rounded-lg">{data.expenses.length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-5 pt-3 sm:pt-4">
                                <AccountList items={data.expenses} color="text-orange-600" totalLabel="Total Beban" total={data.totalExpense} totalBorderColor="border-orange-100" />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Balance Sheet ──────────────────────────────────────────────────────

function BalanceSheetTab({ date, setDate, branchId }: {
    date: string; setDate: (v: string) => void; branchId?: string;
}) {
    const { data, isPending, load } = useBalanceSheet(date, branchId);

    function Section({ title, items, total, gradient, iconBg, icon: Icon, textColor, borderColor }: {
        title: string; items: { accountName: string; balance: number }[];
        total: number; gradient: string; iconBg: string; icon: React.ElementType;
        textColor: string; borderColor: string;
    }) {
        return (
            <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden min-w-0">
                <div className={`h-1 ${gradient}`} />
                <CardHeader className="pb-0 pt-4 sm:pt-5 px-4 sm:px-6">
                    <CardTitle className={`text-xs font-bold ${textColor} flex items-center gap-2 uppercase tracking-widest`}>
                        <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg ${iconBg} flex items-center justify-center`}>
                            <Icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${textColor}`} />
                        </div>
                        {title}
                        <Badge variant="secondary" className={`ml-auto text-[10px] rounded-lg ${iconBg} ${textColor} border-0`}>{items.length}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4 sm:pb-5 pt-3 sm:pt-4">
                    <div className="divide-y divide-gray-100/80">
                        {items.map((a, i) => (
                            <div key={i} className="flex justify-between items-baseline gap-2 py-2.5 sm:py-3 px-2 sm:px-3 hover:bg-gray-50/60 rounded-lg transition-colors -mx-1">
                                <span className="text-xs sm:text-[13px] text-gray-700 min-w-0 truncate">{a.accountName}</span>
                                <span className={`text-xs sm:text-[13px] font-mono tabular-nums font-semibold shrink-0 ${textColor}`}>
                                    {formatAccountingCurrency(a.balance)}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className={`flex justify-between items-center pt-3 sm:pt-4 mt-2 sm:mt-3 border-t-2 ${borderColor} px-1`}>
                        <span className={`text-xs sm:text-sm font-bold ${textColor}`}>Total {title}</span>
                        <span className={`text-sm sm:text-base font-extrabold font-mono tabular-nums ${textColor}`}>
                            {formatAccountingCurrency(total)}
                        </span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-5">
            <SingleDateFilter date={date} setDate={setDate} onGenerate={load} isPending={isPending} icon={PieChart}
                badge={data && (
                    <Badge className={`shrink-0 gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-medium border ${data.isBalanced ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}`}>
                        {data.isBalanced ? <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                        {data.isBalanced ? "Balance" : "Tidak Balance"}
                    </Badge>
                )}
            />

            {isPending ? <LoadingState message="Memuat neraca..." /> : data && (
                <>
                    {/* Summary Bar */}
                    {/* Mobile: compact inline pills */}
                    <div className="sm:hidden flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                        <div className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-blue-50 ring-1 ring-blue-100">
                            <span className="text-[10px] text-blue-500 font-semibold">Aset</span>
                            <span className="text-[11px] font-bold font-mono tabular-nums text-blue-700">{formatAccountingCurrency(data.totalAssets)}</span>
                        </div>
                        <div className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-red-50 ring-1 ring-red-100">
                            <span className="text-[10px] text-red-500 font-semibold">Kewajiban</span>
                            <span className="text-[11px] font-bold font-mono tabular-nums text-red-700">{formatAccountingCurrency(data.totalLiabilities)}</span>
                        </div>
                        <div className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-purple-50 ring-1 ring-purple-100">
                            <span className="text-[10px] text-purple-500 font-semibold">Ekuitas</span>
                            <span className="text-[11px] font-bold font-mono tabular-nums text-purple-700">{formatAccountingCurrency(data.totalEquity + data.retainedEarnings)}</span>
                        </div>
                    </div>
                    {/* Desktop: cards */}
                    <div className="hidden sm:grid grid-cols-3 gap-4">
                        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-50/30 min-w-0 py-0 gap-0">
                            <CardContent className="p-5 text-center">
                                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest">Total Aset</p>
                                <p className="text-xl font-extrabold font-mono tabular-nums text-blue-700 mt-1">{formatAccountingCurrency(data.totalAssets)}</p>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-red-50 to-rose-50/30 min-w-0 py-0 gap-0">
                            <CardContent className="p-5 text-center">
                                <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest">Kewajiban</p>
                                <p className="text-xl font-extrabold font-mono tabular-nums text-red-700 mt-1">{formatAccountingCurrency(data.totalLiabilities)}</p>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-50/30 min-w-0 py-0 gap-0">
                            <CardContent className="p-5 text-center">
                                <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest">Ekuitas</p>
                                <p className="text-xl font-extrabold font-mono tabular-nums text-purple-700 mt-1">{formatAccountingCurrency(data.totalEquity + data.retainedEarnings)}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Two column layout — scroll horizontal on mobile */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                        <Section title="Aset" items={data.assets.accounts} total={data.totalAssets}
                            gradient="bg-gradient-to-r from-blue-400 to-blue-600" iconBg="bg-blue-100"
                            icon={BarChart3} textColor="text-blue-700" borderColor="border-blue-100" />

                        <div className="space-y-5">
                            <Section title="Kewajiban" items={data.liabilities.accounts} total={data.totalLiabilities}
                                gradient="bg-gradient-to-r from-red-400 to-rose-500" iconBg="bg-red-100"
                                icon={TrendingDown} textColor="text-red-700" borderColor="border-red-100" />

                            <Section title="Ekuitas"
                                items={[
                                    ...data.equity.accounts,
                                    ...(data.retainedEarnings !== 0 ? [{ accountName: "Laba Ditahan (Periode Berjalan)", balance: data.retainedEarnings }] : []),
                                ]}
                                total={data.totalEquity + data.retainedEarnings}
                                gradient="bg-gradient-to-r from-purple-400 to-violet-500" iconBg="bg-purple-100"
                                icon={PieChart} textColor="text-purple-700" borderColor="border-purple-100" />
                        </div>
                    </div>

                    {/* Balance equation */}
                    <Card className={`rounded-xl sm:rounded-2xl overflow-hidden border-0 shadow-md py-0 gap-0 ${data.isBalanced ? "bg-gradient-to-r from-emerald-500 to-teal-600" : "bg-gradient-to-r from-red-500 to-rose-600"}`}>
                        <CardContent className="py-3 px-4 sm:py-5 sm:px-8">
                            {/* Mobile */}
                            <div className="sm:hidden space-y-2">
                                <div className="flex items-center gap-1.5 text-white">
                                    {data.isBalanced ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                                    <span className="text-xs font-bold">{data.isBalanced ? "Seimbang" : "Tidak Seimbang"}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-white text-center">
                                    <div>
                                        <p className="text-white/50 text-[8px] uppercase tracking-wider">Aset</p>
                                        <p className="text-[11px] font-bold font-mono tabular-nums">{formatAccountingCurrency(data.totalAssets)}</p>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <span className="text-white/40 text-xs">=</span>
                                    </div>
                                    <div>
                                        <p className="text-white/50 text-[8px] uppercase tracking-wider">Kwjbn + Ekts</p>
                                        <p className="text-[11px] font-bold font-mono tabular-nums">{formatAccountingCurrency(data.totalLiabilities + data.totalEquity + data.retainedEarnings)}</p>
                                    </div>
                                </div>
                            </div>
                            {/* Desktop */}
                            <div className="hidden sm:flex items-center justify-center gap-4 text-white">
                                <div className="text-center">
                                    <p className="text-white/60 text-[10px] uppercase tracking-widest">Aset</p>
                                    <p className="text-lg font-bold font-mono tabular-nums">{formatAccountingCurrency(data.totalAssets)}</p>
                                </div>
                                <span className="text-2xl font-light text-white/50">=</span>
                                <div className="text-center">
                                    <p className="text-white/60 text-[10px] uppercase tracking-widest">Kewajiban</p>
                                    <p className="text-lg font-bold font-mono tabular-nums">{formatAccountingCurrency(data.totalLiabilities)}</p>
                                </div>
                                <span className="text-2xl font-light text-white/50">+</span>
                                <div className="text-center">
                                    <p className="text-white/60 text-[10px] uppercase tracking-widest">Ekuitas</p>
                                    <p className="text-lg font-bold font-mono tabular-nums">{formatAccountingCurrency(data.totalEquity + data.retainedEarnings)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}

// ── Cash Flow ──────────────────────────────────────────────────────────

function CashFlowTab({ dateFrom, setDateFrom, dateTo, setDateTo, branchId }: {
    dateFrom: string; setDateFrom: (v: string) => void;
    dateTo: string; setDateTo: (v: string) => void; branchId?: string;
}) {
    const { data, isPending, load } = useCashFlow(dateFrom, dateTo, branchId);

    return (
        <div className="space-y-5">
            <DateRangeFilter dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} onGenerate={load} isPending={isPending} icon={Wallet} />

            {isPending ? <LoadingState message="Memuat arus kas..." /> : data && (
                <div className="space-y-5">
                    {/* Cash Flow Waterfall: Opening → Movement → Closing */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                        <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
                            <CardContent className="p-2.5 sm:p-5">
                                <div className="hidden sm:flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Kas Awal</p>
                                        <p className="text-2xl font-extrabold font-mono tabular-nums text-gray-900 mt-1">{formatAccountingCurrency(data.openingCash)}</p>
                                    </div>
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                                        <Wallet className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                                <div className="sm:hidden text-center">
                                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Kas Awal</p>
                                    <p className="text-sm font-extrabold font-mono tabular-nums text-gray-900 mt-0.5">{formatAccountingCurrency(data.openingCash)}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className={`rounded-2xl border-0 shadow-sm overflow-hidden ${data.netCashFlow >= 0 ? "bg-gradient-to-br from-emerald-50 to-green-50" : "bg-gradient-to-br from-red-50 to-rose-50"}`}>
                            <div className={`h-1 ${data.netCashFlow >= 0 ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-red-400 to-rose-500"}`} />
                            <CardContent className="p-2.5 sm:p-5">
                                <div className="hidden sm:flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Arus Kas Bersih</p>
                                        <p className={`text-2xl font-extrabold font-mono tabular-nums mt-1 ${data.netCashFlow >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                            {data.netCashFlow >= 0 ? "+" : ""}{formatAccountingCurrency(data.netCashFlow)}
                                        </p>
                                    </div>
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${data.netCashFlow >= 0 ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25" : "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/25"}`}>
                                        {data.netCashFlow >= 0 ? <ArrowUpRight className="w-5 h-5 text-white" /> : <ArrowDownRight className="w-5 h-5 text-white" />}
                                    </div>
                                </div>
                                <div className="sm:hidden text-center">
                                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Arus Bersih</p>
                                    <p className={`text-sm font-extrabold font-mono tabular-nums mt-0.5 ${data.netCashFlow >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                        {data.netCashFlow >= 0 ? "+" : ""}{formatAccountingCurrency(data.netCashFlow)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-violet-400 to-purple-600" />
                            <CardContent className="p-2.5 sm:p-5">
                                <div className="hidden sm:flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Kas Akhir</p>
                                        <p className="text-2xl font-extrabold font-mono tabular-nums text-gray-900 mt-1">{formatAccountingCurrency(data.closingCash)}</p>
                                    </div>
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25 shrink-0">
                                        <Wallet className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                                <div className="sm:hidden text-center">
                                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Kas Akhir</p>
                                    <p className="text-sm font-extrabold font-mono tabular-nums text-gray-900 mt-0.5">{formatAccountingCurrency(data.closingCash)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Cash In / Cash Out — scroll horizontal on mobile */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                        <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden min-w-0">
                            <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
                            <CardHeader className="pb-0 pt-4 sm:pt-5 px-4 sm:px-6">
                                <CardTitle className="text-xs font-bold text-emerald-700 flex items-center gap-2 uppercase tracking-widest">
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />
                                    </div>
                                    Kas Masuk
                                    <span className="ml-auto text-sm sm:text-base font-extrabold font-mono tabular-nums">{formatAccountingCurrency(data.totalCashIn)}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-6 pb-5 pt-4">
                                <div className="divide-y divide-gray-100/80">
                                    {data.cashIn.map((c: { description: string; amount: number }, i: number) => (
                                        <div key={i} className="flex justify-between items-baseline gap-2 py-2.5 sm:py-3 px-2 sm:px-3 hover:bg-gray-50/60 rounded-lg transition-colors -mx-1">
                                            <span className="text-xs sm:text-[13px] text-gray-700 min-w-0 truncate">{c.description}</span>
                                            <span className="text-xs sm:text-[13px] font-mono tabular-nums text-emerald-600 font-semibold shrink-0">+{formatAccountingCurrency(c.amount)}</span>
                                        </div>
                                    ))}
                                    {data.cashIn.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Tidak ada kas masuk</p>}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden min-w-0">
                            <div className="h-1 bg-gradient-to-r from-red-400 to-rose-500" />
                            <CardHeader className="pb-0 pt-4 sm:pt-5 px-4 sm:px-6">
                                <CardTitle className="text-xs font-bold text-red-700 flex items-center gap-2 uppercase tracking-widest">
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-red-100 flex items-center justify-center">
                                        <ArrowDownRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-600" />
                                    </div>
                                    Kas Keluar
                                    <span className="ml-auto text-sm sm:text-base font-extrabold font-mono tabular-nums">{formatAccountingCurrency(data.totalCashOut)}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-5 pt-3 sm:pt-4">
                                <div className="divide-y divide-gray-100/80">
                                    {data.cashOut.map((c: { description: string; amount: number }, i: number) => (
                                        <div key={i} className="flex justify-between items-baseline gap-2 py-2.5 sm:py-3 px-2 sm:px-3 hover:bg-gray-50/60 rounded-lg transition-colors -mx-1">
                                            <span className="text-xs sm:text-[13px] text-gray-700 min-w-0 truncate">{c.description}</span>
                                            <span className="text-xs sm:text-[13px] font-mono tabular-nums text-red-600 font-semibold shrink-0">-{formatAccountingCurrency(c.amount)}</span>
                                        </div>
                                    ))}
                                    {data.cashOut.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Tidak ada kas keluar</p>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
