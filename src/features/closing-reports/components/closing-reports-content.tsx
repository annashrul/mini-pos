"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { useBranch } from "@/components/providers/branch-provider";
import { getClosingReportList, getClosingReport, recloseShift } from "@/server/actions/closing-report";
import { useMenuActionAccess } from "@/features/access-control";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    FileText, Eye, RefreshCw, Printer, ArrowDown, ArrowUp,
    ShoppingCart, Loader2, AlertTriangle, CheckCircle2, Clock,
    User, Banknote, CreditCard, QrCode,
    Smartphone, Wallet, TrendingUp, TrendingDown, Scale,
    Receipt, ClipboardList, StickyNote,
    Search, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControl } from "@/components/ui/pagination-control";

const PAYMENT_CONFIG: Record<string, { label: string; icon: typeof Banknote; color: string }> = {
    CASH: { label: "Cash", icon: Banknote, color: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" },
    TRANSFER: { label: "Transfer", icon: CreditCard, color: "bg-blue-50 text-blue-700 ring-1 ring-blue-100" },
    QRIS: { label: "QRIS", icon: QrCode, color: "bg-purple-50 text-purple-700 ring-1 ring-purple-100" },
    EWALLET: { label: "E-Wallet", icon: Smartphone, color: "bg-orange-50 text-orange-700 ring-1 ring-orange-100" },
    DEBIT: { label: "Debit", icon: CreditCard, color: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100" },
    CREDIT_CARD: { label: "Kartu Kredit", icon: CreditCard, color: "bg-pink-50 text-pink-700 ring-1 ring-pink-100" },
    TERMIN: { label: "Termin", icon: Clock, color: "bg-amber-50 text-amber-700 ring-1 ring-amber-100" },
};

interface ShiftRow {
    id: string;
    userId: string;
    user: { name: string };
    openedAt: string | Date;
    closedAt: string | Date | null;
    openingCash: number;
    closingCash: number | null;
    expectedCash: number | null;
    cashDifference: number | null;
    notes: string | null;
    isOpen: boolean;
}

type ClosingReportData = Awaited<ReturnType<typeof getClosingReport>>;

export function ClosingReportsContent() {
    const [data, setData] = useState<{ shifts: ShiftRow[]; total: number; totalPages: number }>({ shifts: [], total: 0, totalPages: 0 });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [activeFilters] = useState<Record<string, string>>({});
    const [loading, startTransition] = useTransition();
    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);
    const { canAction, cannotMessage } = useMenuActionAccess("closing-reports");
    const canReclosing = canAction("reclosing");
    const canExport = canAction("export");

    const [detailOpen, setDetailOpen] = useState(false);
    const [report, setReport] = useState<ClosingReportData>(null);
    const [reportLoading, setReportLoading] = useState(false);

    const [recloseOpen, setRecloseOpen] = useState(false);
    const [recloseShiftId, setRecloseShiftId] = useState("");
    const [recloseAmount, setRecloseAmount] = useState(0);
    const [recloseNotes, setRecloseNotes] = useState("");
    const [recloseLoading, setRecloseLoading] = useState(false);

    const stats = useMemo(() => {
        const shifts = data.shifts;
        return {
            total: data.total,
            balanced: shifts.filter((s) => s.cashDifference === 0).length,
            surplus: shifts.filter((s) => s.cashDifference != null && s.cashDifference > 0).length,
            deficit: shifts.filter((s) => s.cashDifference != null && s.cashDifference < 0).length,
        };
    }, [data]);

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string> }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const result = await getClosingReportList({
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(f.date_from ? { dateFrom: f.date_from } : {}),
                ...(f.date_to ? { dateTo: f.date_to } : {}),
                ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
            });
            setData(result as typeof data);
        });
    };

    useEffect(() => {
        if (!branchReady) return;
        if (prevBranchRef.current !== selectedBranchId) {
            prevBranchRef.current = selectedBranchId;
            setPage(1);
            fetchData({ page: 1 });
        } else {
            fetchData({});
        }
    }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const openDetail = async (shiftId: string) => {
        setReportLoading(true);
        setDetailOpen(true);
        const r = await getClosingReport(shiftId);
        setReport(r);
        setReportLoading(false);
    };

    const openReclose = (shiftId: string, currentClosing: number | null) => {
        if (!canReclosing) { toast.error(cannotMessage("reclosing")); return; }
        setRecloseShiftId(shiftId);
        setRecloseAmount(currentClosing ?? 0);
        setRecloseNotes("");
        setRecloseOpen(true);
    };

    const handleReclose = async () => {
        if (!canReclosing) { toast.error(cannotMessage("reclosing")); return; }
        setRecloseLoading(true);
        const result = await recloseShift(recloseShiftId, recloseAmount, recloseNotes || undefined);
        setRecloseLoading(false);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Shift berhasil di-reclosing");
        setRecloseOpen(false);
        fetchData({});
        if (detailOpen && report?.shift.id === recloseShiftId) {
            const r = await getClosingReport(recloseShiftId);
            setReport(r);
        }
    };

    const handlePrintReport = () => {
        if (!canExport) { toast.error(cannotMessage("export")); return; }
        if (!report) return;
        const w = window.open("", "_blank", "width=400,height=700");
        if (!w) return;
        w.document.write(`
      <!DOCTYPE html><html><head><title>Closing Report</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 11px; padding: 10px; max-width: 350px; margin: 0 auto; }
        h2 { text-align: center; font-size: 14px; margin: 0 0 8px; }
        .line { border-top: 1px dashed #999; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; }
        .bold { font-weight: bold; }
        .right { text-align: right; }
        .red { color: red; } .green { color: green; }
        @media print { body { padding: 0; } @page { margin: 0; size: 80mm auto; } }
      </style></head><body>
      <h2>LAPORAN CLOSING</h2>
      <div class="line"></div>
      <div class="row"><span>Kasir</span><span>${report.shift.cashierName}</span></div>
      <div class="row"><span>Dibuka</span><span>${format(new Date(report.shift.openedAt), "dd/MM/yy HH:mm")}</span></div>
      <div class="row"><span>Ditutup</span><span>${report.shift.closedAt ? format(new Date(report.shift.closedAt), "dd/MM/yy HH:mm") : "-"}</span></div>
      <div class="line"></div>
      <div class="row bold"><span>Total Transaksi</span><span>${report.summary.totalTransactions}</span></div>
      <div class="row bold"><span>Total Penjualan</span><span>${fmt(report.summary.totalSales)}</span></div>
      <div class="row"><span>Diskon</span><span>${fmt(report.summary.totalDiscount)}</span></div>
      <div class="row"><span>Pajak</span><span>${fmt(report.summary.totalTax)}</span></div>
      <div class="row"><span>Void</span><span>${report.summary.voidCount}</span></div>
      <div class="row"><span>Refund</span><span>${report.summary.refundCount}</span></div>
      <div class="line"></div>
      <div class="bold">Per Metode Bayar:</div>
      ${report.paymentSummary.map((p) => `<div class="row"><span>${PAYMENT_CONFIG[p.method]?.label || p.method} (${p.count})</span><span>${fmt(p.total)}</span></div>`).join("")}
      <div class="line"></div>
      <div class="bold">Arus Kas:</div>
      <div class="row"><span>Kas Awal</span><span>${fmt(report.cashFlow.openingCash)}</span></div>
      <div class="row"><span>Penjualan Cash</span><span>${fmt(report.cashFlow.cashSales)}</span></div>
      <div class="row"><span>Kas Masuk</span><span>${fmt(report.cashFlow.cashMovementIn)}</span></div>
      <div class="row"><span>Kas Keluar</span><span>${fmt(report.cashFlow.cashMovementOut)}</span></div>
      <div class="line"></div>
      <div class="row bold"><span>Kas Seharusnya</span><span>${fmt(report.cashFlow.expectedCash)}</span></div>
      <div class="row bold"><span>Kas Aktual</span><span>${fmt(report.cashFlow.actualCash ?? 0)}</span></div>
      <div class="row bold ${report.cashFlow.difference && report.cashFlow.difference < 0 ? 'red' : 'green'}"><span>Selisih</span><span>${report.cashFlow.difference != null ? fmt(report.cashFlow.difference) : "-"}</span></div>
      ${report.shift.notes ? `<div class="line"></div><div>Catatan: ${report.shift.notes}</div>` : ""}
      </body></html>
    `);
        w.document.close();
        w.print();
    };

    const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

    const getDiffStatus = (diff: number | null) => {
        if (diff == null) return "unknown";
        if (diff === 0) return "balanced";
        if (diff > 0) return "surplus";
        return "deficit";
    };

    const borderColorMap: Record<string, string> = {
        balanced: "border-l-emerald-400",
        surplus: "border-l-blue-400",
        deficit: "border-l-red-400",
        unknown: "border-l-slate-200",
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setPage(1);
        fetchData({ search: value, page: 1 });
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-200/50">
                        <ClipboardList className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Laporan Closing</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">Ringkasan shift kasir yang sudah ditutup</p>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 bg-slate-100/80 text-slate-600 rounded-full px-3 py-1.5 text-xs font-medium">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{stats.total}</span> Total Closing
                </div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-emerald-100">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{stats.balanced}</span> Balance
                </div>
                {stats.surplus > 0 && (
                    <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-blue-100">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">{stats.surplus}</span> Lebih
                    </div>
                )}
                {stats.deficit > 0 && (
                    <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-500 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-red-100">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">{stats.deficit}</span> Kurang
                    </div>
                )}
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                {loading && (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 animate-spin" />
                )}
                <Input
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Cari kasir..."
                    className="pl-10 pr-10 h-11 rounded-xl border-border/40 bg-white shadow-sm focus-visible:ring-teal-200 focus-visible:border-teal-300"
                />
            </div>

            {/* Card List */}
            {loading && data.shifts.length === 0 ? (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-border/30 bg-white p-4 border-l-4 border-l-slate-200">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3 shrink-0">
                                    <Skeleton className="w-10 h-10 rounded-full" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 flex-1 justify-center">
                                    <div className="space-y-1">
                                        <Skeleton className="h-2.5 w-12" />
                                        <Skeleton className="h-3.5 w-28" />
                                    </div>
                                    <div className="space-y-1">
                                        <Skeleton className="h-2.5 w-12" />
                                        <Skeleton className="h-3.5 w-28" />
                                    </div>
                                </div>
                                <div className="shrink-0 space-y-1.5 text-right">
                                    <Skeleton className="h-3.5 w-36 ml-auto" />
                                    <Skeleton className="h-5 w-24 rounded-full ml-auto" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : data.shifts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
                        <ClipboardList className="w-7 h-7 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Belum ada closing shift</p>
                    <p className="text-xs text-muted-foreground/60">Data closing shift akan muncul di sini</p>
                </div>
            ) : (
                <div className={`space-y-3 ${loading ? "opacity-50 pointer-events-none transition-opacity" : ""}`}>
                    {data.shifts.map((row) => {
                        const status = getDiffStatus(row.cashDifference);
                        const branchName = (row as unknown as { branch?: { name: string } | null }).branch?.name ?? null;

                        return (
                            <div
                                key={row.id}
                                className={`group rounded-xl border border-border/30 bg-white hover:shadow-md transition-all p-4 border-l-4 ${borderColorMap[status]}`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Left: Avatar + Name */}
                                    <div className="flex items-center gap-3 min-w-0 shrink-0">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 text-white text-sm font-bold shrink-0">
                                            {row.user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">{row.user.name}</p>
                                            {branchName && (
                                                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <MapPin className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">{branchName}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Middle: Time Info Blocks */}
                                    <div className="flex items-center gap-4 flex-1 min-w-0 justify-center">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Clock className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                                            <div>
                                                <p className="text-[10px] text-muted-foreground/60 font-medium">Dibuka</p>
                                                <p className="font-mono tabular-nums text-xs">{format(new Date(row.openedAt), "dd MMM yy HH:mm", { locale: idLocale })}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Clock className="w-3.5 h-3.5 shrink-0 text-red-400" />
                                            <div>
                                                <p className="text-[10px] text-muted-foreground/60 font-medium">Ditutup</p>
                                                <p className="font-mono tabular-nums text-xs">{row.closedAt ? format(new Date(row.closedAt), "dd MMM yy HH:mm", { locale: idLocale }) : "---"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Cash + Difference + Actions */}
                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="text-right">
                                            <div className="flex items-center gap-1.5 justify-end text-xs">
                                                <span className="font-mono tabular-nums text-muted-foreground">{formatCurrency(row.openingCash)}</span>
                                                <ArrowDown className="w-3 h-3 text-muted-foreground/40 rotate-[-90deg]" />
                                                <span className="font-mono tabular-nums font-semibold">{row.closingCash != null ? formatCurrency(row.closingCash) : "---"}</span>
                                            </div>
                                            <div className="mt-1.5">
                                                {row.cashDifference != null ? (
                                                    <Badge variant="outline" className={`rounded-full text-[11px] font-medium font-mono tabular-nums px-2.5 py-0.5 border-0 ${status === "balanced" ? "bg-emerald-50/50 text-emerald-600 ring-1 ring-emerald-100"
                                                        : status === "surplus" ? "bg-blue-50/50 text-blue-600 ring-1 ring-blue-100"
                                                            : "bg-red-50/50 text-red-600 ring-1 ring-red-100"
                                                        }`}>
                                                        {status === "balanced" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : status === "surplus" ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                                        {row.cashDifference >= 0 ? "+" : ""}{formatCurrency(row.cashDifference)}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/40">---</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-teal-50 hover:text-teal-600 transition-colors" onClick={() => openDetail(row.id)} title="Lihat Detail">
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            <DisabledActionTooltip disabled={!canReclosing} message={cannotMessage("reclosing")}>
                                                <Button disabled={!canReclosing} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-orange-500 hover:text-orange-700 hover:bg-orange-50 transition-colors"
                                                    onClick={() => openReclose(row.id, row.closingCash)} title="Reclosing">
                                                    <RefreshCw className="w-4 h-4" />
                                                </Button>
                                            </DisabledActionTooltip>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            <PaginationControl
                currentPage={page}
                totalPages={data.totalPages}
                totalItems={data.total}
                pageSize={pageSize}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
            />

            {/* Detail Report Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="rounded-2xl w-[99vw] max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-lg font-bold">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-md shadow-teal-200/50">
                                <ClipboardList className="w-4 h-4 text-white" />
                            </div>
                            Laporan Closing
                        </DialogTitle>
                    </DialogHeader>

                    {reportLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
                            <p className="text-sm text-muted-foreground">Memuat laporan...</p>
                        </div>
                    ) : report ? (
                        <>
                            <DialogBody className="space-y-5 pr-1">
                                {/* Shift Info Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-3 space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                            <User className="w-3 h-3" /> Kasir
                                        </div>
                                        <p className="text-sm font-bold text-foreground">{report.shift.cashierName}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-3 space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                            <Clock className="w-3 h-3 text-emerald-500" /> Dibuka
                                        </div>
                                        <p className="text-sm font-medium text-foreground">{format(new Date(report.shift.openedAt), "dd MMM yy HH:mm", { locale: idLocale })}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-3 space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                            <Clock className="w-3 h-3 text-red-400" /> Ditutup
                                        </div>
                                        <p className="text-sm font-medium text-foreground">{report.shift.closedAt ? format(new Date(report.shift.closedAt), "dd MMM yy HH:mm", { locale: idLocale }) : "---"}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-3 space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                            <Scale className="w-3 h-3" /> Status
                                        </div>
                                        {report.shift.cashDifference != null ? (
                                            <Badge variant="outline" className={`rounded-full text-[11px] font-medium px-2 py-0.5 border-0 ${report.shift.cashDifference === 0 ? "bg-emerald-50/50 text-emerald-600 ring-1 ring-emerald-100"
                                                : report.shift.cashDifference > 0 ? "bg-blue-50/50 text-blue-600 ring-1 ring-blue-100"
                                                    : "bg-red-50/50 text-red-600 ring-1 ring-red-100"
                                                }`}>
                                                {report.shift.cashDifference === 0 ? <><CheckCircle2 className="w-3 h-3 mr-1" />Balance</> : report.shift.cashDifference > 0 ? <><TrendingUp className="w-3 h-3 mr-1" />Lebih</> : <><TrendingDown className="w-3 h-3 mr-1" />Kurang</>}
                                            </Badge>
                                        ) : <span className="text-sm text-muted-foreground">---</span>}
                                    </div>
                                </div>

                                {/* Summary Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100/50 p-3.5 text-center space-y-1">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 mx-auto">
                                            <ShoppingCart className="w-4 h-4" />
                                        </div>
                                        <p className="text-xl font-bold text-indigo-700 font-mono tabular-nums">{report.summary.totalTransactions}</p>
                                        <p className="text-[10px] font-medium text-indigo-500">Transaksi</p>
                                    </div>
                                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100/50 p-3.5 text-center space-y-1">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 mx-auto">
                                            <Wallet className="w-4 h-4" />
                                        </div>
                                        <p className="text-xl font-bold text-emerald-700 font-mono tabular-nums">{formatCurrency(report.summary.totalSales)}</p>
                                        <p className="text-[10px] font-medium text-emerald-500">Total Penjualan</p>
                                    </div>
                                    <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/50 p-3.5 text-center space-y-1">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600 mx-auto">
                                            <AlertTriangle className="w-4 h-4" />
                                        </div>
                                        <p className="text-xl font-bold text-amber-700 font-mono tabular-nums">
                                            {report.summary.voidCount}<span className="text-sm font-normal text-amber-400 mx-0.5">/</span>{report.summary.refundCount}
                                        </p>
                                        <p className="text-[10px] font-medium text-amber-500">Void / Refund</p>
                                    </div>
                                    <div className="rounded-xl bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-100/50 p-3.5 text-center space-y-1">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 mx-auto">
                                            <TrendingUp className="w-4 h-4" />
                                        </div>
                                        <p className="text-xl font-bold text-slate-700 font-mono tabular-nums">{formatCurrency(report.summary.averageTransaction)}</p>
                                        <p className="text-[10px] font-medium text-slate-400">Rata-rata/Trx</p>
                                    </div>
                                </div>

                                {/* Payment Breakdown */}
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                        <CreditCard className="w-3.5 h-3.5" /> Per Metode Pembayaran
                                    </p>
                                    <div className="space-y-1.5">
                                        {report.paymentSummary.map((p) => {
                                            const cfg = PAYMENT_CONFIG[p.method];
                                            const Icon = cfg?.icon || Wallet;
                                            return (
                                                <div key={p.method} className="flex items-center justify-between py-2 px-3.5 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white shadow-sm border border-border/30">
                                                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-medium text-foreground">{cfg?.label || p.method}</span>
                                                            <span className="text-[10px] text-muted-foreground ml-2">{p.count} trx</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-sm font-semibold font-mono tabular-nums">{formatCurrency(p.total)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Cash Flow */}
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                        <Banknote className="w-3.5 h-3.5" /> Arus Kas
                                    </p>
                                    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-4 space-y-2.5 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Kas Awal</span>
                                            <span className="font-mono tabular-nums font-medium">{formatCurrency(report.cashFlow.openingCash)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground flex items-center gap-1.5">
                                                <ArrowDown className="w-3.5 h-3.5 text-emerald-500" /> Penjualan Cash
                                            </span>
                                            <span className="text-emerald-600 font-mono tabular-nums font-medium">+{formatCurrency(report.cashFlow.cashSales)}</span>
                                        </div>
                                        {report.cashFlow.cashMovementIn > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground flex items-center gap-1.5">
                                                    <ArrowDown className="w-3.5 h-3.5 text-emerald-500" /> Kas Masuk
                                                </span>
                                                <span className="text-emerald-600 font-mono tabular-nums font-medium">+{formatCurrency(report.cashFlow.cashMovementIn)}</span>
                                            </div>
                                        )}
                                        {report.cashFlow.cashMovementOut > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground flex items-center gap-1.5">
                                                    <ArrowUp className="w-3.5 h-3.5 text-red-500" /> Kas Keluar
                                                </span>
                                                <span className="text-red-600 font-mono tabular-nums font-medium">-{formatCurrency(report.cashFlow.cashMovementOut)}</span>
                                            </div>
                                        )}
                                        <div className="border-t border-slate-200 pt-2.5 space-y-2">
                                            <div className="flex justify-between items-center font-semibold">
                                                <span>Kas Seharusnya</span>
                                                <span className="font-mono tabular-nums">{formatCurrency(report.cashFlow.expectedCash)}</span>
                                            </div>
                                            <div className="flex justify-between items-center font-semibold">
                                                <span>Kas Aktual</span>
                                                <span className="font-mono tabular-nums">{formatCurrency(report.cashFlow.actualCash ?? 0)}</span>
                                            </div>
                                            <div className={`flex justify-between items-center font-bold text-base pt-2 border-t border-slate-200 ${report.cashFlow.difference == null ? "" : report.cashFlow.difference === 0 ? "text-emerald-600" : report.cashFlow.difference > 0 ? "text-blue-600" : "text-red-600"
                                                }`}>
                                                <span className="flex items-center gap-1.5">
                                                    <Scale className="w-4 h-4" /> Selisih
                                                </span>
                                                <span className="font-mono tabular-nums">
                                                    {report.cashFlow.difference != null ? `${report.cashFlow.difference >= 0 ? "+" : ""}${formatCurrency(report.cashFlow.difference)}` : "---"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Notes */}
                                {report.shift.notes && (
                                    <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3.5 flex items-start gap-2.5">
                                        <StickyNote className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-semibold text-amber-700 mb-0.5">Catatan</p>
                                            <p className="text-sm text-amber-800">{report.shift.notes}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Transaction List */}
                                {report.transactions.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                            <Receipt className="w-3.5 h-3.5" /> Daftar Transaksi ({report.transactions.length})
                                        </p>
                                        <div className="rounded-xl border border-border/30 overflow-hidden shadow-sm">
                                            <div className="max-h-[250px] overflow-y-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100/50">
                                                            <TableHead className="text-xs font-semibold">Invoice</TableHead>
                                                            <TableHead className="text-xs font-semibold">Waktu</TableHead>
                                                            <TableHead className="text-xs font-semibold">Pembayaran</TableHead>
                                                            <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {report.transactions.map((tx) => {
                                                            const pmCfg = PAYMENT_CONFIG[tx.paymentMethod];
                                                            const PmIcon = pmCfg?.icon || Wallet;
                                                            return (
                                                                <TableRow key={tx.id} className="hover:bg-muted/20 transition-colors">
                                                                    <TableCell className="text-xs font-mono font-medium">{tx.invoiceNumber}</TableCell>
                                                                    <TableCell className="text-xs text-muted-foreground font-mono tabular-nums">{format(new Date(tx.createdAt), "HH:mm")}</TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="outline" className={`rounded-full text-[10px] font-medium px-2 py-0.5 border-0 ${pmCfg?.color || "bg-slate-50 text-slate-600"}`}>
                                                                            <PmIcon className="w-3 h-3 mr-1" />
                                                                            {pmCfg?.label || tx.paymentMethod}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-right font-semibold font-mono tabular-nums">
                                                                        {formatCurrency(tx.grandTotal)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </DialogBody>

                            <DialogFooter>
                                <div className="flex items-center justify-between w-full">
                                    <DisabledActionTooltip disabled={!canReclosing} message={cannotMessage("reclosing")}>
                                        <Button
                                            disabled={!canReclosing}
                                            variant="outline"
                                            className="rounded-xl text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300 transition-all"
                                            onClick={() => { setDetailOpen(false); openReclose(report.shift.id, report.cashFlow.actualCash); }}
                                        >
                                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reclosing
                                        </Button>
                                    </DisabledActionTooltip>
                                    <DisabledActionTooltip disabled={!canExport} message={cannotMessage("export")}>
                                        <Button
                                            disabled={!canExport}
                                            variant="outline"
                                            className="rounded-xl hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200 transition-all"
                                            onClick={handlePrintReport}
                                        >
                                            <Printer className="w-3.5 h-3.5 mr-1.5" /> Cetak Laporan
                                        </Button>
                                    </DisabledActionTooltip>
                                </div>
                            </DialogFooter>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100">
                                <FileText className="w-6 h-6 text-muted-foreground/30" />
                            </div>
                            <p className="text-sm text-muted-foreground">Data tidak ditemukan</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Reclosing Dialog */}
            <Dialog open={recloseOpen} onOpenChange={setRecloseOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-lg font-bold">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-md shadow-orange-200/50">
                                <RefreshCw className="w-4 h-4 text-white" />
                            </div>
                            Reclosing Shift
                        </DialogTitle>
                    </DialogHeader>
                    <div className={`space-y-4 mt-1 ${!canReclosing ? "pointer-events-none opacity-70" : ""}`}>
                        <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3 flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700">Reclosing akan mengupdate kas akhir dan menghitung ulang selisih berdasarkan transaksi aktual.</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Kas Akhir (Baru) <span className="text-red-400">*</span></Label>
                            <Input type="number" value={recloseAmount} onChange={(e) => setRecloseAmount(Number(e.target.value))} className="rounded-xl h-10" min={0} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Catatan Reclosing</Label>
                            <Input value={recloseNotes} onChange={(e) => setRecloseNotes(e.target.value)} className="rounded-xl h-10" placeholder="Alasan reclosing..." />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="outline" onClick={() => setRecloseOpen(false)} className="rounded-xl">Batal</Button>
                            <DisabledActionTooltip disabled={!canReclosing} message={cannotMessage("reclosing")}>
                                <Button disabled={!canReclosing || recloseLoading} onClick={handleReclose} className="rounded-xl bg-orange-600 hover:bg-orange-700 shadow-md shadow-orange-200/50 hover:shadow-lg hover:shadow-orange-300/50 transition-all">
                                    {recloseLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                                    Reclosing
                                </Button>
                            </DisabledActionTooltip>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
