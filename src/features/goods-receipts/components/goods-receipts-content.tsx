"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { useState, useEffect, useRef, useTransition } from "react";
import {
    getGoodsReceipts,
    getGoodsReceiptById,
    getGoodsReceiptStats,
    deleteGoodsReceipt,
    bulkDeleteGoodsReceipts,
} from "@/features/goods-receipts";
import type { GoodsReceiptDetail } from "@/features/goods-receipts";
import { useMenuActionAccess } from "@/features/access-control";
import { Button } from "@/components/ui/button";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Eye, PackageCheck,
    Truck, Search, Loader2,
    CalendarDays, ClipboardList,
    MapPin, Package, Printer, Trash2, FileDown, FileSpreadsheet, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { printDocument, exportToPDF, exportToCSV, exportToExcel } from "@/lib/document-export";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useBranch } from "@/components/providers/branch-provider";
import { PaginationControl } from "@/components/ui/pagination-control";

type GoodsReceiptsData = Awaited<ReturnType<typeof getGoodsReceipts>>;
type StatsData = Awaited<ReturnType<typeof getGoodsReceiptStats>>;

export function GoodsReceiptsContent() {
    const [data, setData] = useState<GoodsReceiptsData>({ receipts: [], total: 0, totalPages: 0 });
    const [stats, setStats] = useState<StatsData>({ total: 0, today: 0, thisMonth: 0 });
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedGR, setSelectedGR] = useState<GoodsReceiptDetail | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [loading, startTransition] = useTransition();
    const { canAction } = useMenuActionAccess("goods-receipts");
    const { canAction: canPlan } = usePlanAccess();
    const canDelete = canAction("delete") && canPlan("goods-receipts", "delete");
    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    function fetchData(params: { search?: string; page?: number; pageSize?: number }) {
        startTransition(async () => {
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
            };
            const [result, statsResult] = await Promise.all([
                getGoodsReceipts(query),
                getGoodsReceiptStats(selectedBranchId ? { branchId: selectedBranchId } : {}),
            ]);
            setData(result);
            setStats(statsResult);
        });
    }

    useEffect(() => {
        if (!branchReady) return;
        if (prevBranchRef.current !== selectedBranchId) {
            prevBranchRef.current = selectedBranchId;
            setPage(1);
            setSelectedIds(new Set());
            fetchData({ page: 1 });
        } else {
            fetchData({});
        }
    }, [branchReady, selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleViewDetail = async (id: string) => {
        const gr = await getGoodsReceiptById(id);
        setSelectedGR(gr as GoodsReceiptDetail | null);
        setDetailOpen(true);
    };

    const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setPage(1);
            fetchData({ search: value, page: 1 });
        }, 400);
    };

    const handleDelete = async () => {
        if (!deleteTargetId) return;
        const result = await deleteGoodsReceipt(deleteTargetId);
        if ("error" in result) toast.error(result.error);
        else { toast.success("Bukti penerimaan dihapus"); fetchData({}); }
        setDeleteConfirmOpen(false);
        setDeleteTargetId(null);
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedIds);
        const result = await bulkDeleteGoodsReceipts(ids);
        if ("error" in result) toast.error(result.error as string);
        else { toast.success(`${ids.length} bukti penerimaan dihapus`); setSelectedIds(new Set()); fetchData({}); }
        setBulkDeleteConfirmOpen(false);
    };

    const toggleOne = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const buildGRConfig = (gr: GoodsReceiptDetail): import("@/lib/document-export").DocumentConfig => ({
        title: "BUKTI PENERIMAAN BARANG",
        docNumber: gr.receiptNumber,
        date: `Tanggal: ${format(new Date(gr.receivedAt), "dd MMM yyyy", { locale: idLocale })}`,
        infoRows: [
            { label: "Ref. Purchase Order", value: `${gr.purchaseOrder.orderNumber} — ${gr.purchaseOrder.supplier.name}` },
            { label: "Lokasi", value: gr.branch?.name || "—" },
            ...(gr.receivedByName ? [{ label: "Diterima Oleh", value: gr.receivedByName }] : []),
        ],
        columns: [
            { key: "no", header: "No", align: "center", width: 5 },
            { key: "productName", header: "Produk", align: "left", width: 30 },
            { key: "quantityOrdered", header: "Order", align: "center", width: 10 },
            { key: "quantityReceived", header: "Diterima", align: "center", width: 12 },
            { key: "gap", header: "Selisih", align: "center", width: 10, format: (v) => { const n = v as number; return n > 0 ? `-${n}` : "✓"; } },
        ],
        data: gr.items.map((item, i) => ({
            no: i + 1,
            productName: item.productName,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: item.quantityReceived,
            gap: item.quantityOrdered - item.quantityReceived,
        })),
        totals: [{ label: "Total Diterima", value: `${gr.items.reduce((s, i) => s + i.quantityReceived, 0)} pcs` }],
        notes: gr.notes || undefined,
        signatures: ["Diterima Oleh", "Diketahui Oleh"],
    });

    const handlePrintGR = (gr: GoodsReceiptDetail) => {
        printDocument(buildGRConfig(gr));
    };

    const handleExportGRPDF = (gr: GoodsReceiptDetail) => {
        exportToPDF(buildGRConfig(gr), `GR-${gr.receiptNumber}.pdf`);
    };

    const handleExportGRCSV = (gr: GoodsReceiptDetail) => {
        exportToCSV(buildGRConfig(gr), `GR-${gr.receiptNumber}.csv`);
    };

    const handleExportGRExcel = (gr: GoodsReceiptDetail) => {
        exportToExcel(buildGRConfig(gr), `GR-${gr.receiptNumber}.xlsx`);
    };

    return (
        <div className="space-y-4 sm:space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-200">
                        <PackageCheck className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Bukti Penerimaan</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-muted-foreground text-xs sm:text-sm">Riwayat penerimaan barang dari Purchase Order</p>
                            <Badge variant="secondary" className="rounded-full bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 border border-cyan-200 text-xs font-medium">
                                {data.total} GR
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    <ExportMenu module="goods-receipts" branchId={selectedBranchId || undefined} />
                </div>
            </div>

            {/* Mobile: search + stats */}
            <div className="sm:hidden space-y-2">
                <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Cari GR..." className="pl-9 rounded-xl border-slate-200 bg-white h-9 text-sm" />
                        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                    <div className="inline-flex items-center gap-1 rounded-full bg-cyan-50 ring-1 ring-cyan-200 px-2 py-1 shrink-0">
                        <PackageCheck className="w-3 h-3 text-cyan-500" />
                        <span className="text-[11px] font-semibold text-cyan-700">{stats.total}</span>
                        <span className="text-[11px] text-cyan-400">Total</span>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 ring-1 ring-emerald-100 px-2 py-1 shrink-0">
                        <CalendarDays className="w-3 h-3 text-emerald-500" />
                        <span className="text-[11px] font-semibold text-emerald-700">{stats.today}</span>
                        <span className="text-[11px] text-emerald-400">Hari ini</span>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 ring-1 ring-blue-100 px-2 py-1 shrink-0">
                        <Package className="w-3 h-3 text-blue-500" />
                        <span className="text-[11px] font-semibold text-blue-700">{stats.thisMonth}</span>
                        <span className="text-[11px] text-blue-400">Bulan ini</span>
                    </div>
                </div>
            </div>

            {/* Desktop: search + stats */}
            <div className="hidden sm:flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Cari berdasarkan nomor GR, PO, supplier..." className="pl-10 rounded-xl border-slate-200 bg-white h-10 text-sm" />
                    {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 border border-cyan-200 px-3 py-1.5">
                        <PackageCheck className="w-3 h-3 text-cyan-500" />
                        <span className="text-[11px] font-semibold text-cyan-700">{stats.total}</span>
                        <span className="text-[11px] text-cyan-500">Total</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                        <CalendarDays className="w-3 h-3 text-emerald-500" />
                        <span className="text-[11px] font-semibold text-emerald-700">{stats.today}</span>
                        <span className="text-[11px] text-emerald-500">Hari ini</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5">
                        <Package className="w-3 h-3 text-blue-500" />
                        <span className="text-[11px] font-semibold text-blue-700">{stats.thisMonth}</span>
                        <span className="text-[11px] text-blue-500">Bulan ini</span>
                    </div>
                </div>
            </div>

            {/* Card List */}
            <div className="space-y-3">
                {loading && data.receipts.length === 0 ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-slate-200" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-slate-200 rounded w-1/3" />
                                        <div className="h-3 bg-slate-100 rounded w-1/4" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : data.receipts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 sm:py-16 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white to-slate-50/50">
                        <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center mb-4">
                            <PackageCheck className="w-5 h-5 sm:w-8 sm:h-8 text-cyan-300" />
                        </div>
                        <p className="text-sm sm:text-base font-semibold text-foreground mb-1">Belum ada bukti penerimaan</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            {search ? "Tidak ada GR yang cocok" : "Bukti penerimaan otomatis dibuat saat menerima barang di Purchase Order"}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                        {data.receipts.map((row) => {
                            const d = new Date(row.receivedAt);
                            const isSelected = selectedIds.has(row.id);
                            return (
                                <div
                                    key={row.id}
                                    className={cn(
                                        "group relative rounded-xl border border-l-4 border-l-cyan-500 bg-white hover:shadow-md transition-all duration-200",
                                        isSelected ? "border-primary ring-1 ring-primary/20 bg-primary/5" : "border-slate-200/60"
                                    )}
                                >
                                    <div className="p-3 sm:p-4 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
                                        {/* Checkbox */}
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleOne(row.id)}
                                            className="shrink-0 hidden sm:flex"
                                        />

                                        {/* Icon */}
                                        <div className="hidden sm:flex w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-200 text-cyan-600 items-center justify-center shadow-sm shrink-0">
                                            <PackageCheck className="w-4.5 h-4.5" />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5">
                                            <div className="flex items-baseline gap-1.5 sm:gap-2">
                                                <span className="font-mono text-xs sm:text-sm font-bold text-foreground">{row.receiptNumber}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-0.5 text-[11px] sm:text-xs text-muted-foreground">
                                                <span className="inline-flex items-center gap-1">
                                                    <ClipboardList className="w-3 h-3" />
                                                    {row.purchaseOrder.orderNumber}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <Truck className="w-3 h-3" />
                                                    {row.purchaseOrder.supplier.name}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarDays className="w-3 h-3" />
                                                    {format(d, "dd MMM yy", { locale: idLocale })}
                                                </span>
                                                {row.branch && (
                                                    <span className="hidden sm:inline-flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {row.branch.name}
                                                    </span>
                                                )}
                                                <span className="inline-flex items-center gap-1">
                                                    <Package className="w-3 h-3" />
                                                    {row._count.items} item
                                                </span>
                                            </div>
                                            {row.receivedByName && (
                                                <p className="text-[11px] text-muted-foreground">Diterima oleh: <span className="font-medium text-foreground">{row.receivedByName}</span></p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 sm:shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-slate-100" onClick={() => handleViewDetail(row.id)} title="Detail">
                                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                            </Button>
                                            {canDelete && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => { setDeleteTargetId(row.id); setDeleteConfirmOpen(true); }}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            <PaginationControl
                currentPage={page}
                totalPages={data.totalPages}
                totalItems={data.total}
                pageSize={pageSize}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
            />

            {/* Bulk Action */}
            {selectedIds.size > 0 && canDelete && (
                <BulkActionBar
                    selectedCount={selectedIds.size}
                    onClear={() => setSelectedIds(new Set())}
                    actions={[
                        { label: "Hapus", icon: <Trash2 className="w-4 h-4" />, variant: "destructive" as const, onClick: () => setBulkDeleteConfirmOpen(true) },
                    ]}
                />
            )}

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-xl sm:rounded-2xl p-0 gap-0 max-h-[90vh] flex flex-col">
                    <div className="h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 shrink-0" />
                    <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 shrink-0">
                        <DialogTitle className="text-base sm:text-lg font-bold">Detail Bukti Penerimaan</DialogTitle>
                    </DialogHeader>
                    {selectedGR && (<>
                        <DialogBody className="px-4 sm:px-6 space-y-3 sm:space-y-4">
                            {/* Info cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">No. GR</p>
                                    <p className="font-mono font-bold text-sm text-foreground">{selectedGR.receiptNumber}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Ref. Purchase Order</p>
                                    <p className="font-mono font-bold text-sm text-foreground">{selectedGR.purchaseOrder.orderNumber}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Supplier</p>
                                    <div className="flex items-center gap-1.5">
                                        <Truck className="w-3.5 h-3.5 text-cyan-500" />
                                        <p className="text-sm font-medium">{selectedGR.purchaseOrder.supplier.name}</p>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Tanggal Terima</p>
                                    <p className="text-sm">{format(new Date(selectedGR.receivedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}</p>
                                </div>
                                {selectedGR.branch && (
                                    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Lokasi</p>
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                            <p className="text-sm font-medium">{selectedGR.branch.name}</p>
                                        </div>
                                    </div>
                                )}
                                {selectedGR.receivedByName && (
                                    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Diterima Oleh</p>
                                        <p className="text-sm font-medium">{selectedGR.receivedByName}</p>
                                    </div>
                                )}
                            </div>

                            {selectedGR.notes && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-[11px] text-muted-foreground font-medium mb-1">Catatan</p>
                                    <p className="text-xs text-foreground">{selectedGR.notes}</p>
                                </div>
                            )}

                            {/* Items table */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gradient-to-r from-slate-50 to-white">
                                            <TableHead className="text-xs font-semibold">Produk</TableHead>
                                            <TableHead className="text-center text-xs font-semibold">Order</TableHead>
                                            <TableHead className="text-center text-xs font-semibold">Diterima</TableHead>
                                            <TableHead className="text-center text-xs font-semibold">Selisih</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedGR.items.map((item) => {
                                            const gap = item.quantityOrdered - item.quantityReceived;
                                            return (
                                                <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                    <TableCell className="text-sm font-medium">{item.productName}</TableCell>
                                                    <TableCell className="text-center text-sm tabular-nums">{item.quantityOrdered}</TableCell>
                                                    <TableCell className="text-center text-sm">
                                                        <Badge className={`rounded-lg font-semibold ${item.quantityReceived >= item.quantityOrdered
                                                            ? "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200"
                                                            : "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200"
                                                            }`}>
                                                            {item.quantityReceived}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center text-sm">
                                                        {gap > 0 ? (
                                                            <Badge className="rounded-lg bg-red-50 text-red-600 border border-red-200 font-semibold">-{gap}</Badge>
                                                        ) : (
                                                            <span className="text-emerald-500 text-xs">✓</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                        </DialogBody>

                        <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6 justify-between items-center">
                            {/* Total - left */}
                            <div className="min-w-0">
                                <p className="text-[11px] text-muted-foreground font-medium">Total Diterima</p>
                                <p className="font-mono text-base font-bold tabular-nums text-foreground">
                                    {selectedGR.items.reduce((s, i) => s + i.quantityReceived, 0)} pcs
                                </p>
                            </div>
                            {/* Actions - right */}
                            <div className="flex items-center gap-2 shrink-0">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="rounded-xl">
                                            <FileDown className="w-4 h-4 mr-2" /> Export
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                        <DropdownMenuItem onClick={() => handlePrintGR(selectedGR)}>
                                            <Printer className="w-3.5 h-3.5 mr-2" /> Print
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExportGRPDF(selectedGR)}>
                                            <FileDown className="w-3.5 h-3.5 mr-2" /> Export PDF
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExportGRCSV(selectedGR)}>
                                            <FileText className="w-3.5 h-3.5 mr-2" /> Export CSV
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExportGRExcel(selectedGR)}>
                                            <FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Export Excel
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </DialogFooter>
                    </>)}
                </DialogContent>
            </Dialog>

            {/* Confirm Dialogs */}
            <ActionConfirmDialog
                open={deleteConfirmOpen}
                onOpenChange={(v) => { setDeleteConfirmOpen(v); if (!v) setDeleteTargetId(null); }}
                kind="delete"
                description="Yakin ingin menghapus bukti penerimaan ini?"
                onConfirm={handleDelete}
            />
            <ActionConfirmDialog
                open={bulkDeleteConfirmOpen}
                onOpenChange={setBulkDeleteConfirmOpen}
                kind="delete"
                description={`Yakin ingin menghapus ${selectedIds.size} bukti penerimaan?`}
                onConfirm={handleBulkDelete}
            />
        </div>
    );
}
