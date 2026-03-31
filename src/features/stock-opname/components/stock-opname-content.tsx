"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import {
    getStockOpnames,
    getStockOpnameById,
    createStockOpname,
    updateOpnameItems,
    completeStockOpname,
    cancelStockOpname,
} from "@/features/stock-opname";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BranchMultiSelect } from "@/components/ui/branch-multi-select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Plus, Eye, ClipboardCheck,
    CheckCircle2, XCircle, Save,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { StockOpname, StockOpnameDetail } from "@/types";
import { useBranch } from "@/components/providers/branch-provider";

interface Props {
    initialData: { opnames: StockOpname[]; total: number; totalPages: number; currentPage: number };
    branches: { id: string; name: string }[];
}

const statusColors: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
    DRAFT: "Draft",
    IN_PROGRESS: "Berlangsung",
    COMPLETED: "Selesai",
    CANCELLED: "Dibatalkan",
};

export function StockOpnameContent({ initialData, branches }: Props) {
    const [data, setData] = useState(initialData);
    const [createOpen, setCreateOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedOpname, setSelectedOpname] = useState<StockOpnameDetail | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ status: "ALL" });
    const [sortKey, setSortKey] = useState<string>("");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();
    const { selectedBranchId } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);
    useEffect(() => {
        if (prevBranchRef.current !== selectedBranchId) { prevBranchRef.current = selectedBranchId; setPage(1); fetchData({ page: 1 }); } else if (selectedBranchId) { fetchData({}); }
    }, [selectedBranchId]);

    // Create state
    const [createNotes, setCreateNotes] = useState("");
    const [createBranchIds, setCreateBranchIds] = useState<string[]>(branches.map((b) => b.id));

    // Detail edit state
    const [editedItems, setEditedItems] = useState<Record<string, number>>({});
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                ...(f.status !== "ALL" ? { status: f.status } : {}),
                ...(f.branchId && f.branchId !== "ALL" ? { branchId: f.branchId } : selectedBranchId ? { branchId: selectedBranchId } : {}),
                ...(f.date_from ? { dateFrom: f.date_from } : {}),
                ...(f.date_to ? { dateTo: f.date_to } : {}),
                ...(sk ? { sortBy: sk, sortDir: sd } : {}),
            };
            const result = await getStockOpnames(query);
            setData(result);
        });
    };

    const handleViewDetail = async (id: string) => {
        const opname: StockOpnameDetail | null = await getStockOpnameById(id);
        setSelectedOpname(opname);
        // Initialize edited items with current actual stock values
        const items: Record<string, number> = {};
        opname?.items.forEach((item) => {
            items[item.productId] = item.actualStock;
        });
        setEditedItems(items);
        setDetailOpen(true);
    };

    const handleCreate = async () => {
        const result = await createStockOpname(createBranchIds.length === branches.length ? null : createBranchIds, createNotes || undefined);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Stock Opname berhasil dibuat");
            setCreateOpen(false);
            setCreateNotes("");
            fetchData({});
        }
    };

    const handleSaveItems = async () => {
        if (!selectedOpname) return;
        const items = Object.entries(editedItems).map(([productId, actualStock]) => ({
            productId,
            actualStock,
        }));

        const result = await updateOpnameItems(selectedOpname.id, items);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Data opname berhasil disimpan");
            // Refresh detail
            const updated = await getStockOpnameById(selectedOpname.id);
            setSelectedOpname(updated);
            fetchData({});
        }
    };

    const handleComplete = async () => {
        if (!selectedOpname) return;
        setConfirmText("Yakin ingin menyelesaikan stock opname ini? Stok produk akan disesuaikan.");
        setPendingConfirmAction(() => async () => {
            const items = Object.entries(editedItems).map(([productId, actualStock]) => ({
                productId,
                actualStock,
            }));
            await updateOpnameItems(selectedOpname.id, items);
            const result = await completeStockOpname(selectedOpname.id);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success("Stock Opname berhasil diselesaikan. Stok telah disesuaikan.");
                setDetailOpen(false);
                fetchData({});
            }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const handleCancel = async (id: string) => {
        setConfirmText("Yakin ingin membatalkan stock opname ini?");
        setPendingConfirmAction(() => async () => {
            const result = await cancelStockOpname(id);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success("Stock Opname dibatalkan");
                setDetailOpen(false);
                fetchData({});
            }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const isEditable = selectedOpname && (selectedOpname.status === "DRAFT" || selectedOpname.status === "IN_PROGRESS");

    const columns: SmartColumn<StockOpname>[] = [
        {
            key: "opnameNumber", header: "No. Opname", sortable: true, width: "150px",
            render: (row) => <span className="font-mono text-sm font-medium">{row.opnameNumber}</span>,
            exportValue: (row) => row.opnameNumber,
        },
        {
            key: "branch", header: "Branch", sortable: true,
            render: (row) => <span className="text-sm">{row.branch?.name || "Semua"}</span>,
            exportValue: (row) => row.branch?.name || "Semua",
        },
        {
            key: "status", header: "Status", align: "center",
            render: (row) => <Badge className={statusColors[row.status]}>{statusLabels[row.status]}</Badge>,
            exportValue: (row) => statusLabels[row.status] || row.status,
        },
        {
            key: "items", header: "Items", align: "center",
            render: (row) => <Badge variant="secondary" className="rounded-lg">{row._count.items}</Badge>,
            exportValue: (row) => row._count.items,
        },
        {
            key: "startedAt", header: "Tanggal", sortable: true,
            render: (row) => <span className="text-sm">{format(new Date(row.startedAt), "dd MMM yy", { locale: idLocale })}</span>,
            exportValue: (row) => format(new Date(row.startedAt), "dd/MM/yyyy"),
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "90px",
            render: (row) => (
                <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleViewDetail(row.id)} title="Detail">
                        <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {(row.status === "DRAFT" || row.status === "IN_PROGRESS") && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleCancel(row.id)} title="Batalkan">
                            <XCircle className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    const filters: SmartFilter[] = [
        {
            key: "branchId", label: "Cabang", type: "select",
            options: branches.map((b) => ({ value: b.id, label: b.name })),
        },
        {
            key: "status", label: "Status", type: "select",
            options: [
                { value: "DRAFT", label: "Draft" },
                { value: "IN_PROGRESS", label: "Berlangsung" },
                { value: "COMPLETED", label: "Selesai" },
                { value: "CANCELLED", label: "Dibatalkan" },
            ],
        },
        { key: "date", label: "Tanggal", type: "daterange" },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Stock Opname</h1>
                    <p className="text-muted-foreground text-sm">Penyesuaian stok berdasarkan penghitungan fisik</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="rounded-lg">
                            <Plus className="w-4 h-4 mr-2" />
                            Buat Opname
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>Buat Stock Opname Baru</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500">
                                Semua produk aktif akan dimuat dengan stok sistem saat ini. Anda dapat memasukkan stok aktual setelah opname dibuat.
                            </p>
                            <div className="space-y-2">
                                <Label>Lokasi <span className="text-red-400">*</span></Label>
                                <BranchMultiSelect
                                    branches={branches}
                                    value={createBranchIds}
                                    onChange={setCreateBranchIds}
                                    placeholder="Pilih lokasi"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Catatan (opsional)</Label>
                                <Input
                                    value={createNotes}
                                    onChange={(e) => setCreateNotes(e.target.value)}
                                    className="rounded-xl"
                                    placeholder="Catatan opname..."
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Batal</Button>
                                <Button onClick={handleCreate} className="rounded-xl">Buat Opname</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <SmartTable<StockOpname>
                data={data.opnames}
                columns={columns}
                totalItems={data.total}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Daftar Stock Opname"
                titleIcon={<ClipboardCheck className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari opname..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1); fetchData({ page: 1, sortKey: key, sortDir: dir }); }}
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
                rowKey={(row) => row.id}
                exportFilename="stock-opname"
                emptyIcon={<ClipboardCheck className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Belum ada stock opname"
            />

            {/* Detail / Edit Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="rounded-2xl max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span>Detail Stock Opname - {selectedOpname?.opnameNumber}</span>
                            {selectedOpname && (
                                <Badge className={statusColors[selectedOpname.status]}>{statusLabels[selectedOpname.status]}</Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedOpname && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div>
                                    <p className="text-slate-500">Cabang</p>
                                    <p className="font-medium">{selectedOpname.branch?.name || "Semua"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">Tanggal Mulai</p>
                                    <p>{format(new Date(selectedOpname.startedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">Catatan</p>
                                    <p>{selectedOpname.notes || "-"}</p>
                                </div>
                            </div>

                            {selectedOpname.items.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold">Daftar Produk ({selectedOpname.items.length} item)</p>
                                        {isEditable && (
                                            <div className="text-xs text-slate-500">Masukkan stok aktual hasil penghitungan fisik</div>
                                        )}
                                    </div>
                                    <div className="border rounded-xl overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Kode</TableHead>
                                                    <TableHead>Produk</TableHead>
                                                    <TableHead className="text-center">Stok Sistem</TableHead>
                                                    <TableHead className="text-center">Stok Aktual</TableHead>
                                                    <TableHead className="text-center">Selisih</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedOpname.items.map((item) => {
                                                    const actualStock = editedItems[item.productId] ?? item.actualStock;
                                                    const diff = actualStock - item.systemStock;
                                                    return (
                                                        <TableRow key={item.id}>
                                                            <TableCell className="font-mono text-sm">{item.product.code}</TableCell>
                                                            <TableCell className="text-sm">{item.product.name}</TableCell>
                                                            <TableCell className="text-center text-sm">{item.systemStock}</TableCell>
                                                            <TableCell className="text-center">
                                                                {isEditable ? (
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        value={actualStock}
                                                                        onChange={(e) => setEditedItems({ ...editedItems, [item.productId]: Number(e.target.value) })}
                                                                        className="w-20 mx-auto rounded-lg text-center text-sm"
                                                                    />
                                                                ) : (
                                                                    <span className="text-sm">{item.actualStock}</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <span className={`text-sm font-medium ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-slate-400"}`}>
                                                                    {diff > 0 ? `+${diff}` : diff === 0 ? "0" : diff}
                                                                </span>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </>
                            )}

                            {/* Summary */}
                            {selectedOpname.items.length > 0 && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                                        <p className="text-xs text-slate-500">Total Item</p>
                                        <p className="text-lg font-bold">{selectedOpname.items.length}</p>
                                    </div>
                                    <div className="bg-green-50 rounded-xl p-3 text-center">
                                        <p className="text-xs text-green-600">Kelebihan</p>
                                        <p className="text-lg font-bold text-green-600">
                                            {selectedOpname.items.filter((i) => (editedItems[i.productId] ?? i.actualStock) > i.systemStock).length}
                                        </p>
                                    </div>
                                    <div className="bg-red-50 rounded-xl p-3 text-center">
                                        <p className="text-xs text-red-600">Kekurangan</p>
                                        <p className="text-lg font-bold text-red-600">
                                            {selectedOpname.items.filter((i) => (editedItems[i.productId] ?? i.actualStock) < i.systemStock).length}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setDetailOpen(false)} className="rounded-xl">Tutup</Button>
                                {isEditable && (
                                    <>
                                        <Button variant="outline" onClick={handleSaveItems} className="rounded-xl">
                                            <Save className="w-4 h-4 mr-2" />
                                            Simpan
                                        </Button>
                                        <Button variant="destructive" onClick={() => handleCancel(selectedOpname.id)} className="rounded-xl">
                                            <XCircle className="w-4 h-4 mr-2" />
                                            Batalkan
                                        </Button>
                                        <Button onClick={handleComplete} className="rounded-xl bg-green-600 hover:bg-green-700">
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Selesaikan Opname
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Konfirmasi</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">{confirmText}</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-xl">Batal</Button>
                        <Button variant="destructive" onClick={async () => { await pendingConfirmAction?.(); }} className="rounded-xl">Ya, Lanjutkan</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
