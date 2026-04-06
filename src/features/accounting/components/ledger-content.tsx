"use client";

import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SmartTable, type SmartColumn } from "@/components/ui/smart-table";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    BookText,
    Loader2,
    Check,
    ChevronsUpDown,
    FileSpreadsheet,
    Wallet,
    ArrowUpRight,
    ArrowDownRight,
    Scale,
    SlidersHorizontal,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "../hooks";
import { useMemo, useState, useCallback } from "react";

// ── Date presets ──────────────────────────────────────────────────────
type PresetKey = string;
interface Preset { key: PresetKey; label: string; from: string; to: string }

function getLedgerPresets(): Preset[] {
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

export function LedgerContent() {
    const {
        accounts,
        selectedAccountId,
        setSelectedAccountId,
        accountOpen,
        setAccountOpen,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        ledger,
        loading,
        initialLoad,
        selectedAccount,
    } = useLedger();

    const [entryPage, setEntryPage] = useState(1);
    const [entryPageSize, setEntryPageSize] = useState(20);
    const [entrySearch, setEntrySearch] = useState("");
    const [ledgerFilters, setLedgerFilters] = useState<Record<string, string>>({
        date_from: "",
        date_to: "",
    });

    const presets = useMemo(() => getLedgerPresets(), []);
    const [selectedPresetKey, setSelectedPresetKey] = useState<PresetKey>("this-month");

    const handlePresetSelect = useCallback((p: Preset) => {
        setSelectedPresetKey(p.key);
        setDateFrom(p.from);
        setDateTo(p.to);
    }, [setDateFrom, setDateTo]);

    const filteredEntries = useMemo(() => {
        if (!ledger) return [];
        const q = entrySearch.trim().toLowerCase();
        if (!q) return ledger.entries;
        return ledger.entries.filter((e) => {
            const d = `${e.entryNumber} ${e.description} ${e.lineDescription ?? ""}`.toLowerCase();
            return d.includes(q);
        });
    }, [ledger, entrySearch]);

    const entriesTotal = filteredEntries.length;
    const entriesTotalPages = Math.max(1, Math.ceil(entriesTotal / entryPageSize));
    const entriesCurrentPage = Math.min(entryPage, entriesTotalPages);
    const entriesPageData = useMemo(() => {
        const start = (entriesCurrentPage - 1) * entryPageSize;
        return filteredEntries.slice(start, start + entryPageSize);
    }, [filteredEntries, entriesCurrentPage, entryPageSize]);

    const columns: SmartColumn<(typeof ledger extends null ? never : NonNullable<typeof ledger>["entries"][number])>[] = [
        {
            key: "date",
            header: "Tanggal",
            render: (row) => <span className="text-xs text-slate-700">{formatDate(row.date)}</span>,
            exportValue: (row) => new Date(row.date).toISOString(),
        },
        {
            key: "entryNumber",
            header: "No. Jurnal",
            render: (row) => <span className="text-xs font-mono text-slate-600">{row.entryNumber}</span>,
            exportValue: (row) => row.entryNumber,
        },
        {
            key: "description",
            header: "Keterangan",
            render: (row) => (
                <div className="min-w-0">
                    <div className="text-xs text-slate-700 truncate max-w-[520px]">{row.description}</div>
                    {row.lineDescription && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-[520px]">{row.lineDescription}</div>
                    )}
                </div>
            ),
            exportValue: (row) => row.description,
        },
        {
            key: "debit",
            header: "Debit",
            align: "right",
            render: (row) =>
                row.debit > 0 ? (
                    <span className="text-xs font-mono tabular-nums font-semibold text-emerald-600">{formatCurrency(row.debit)}</span>
                ) : (
                    <span className="text-xs text-muted-foreground/40">-</span>
                ),
            exportValue: (row) => row.debit,
        },
        {
            key: "credit",
            header: "Kredit",
            align: "right",
            render: (row) =>
                row.credit > 0 ? (
                    <span className="text-xs font-mono tabular-nums font-semibold text-rose-600">{formatCurrency(row.credit)}</span>
                ) : (
                    <span className="text-xs text-muted-foreground/40">-</span>
                ),
            exportValue: (row) => row.credit,
        },
        {
            key: "runningBalance",
            header: "Saldo",
            align: "right",
            render: (row) => (
                <span className="text-xs font-mono tabular-nums font-bold text-slate-800">{formatCurrency(row.runningBalance)}</span>
            ),
            exportValue: (row) => row.runningBalance,
        },
    ];

    if (initialLoad) {
        return (
            <div className="space-y-6">
                {/* Header skeleton */}
                <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-48" />
                        <Skeleton className="h-4 w-72" />
                    </div>
                </div>
                {/* Filter skeleton */}
                <Skeleton className="h-20 rounded-2xl" />
                {/* Stats skeleton */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-2xl" />
                    ))}
                </div>
                {/* Table skeleton */}
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                    <BookText className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Buku Besar</h1>
                    <p className="text-sm text-gray-500">
                        Detail transaksi dan saldo per akun dalam periode tertentu
                    </p>
                </div>
            </div>

            {/* Filter Section */}
            <Card className="rounded-2xl border-0 shadow-sm bg-white">
                <CardContent className="px-3 sm:px-5 py-3 sm:py-4 space-y-3">
                    {/* Account combobox — full width on mobile */}
                    <Popover open={accountOpen} onOpenChange={setAccountOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                className="w-full sm:w-[320px] justify-between rounded-xl font-normal h-9 border-gray-200 hover:border-gray-300 transition-colors text-sm"
                            >
                                {selectedAccount ? (
                                    <span className="flex items-center gap-2 truncate">
                                        <span className="font-mono text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                            {selectedAccount.code}
                                        </span>
                                        <span className="text-gray-700 truncate">{selectedAccount.name}</span>
                                    </span>
                                ) : (
                                    <span className="text-gray-400">Pilih akun...</span>
                                )}
                                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[420px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Cari kode atau nama akun..." />
                                <CommandList>
                                    <CommandEmpty>Tidak ditemukan</CommandEmpty>
                                    <CommandGroup>
                                        {accounts.map((a) => (
                                            <CommandItem
                                                key={a.id}
                                                value={`${a.code} ${a.name}`}
                                                onSelect={() => {
                                                    setSelectedAccountId(a.id);
                                                    setAccountOpen(false);
                                                }}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4 shrink-0", selectedAccountId === a.id ? "opacity-100 text-violet-600" : "opacity-0")} />
                                                <span className="font-mono text-xs text-gray-400 mr-2">{a.code}</span>
                                                <span className="flex-1 truncate">{a.name}</span>
                                                <Badge variant="outline" className="ml-auto text-[10px] font-normal hidden sm:inline-flex">{a.category}</Badge>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {/* Date preset tabs — scrollable on mobile */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-100/80 rounded-xl p-1 gap-0.5 overflow-x-auto scrollbar-hide w-full sm:w-auto">
                            {presets.map((p) => (
                                <button key={p.key} type="button" onClick={() => handlePresetSelect(p)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap shrink-0 ${selectedPresetKey === p.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                                    {p.label}
                                </button>
                            ))}
                            <button type="button" onClick={() => setSelectedPresetKey("custom")}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap shrink-0 ${selectedPresetKey === "custom" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                                <SlidersHorizontal className="w-3 h-3" />
                                Custom
                            </button>
                        </div>
                        {loading && <Loader2 className="w-4 h-4 animate-spin text-violet-400 shrink-0" />}
                    </div>

                    {/* Custom date pickers */}
                    {selectedPresetKey === "custom" && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Dari" className="w-full sm:w-[140px] rounded-xl h-9 sm:h-8 text-sm sm:text-xs" />
                            <span className="text-slate-300 text-xs text-center hidden sm:block">—</span>
                            <DatePicker value={dateTo} onChange={setDateTo} placeholder="Sampai" className="w-full sm:w-[140px] rounded-xl h-9 sm:h-8 text-sm sm:text-xs" />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Loading state */}
            {loading && (
                <div className="flex items-center justify-center p-12">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                        <p className="text-sm text-gray-400">Memuat data buku besar...</p>
                    </div>
                </div>
            )}

            {/* Empty state - no account selected */}
            {!loading && !selectedAccountId && (
                <Card className="rounded-2xl border-0 shadow-sm bg-white">
                    <CardContent className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                            <FileSpreadsheet className="w-8 h-8 text-gray-300" />
                        </div>
                        <p className="text-base font-medium text-gray-500 mb-1">
                            Belum Ada Akun Dipilih
                        </p>
                        <p className="text-sm text-gray-400">
                            Pilih akun dari filter di atas untuk melihat buku besar
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Empty state - no data */}
            {!loading && !ledger && selectedAccountId && (
                <Card className="rounded-2xl border-0 shadow-sm bg-white">
                    <CardContent className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                            <BookText className="w-8 h-8 text-gray-300" />
                        </div>
                        <p className="text-base font-medium text-gray-500 mb-1">
                            Tidak Ada Data
                        </p>
                        <p className="text-sm text-gray-400">
                            Tidak ditemukan transaksi untuk akun ini pada periode yang dipilih
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Data loaded */}
            {!loading && ledger && (
                <>
                    {/* Summary stat cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                        {[
                            { label: "Saldo Awal", value: ledger.openingBalance, color: "text-gray-900", gradient: "from-blue-400 to-blue-600", shadow: "shadow-blue-500/25", icon: Wallet },
                            { label: "Total Debit", value: ledger.totalDebit, color: "text-emerald-600", gradient: "from-emerald-400 to-emerald-600", shadow: "shadow-emerald-500/25", icon: ArrowUpRight },
                            { label: "Total Kredit", value: ledger.totalCredit, color: "text-rose-600", gradient: "from-rose-400 to-rose-600", shadow: "shadow-rose-500/25", icon: ArrowDownRight },
                            { label: "Saldo Akhir", value: ledger.closingBalance, color: "text-violet-600", gradient: "from-violet-400 to-violet-600", shadow: "shadow-violet-500/25", icon: Scale },
                        ].map((stat) => (
                            <Card key={stat.label} className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden">
                                <CardContent className="p-3 sm:p-5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5 sm:space-y-1 min-w-0">
                                            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                                            <p className={`text-sm sm:text-xl font-bold font-mono tabular-nums truncate ${stat.color}`}>{formatCurrency(stat.value)}</p>
                                        </div>
                                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-md ${stat.shadow} shrink-0`}>
                                            <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="rounded-2xl overflow-hidden">
                        <SmartTable
                            data={entriesPageData}
                            columns={columns}
                            totalItems={entriesTotal}
                            totalPages={entriesTotalPages}
                            currentPage={entriesCurrentPage}
                            pageSize={entryPageSize}
                            loading={loading}
                            title="Mutasi Buku Besar"
                            titleIcon={<BookText className="w-4 h-4 text-violet-600" />}
                            headerActions={
                                <div className="hidden sm:flex items-center gap-2">
                                    <Badge variant="secondary" className="rounded-lg text-xs bg-blue-50 text-blue-700 border border-blue-100">
                                        Awal: <span className="font-mono font-semibold ml-1">{formatCurrency(ledger.openingBalance)}</span>
                                    </Badge>
                                    <Badge variant="secondary" className="rounded-lg text-xs bg-emerald-50 text-emerald-700 border border-emerald-100">
                                        Akhir: <span className="font-mono font-semibold ml-1">{formatCurrency(ledger.closingBalance)}</span>
                                    </Badge>
                                </div>
                            }
                            filters={[
                                {
                                    key: "date",
                                    label: "Tanggal",
                                    type: "daterange",
                                },
                            ]}
                            activeFilters={{
                                ...ledgerFilters,
                                date_from: dateFrom || ledgerFilters.date_from || "",
                                date_to: dateTo || ledgerFilters.date_to || "",
                            }}
                            onFilterChange={(f) => {
                                setLedgerFilters(f);
                                setEntryPage(1);
                                setDateFrom(f.date_from || "");
                                setDateTo(f.date_to || "");
                            }}
                            searchPlaceholder="Cari transaksi..."
                            onSearch={(q) => { setEntrySearch(q); setEntryPage(1); }}
                            onPageChange={setEntryPage}
                            onPageSizeChange={(s) => { setEntryPageSize(s); setEntryPage(1); }}
                            exportFilename="buku-besar"
                            emptyIcon={<BookText className="w-6 h-6 text-muted-foreground/40" />}
                            emptyTitle="Tidak ada transaksi"
                            emptyDescription="Tidak ada mutasi pada periode ini atau filter pencarian tidak menemukan hasil."
                            mobileRender={(row) => (
                                <div className="space-y-1">
                                    <span className="font-mono text-xs font-medium text-slate-700">{row.entryNumber}</span>
                                    <div className="text-xs text-slate-500">{formatDate(row.date)}</div>
                                    <p className="text-xs text-slate-600 truncate">{row.description}</p>
                                    <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                                        <span>D: {row.debit > 0 ? <span className="font-semibold text-emerald-600">{formatCurrency(row.debit)}</span> : <span className="text-muted-foreground/40">&mdash;</span>}</span>
                                        <span>K: {row.credit > 0 ? <span className="font-semibold text-rose-600">{formatCurrency(row.credit)}</span> : <span className="text-muted-foreground/40">&mdash;</span>}</span>
                                        <span className="font-bold text-slate-800">Saldo: {formatCurrency(row.runningBalance)}</span>
                                    </div>
                                </div>
                            )}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
