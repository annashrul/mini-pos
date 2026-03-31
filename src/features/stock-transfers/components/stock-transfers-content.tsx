"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import {
    getStockTransfers,
    getStockTransferById,
    createStockTransfer,
    approveStockTransfer,
    receiveStockTransfer,
    rejectStockTransfer,
} from "@/features/stock-transfers";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartSelect } from "@/components/ui/smart-select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Plus, Eye, ArrowRightLeft,
    CheckCircle2, XCircle, PackageCheck, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { StockTransfer, Branch, TransferCartItem, StockTransferDetail } from "@/types";
import { useBranch } from "@/components/providers/branch-provider";

interface Props {
    initialData: { transfers: StockTransfer[]; total: number; totalPages: number; currentPage: number };
    branches: Branch[];
}

const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-blue-100 text-blue-700",
    IN_TRANSIT: "bg-indigo-100 text-indigo-700",
    RECEIVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
    PENDING: "Menunggu",
    APPROVED: "Disetujui",
    IN_TRANSIT: "Dalam Perjalanan",
    RECEIVED: "Diterima",
    REJECTED: "Ditolak",
};

export function StockTransfersContent({ initialData, branches }: Props) {
    const [data, setData] = useState(initialData);
    const [createOpen, setCreateOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<StockTransferDetail | null>(null);
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
    const [fromBranch, setFromBranch] = useState("");
    const [toBranch, setToBranch] = useState("");
    const [transferNotes, setTransferNotes] = useState("");
    const [cartItems, setCartItems] = useState<TransferCartItem[]>([]);
    const [newProductName, setNewProductName] = useState("");
    const [newProductId, setNewProductId] = useState("");
    const [newQty, setNewQty] = useState(1);

    // Reject state
    const [rejectReason, setRejectReason] = useState("");
    const [rejectId, setRejectId] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);

    const activeBranches = branches.filter((b) => b.isActive);

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                ...(f.status !== "ALL" ? { status: f.status } : {}),
                ...(f.date_from ? { dateFrom: f.date_from } : {}),
                ...(f.date_to ? { dateTo: f.date_to } : {}),
                ...(sk ? { sortBy: sk, sortDir: sd } : {}),
                ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
            };
            const result = await getStockTransfers(query);
            setData(result);
        });
    };

    const handleViewDetail = async (id: string) => {
        const transfer = await getStockTransferById(id);
        setSelectedTransfer(transfer);
        setDetailOpen(true);
    };

    const addCartItem = () => {
        if (!newProductName || newQty < 1) {
            toast.error("Lengkapi data item");
            return;
        }
        setCartItems([...cartItems, {
            productId: newProductId,
            productName: newProductName,
            quantity: newQty,
        }]);
        setNewProductId("");
        setNewProductName("");
        setNewQty(1);
    };

    const removeCartItem = (index: number) => {
        setCartItems(cartItems.filter((_, i) => i !== index));
    };

    const handleCreate = async () => {
        if (!fromBranch) { toast.error("Pilih cabang asal"); return; }
        if (!toBranch) { toast.error("Pilih cabang tujuan"); return; }
        if (fromBranch === toBranch) { toast.error("Cabang asal dan tujuan tidak boleh sama"); return; }
        if (cartItems.length === 0) { toast.error("Tambahkan minimal 1 item"); return; }

        const payload = {
            fromBranchId: fromBranch,
            toBranchId: toBranch,
            items: cartItems,
            ...(transferNotes ? { notes: transferNotes } : {}),
        };

        const result = await createStockTransfer(payload);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Transfer stok berhasil dibuat");
            setCreateOpen(false);
            setCartItems([]);
            setFromBranch("");
            setToBranch("");
            setTransferNotes("");
            fetchData({});
        }
    };

    const handleApprove = async (id: string) => {
        setConfirmText("Yakin ingin menyetujui transfer ini?");
        setPendingConfirmAction(() => async () => {
            const result = await approveStockTransfer(id);
            if (result.error) toast.error(result.error);
            else { toast.success("Transfer disetujui"); setDetailOpen(false); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const handleReceive = async (id: string) => {
        setConfirmText("Yakin ingin menerima transfer ini? Stok akan diperbarui.");
        setPendingConfirmAction(() => async () => {
            const result = await receiveStockTransfer(id);
            if (result.error) toast.error(result.error);
            else { toast.success("Transfer diterima. Stok telah diperbarui."); setDetailOpen(false); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const openRejectDialog = (id: string) => {
        setRejectId(id);
        setRejectReason("");
        setRejectOpen(true);
    };

    const handleReject = async () => {
        const result = await rejectStockTransfer(rejectId, rejectReason || undefined);
        if (result.error) toast.error(result.error);
        else { toast.success("Transfer ditolak"); setRejectOpen(false); setDetailOpen(false); fetchData({}); }
    };

    const columns: SmartColumn<StockTransfer>[] = [
        {
            key: "transferNumber", header: "No. Transfer", sortable: true, width: "150px",
            render: (row) => <span className="font-mono text-sm font-medium">{row.transferNumber}</span>,
            exportValue: (row) => row.transferNumber,
        },
        {
            key: "fromBranch", header: "Dari", sortable: true,
            render: (row) => <span className="text-sm">{row.fromBranch.name}</span>,
            exportValue: (row) => row.fromBranch.name,
        },
        {
            key: "toBranch", header: "Ke", sortable: true,
            render: (row) => <span className="text-sm">{row.toBranch.name}</span>,
            exportValue: (row) => row.toBranch.name,
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
            key: "requestedAt", header: "Tanggal", sortable: true,
            render: (row) => <span className="text-sm">{format(new Date(row.requestedAt), "dd MMM yy", { locale: idLocale })}</span>,
            exportValue: (row) => format(new Date(row.requestedAt), "dd/MM/yyyy"),
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "120px",
            render: (row) => (
                <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleViewDetail(row.id)} title="Detail">
                        <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {row.status === "PENDING" && (
                        <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-green-500" onClick={() => handleApprove(row.id)} title="Setujui">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500" onClick={() => openRejectDialog(row.id)} title="Tolak">
                                <XCircle className="w-3.5 h-3.5" />
                            </Button>
                        </>
                    )}
                    {row.status === "APPROVED" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-blue-500" onClick={() => handleReceive(row.id)} title="Terima">
                            <PackageCheck className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    const filters: SmartFilter[] = [
        {
            key: "status", label: "Status", type: "select",
            options: [
                { value: "PENDING", label: "Menunggu" },
                { value: "APPROVED", label: "Disetujui" },
                { value: "IN_TRANSIT", label: "Dalam Perjalanan" },
                { value: "RECEIVED", label: "Diterima" },
                { value: "REJECTED", label: "Ditolak" },
            ],
        },
        { key: "date", label: "Tanggal", type: "daterange" },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Transfer Stok</h1>
                    <p className="text-muted-foreground text-sm">Kelola transfer stok antar cabang</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="rounded-lg">
                            <Plus className="w-4 h-4 mr-2" />
                            Buat Transfer
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Buat Transfer Stok</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Cabang Asal</Label>
                                    <SmartSelect
                                        value={fromBranch}
                                        onChange={setFromBranch}
                                        placeholder="Pilih cabang asal"
                                        onSearch={async (query) =>
                                            activeBranches
                                                .filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
                                                .map((b) => ({ value: b.id, label: b.name }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cabang Tujuan</Label>
                                    <SmartSelect
                                        value={toBranch}
                                        onChange={setToBranch}
                                        placeholder="Pilih cabang tujuan"
                                        onSearch={async (query) =>
                                            activeBranches
                                                .filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
                                                .map((b) => ({ value: b.id, label: b.name }))
                                        }
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Catatan (opsional)</Label>
                                <Input value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} className="rounded-xl" placeholder="Catatan transfer..." />
                            </div>

                            <div className="border rounded-xl p-4 space-y-3">
                                <Label className="font-semibold">Tambah Item</Label>
                                <div className="grid grid-cols-12 gap-2 items-end">
                                    <div className="col-span-3 space-y-1">
                                        <Label className="text-xs">ID Produk</Label>
                                        <Input value={newProductId} onChange={(e) => setNewProductId(e.target.value)} className="rounded-xl" placeholder="Opsional" />
                                    </div>
                                    <div className="col-span-5 space-y-1">
                                        <Label className="text-xs">Nama Produk</Label>
                                        <Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} className="rounded-xl" placeholder="Nama produk" />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label className="text-xs">Qty</Label>
                                        <Input type="number" value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} className="rounded-xl" min={1} />
                                    </div>
                                    <div className="col-span-2">
                                        <Button onClick={addCartItem} className="rounded-xl w-full" size="sm">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {cartItems.length > 0 && (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Produk</TableHead>
                                                <TableHead className="text-center">Qty</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {cartItems.map((item, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="text-sm">{item.productName}</TableCell>
                                                    <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCartItem(i)}>
                                                            <Trash2 className="w-3 h-3 text-red-500" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Batal</Button>
                                <Button onClick={handleCreate} className="rounded-xl">Buat Transfer</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <SmartTable<StockTransfer>
                data={data.transfers}
                columns={columns}
                totalItems={data.total}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Daftar Transfer Stok"
                titleIcon={<ArrowRightLeft className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari transfer..."
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
                exportFilename="stock-transfers"
                emptyIcon={<ArrowRightLeft className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Belum ada transfer stok"
            />

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="rounded-2xl max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span>Detail Transfer - {selectedTransfer?.transferNumber}</span>
                            {selectedTransfer && (
                                <Badge className={statusColors[selectedTransfer.status]}>{statusLabels[selectedTransfer.status]}</Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedTransfer && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-slate-500">Dari Cabang</p>
                                    <p className="font-medium">{selectedTransfer.fromBranch.name}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">Ke Cabang</p>
                                    <p className="font-medium">{selectedTransfer.toBranch.name}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">Tanggal Request</p>
                                    <p>{format(new Date(selectedTransfer.requestedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">Catatan</p>
                                    <p>{selectedTransfer.notes || "-"}</p>
                                </div>
                                {selectedTransfer.approvedAt && (
                                    <div>
                                        <p className="text-slate-500">Tanggal Approve</p>
                                        <p>{format(new Date(selectedTransfer.approvedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}</p>
                                    </div>
                                )}
                                {selectedTransfer.receivedAt && (
                                    <div>
                                        <p className="text-slate-500">Tanggal Diterima</p>
                                        <p>{format(new Date(selectedTransfer.receivedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}</p>
                                    </div>
                                )}
                            </div>

                            <div className="border rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produk</TableHead>
                                            <TableHead className="text-center">Qty</TableHead>
                                            <TableHead className="text-center">Diterima</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedTransfer.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="text-sm">{item.productName}</TableCell>
                                                <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                                                <TableCell className="text-center text-sm">
                                                    <Badge variant={item.receivedQty >= item.quantity ? "default" : "secondary"} className="rounded-lg">
                                                        {item.receivedQty}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setDetailOpen(false)} className="rounded-xl">Tutup</Button>
                                {selectedTransfer.status === "PENDING" && (
                                    <>
                                        <Button variant="destructive" onClick={() => { setDetailOpen(false); openRejectDialog(selectedTransfer.id); }} className="rounded-xl">
                                            <XCircle className="w-4 h-4 mr-2" />
                                            Tolak
                                        </Button>
                                        <Button onClick={() => handleApprove(selectedTransfer.id)} className="rounded-xl bg-green-600 hover:bg-green-700">
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Setujui
                                        </Button>
                                    </>
                                )}
                                {selectedTransfer.status === "APPROVED" && (
                                    <Button onClick={() => handleReceive(selectedTransfer.id)} className="rounded-xl bg-blue-600 hover:bg-blue-700">
                                        <PackageCheck className="w-4 h-4 mr-2" />
                                        Terima Barang
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Tolak Transfer</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Alasan Penolakan (opsional)</Label>
                            <Input
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="rounded-xl"
                                placeholder="Masukkan alasan..."
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setRejectOpen(false)} className="rounded-xl">Batal</Button>
                            <Button variant="destructive" onClick={handleReject} className="rounded-xl">Tolak Transfer</Button>
                        </div>
                    </div>
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
