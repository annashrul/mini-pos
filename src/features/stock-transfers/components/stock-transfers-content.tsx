"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
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
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { ProductPicker } from "@/components/ui/product-picker";
import { ExportMenu } from "@/components/ui/export-menu";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
    Plus, Eye, ArrowRightLeft, ArrowRight,
    CheckCircle2, XCircle, PackageCheck,
    Clock, ShieldCheck, Truck, PackageOpen, Ban, Package,
    Search, Loader2, CalendarDays, MapPin, SlidersHorizontal, Check, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { StockTransfer, Branch, StockTransferDetail } from "@/types";
import { useBranch } from "@/components/providers/branch-provider";
import { PaginationControl } from "@/components/ui/pagination-control";
import { TransferImportDialog } from "./transfer-import-dialog";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType; borderColor: string; gradientBg: string }> = {
    PENDING: { label: "Menunggu", color: "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border border-amber-200", icon: Clock, borderColor: "border-l-amber-400", gradientBg: "from-amber-400 to-yellow-500" },
    APPROVED: { label: "Disetujui", color: "bg-gradient-to-r from-blue-100 to-sky-100 text-blue-700 border border-blue-200", icon: ShieldCheck, borderColor: "border-l-blue-400", gradientBg: "from-blue-400 to-sky-500" },
    IN_TRANSIT: { label: "Dalam Perjalanan", color: "bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 border border-purple-200", icon: Truck, borderColor: "border-l-purple-400", gradientBg: "from-purple-400 to-violet-500" },
    RECEIVED: { label: "Diterima", color: "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200", icon: PackageOpen, borderColor: "border-l-green-400", gradientBg: "from-emerald-400 to-green-500" },
    REJECTED: { label: "Ditolak", color: "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200", icon: Ban, borderColor: "border-l-red-400", gradientBg: "from-red-400 to-rose-500" },
};

const STATUS_PILLS = [
    { value: "ALL", label: "Semua" },
    { value: "PENDING", label: "Menunggu" },
    { value: "APPROVED", label: "Disetujui" },
    { value: "RECEIVED", label: "Diterima" },
    { value: "REJECTED", label: "Ditolak" },
];

export function StockTransfersContent() {
    const [data, setData] = useState<{ transfers: StockTransfer[]; total: number; totalPages: number; currentPage: number }>({ transfers: [], total: 0, totalPages: 0, currentPage: 1 });
    const [branches, setBranches] = useState<Branch[]>([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
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

    // Reject state
    const [rejectReason, setRejectReason] = useState("");
    const [rejectId, setRejectId] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [confirmKind, setConfirmKind] = useState<"approve" | "custom">("custom");
    const { canAction, cannotMessage } = useMenuActionAccess("stock-transfers");
    const { canAction: canPlan } = usePlanAccess();
    const canCreate = canAction("create") && canPlan("stock-transfers", "create");
    const canApprove = canAction("approve") && canPlan("stock-transfers", "approve");
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
            const allBranches = await getAllBranches();
            setBranches(allBranches);
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


    const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);

    const handleCreate = form.handleSubmit(() => {
        if (!canCreate) { toast.error(cannotMessage("create")); return; }
        setTransferConfirmOpen(true);
    });

    const executeCreateTransfer = async () => {
        const data = form.getValues();
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
        setTransferConfirmOpen(false);
    };

    const handleApprove = async (id: string) => {
        if (!canApprove) { toast.error(cannotMessage("approve")); return; }
        setConfirmKind("approve");
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
        if (!canReceive) { toast.error(cannotMessage("receive")); return; }
        setConfirmKind("approve");
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
        if (!canApprove) { toast.error(cannotMessage("approve")); return; }
        setRejectId(id);
        setRejectReason("");
        setRejectOpen(true);
    };

    const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);

    const handleReject = () => {
        if (!canApprove) { toast.error(cannotMessage("approve")); return; }
        setRejectConfirmOpen(true);
    };

    const executeReject = async () => {
        const result = await rejectStockTransfer(rejectId, rejectReason || undefined);
        if (result.error) { toast.error(result.error); }
        else { toast.success("Transfer ditolak"); setRejectOpen(false); setDetailOpen(false); fetchData({}); }
        setRejectConfirmOpen(false);
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
                <div className="hidden sm:flex items-center gap-2">
                    <ExportMenu module="stock-transfers" branchId={selectedBranchId || undefined} filters={activeFilters} />
                    <Button variant="outline" className="rounded-xl border-dashed" onClick={() => setImportOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" /> Import
                    </Button>
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="stock-transfers" actionKey="create">
                        <Button disabled={!canCreate} className="text-sm rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 shadow-lg shadow-purple-200/50 text-white" onClick={() => setCreateOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Buat Transfer
                        </Button>
                    </DisabledActionTooltip>
                </div>
                {canCreate && (
                    <div className="sm:hidden fixed bottom-4 right-4 z-50">
                        <Button onClick={() => setCreateOpen(true)} size="icon" className="h-12 w-12 rounded-full shadow-xl shadow-purple-300/50 bg-gradient-to-br from-purple-500 to-violet-600">
                            <Plus className="w-5 h-5" />
                        </Button>
                    </div>
                )}
                <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) form.reset(); }}>
                    <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl rounded-xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
                        <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 rounded-t-xl sm:rounded-t-2xl shrink-0" />
                        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 shrink-0">
                            <DialogTitle className="text-base sm:text-lg font-bold">Buat Transfer Stok</DialogTitle>
                        </DialogHeader>

                        <DialogBody className={`space-y-3 sm:space-y-5 overflow-x-hidden px-4 sm:px-6 ${!canCreate ? "pointer-events-none opacity-70" : ""}`}>
                            {/* From / To branch selectors — inline on sm, stacked on mobile */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs sm:text-sm font-medium">Cabang Asal <span className="text-red-400">*</span></Label>
                                    <Controller name="fromBranchId" control={form.control} render={({ field }) => (
                                        <SmartSelect value={field.value} onChange={(v) => { field.onChange(v); form.setValue("items", []); }} placeholder="Pilih cabang asal"
                                            onSearch={async (query) => activeBranches.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())).map((b) => ({ value: b.id, label: b.name }))} />
                                    )} />
                                    {form.formState.errors.fromBranchId && <p className="text-xs text-red-500">{form.formState.errors.fromBranchId.message}</p>}
                                </div>
                                <ArrowRight className="w-5 h-5 text-purple-400 shrink-0 hidden sm:block mt-6" />
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs sm:text-sm font-medium">Cabang Tujuan <span className="text-red-400">*</span></Label>
                                    <Controller name="toBranchId" control={form.control} render={({ field }) => (
                                        <SmartSelect value={field.value} onChange={field.onChange} placeholder="Pilih cabang tujuan"
                                            onSearch={async (query) => activeBranches.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())).map((b) => ({ value: b.id, label: b.name }))} />
                                    )} />
                                    {form.formState.errors.toBranchId && <p className="text-xs text-red-500">{form.formState.errors.toBranchId.message}</p>}
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <Label className="text-xs sm:text-sm font-medium">Catatan (opsional)</Label>
                                <Textarea {...form.register("notes")} className="rounded-xl resize-none min-h-[60px]" placeholder="Catatan transfer..." />
                            </div>

                            {/* Product items */}
                            {form.formState.errors.items && <p className="text-xs text-red-500">{form.formState.errors.items.message || form.formState.errors.items.root?.message}</p>}
                            <ProductPicker
                                stickySearch
                                items={cartItems.map((item) => ({
                                    productId: item.productId,
                                    productName: item.productName,
                                    productCode: "",
                                    productPrice: 0,
                                    quantity: item.quantity,
                                }))}
                                onChange={(pickerItems) => {
                                    form.setValue("items", pickerItems.map((pi) => ({
                                        productId: pi.productId,
                                        productName: pi.productName,
                                        quantity: pi.quantity,
                                    })), { shouldValidate: true });
                                }}
                                branchId={form.watch("fromBranchId") || undefined}
                                label="Item Transfer"
                                required
                                showPrice={false}
                                showSubtotal={false}
                                emptyText="Pilih cabang asal lalu tambahkan produk"
                            />
                        </DialogBody>

                        <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6 shrink-0">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-2">
                                {cartItems.length > 0 ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs sm:text-sm font-medium text-purple-700">Total:</span>
                                        <Badge className="bg-gradient-to-r from-purple-500 to-violet-600 text-white px-3">
                                            {cartItems.length} produk, {cartItems.reduce((sum, item) => sum + item.quantity, 0)} unit
                                        </Badge>
                                    </div>
                                ) : <div />}
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Batal</Button>
                                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="stock-transfers" actionKey="create">
                                        <Button disabled={!canCreate || form.formState.isSubmitting} onClick={handleCreate} className="rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white shadow-lg shadow-purple-200/50">
                                            {form.formState.isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                                            {form.formState.isSubmitting ? "Menyimpan..." : "Buat Transfer"}
                                        </Button>
                                    </DisabledActionTooltip>
                                </div>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Mobile: search + filter + stats */}
            <div className="sm:hidden space-y-2">
                <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Cari transfer..." className="pl-9 rounded-xl h-9 text-sm" />
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 rounded-xl h-9 gap-1.5 relative" onClick={() => setFilterSheetOpen(true)}>
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span className="text-xs">Filter</span>
                        {activeFilters.status !== "ALL" && <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-purple-500" />}
                    </Button>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                    <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 ring-1 ring-amber-100 px-2 py-1 shrink-0">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span className="text-[11px] font-semibold text-amber-700">{stats.pending}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 ring-1 ring-blue-100 px-2 py-1 shrink-0">
                        <ShieldCheck className="w-3 h-3 text-blue-600" />
                        <span className="text-[11px] font-semibold text-blue-700">{stats.approved}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-purple-50 ring-1 ring-purple-100 px-2 py-1 shrink-0">
                        <Truck className="w-3 h-3 text-purple-600" />
                        <span className="text-[11px] font-semibold text-purple-700">{stats.inTransit}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 ring-1 ring-emerald-100 px-2 py-1 shrink-0">
                        <PackageOpen className="w-3 h-3 text-emerald-600" />
                        <span className="text-[11px] font-semibold text-emerald-700">{stats.received}</span>
                    </div>
                </div>
                <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                    <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                        <div className="shrink-0">
                            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-muted-foreground/20" /></div>
                            <SheetHeader className="px-4 pb-3 pt-0"><SheetTitle className="text-base font-bold">Filter Status</SheetTitle></SheetHeader>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                            {STATUS_PILLS.map((pill) => {
                                const isActive = activeFilters.status === pill.value;
                                return (
                                    <button key={pill.value} onClick={() => { handleStatusPill(pill.value); setFilterSheetOpen(false); }}
                                        className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                            isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted")}>
                                        <span>{pill.label}</span>
                                        {isActive && <Check className="w-4 h-4" />}
                                    </button>
                                );
                            })}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop: search + stats + filter */}
            <div className="hidden sm:flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Cari nomor transfer, cabang..." className="pl-9 rounded-xl h-10 text-sm" />
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span className="text-[11px] font-semibold text-amber-700">{stats.pending}</span>
                        <span className="text-[11px] text-amber-600">Menunggu</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5">
                        <ShieldCheck className="w-3 h-3 text-blue-600" />
                        <span className="text-[11px] font-semibold text-blue-700">{stats.approved}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-3 py-1.5">
                        <Truck className="w-3 h-3 text-purple-600" />
                        <span className="text-[11px] font-semibold text-purple-700">{stats.inTransit}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                        <PackageOpen className="w-3 h-3 text-emerald-600" />
                        <span className="text-[11px] font-semibold text-emerald-700">{stats.received}</span>
                    </div>
                </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                {STATUS_PILLS.map((pill) => (
                    <button key={pill.value} onClick={() => handleStatusPill(pill.value)}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${activeFilters.status === pill.value
                            ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-md shadow-purple-200/50"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                        {pill.label}
                    </button>
                ))}
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
                                    <div className="p-3 sm:p-4">
                                        {/* Mobile: stacked */}
                                        <div className="sm:hidden space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-xs font-bold text-foreground">{row.transferNumber}</span>
                                                <Badge className={`${cfg.color} gap-1 px-2 py-0.5 text-[10px] font-medium shadow-none`}>
                                                    <IconComp className="w-2.5 h-2.5" />{cfg.label}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                <span className="font-medium text-foreground truncate">{row.fromBranch.name}</span>
                                                <ArrowRight className="w-3 h-3 shrink-0 text-purple-400" />
                                                <span className="font-medium text-foreground truncate">{row.toBranch.name}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                    <span>{format(new Date(row.requestedAt), "dd MMM yy", { locale: idLocale })}</span>
                                                    <span>{row._count.items} item</span>
                                                </div>
                                                <Button variant="ghost" size="xs" className="rounded-lg hover:bg-purple-50 hover:text-purple-600" onClick={() => handleViewDetail(row.id)}>
                                                    <Eye className="w-3 h-3 mr-1" /> Detail
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Desktop: horizontal */}
                                        <div className="hidden sm:flex items-center gap-3">
                                            <Badge className={`${cfg.color} gap-1.5 rounded-bl-xl rounded-tr-xl rounded-tl-none rounded-br-none px-3 py-1 text-[11px] font-medium shadow-none absolute top-0 right-0 z-[1]`}>
                                                <IconComp className="w-3 h-3" />{cfg.label}
                                            </Badge>
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.gradientBg} flex items-center justify-center shadow-sm shrink-0`}>
                                                <ArrowRightLeft className="w-4.5 h-4.5 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-1.5">
                                                <span className="font-mono text-sm font-bold text-foreground">{row.transferNumber}</span>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <MapPin className="w-3 h-3 shrink-0 text-violet-500" />
                                                    <span className="font-medium text-foreground truncate">{row.fromBranch.name}</span>
                                                    <ArrowRight className="w-3 h-3 shrink-0 text-purple-400" />
                                                    <span className="font-medium text-foreground truncate">{row.toBranch.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="w-3 h-3" />{format(new Date(row.requestedAt), "dd MMM yy", { locale: idLocale })}</span>
                                                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"><Package className="w-3 h-3 text-slate-400" />{row._count.items} item</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                                                <Button variant="ghost" size="icon-sm" className="rounded-lg hover:bg-purple-50 hover:text-purple-600" onClick={() => handleViewDetail(row.id)}>
                                                    <Eye className="w-3.5 h-3.5" />
                                                </Button>
                                                {row.status === "PENDING" && (
                                                    <>
                                                        <Button disabled={!canApprove} variant="ghost" size="icon-sm" className="rounded-lg text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleApprove(row.id)}>
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button disabled={!canApprove} variant="ghost" size="icon-sm" className="rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => openRejectDialog(row.id)}>
                                                            <XCircle className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </>
                                                )}
                                                {row.status === "APPROVED" && (
                                                    <Button disabled={!canReceive} variant="ghost" size="icon-sm" className="rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleReceive(row.id)}>
                                                        <PackageCheck className="w-3.5 h-3.5" />
                                                    </Button>
                                                )}
                                            </div>
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
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-xl sm:rounded-2xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 shrink-0" />
                    <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 shrink-0">
                        <DialogTitle className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm sm:text-lg font-bold">Detail Transfer</span>
                                {selectedTransfer && (
                                    <span className="font-mono text-[10px] sm:text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg truncate">
                                        {selectedTransfer.transferNumber}
                                    </span>
                                )}
                            </div>
                            {selectedTransfer && (() => {
                                const cfg = statusConfig[selectedTransfer.status] || { label: selectedTransfer.status, color: "bg-slate-100 text-slate-700", icon: Clock, borderColor: "", gradientBg: "" };
                                const SIcon = cfg.icon;
                                return <Badge className={`${cfg.color} gap-1 px-2 py-0.5 text-[10px] sm:text-xs shrink-0`}><SIcon className="w-3 h-3" />{cfg.label}</Badge>;
                            })()}
                        </DialogTitle>
                    </DialogHeader>

                    <DialogBody className="px-4 sm:px-6">
                        {selectedTransfer && (
                            <div className="space-y-3 sm:space-y-5">
                                {/* Route card */}
                                <div className="rounded-xl bg-gradient-to-r from-purple-50/50 via-violet-50/30 to-indigo-50/50 border border-purple-100 p-3 sm:p-4">
                                    <div className="flex items-center justify-center gap-3 sm:gap-4">
                                        <div className="text-center">
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center text-violet-600 font-bold text-xs sm:text-sm mx-auto border border-violet-200/50 mb-1">
                                                {selectedTransfer.fromBranch.name.charAt(0)}
                                            </div>
                                            <p className="text-[10px] sm:text-xs text-muted-foreground">Dari</p>
                                            <p className="text-xs sm:text-sm font-semibold">{selectedTransfer.fromBranch.name}</p>
                                        </div>
                                        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-md shrink-0">
                                            <ArrowRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                                        </div>
                                        <div className="text-center">
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-indigo-600 font-bold text-xs sm:text-sm mx-auto border border-indigo-200/50 mb-1">
                                                {selectedTransfer.toBranch.name.charAt(0)}
                                            </div>
                                            <p className="text-[10px] sm:text-xs text-muted-foreground">Ke</p>
                                            <p className="text-xs sm:text-sm font-semibold">{selectedTransfer.toBranch.name}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Info pills */}
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1 bg-slate-50 rounded-full px-2 py-1 ring-1 ring-slate-100">
                                        <CalendarDays className="w-3 h-3" /> {format(new Date(selectedTransfer.requestedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}
                                    </span>
                                    {selectedTransfer.approvedAt && (
                                        <span className="inline-flex items-center gap-1 bg-blue-50 rounded-full px-2 py-1 ring-1 ring-blue-100 text-blue-600">
                                            <ShieldCheck className="w-3 h-3" /> {format(new Date(selectedTransfer.approvedAt), "dd MMM yy", { locale: idLocale })}
                                        </span>
                                    )}
                                    {selectedTransfer.receivedAt && (
                                        <span className="inline-flex items-center gap-1 bg-emerald-50 rounded-full px-2 py-1 ring-1 ring-emerald-100 text-emerald-600">
                                            <PackageOpen className="w-3 h-3" /> {format(new Date(selectedTransfer.receivedAt), "dd MMM yy", { locale: idLocale })}
                                        </span>
                                    )}
                                    {selectedTransfer.notes && <span className="text-slate-400 truncate max-w-[200px]">{selectedTransfer.notes}</span>}
                                </div>

                                {/* Items */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Package className="w-3.5 h-3.5 text-purple-600" />
                                        <span className="text-xs sm:text-sm font-semibold text-purple-700">Item ({selectedTransfer.items.length})</span>
                                    </div>
                                    {/* Mobile: card list */}
                                    <div className="sm:hidden space-y-1.5">
                                        {selectedTransfer.items.map((item) => (
                                            <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200/60 px-3 py-2">
                                                <span className="text-xs font-medium truncate flex-1">{item.productName}</span>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge variant="secondary" className="rounded-md text-[10px] font-semibold">{item.quantity}</Badge>
                                                    {item.receivedQty > 0 && (
                                                        <Badge className={`rounded-md text-[10px] font-semibold ${item.receivedQty >= item.quantity ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                                            ✓{item.receivedQty}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Desktop: table */}
                                    <div className="hidden sm:block border rounded-xl overflow-hidden">
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
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center text-purple-600 font-bold text-[10px]">
                                                                    {item.productName.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="text-sm font-medium">{item.productName}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center"><Badge variant="secondary" className="rounded-lg font-semibold">{item.quantity}</Badge></TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge className={`rounded-lg font-semibold ${item.receivedQty >= item.quantity ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>{item.receivedQty}</Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </DialogBody>

                    <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
                        <div className="flex items-center justify-between w-full gap-2">
                            <Button variant="outline" onClick={() => setDetailOpen(false)} className="rounded-xl">Tutup</Button>
                            {selectedTransfer && (
                                <div className="flex items-center gap-1.5">
                                    {selectedTransfer.status === "PENDING" && (
                                        <>
                                            <Button disabled={!canApprove} variant="destructive" onClick={() => { setDetailOpen(false); openRejectDialog(selectedTransfer.id); }} className="rounded-xl">
                                                <XCircle className="w-4 h-4 mr-1.5" /> Tolak
                                            </Button>
                                            <Button disabled={!canApprove} onClick={() => handleApprove(selectedTransfer.id)} className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white">
                                                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Setujui
                                            </Button>
                                        </>
                                    )}
                                    {selectedTransfer.status === "APPROVED" && (
                                        <Button disabled={!canReceive} onClick={() => handleReceive(selectedTransfer.id)} className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                                            <PackageCheck className="w-4 h-4 mr-1.5" /> Terima
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-xl sm:rounded-2xl p-0 gap-0 overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 shrink-0" />
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                        <DialogHeader className="pt-4 sm:pt-6 pb-3">
                            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center shrink-0">
                                    <XCircle className="w-4 h-4 text-red-600" />
                                </div>
                                Tolak Transfer
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 sm:space-y-4 mt-2 sm:mt-4">
                            <div className="space-y-2">
                                <Label className="text-xs sm:text-sm font-medium">Alasan Penolakan (opsional)</Label>
                                <Textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    className="rounded-xl resize-none min-h-[80px]"
                                    placeholder="Masukkan alasan penolakan..."
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setRejectOpen(false)} className="rounded-xl">Batal</Button>
                                <DisabledActionTooltip disabled={!canApprove} message={cannotMessage("approve")} menuKey="stock-transfers" actionKey="approve">
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
            <ActionConfirmDialog
                open={confirmOpen}
                onOpenChange={(v) => { setConfirmOpen(v); if (!v) setPendingConfirmAction(null); }}
                kind={confirmKind}
                description={confirmText}
                confirmLabel="Ya, Lanjutkan"
                onConfirm={async () => { await pendingConfirmAction?.(); }}
                size="sm"
            />
            <ActionConfirmDialog
                open={transferConfirmOpen}
                onOpenChange={setTransferConfirmOpen}
                kind="submit"
                description="Yakin ingin membuat transfer stok ini?"
                onConfirm={executeCreateTransfer}
            />
            <ActionConfirmDialog
                open={rejectConfirmOpen}
                onOpenChange={setRejectConfirmOpen}
                kind="delete"
                title="Konfirmasi Penolakan"
                description="Yakin ingin menolak transfer ini?"
                confirmLabel="Ya, Tolak"
                onConfirm={executeReject}
            />

            <TransferImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => fetchData({})} />
        </div>
    );
}
