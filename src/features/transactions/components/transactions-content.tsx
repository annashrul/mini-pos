"use client";

import { useState, useTransition } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { printThermalReceipt } from "@/lib/thermal-receipt";
import { getTransactions, getTransactionById, voidTransaction, refundTransaction } from "@/features/transactions";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { History, Eye, Printer, Ban, RotateCcw } from "lucide-react";
import type { Transaction, TransactionDetail } from "@/types";

interface Props {
    data: {
        transactions: Transaction[];
        total: number;
        totalPages: number;
        currentPage: number;
    };
    filters: Record<string, string | undefined>;
}

const statusColors: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    VOIDED: "bg-red-100 text-red-700",
    REFUNDED: "bg-blue-100 text-blue-700",
};

const paymentLabels: Record<string, string> = {
    CASH: "Cash",
    TRANSFER: "Transfer",
    QRIS: "QRIS",
    EWALLET: "E-Wallet",
};

export function TransactionsContent({ data: initialData, filters: initialFilters }: Props) {
    const [data, setData] = useState(initialData);
    const [page, setPage] = useState(initialData.currentPage);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState(initialFilters.search || "");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        status: initialFilters.status || "ALL",
    });
    const [sortKey, setSortKey] = useState<string>("");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();

    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedTx, setSelectedTx] = useState<TransactionDetail | null>(null);
    const [voidDialogOpen, setVoidDialogOpen] = useState(false);
    const [refundDialogOpen, setRefundDialogOpen] = useState(false);
    const [actionTxId, setActionTxId] = useState<string>("");
    const [reason, setReason] = useState("");

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                limit: params.pageSize ?? pageSize,
                ...(f.status !== "ALL" ? { status: f.status } : {}),
                ...(f.date_from ? { dateFrom: f.date_from } : {}),
                ...(f.date_to ? { dateTo: f.date_to } : {}),
                ...(sk ? { sortBy: sk, sortDir: sd } : {}),
            };
            const result = await getTransactions(query);
            setData(result);
        });
    };

    const handleViewDetail = async (id: string) => {
        const tx = await getTransactionById(id);
        setSelectedTx(tx);
        setDetailOpen(true);
    };

    const handleVoid = async () => {
        if (!reason.trim()) { toast.error("Alasan wajib diisi"); return; }
        const result = await voidTransaction(actionTxId, reason);
        if (result.error) toast.error(result.error);
        else { toast.success("Transaksi berhasil di-void"); setVoidDialogOpen(false); setReason(""); fetchData({}); }
    };

    const handleRefund = async () => {
        if (!reason.trim()) { toast.error("Alasan wajib diisi"); return; }
        const result = await refundTransaction(actionTxId, reason);
        if (result.error) toast.error(result.error);
        else { toast.success("Transaksi berhasil di-refund"); setRefundDialogOpen(false); setReason(""); fetchData({}); }
    };

    const columns: SmartColumn<Transaction>[] = [
        {
            key: "invoiceNumber", header: "Invoice", sortable: true, width: "150px",
            render: (row) => <span className="font-mono text-xs font-medium">{row.invoiceNumber}</span>,
            exportValue: (row) => row.invoiceNumber,
        },
        {
            key: "createdAt", header: "Tanggal", sortable: true,
            render: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span>,
            exportValue: (row) => formatDateTime(row.createdAt),
        },
        {
            key: "user", header: "Kasir", sortable: true,
            render: (row) => <span className="text-sm">{row.user.name}</span>,
            exportValue: (row) => row.user.name,
        },
        {
            key: "paymentMethod", header: "Pembayaran",
            render: (row) => <Badge variant="secondary" className="rounded-lg text-xs">{paymentLabels[row.paymentMethod] || row.paymentMethod}</Badge>,
            exportValue: (row) => paymentLabels[row.paymentMethod] || row.paymentMethod,
        },
        {
            key: "grandTotal", header: "Total", sortable: true, align: "right",
            render: (row) => <span className="text-xs font-medium">{formatCurrency(row.grandTotal)}</span>,
            exportValue: (row) => row.grandTotal,
        },
        {
            key: "status", header: "Status", align: "center",
            render: (row) => <Badge className={`rounded-lg ${statusColors[row.status] || ""}`}>{row.status}</Badge>,
            exportValue: (row) => row.status,
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "120px",
            render: (row) => (
                <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleViewDetail(row.id)}>
                        <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {row.status === "COMPLETED" && (
                        <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-orange-500 hover:text-orange-700 hover:bg-orange-50"
                                onClick={() => { setActionTxId(row.id); setReason(""); setVoidDialogOpen(true); }} title="Void">
                                <Ban className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => { setActionTxId(row.id); setReason(""); setRefundDialogOpen(true); }} title="Refund">
                                <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    const filters: SmartFilter[] = [
        {
            key: "status", label: "Status", type: "select",
            options: [
                { value: "COMPLETED", label: "Completed" },
                { value: "PENDING", label: "Pending" },
                { value: "VOIDED", label: "Voided" },
                { value: "REFUNDED", label: "Refunded" },
            ],
        },
        { key: "date", label: "Tanggal", type: "daterange" },
    ];

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Riwayat Transaksi</h1>
                <p className="text-muted-foreground text-sm">{data.total} transaksi ditemukan</p>
            </div>

            <SmartTable<Transaction>
                data={data.transactions}
                columns={columns}
                totalItems={data.total}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Daftar Transaksi"
                titleIcon={<History className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari invoice..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1); fetchData({ page: 1, sortKey: key, sortDir: dir }); }}
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
                exportFilename="transaksi"
                emptyIcon={<History className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Tidak ada transaksi ditemukan"
            />

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="rounded-2xl max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Detail Transaksi</DialogTitle>
                    </DialogHeader>
                    {selectedTx && (
                        <>
                            <DialogBody className="space-y-4 pr-1">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-muted-foreground">Invoice</p>
                                        <p className="font-mono font-medium">{selectedTx.invoiceNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Tanggal</p>
                                        <p>{formatDateTime(selectedTx.createdAt)}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Kasir</p>
                                        <p>{selectedTx.user.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Status</p>
                                        <Badge className={`rounded-lg ${statusColors[selectedTx.status]}`}>{selectedTx.status}</Badge>
                                    </div>
                                </div>

                                <div className="border rounded-xl overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Produk</TableHead>
                                                <TableHead className="text-center">Qty</TableHead>
                                                <TableHead className="text-right">Harga</TableHead>
                                                <TableHead className="text-right">Subtotal</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedTx.items.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="text-sm">{item.productName}</TableCell>
                                                    <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                                                    <TableCell className="text-right text-sm">{formatCurrency(item.unitPrice)}</TableCell>
                                                    <TableCell className="text-right text-sm font-medium">{formatCurrency(item.subtotal)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(selectedTx.subtotal)}</span></div>
                                    {selectedTx.discountAmount > 0 && (
                                        <div className="flex justify-between text-red-500"><span>Diskon</span><span>-{formatCurrency(selectedTx.discountAmount)}</span></div>
                                    )}
                                    {selectedTx.taxAmount > 0 && (
                                        <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span>{formatCurrency(selectedTx.taxAmount)}</span></div>
                                    )}
                                    <div className="flex justify-between font-bold text-base border-t pt-1">
                                        <span>Grand Total</span><span>{formatCurrency(selectedTx.grandTotal)}</span>
                                    </div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Dibayar</span><span>{formatCurrency(selectedTx.paymentAmount)}</span></div>
                                    {selectedTx.changeAmount > 0 && (
                                        <div className="flex justify-between"><span className="text-muted-foreground">Kembalian</span><span>{formatCurrency(selectedTx.changeAmount)}</span></div>
                                    )}
                                </div>
                            </DialogBody>
                            <DialogFooter className="pt-3">
                                <Button variant="outline" className="w-full rounded-lg" onClick={() => {
                                    if (!selectedTx) return;
                                    printThermalReceipt({
                                        invoiceNumber: selectedTx.invoiceNumber,
                                        date: formatDateTime(selectedTx.createdAt),
                                        cashier: selectedTx.user.name,
                                        items: selectedTx.items.map((i) => ({
                                            name: i.productName,
                                            qty: i.quantity,
                                            price: i.unitPrice,
                                            subtotal: i.subtotal,
                                        })),
                                        subtotal: selectedTx.subtotal,
                                        discount: selectedTx.discountAmount,
                                        tax: selectedTx.taxAmount,
                                        grandTotal: selectedTx.grandTotal,
                                        paymentMethod: selectedTx.paymentMethod,
                                        paymentAmount: selectedTx.paymentAmount,
                                        change: selectedTx.changeAmount,
                                        promos: selectedTx.promoApplied ? [selectedTx.promoApplied] : undefined,
                                    });
                                }}>
                                    <Printer className="w-4 h-4 mr-2" />
                                    Cetak Struk
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Void Dialog */}
            <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Void Transaksi</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">Transaksi akan dibatalkan dan stok akan dikembalikan.</p>
                        <div className="space-y-2">
                            <Label htmlFor="voidReason">Alasan Void</Label>
                            <Input id="voidReason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masukkan alasan..." className="rounded-lg" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setVoidDialogOpen(false)} className="rounded-lg">Batal</Button>
                            <Button onClick={handleVoid} className="rounded-lg bg-red-600 hover:bg-red-700">Void Transaksi</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Refund Dialog */}
            <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Refund Transaksi</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">Transaksi akan di-refund dan stok akan dikembalikan.</p>
                        <div className="space-y-2">
                            <Label htmlFor="refundReason">Alasan Refund</Label>
                            <Input id="refundReason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masukkan alasan..." className="rounded-lg" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setRefundDialogOpen(false)} className="rounded-lg">Batal</Button>
                            <Button onClick={handleRefund} className="rounded-lg bg-blue-600 hover:bg-blue-700">Refund Transaksi</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
