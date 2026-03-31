"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useBranch } from "@/components/providers/branch-provider";
import { getClosingReportList, getClosingReport, recloseShift } from "@/server/actions/closing-report";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { SmartColumn } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import {
    FileText, Eye, RefreshCw, Printer, DollarSign, ArrowDown, ArrowUp,
    ShoppingCart, Loader2, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const PAYMENT_LABELS: Record<string, string> = {
    CASH: "Cash", TRANSFER: "Transfer", QRIS: "QRIS",
    EWALLET: "E-Wallet", DEBIT: "Debit", CREDIT_CARD: "Kartu Kredit",
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

interface Props {
    initialData: { shifts: ShiftRow[]; total: number; totalPages: number };
}

type ClosingReportData = Awaited<ReturnType<typeof getClosingReport>>;

export function ClosingReportsContent({ initialData }: Props) {
    const [data, setData] = useState(initialData);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
    const [loading, startTransition] = useTransition();
    const { selectedBranchId } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);
    useEffect(() => { if (prevBranchRef.current !== selectedBranchId) { prevBranchRef.current = selectedBranchId; setPage(1); fetchData({ page: 1 }); } else if (selectedBranchId) { fetchData({}); } }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Detail
    const [detailOpen, setDetailOpen] = useState(false);
    const [report, setReport] = useState<ClosingReportData>(null);
    const [reportLoading, setReportLoading] = useState(false);

    // Reclosing
    const [recloseOpen, setRecloseOpen] = useState(false);
    const [recloseShiftId, setRecloseShiftId] = useState("");
    const [recloseAmount, setRecloseAmount] = useState(0);
    const [recloseNotes, setRecloseNotes] = useState("");
    const [recloseLoading, setRecloseLoading] = useState(false);

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

    const openDetail = async (shiftId: string) => {
        setReportLoading(true);
        setDetailOpen(true);
        const r = await getClosingReport(shiftId);
        setReport(r);
        setReportLoading(false);
    };

    const openReclose = (shiftId: string, currentClosing: number | null) => {
        setRecloseShiftId(shiftId);
        setRecloseAmount(currentClosing ?? 0);
        setRecloseNotes("");
        setRecloseOpen(true);
    };

    const handleReclose = async () => {
        setRecloseLoading(true);
        const result = await recloseShift(recloseShiftId, recloseAmount, recloseNotes || undefined);
        setRecloseLoading(false);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Shift berhasil di-reclosing");
        setRecloseOpen(false);
        fetchData({});
        // Refresh detail if open
        if (detailOpen && report?.shift.id === recloseShiftId) {
            const r = await getClosingReport(recloseShiftId);
            setReport(r);
        }
    };

    const handlePrintReport = () => {
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
      ${report.paymentSummary.map((p) => `<div class="row"><span>${PAYMENT_LABELS[p.method] || p.method} (${p.count})</span><span>${fmt(p.total)}</span></div>`).join("")}
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

    const columns: SmartColumn<ShiftRow>[] = [
        {
            key: "user", header: "Kasir", sortable: true,
            render: (row) => <span className="text-sm font-medium">{row.user.name}</span>,
            exportValue: (row) => row.user.name,
        },
        {
            key: "branch", header: "Lokasi",
            render: (row) => <span className="text-xs">{(row as unknown as { branch?: { name: string } | null }).branch?.name ?? "Semua"}</span>,
            exportValue: (row) => (row as unknown as { branch?: { name: string } | null }).branch?.name ?? "Semua",
        },
        {
            key: "openedAt", header: "Dibuka", sortable: true,
            render: (row) => <span className="text-xs text-muted-foreground">{format(new Date(row.openedAt), "dd MMM yy HH:mm", { locale: idLocale })}</span>,
            exportValue: (row) => format(new Date(row.openedAt), "dd/MM/yyyy HH:mm"),
        },
        {
            key: "closedAt", header: "Ditutup", sortable: true,
            render: (row) => <span className="text-xs text-muted-foreground">{row.closedAt ? format(new Date(row.closedAt), "dd MMM yy HH:mm", { locale: idLocale }) : "-"}</span>,
            exportValue: (row) => row.closedAt ? format(new Date(row.closedAt), "dd/MM/yyyy HH:mm") : "-",
        },
        {
            key: "openingCash", header: "Kas Awal", align: "right",
            render: (row) => <span className="text-xs">{formatCurrency(row.openingCash)}</span>,
            exportValue: (row) => row.openingCash,
        },
        {
            key: "closingCash", header: "Kas Akhir", align: "right",
            render: (row) => <span className="text-xs font-medium">{row.closingCash != null ? formatCurrency(row.closingCash) : "-"}</span>,
            exportValue: (row) => row.closingCash ?? 0,
        },
        {
            key: "difference", header: "Selisih", align: "center",
            render: (row) => {
                if (row.cashDifference == null) return <span className="text-xs text-muted-foreground">-</span>;
                return (
                    <Badge className={row.cashDifference >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                        {row.cashDifference >= 0 ? "+" : ""}{formatCurrency(row.cashDifference)}
                    </Badge>
                );
            },
            exportValue: (row) => row.cashDifference ?? 0,
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "130px",
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openDetail(row.id)} title="Lihat Detail">
                        <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-orange-500 hover:text-orange-700 hover:bg-orange-50"
                        onClick={() => openReclose(row.id, row.closingCash)} title="Reclosing">
                        <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <FileText className="w-6 h-6 text-primary" /> Laporan Closing
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Ringkasan shift kasir yang sudah ditutup</p>
            </div>

            <SmartTable<ShiftRow>
                data={data.shifts}
                columns={columns}
                totalItems={data.total}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Riwayat Closing"
                titleIcon={<FileText className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari kasir..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                filters={[{ key: "date", label: "Tanggal", type: "daterange" }]}
                activeFilters={activeFilters}
                onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
                exportFilename="closing-reports"
                emptyIcon={<FileText className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Belum ada closing shift"
            />

            {/* Detail Report Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>

                <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] p-0 overflow-hidden">
                    <div className="px-6 pt-6 pb-0">
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-between">
                                <span>Laporan Closing</span>
                            </DialogTitle>
                        </DialogHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {reportLoading ? (
                            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary/40" /></div>
                        ) : report ? (
                            <div className="space-y-5">
                                {/* Shift Info */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div><p className="text-muted-foreground text-xs">Kasir</p><p className="font-semibold">{report.shift.cashierName}</p></div>
                                    <div><p className="text-muted-foreground text-xs">Dibuka</p><p>{format(new Date(report.shift.openedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}</p></div>
                                    <div><p className="text-muted-foreground text-xs">Ditutup</p><p>{report.shift.closedAt ? format(new Date(report.shift.closedAt), "dd MMM yyyy HH:mm", { locale: idLocale }) : "-"}</p></div>
                                    <div><p className="text-muted-foreground text-xs">Status</p>
                                        {report.shift.cashDifference != null ? (
                                            <Badge className={report.shift.cashDifference === 0 ? "bg-green-100 text-green-700" : report.shift.cashDifference > 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}>
                                                {report.shift.cashDifference === 0 ? "Balance" : report.shift.cashDifference > 0 ? "Lebih" : "Kurang"}
                                            </Badge>
                                        ) : <span>-</span>}
                                    </div>
                                </div>

                                <Separator />

                                {/* Summary Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-primary/5 rounded-xl p-3 text-center">
                                        <ShoppingCart className="w-5 h-5 text-primary mx-auto mb-1" />
                                        <p className="text-xl font-bold text-primary">{report.summary.totalTransactions}</p>
                                        <p className="text-[10px] text-muted-foreground">Transaksi</p>
                                    </div>
                                    <div className="bg-green-50 rounded-xl p-3 text-center">
                                        <DollarSign className="w-5 h-5 text-green-600 mx-auto mb-1" />
                                        <p className="text-xl font-bold text-green-700">{formatCurrency(report.summary.totalSales)}</p>
                                        <p className="text-[10px] text-muted-foreground">Total Penjualan</p>
                                    </div>
                                    <div className="bg-orange-50 rounded-xl p-3 text-center">
                                        <AlertTriangle className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                                        <p className="text-xl font-bold text-orange-600">{report.summary.voidCount + report.summary.refundCount}</p>
                                        <p className="text-[10px] text-muted-foreground">Void/Refund</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                                        <DollarSign className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                                        <p className="text-xl font-bold">{formatCurrency(report.summary.averageTransaction)}</p>
                                        <p className="text-[10px] text-muted-foreground">Rata-rata/Trx</p>
                                    </div>
                                </div>

                                {/* Payment Breakdown */}
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Per Metode Pembayaran</p>
                                    <div className="space-y-1.5">
                                        {report.paymentSummary.map((p) => (
                                            <div key={p.method} className="flex items-center justify-between py-1.5 px-3 bg-muted/30 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-xs rounded-md">{PAYMENT_LABELS[p.method] || p.method}</Badge>
                                                    <span className="text-xs text-muted-foreground">{p.count} trx</span>
                                                </div>
                                                <span className="text-sm font-semibold">{formatCurrency(p.total)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                {/* Cash Flow */}
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Arus Kas</p>
                                    <div className="bg-muted/20 rounded-xl p-4 space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Kas Awal</span><span>{formatCurrency(report.cashFlow.openingCash)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><ArrowDown className="w-3 h-3 text-green-500" /> Penjualan Cash</span><span className="text-green-600">+{formatCurrency(report.cashFlow.cashSales)}</span></div>
                                        {report.cashFlow.cashMovementIn > 0 && (
                                            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><ArrowDown className="w-3 h-3 text-green-500" /> Kas Masuk</span><span className="text-green-600">+{formatCurrency(report.cashFlow.cashMovementIn)}</span></div>
                                        )}
                                        {report.cashFlow.cashMovementOut > 0 && (
                                            <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><ArrowUp className="w-3 h-3 text-red-500" /> Kas Keluar</span><span className="text-red-600">-{formatCurrency(report.cashFlow.cashMovementOut)}</span></div>
                                        )}
                                        <Separator />
                                        <div className="flex justify-between font-semibold"><span>Kas Seharusnya</span><span>{formatCurrency(report.cashFlow.expectedCash)}</span></div>
                                        <div className="flex justify-between font-semibold"><span>Kas Aktual</span><span>{formatCurrency(report.cashFlow.actualCash ?? 0)}</span></div>
                                        <div className={`flex justify-between font-bold text-base pt-1 border-t ${report.cashFlow.difference == null ? "" : report.cashFlow.difference === 0 ? "text-green-600" : report.cashFlow.difference > 0 ? "text-blue-600" : "text-red-600"
                                            }`}>
                                            <span>Selisih</span>
                                            <span>{report.cashFlow.difference != null ? `${report.cashFlow.difference >= 0 ? "+" : ""}${formatCurrency(report.cashFlow.difference)}` : "-"}</span>
                                        </div>
                                    </div>
                                </div>

                                {report.shift.notes && (
                                    <div className="bg-yellow-50 rounded-xl p-3">
                                        <p className="text-xs font-semibold text-yellow-700 mb-1">Catatan</p>
                                        <p className="text-sm text-yellow-800">{report.shift.notes}</p>
                                    </div>
                                )}

                                {/* Transaction List */}
                                {report.transactions.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Daftar Transaksi ({report.transactions.length})</p>
                                        <div className="border rounded-xl overflow-hidden max-h-[250px] overflow-y-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="text-xs">Invoice</TableHead>
                                                        <TableHead className="text-xs">Waktu</TableHead>
                                                        <TableHead className="text-xs">Bayar</TableHead>
                                                        <TableHead className="text-xs text-right">Total</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {report.transactions.map((tx) => (
                                                        <TableRow key={tx.id}>
                                                            <TableCell className="text-xs font-mono">{tx.invoiceNumber}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), "HH:mm")}</TableCell>
                                                            <TableCell><Badge variant="secondary" className="text-[10px]">{PAYMENT_LABELS[tx.paymentMethod] || tx.paymentMethod}</Badge></TableCell>
                                                            <TableCell className="text-xs text-right font-medium">{formatCurrency(tx.grandTotal)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">Data tidak ditemukan</p>
                        )}
                    </div>


                    <DialogFooter>
                        {/* Footer with Reclosing button */}
                        {report && !reportLoading && (
                            <div className="gap-2 px-6 py-4 border-t border-border/40 flex justify-between items-center">
                                <Button variant="outline" className="rounded-lg text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => { setDetailOpen(false); openReclose(report.shift.id, report.cashFlow.actualCash); }}>
                                    <RefreshCw className="w-4 h-4 mr-2" /> Reclosing
                                </Button>
                                <Button variant="outline" className="rounded-lg" onClick={handlePrintReport}>
                                    <Printer className="w-3.5 h-3.5 mr-1" /> Cetak
                                </Button>
                            </div>
                        )}

                    </DialogFooter>
                </DialogContent>

            </Dialog>

            {/* Reclosing Dialog */}
            <Dialog open={recloseOpen} onOpenChange={setRecloseOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-orange-500" /> Reclosing Shift</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Reclosing akan mengupdate kas akhir dan menghitung ulang selisih berdasarkan transaksi aktual.
                        </p>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Kas Akhir (Baru) <span className="text-red-400">*</span></Label>
                            <Input type="number" value={recloseAmount} onChange={(e) => setRecloseAmount(Number(e.target.value))} className="rounded-lg" min={0} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Catatan Reclosing</Label>
                            <Input value={recloseNotes} onChange={(e) => setRecloseNotes(e.target.value)} className="rounded-lg" placeholder="Alasan reclosing..." />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setRecloseOpen(false)} className="rounded-lg">Batal</Button>
                            <Button onClick={handleReclose} disabled={recloseLoading} className="rounded-lg bg-orange-600 hover:bg-orange-700">
                                {recloseLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                Reclosing
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
