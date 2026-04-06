"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    getStockTransfers,
    getStockTransferById,
    createStockTransfer,
    approveStockTransfer,
    receiveStockTransfer,
    rejectStockTransfer,
} from "@/features/stock-transfers";
import { getAllBranches } from "@/features/branches";
import { createStockTransferSchema, type CreateStockTransferInput } from "@/features/stock-transfers/schemas/stock-transfers.schema";
import { useMenuActionAccess } from "@/features/access-control";
import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartSelect } from "@/components/ui/smart-select";
import {
    Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Plus, Eye, ArrowRightLeft, ArrowRight,
    CheckCircle2, XCircle, PackageCheck, Trash2,
    Clock, ShieldCheck, Truck, PackageOpen, Ban, Package,
    Search, Loader2, CalendarDays, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { StockTransfer, Branch, StockTransferDetail } from "@/types";
import { useBranch } from "@/components/providers/branch-provider";
import { PaginationControl } from "@/components/ui/pagination-control";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType; borderColor: string; gradientBg: string }> = {
    PENDING: { label: "Menunggu", color: "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border border-amber-200", icon: Clock, borderColor: "border-l-amber-400", gradientBg: "from-amber-400 to-yellow-500" },
    APPROVED: { label: "Disetujui", color: "bg-gradient-to-r from-blue-100 to-sky-100 text-blue-700 border border-blue-200", icon: ShieldCheck, borderColor: "border-l-blue-400", gradientBg: "from-blue-400 to-sky-500" },
    IN_TRANSIT: { label: "Dalam Perjalanan", color: "bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 border border-purple-200", icon: Truck, borderColor: "border-l-purple-400", gradientBg: "from-purple-400 to-violet-500" },
    RECEIVED: { label: "Diterima", color: "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200", icon: PackageOpen, borderColor: "border-l-green-400", gradientBg: "from-emerald-400 to-green-500" },
    REJECTED: { label: "Ditolak", color: "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200", icon: Ban, borderColor: "border-l-red-400", gradientBg: "from-red-400 to-rose-500" },
};

const STATUS_PILLS = [
    { value: "ALL", label: "Semua" },
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "RECEIVED", label: "Received" },
    { value: "REJECTED", label: "Rejected" },
];

export function StockTransfersContent() {
    const [data, setData] = useState<{ transfers: StockTransfer[]; total: number; totalPages: number; currentPage: number }>({ transfers: [], total: 0, totalPages: 0, currentPage: 1 });
    const [branches, setBranches] = useState<Branch[]>([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<StockTransferDetail | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ status: "ALL" });
    const [sortKey] = useState<string>("");
    const [sortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();
    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);

    // Create form (React Hook Form + Zod)
    const form = useForm<CreateStockTransferInput>({
        resolver: zodResolver(createStockTransferSchema),
        defaultValues: { fromBranchId: "", toBranchId: "", notes: "", items: [] },
    });
    const cartItems = form.watch("items");
    const [productOptions, setProductOptions] = useState<Array<{ id: string; name: string; code: string; stock: number; unit: string }>>([]);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [newQty, setNewQty] = useState(1);

    // Reject state
    const [rejectReason, setRejectReason] = useState("");
    const [rejectId, setRejectId] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [confirmRequiredAction, setConfirmRequiredAction] = useState<null | "approve" | "receive">(null);
    const { canAction, cannotMessage } = useMenuActionAccess("stock-transfers");
    const canCreate = canAction("create");
    const canApprove = canAction("approve");
    const canReceive = canAction("receive");

    const activeBranches = branches.filter((b) => b.isActive);

    const stats = useMemo(() => {
        const pending = data.transfers.filter((t) => t.status === "PENDING").length;
        const approved = data.transfers.filter((t) => t.status === "APPROVED").length;
        const inTransit = data.transfers.filter((t) => t.status === "IN_TRANSIT").length;
        const received = data.transfers.filter((t) => t.status === "RECEIVED").length;
        return { pending, approved, inTransit, received };
    }, [data.transfers]);

    function fetchData(params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(f.status !== "ALL" ? { status: f.status } : {}),
                ...(f.date_from ? { dateFrom: f.date_from } : {}),
                ...(f.date_to ? { dateTo: f.date_to } : {}),
                ...(sk ? { sortBy: sk, sortDir: sd } : {}),
                ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
            };
            const result = await getStockTransfers(query);
            setData(result);
        });
    }

    useEffect(() => {
        startTransition(async () => {
            const [allBranches, productsData] = await Promise.all([
                getAllBranches(),
                import("@/server/actions/products").then((m) => m.getProducts({ limit: 500 })),
            ]);
            setBranches(allBranches);
            setProductOptions(productsData.products.map((p: Record<string, unknown>) => ({
                id: p.id as string,
                name: p.name as string,
                code: p.code as string,
                stock: (p.stock as number) || 0,
                unit: (p.unit as string) || "PCS",
            })));
        });
    }, []);

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

    const handleViewDetail = async (id: string) => {
        const transfer = await getStockTransferById(id);
        setSelectedTransfer(transfer);
        setDetailOpen(true);
    };

    const addCartItem = () => {
        if (!selectedProductId || newQty < 1) {
            toast.error("Pilih produk dan masukkan jumlah");
            return;
        }
        const product = productOptions.find((p) => p.id === selectedProductId);
        if (!product) return;
        const currentItems = form.getValues("items");
        const existing = currentItems.find((item) => item.productId === selectedProductId);
        if (existing) {
            form.setValue("items", currentItems.map((item) =>
                item.productId === selectedProductId
                    ? { ...item, quantity: item.quantity + newQty }
                    : item
            ), { shouldValidate: true });
        } else {
            form.setValue("items", [...currentItems, {
                productId: product.id,
                productName: product.name,
                quantity: newQty,
            }], { shouldValidate: true });
        }
        setSelectedProductId("");
        setNewQty(1);
    };

    const removeCartItem = (index: number) => {
        const currentItems = form.getValues("items");
        form.setValue("items", currentItems.filter((_, i) => i !== index), { shouldValidate: true });
    };

    const handleCreate = form.handleSubmit(async (data) => {
        if (!canCreate) { toast.error(cannotMessage("create")); return; }

        const payload = {
            fromBranchId: data.fromBranchId,
            toBranchId: data.toBranchId,
            items: data.items,
            ...(data.notes ? { notes: data.notes } : {}),
        };

        const result = await createStockTransfer(payload);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Transfer stok berhasil dibuat");
            setCreateOpen(false);
            form.reset();
            fetchData({});
        }
    });

    const handleApprove = async (id: string) => {
        if (!canApprove) { toast.error(cannotMessage("approve")); return; }
        setConfirmRequiredAction("approve");
        setConfirmText("Yakin ingin menyetujui transfer ini?");
        setPendingConfirmAction(() => async () => {
            const result = await approveStockTransfer(id);
            if (result.error) toast.error(result.error);
            else { toast.success("Transfer disetujui"); setDetailOpen(false); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
            setConfirmRequiredAction(null);
        });
        setConfirmOpen(true);
    };

    const handleReceive = async (id: string) => {
        if (!canReceive) { toast.error(cannotMessage("receive")); return; }
        setConfirmRequiredAction("receive");
        setConfirmText("Yakin ingin menerima transfer ini? Stok akan diperbarui.");
        setPendingConfirmAction(() => async () => {
            const result = await receiveStockTransfer(id);
            if (result.error) toast.error(result.error);
            else { toast.success("Transfer diterima. Stok telah diperbarui."); setDetailOpen(false); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
            setConfirmRequiredAction(null);
        });
        setConfirmOpen(true);
    };

    const openRejectDialog = (id: string) => {
        if (!canApprove) { toast.error(cannotMessage("approve")); return; }
        setRejectId(id);
        setRejectReason("");
        setRejectOpen(true);
    };

    const handleReject = async () => {
        if (!canApprove) { toast.error(cannotMessage("approve")); return; }
        const result = await rejectStockTransfer(rejectId, rejectReason || undefined);
        if (result.error) toast.error(result.error);
        else { toast.success("Transfer ditolak"); setRejectOpen(false); setDetailOpen(false); fetchData({}); }
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setPage(1);
        fetchData({ search: value, page: 1 });
    };

    const handleStatusPill = (status: string) => {
        const newFilters = { ...activeFilters, status };
        setActiveFilters(newFilters);
        setPage(1);
        fetchData({ filters: newFilters, page: 1 });
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-200">
                        <ArrowRightLeft className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Transfer Stok</h1>
                        <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-2">
                            Kelola transfer stok antar cabang
                            <Badge variant="secondary" className="text-xs font-normal">{data.total} transfer</Badge>
                        </p>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                    <Button disabled={!canCreate} className="w-full sm:w-auto text-xs sm:text-sm rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 shadow-lg shadow-purple-200/50 text-white" onClick={() => setCreateOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Buat Transfer
                    </Button>
                </DisabledActionTooltip>
                <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) form.reset(); }}>
                    <DialogContent className="rounded-xl sm:rounded-2xl w-[95vw] max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 rounded-t-2xl -mt-6 mb-2" />
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold">Buat Transfer Stok</DialogTitle>
                        </DialogHeader>

                        <DialogBody className={`space-y-5 overflow-x-hidden ${!canCreate ? "pointer-events-none opacity-70" : ""}`}>
                            {/* From / To branch selectors — inline */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 space-y-2">
                                    <Label className="text-sm font-medium">Cabang Asal</Label>
                                    <Controller name="fromBranchId" control={form.control} render={({ field }) => (
                                        <SmartSelect value={field.value} onChange={field.onChange} placeholder="Pilih cabang asal"
                                            onSearch={async (query) => activeBranches.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())).map((b) => ({ value: b.id, label: b.name }))} />
                                    )} />
                                    {form.formState.errors.fromBranchId && <p className="text-xs text-red-500">{form.formState.errors.fromBranchId.message}</p>}
                                </div>
                                <ArrowRight className="w-5 h-5 text-purple-400 shrink-0 mt-6" />
                                <div className="flex-1 space-y-2">
                                    <Label className="text-sm font-medium">Cabang Tujuan</Label>
                                    <Controller name="toBranchId" control={form.control} render={({ field }) => (
                                        <SmartSelect value={field.value} onChange={field.onChange} placeholder="Pilih cabang tujuan"
                                            onSearch={async (query) => activeBranches.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())).map((b) => ({ value: b.id, label: b.name }))} />
                                    )} />
                                    {form.formState.errors.toBranchId && <p className="text-xs text-red-500">{form.formState.errors.toBranchId.message}</p>}
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Catatan (opsional)</Label>
                                <Textarea {...form.register("notes")} className="rounded-xl resize-none min-h-[60px]" placeholder="Catatan transfer..." />
                            </div>

                            {/* Add item form — sticky below DialogHeader */}
                            <div className="sticky top-0 z-10 py-3 bg-white/95 backdrop-blur-sm border-y border-slate-200/60">
                                <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-purple-600" />
                                        <Label className="font-semibold text-sm">Tambah Produk</Label>
                                    </div>
                                    <div className="grid grid-cols-12 gap-2 items-end">
                                        <div className="col-span-7">
                                            <SmartSelect value={selectedProductId} onChange={setSelectedProductId} placeholder="Pilih produk"
                                                onSearch={async (query) => productOptions.filter((p) => { if (!query) return true; const q = query.toLowerCase(); return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q); }).map((p) => ({ value: p.id, label: p.name, description: `${p.code} • Stok ${p.stock} ${p.unit}` }))} />
                                        </div>
                                        <div className="col-span-3">
                                            <Input type="number" value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} className="rounded-xl" min={1} placeholder="Qty" />
                                        </div>
                                        <div className="col-span-2">
                                            <Button onClick={addCartItem} className="rounded-xl w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white" size="sm">
                                                <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Item list */}
                            {cartItems.length > 0 ? (
                                <div className="space-y-2">
                                    {cartItems.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-4 py-3 group hover:shadow-sm transition-shadow">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center text-purple-600 font-bold text-xs border border-purple-200/50">
                                                    {item.productName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{item.productName}</p>
                                                    {item.productId && <p className="text-[10px] text-muted-foreground font-mono">{item.productId.slice(0, 8)}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge className="bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 border border-purple-200 px-3">
                                                    Qty: {item.quantity}
                                                </Badge>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition-all" onClick={() => removeCartItem(i)}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100 flex items-center justify-center mb-3">
                                        <Package className="w-4 h-4 sm:w-6 sm:h-6 text-slate-400" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">Belum ada item ditambahkan</p>
                                    <p className="text-xs text-muted-foreground/70">Pilih produk di atas untuk menambahkan</p>
                                </div>
                            )}
                            {form.formState.errors.items && <p className="text-xs text-red-500">{form.formState.errors.items.message || form.formState.errors.items.root?.message}</p>}
                        </DialogBody>

                        <DialogFooter>
                            <div className="flex items-center justify-between w-full">
                                {cartItems.length > 0 ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-purple-700">Total:</span>
                                        <Badge className="bg-gradient-to-r from-purple-500 to-violet-600 text-white px-3">
                                            {cartItems.length} produk, {cartItems.reduce((sum, item) => sum + item.quantity, 0)} unit
                                        </Badge>
                                    </div>
                                ) : <div />}
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Batal</Button>
                                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                                        <Button disabled={!canCreate} onClick={handleCreate} className="rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white shadow-lg shadow-purple-200/50">
                                            <ArrowRightLeft className="w-4 h-4 mr-2" />
                                            Buat Transfer
                                        </Button>
                                    </DisabledActionTooltip>
                                </div>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats Bar */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 px-2.5 sm:px-4 py-1.5 sm:py-2">
                    <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />
                    <span className="text-[11px] sm:text-xs font-semibold text-amber-700">{stats.pending}</span>
                    <span className="text-[11px] sm:text-xs text-amber-600">Menunggu</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 px-2.5 sm:px-4 py-1.5 sm:py-2">
                    <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600" />
                    <span className="text-[11px] sm:text-xs font-semibold text-blue-700">{stats.approved}</span>
                    <span className="text-[11px] sm:text-xs text-blue-600">Disetujui</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 px-2.5 sm:px-4 py-1.5 sm:py-2">
                    <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-600" />
                    <span className="text-[11px] sm:text-xs font-semibold text-purple-700">{stats.inTransit}</span>
                    <span className="text-[11px] sm:text-xs text-purple-600">Dalam Perjalanan</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 px-2.5 sm:px-4 py-1.5 sm:py-2">
                    <PackageOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />
                    <span className="text-[11px] sm:text-xs font-semibold text-emerald-700">{stats.received}</span>
                    <span className="text-[11px] sm:text-xs text-emerald-600">Diterima</span>
                </div>
            </div>

            {/* Search Bar + Status Filter Pills */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <div className="relative flex-1 sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="Cari nomor transfer, cabang..."
                            className="pl-9 rounded-xl h-9 sm:h-10 text-sm"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap overflow-x-auto scrollbar-hide">
                    {STATUS_PILLS.map((pill) => (
                        <button
                            key={pill.value}
                            onClick={() => handleStatusPill(pill.value)}
                            className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${activeFilters.status === pill.value
                                ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-md shadow-purple-200/50"
                                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                                }`}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Transfer Card List */}
            <div className="space-y-3">
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                        <span className="ml-2 text-sm text-muted-foreground">Memuat data...</span>
                    </div>
                )}

                {!loading && data.transfers.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center">
                        <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center mb-4">
                            <ArrowRightLeft className="w-5 h-5 sm:w-8 sm:h-8 text-purple-400" />
                        </div>
                        <h3 className="text-sm sm:text-lg font-semibold text-foreground mb-1">Belum ada transfer stok</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
                            Tidak ada data transfer yang ditemukan. Buat transfer baru untuk memulai.
                        </p>
                    </div>
                )}

                {!loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                        {data.transfers.map((row) => {
                            const cfg = statusConfig[row.status] || { label: row.status, color: "bg-slate-100 text-slate-700", icon: Clock, borderColor: "border-l-slate-400", gradientBg: "from-slate-400 to-gray-500" };
                            const IconComp = cfg.icon;

                            return (
                                <div
                                    key={row.id}
                                    className={`group relative bg-white rounded-xl border border-slate-200/60 border-l-4 ${cfg.borderColor} shadow-sm hover:shadow-md transition-all duration-200`}
                                >
                                    {/* Status badge — absolute top right */}
                                    <Badge className={`${cfg.color} gap-1.5 rounded-bl-xl rounded-tr-xl rounded-tl-none rounded-br-none px-3 py-1 text-[11px] font-medium shadow-none absolute top-0 right-0 z-[1]`}>
                                        <IconComp className="w-3 h-3" />
                                        {cfg.label}
                                    </Badge>

                                    <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
                                        {/* Left: Icon */}
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.gradientBg} flex items-center justify-center shadow-sm shrink-0`}>
                                            <ArrowRightLeft className="w-4.5 h-4.5 text-white" />
                                        </div>

                                        {/* Middle: Content */}
                                        <div className="flex-1 min-w-0 space-y-1.5">
                                            <span className="font-mono text-sm font-bold text-foreground">{row.transferNumber}</span>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <MapPin className="w-3 h-3 shrink-0 text-violet-500" />
                                                <span className="font-medium text-foreground truncate">{row.fromBranch.name}</span>
                                                <ArrowRight className="w-3 h-3 shrink-0 text-purple-400" />
                                                <span className="font-medium text-foreground truncate">{row.toBranch.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                    <CalendarDays className="w-3 h-3" />
                                                    {format(new Date(row.requestedAt), "dd MMM yy", { locale: idLocale })}
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                                    <Package className="w-3 h-3 text-slate-400" />
                                                    {row._count.items} item
                                                </span>
                                            </div>
                                        </div>

                                        {/* Right: Action buttons */}
                                        <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-purple-50 hover:text-purple-600 transition-colors" onClick={() => handleViewDetail(row.id)}>
                                                <Eye className="w-3.5 h-3.5" />
                                            </Button>
                                            {row.status === "PENDING" && (
                                                <>
                                                    <DisabledActionTooltip disabled={!canApprove} message={cannotMessage("approve")}>
                                                        <Button disabled={!canApprove} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" onClick={() => handleApprove(row.id)}>
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </DisabledActionTooltip>
                                                    <DisabledActionTooltip disabled={!canApprove} message={cannotMessage("approve")}>
                                                        <Button disabled={!canApprove} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" onClick={() => openRejectDialog(row.id)}>
                                                            <XCircle className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </DisabledActionTooltip>
                                                </>
                                            )}
                                            {row.status === "APPROVED" && (
                                                <DisabledActionTooltip disabled={!canReceive} message={cannotMessage("receive")}>
                                                    <Button disabled={!canReceive} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors" onClick={() => handleReceive(row.id)}>
                                                        <PackageCheck className="w-3.5 h-3.5" />
                                                    </Button>
                                                </DisabledActionTooltip>
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

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="rounded-xl sm:rounded-2xl max-w-lg p-0 overflow-hidden">
                    {/* Gradient accent line */}
                    <div className="h-1.5 bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500" />
                    <div className="p-6">
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold">Detail Transfer</span>
                                    {selectedTransfer && (
                                        <span className="inline-flex items-center font-mono text-xs font-semibold bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-lg">
                                            {selectedTransfer.transferNumber}
                                        </span>
                                    )}
                                </div>
                                {selectedTransfer && (() => {
                                    const cfg = statusConfig[selectedTransfer.status] || { label: selectedTransfer.status, color: "bg-slate-100 text-slate-700", icon: Clock, borderColor: "", gradientBg: "" };
                                    const IconComp = cfg.icon;
                                    return (
                                        <Badge className={`${cfg.color} gap-1.5 px-2.5 py-1`}>
                                            <IconComp className="w-3.5 h-3.5" />
                                            {cfg.label}
                                        </Badge>
                                    );
                                })()}
                            </DialogTitle>
                        </DialogHeader>
                        {selectedTransfer && (
                            <div className="space-y-5 mt-4">
                                {/* From → To route card */}
                                <div className="rounded-xl bg-gradient-to-r from-purple-50/50 via-violet-50/30 to-indigo-50/50 border border-purple-100 p-4">
                                    <div className="flex items-center justify-center gap-4">
                                        <div className="text-center">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center text-violet-600 font-bold text-sm mx-auto border border-violet-200/50 mb-1.5">
                                                {selectedTransfer.fromBranch.name.charAt(0)}
                                            </div>
                                            <p className="text-xs text-muted-foreground">Dari</p>
                                            <p className="text-sm font-semibold">{selectedTransfer.fromBranch.name}</p>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-md">
                                            <ArrowRight className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="text-center">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-indigo-600 font-bold text-sm mx-auto border border-indigo-200/50 mb-1.5">
                                                {selectedTransfer.toBranch.name.charAt(0)}
                                            </div>
                                            <p className="text-xs text-muted-foreground">Ke</p>
                                            <p className="text-sm font-semibold">{selectedTransfer.toBranch.name}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Info grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-sm">
                                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                        <p className="text-xs text-muted-foreground mb-1">Tanggal Request</p>
                                        <p className="font-medium">{format(new Date(selectedTransfer.requestedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                        <p className="text-xs text-muted-foreground mb-1">Catatan</p>
                                        <p className="font-medium">{selectedTransfer.notes || "-"}</p>
                                    </div>
                                    {selectedTransfer.approvedAt && (
                                        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
                                            <p className="text-xs text-blue-600 mb-1">Tanggal Approve</p>
                                            <p className="font-medium text-blue-700">{format(new Date(selectedTransfer.approvedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}</p>
                                        </div>
                                    )}
                                    {selectedTransfer.receivedAt && (
                                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                                            <p className="text-xs text-emerald-600 mb-1">Tanggal Diterima</p>
                                            <p className="font-medium text-emerald-700">{format(new Date(selectedTransfer.receivedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Items list */}
                                <div className="border rounded-xl overflow-hidden overflow-x-auto">
                                    <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-b border-purple-100 px-4 py-2.5 flex items-center gap-2">
                                        <Package className="w-4 h-4 text-purple-600" />
                                        <span className="text-sm font-semibold text-purple-700">Item Transfer ({selectedTransfer.items.length})</span>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Produk</TableHead>
                                                <TableHead className="text-center">Qty</TableHead>
                                                <TableHead className="text-center hidden sm:table-cell">Diterima</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedTransfer.items.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center text-purple-600 font-bold text-[10px] border border-purple-200/50">
                                                                {item.productName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="text-sm font-medium">{item.productName}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="secondary" className="rounded-lg font-semibold">{item.quantity}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center hidden sm:table-cell">
                                                        <Badge className={`rounded-lg font-semibold ${item.receivedQty >= item.quantity
                                                            ? "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200"
                                                            : "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border border-amber-200"
                                                            }`}>
                                                            {item.receivedQty}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Action buttons */}
                                <div className="flex justify-end gap-2 pt-1">
                                    <Button variant="outline" onClick={() => setDetailOpen(false)} className="rounded-xl">Tutup</Button>
                                    {selectedTransfer.status === "PENDING" && (
                                        <>
                                            <DisabledActionTooltip disabled={!canApprove} message={cannotMessage("approve")}>
                                                <Button disabled={!canApprove} variant="destructive" onClick={() => { setDetailOpen(false); openRejectDialog(selectedTransfer.id); }} className="rounded-xl">
                                                    <XCircle className="w-4 h-4 mr-2" />
                                                    Tolak
                                                </Button>
                                            </DisabledActionTooltip>
                                            <DisabledActionTooltip disabled={!canApprove} message={cannotMessage("approve")}>
                                                <Button disabled={!canApprove} onClick={() => handleApprove(selectedTransfer.id)} className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-200/50">
                                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                                    Setujui
                                                </Button>
                                            </DisabledActionTooltip>
                                        </>
                                    )}
                                    {selectedTransfer.status === "APPROVED" && (
                                        <DisabledActionTooltip disabled={!canReceive} message={cannotMessage("receive")}>
                                            <Button disabled={!canReceive} onClick={() => handleReceive(selectedTransfer.id)} className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-200/50">
                                                <PackageCheck className="w-4 h-4 mr-2" />
                                                Terima Barang
                                            </Button>
                                        </DisabledActionTooltip>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent className="rounded-xl sm:rounded-2xl p-0 overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-pink-500" />
                    <div className="p-6">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center">
                                    <XCircle className="w-4 h-4 text-red-600" />
                                </div>
                                Tolak Transfer
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Alasan Penolakan (opsional)</Label>
                                <Textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    className="rounded-xl resize-none min-h-[80px]"
                                    placeholder="Masukkan alasan penolakan..."
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setRejectOpen(false)} className="rounded-xl">Batal</Button>
                                <DisabledActionTooltip disabled={!canApprove} message={cannotMessage("approve")}>
                                    <Button disabled={!canApprove} variant="destructive" onClick={handleReject} className="rounded-xl">
                                        <Ban className="w-4 h-4 mr-2" />
                                        Tolak Transfer
                                    </Button>
                                </DisabledActionTooltip>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirm Dialog */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-xl sm:rounded-2xl max-w-sm p-0 overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
                    <div className="p-6">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                                </div>
                                Konfirmasi
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground mt-3">{confirmText}</p>
                        <div className="flex justify-end gap-2 mt-5">
                            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-xl">Batal</Button>
                            <DisabledActionTooltip
                                disabled={confirmRequiredAction === "approve" ? !canApprove : confirmRequiredAction === "receive" ? !canReceive : false}
                                message={cannotMessage(confirmRequiredAction === "approve" ? "approve" : "receive")}
                            >
                                <Button
                                    disabled={confirmRequiredAction === "approve" ? !canApprove : confirmRequiredAction === "receive" ? !canReceive : false}
                                    variant="destructive"
                                    onClick={async () => { await pendingConfirmAction?.(); }}
                                    className="rounded-xl"
                                >
                                    Ya, Lanjutkan
                                </Button>
                            </DisabledActionTooltip>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
