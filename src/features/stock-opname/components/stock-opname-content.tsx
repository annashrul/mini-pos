"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    getStockOpnames,
    getStockOpnameById,
    createStockOpnameWithItems,
    getProductsForOpname,
    updateOpnameItems,
    completeStockOpname,
    cancelStockOpname,
} from "@/features/stock-opname";
import { createStockOpnameSchema, type CreateStockOpnameInput } from "@/features/stock-opname/schemas/stock-opname.schema";
import { getAllBranches } from "@/features/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
    Plus, Eye, ClipboardCheck,
    CheckCircle2, XCircle, Save,
    FileEdit, Loader2, Copy,
    Package, TrendingUp, TrendingDown,
    Search, CalendarDays, MapPin,
    SlidersHorizontal, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { StockOpname, StockOpnameDetail } from "@/types";
import { useBranch } from "@/components/providers/branch-provider";
import { PaginationControl } from "@/components/ui/pagination-control";

const statusConfig: Record<string, { label: string; classes: string; icon: React.ReactNode; borderColor: string; gradientBg: string }> = {
    DRAFT: {
        label: "Draft",
        classes: "bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border border-slate-200/60",
        icon: <FileEdit className="w-3 h-3" />,
        borderColor: "border-l-blue-400",
        gradientBg: "from-blue-400 to-blue-500",
    },
    IN_PROGRESS: {
        label: "Berlangsung",
        classes: "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200/60",
        icon: <FileEdit className="w-3 h-3" />,
        borderColor: "border-l-amber-400",
        gradientBg: "from-amber-400 to-amber-500",
    },
    COMPLETED: {
        label: "Selesai",
        classes: "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border border-emerald-200/60",
        icon: <CheckCircle2 className="w-3 h-3" />,
        borderColor: "border-l-emerald-400",
        gradientBg: "from-emerald-400 to-emerald-500",
    },
    CANCELLED: {
        label: "Dibatalkan",
        classes: "bg-gradient-to-r from-red-50 to-red-100 text-red-700 border border-red-200/60",
        icon: <XCircle className="w-3 h-3" />,
        borderColor: "border-l-red-400",
        gradientBg: "from-red-400 to-red-500",
    },
};

type StatusFilterValue = "ALL" | "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

const statusPills: { value: StatusFilterValue; label: string }[] = [
    { value: "ALL", label: "Semua" },
    { value: "DRAFT", label: "Draft" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
];

export function StockOpnameContent() {
    const [data, setData] = useState<{ opnames: StockOpname[]; total: number; totalPages: number; currentPage: number }>({ opnames: [], total: 0, totalPages: 0, currentPage: 1 });
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedOpname, setSelectedOpname] = useState<StockOpnameDetail | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ status: "ALL" });
    const [sortKey] = useState<string>("");
    const [sortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();
    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);

    // Create form
    const createForm = useForm<CreateStockOpnameInput>({
        resolver: zodResolver(createStockOpnameSchema),
        defaultValues: { branchIds: [], notes: "" },
    });
    const [createProducts, setCreateProducts] = useState<Array<{ id: string; name: string; code: string; systemStock: number; actualStock: number }>>([]);
    const [createProductsLoading, setCreateProductsLoading] = useState(false);
    const [createSearch, setCreateSearch] = useState("");
    const [createSubmitting, setCreateSubmitting] = useState(false);

    // Detail edit state
    const [editedItems, setEditedItems] = useState<Record<string, number>>({});
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [confirmKind, setConfirmKind] = useState<"approve" | "delete" | "custom">("custom");
    const { canAction, cannotMessage } = useMenuActionAccess("stock-opname");
    const { canAction: canPlan } = usePlanAccess();
    const canCreate = canAction("create") && canPlan("stock-opname", "create");
    const canUpdate = canAction("update") && canPlan("stock-opname", "update");
    const canApprove = canAction("approve") && canPlan("stock-opname", "approve");

    function fetchData(params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) {
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
    }

    useEffect(() => {
        startTransition(async () => {
            const allBranches = await getAllBranches();
            const activeBranches = allBranches.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name }));
            setBranches(activeBranches);
            createForm.setValue("branchIds", activeBranches.map((b) => b.id));
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
    }, [branchReady, selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const loadCreateProducts = async (branchId?: string) => {
        setCreateProductsLoading(true);
        try {
            const products = await getProductsForOpname(branchId || undefined);
            setCreateProducts(products.map((p) => ({ ...p, actualStock: p.systemStock })));
        } finally {
            setCreateProductsLoading(false);
        }
    };

    const openCreateDialog = () => {
        const bid = selectedBranchId || undefined;
        if (bid) {
            createForm.setValue("branchIds", [bid]);
            loadCreateProducts(bid);
        } else {
            createForm.setValue("branchIds", []);
            setCreateProducts([]);
        }
        setCreateOpen(true);
    };

    const [opnameCreateConfirmOpen, setOpnameCreateConfirmOpen] = useState(false);
    const [opnameSaveConfirmOpen, setOpnameSaveConfirmOpen] = useState(false);

    const onCreateSubmit = (_values: CreateStockOpnameInput) => {
        if (!canCreate) { toast.error(cannotMessage("create")); return; }
        setOpnameCreateConfirmOpen(true);
    };

    const executeCreateOpname = async () => {
        const values = createForm.getValues();
        const effectiveIds = selectedBranchId ? [selectedBranchId] : values.branchIds;

        setCreateSubmitting(true);
        try {
            const result = await createStockOpnameWithItems({
                branchIds: effectiveIds,
                notes: values.notes || undefined,
                items: createProducts.map((p) => ({
                    productId: p.id,
                    systemStock: p.systemStock,
                    actualStock: p.actualStock,
                })),
            });
            if (result.error) { toast.error(result.error); return; }

            toast.success("Stock Opname berhasil dibuat");
            setCreateOpen(false);
            createForm.reset();
            setCreateProducts([]);
            setCreateSearch("");
            fetchData({});
        } finally {
            setCreateSubmitting(false);
            setOpnameCreateConfirmOpen(false);
        }
    };

    const handleSaveItems = () => {
        if (!canUpdate) { toast.error(cannotMessage("update")); return; }
        if (!selectedOpname) return;
        setOpnameSaveConfirmOpen(true);
    };

    const executeSaveItems = async () => {
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
            const updated = await getStockOpnameById(selectedOpname.id);
            setSelectedOpname(updated);
            fetchData({});
        }
        setOpnameSaveConfirmOpen(false);
    };

    const handleComplete = async () => {
        if (!canApprove) { toast.error(cannotMessage("approve")); return; }
        if (!selectedOpname) return;
        setConfirmKind("approve");
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
        if (!canUpdate) { toast.error(cannotMessage("update")); return; }
        setConfirmKind("delete");
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

    const isEditable = Boolean(selectedOpname && (selectedOpname.status === "DRAFT" || selectedOpname.status === "IN_PROGRESS") && canUpdate);

    // Stats bar data
    const stats = useMemo(() => {
        const opnames = data.opnames;
        return {
            draft: opnames.filter((o) => o.status === "DRAFT").length,
            inProgress: opnames.filter((o) => o.status === "IN_PROGRESS").length,
            completed: opnames.filter((o) => o.status === "COMPLETED").length,
            cancelled: opnames.filter((o) => o.status === "CANCELLED").length,
        };
    }, [data.opnames]);

    // Detail summary
    const detailSummary = useMemo(() => {
        if (!selectedOpname) return { total: 0, withDiff: 0, surplus: 0, deficit: 0, totalDiffValue: 0 };
        const items = selectedOpname.items;
        let surplus = 0;
        let deficit = 0;
        let totalDiffValue = 0;
        items.forEach((item) => {
            const actual = editedItems[item.productId] ?? item.actualStock;
            const diff = actual - item.systemStock;
            if (diff > 0) surplus++;
            if (diff < 0) deficit++;
            totalDiffValue += diff;
        });
        return { total: items.length, withDiff: surplus + deficit, surplus, deficit, totalDiffValue };
    }, [selectedOpname, editedItems]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Nomor opname disalin");
    };

    const handleStatusFilter = (status: StatusFilterValue) => {
        const newFilters = { ...activeFilters, status };
        setActiveFilters(newFilters);
        setPage(1);
        fetchData({ filters: newFilters, page: 1 });
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setPage(1);
        fetchData({ search: value, page: 1 });
    };


    // Compute discrepancy count per opname (items where actual != system)
    const getDiscrepancyInfo = (opname: StockOpname) => {
        // We only have _count.items from list view, no per-item detail
        // So discrepancy count is not available at list level; show item count only
        return { itemCount: opname._count.items };
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200/50">
                        <ClipboardCheck className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Stock Opname</h1>
                            <Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-medium px-2.5">
                                {data.total} opname
                            </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Penyesuaian stok berdasarkan penghitungan fisik</p>
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    <ExportMenu module="stock-opname" branchId={selectedBranchId || undefined} filters={activeFilters} />
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="stock-opname" actionKey="create">
                        <Button disabled={!canCreate} className="text-sm rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-200/50" onClick={() => openCreateDialog()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Buat Opname
                        </Button>
                    </DisabledActionTooltip>
                </div>
                {/* Mobile: Floating button */}
                {canCreate && (
                    <div className="sm:hidden fixed bottom-4 right-4 z-50">
                        <Button onClick={() => openCreateDialog()} size="icon" className="h-12 w-12 rounded-full shadow-xl shadow-amber-300/50 bg-gradient-to-br from-amber-500 to-orange-500">
                            <Plus className="w-5 h-5" />
                        </Button>
                    </div>
                )}
                <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { createForm.reset(); setCreateProducts([]); setCreateSearch(""); } }}>
                    <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl rounded-xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden border-0 shadow-2xl p-0 gap-0">
                        <div className="h-1 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 shrink-0" />
                        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="flex flex-col flex-1 min-h-0">
                            <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 shrink-0">
                                <DialogTitle className="text-base sm:text-lg font-bold">Buat Stock Opname</DialogTitle>
                            </DialogHeader>
                            <DialogBody className={`space-y-3 sm:space-y-4 px-4 sm:px-6 ${!canCreate ? "pointer-events-none opacity-70" : ""}`}>
                                {/* Lokasi + Catatan */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs sm:text-sm font-medium">Lokasi <span className="text-red-400">*</span></Label>
                                        {selectedBranchId ? (
                                            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                <span className="font-medium">{branches.find((b) => b.id === selectedBranchId)?.name ?? "—"}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <SmartSelect
                                                    value={createForm.watch("branchIds")?.[0] ?? ""}
                                                    onChange={(v) => {
                                                        createForm.setValue("branchIds", v ? [v] : []);
                                                        if (v) loadCreateProducts(v);
                                                        else setCreateProducts([]);
                                                    }}
                                                    placeholder="Pilih lokasi"
                                                    onSearch={async (query) =>
                                                        branches
                                                            .filter((b) => !query || b.name.toLowerCase().includes(query.toLowerCase()))
                                                            .map((b) => ({ value: b.id, label: b.name }))
                                                    }
                                                />
                                                {createForm.formState.errors.branchIds && <p className="text-xs text-red-500">{createForm.formState.errors.branchIds.message}</p>}
                                            </>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs sm:text-sm font-medium">Catatan</Label>
                                        <Input {...createForm.register("notes")} className="rounded-xl h-9 sm:h-10" placeholder="Opsional..." />
                                    </div>
                                </div>

                                {/* Product list */}
                                {createProductsLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-amber-500 mr-2" />
                                        <span className="text-sm text-muted-foreground">Memuat produk...</span>
                                    </div>
                                ) : createProducts.length > 0 ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs sm:text-sm font-semibold">Daftar Produk</Label>
                                                <Badge variant="secondary" className="rounded-full text-[10px] px-1.5">{createProducts.length}</Badge>
                                            </div>
                                            <div className="relative w-40 sm:w-56">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                                <Input value={createSearch} onChange={(e) => setCreateSearch(e.target.value)} className="rounded-lg h-7 sm:h-8 pl-8 text-xs" placeholder="Cari produk..." />
                                            </div>
                                        </div>

                                        {/* Header */}
                                        <div className="hidden sm:grid grid-cols-[1fr_100px_100px_80px] gap-2 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">
                                            <span>Produk</span>
                                            <span className="text-center">Stok Sistem</span>
                                            <span className="text-center">Stok Aktual</span>
                                            <span className="text-center">Selisih</span>
                                        </div>

                                        {/* Items */}
                                        <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                                            {createProducts
                                                .filter((p) => !createSearch || p.name.toLowerCase().includes(createSearch.toLowerCase()) || p.code.toLowerCase().includes(createSearch.toLowerCase()))
                                                .map((item) => {
                                                    const diff = item.actualStock - item.systemStock;
                                                    return (
                                                        <div key={item.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_100px_100px_80px] gap-2 items-center px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50/50">
                                                            <div className="min-w-0">
                                                                <p className="text-xs sm:text-sm font-medium truncate">{item.name}</p>
                                                                <p className="text-[10px] text-muted-foreground font-mono">{item.code}</p>
                                                            </div>
                                                            <div className="hidden sm:block text-center text-sm tabular-nums text-slate-500">{item.systemStock}</div>
                                                            <div className="flex items-center gap-1.5 sm:justify-center">
                                                                <span className="sm:hidden text-[10px] text-muted-foreground">Aktual:</span>
                                                                <Input
                                                                    type="number"
                                                                    value={item.actualStock}
                                                                    onChange={(e) => {
                                                                        const val = parseInt(e.target.value) || 0;
                                                                        setCreateProducts((prev) => prev.map((p) => p.id === item.id ? { ...p, actualStock: val } : p));
                                                                    }}
                                                                    className="w-16 sm:w-20 h-7 sm:h-8 rounded-lg text-center text-xs sm:text-sm font-medium tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    min={0}
                                                                />
                                                            </div>
                                                            <div className="hidden sm:flex justify-center">
                                                                {diff !== 0 && (
                                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${diff > 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                                                                        {diff > 0 ? "+" : ""}{diff}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                ) : !selectedBranchId ? (
                                    <div className="text-center py-6 text-muted-foreground">
                                        <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-xs sm:text-sm">Pilih 1 lokasi untuk memuat daftar produk</p>
                                    </div>
                                ) : null}
                            </DialogBody>
                            <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
                                <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); createForm.reset(); setCreateProducts([]); setCreateSearch(""); }} className="rounded-xl">
                                    Batal
                                </Button>
                                <Button type="submit" disabled={!canCreate || createProducts.length === 0 || createSubmitting}
                                    className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-200/40 px-6">
                                    {createSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</> : "Simpan Opname"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Mobile: search + filter + stats */}
            <div className="sm:hidden space-y-2">
                <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Cari opname..." className="pl-9 rounded-xl h-9 text-sm border-slate-200" />
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 rounded-xl h-9 gap-1.5 relative" onClick={() => setFilterSheetOpen(true)}>
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span className="text-xs">Filter</span>
                        {activeFilters.status !== "ALL" && <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-amber-500" />}
                    </Button>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                    <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 ring-1 ring-slate-200 px-2 py-1 shrink-0">
                        <FileEdit className="w-3 h-3 text-slate-500" />
                        <span className="text-[11px] font-semibold text-slate-700">{stats.draft}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 ring-1 ring-blue-100 px-2 py-1 shrink-0">
                        <Loader2 className="w-3 h-3 text-blue-500" />
                        <span className="text-[11px] font-semibold text-blue-700">{stats.inProgress}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 ring-1 ring-emerald-100 px-2 py-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span className="text-[11px] font-semibold text-emerald-700">{stats.completed}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-red-50 ring-1 ring-red-100 px-2 py-1 shrink-0">
                        <XCircle className="w-3 h-3 text-red-400" />
                        <span className="text-[11px] font-semibold text-red-700">{stats.cancelled}</span>
                    </div>
                </div>
                <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                    <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                        <div className="shrink-0">
                            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-muted-foreground/20" /></div>
                            <SheetHeader className="px-4 pb-3 pt-0"><SheetTitle className="text-base font-bold">Filter Status</SheetTitle></SheetHeader>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                            {statusPills.map((pill) => {
                                const isActive = activeFilters.status === pill.value;
                                return (
                                    <button key={pill.value} onClick={() => { handleStatusFilter(pill.value); setFilterSheetOpen(false); }}
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Cari nomor opname..." className="pl-10 rounded-xl h-10 text-sm border-slate-200" />
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-3 py-1.5">
                        <FileEdit className="w-3 h-3 text-slate-500" />
                        <span className="text-[11px] font-semibold text-slate-700">{stats.draft}</span>
                        <span className="text-[11px] text-slate-500">Draft</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5">
                        <Loader2 className="w-3 h-3 text-blue-500" />
                        <span className="text-[11px] font-semibold text-blue-700">{stats.inProgress}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span className="text-[11px] font-semibold text-emerald-700">{stats.completed}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1.5">
                        <XCircle className="w-3 h-3 text-red-400" />
                        <span className="text-[11px] font-semibold text-red-700">{stats.cancelled}</span>
                    </div>
                </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                {statusPills.map((pill) => (
                    <button key={pill.value} onClick={() => handleStatusFilter(pill.value)}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                            activeFilters.status === pill.value
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200/50"
                                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}>
                        {pill.label}
                    </button>
                ))}
            </div>

            {/* Card List */}
            <div className="space-y-3">
                {loading && data.opnames.length === 0 ? (
                    /* Loading skeleton */
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-slate-200/60 bg-white p-5 animate-pulse">
                                <div className="flex items-center gap-4">
                                    <div className="h-11 w-11 rounded-xl bg-slate-200" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 w-40 bg-slate-200 rounded" />
                                        <div className="h-3 w-28 bg-slate-100 rounded" />
                                    </div>
                                    <div className="h-6 w-20 bg-slate-200 rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : data.opnames.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-10 sm:py-16 px-4">
                        <div className="flex h-10 w-10 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 mb-4">
                            <ClipboardCheck className="w-5 h-5 sm:w-8 sm:h-8 text-amber-400" />
                        </div>
                        <h3 className="text-sm sm:text-lg font-semibold text-slate-700 mb-1">Belum ada stock opname</h3>
                        <p className="text-xs sm:text-sm text-slate-400 text-center max-w-sm">Buat stock opname pertama untuk mulai menghitung stok fisik</p>
                    </div>
                ) : (
                    /* Opname card grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                        {data.opnames.map((opname) => {
                            const cfg = statusConfig[opname.status];
                            const info = getDiscrepancyInfo(opname);
                            const date = new Date(opname.startedAt);

                            return (
                                <div
                                    key={opname.id}
                                    className={`group relative rounded-xl border border-slate-200/60 bg-white border-l-4 ${cfg?.borderColor || "border-l-slate-300"} shadow-sm hover:shadow-md transition-all duration-200`}
                                >
                                    <div className="p-3 sm:p-4 space-y-2 sm:space-y-0">
                                        {/* Mobile: stacked layout */}
                                        <div className="sm:hidden space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-bold text-slate-800">{opname.opnameNumber}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(opname.opnameNumber); }} className="p-0.5 rounded hover:bg-slate-100">
                                                        <Copy className="w-2.5 h-2.5 text-slate-400" />
                                                    </button>
                                                </div>
                                                <Badge className={`${cfg?.classes || ""} gap-1 px-2 py-0.5 text-[10px] font-medium shadow-none`}>
                                                    {cfg?.icon || null}
                                                    {cfg?.label || null}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                                <span className="inline-flex items-center gap-1">
                                                    <MapPin className="w-2.5 h-2.5" />
                                                    {opname.branch?.name || "Semua"}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarDays className="w-2.5 h-2.5" />
                                                    {format(date, "dd MMM yy", { locale: idLocale })}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <Package className="w-2.5 h-2.5" />
                                                    {info.itemCount}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 pt-1">
                                                <Button variant="ghost" size="xs" className="rounded-lg hover:bg-amber-50 hover:text-amber-700" onClick={() => handleViewDetail(opname.id)}>
                                                    <Eye className="w-3 h-3 mr-1" /> Lihat
                                                </Button>
                                                {(opname.status === "DRAFT" || opname.status === "IN_PROGRESS") && (
                                                    <Button disabled={!canUpdate} variant="ghost" size="xs" className="rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => handleCancel(opname.id)}>
                                                        <XCircle className="w-3 h-3 mr-1" /> Batal
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Desktop: horizontal layout */}
                                        <div className="hidden sm:flex items-center gap-4">
                                            <Badge className={`${cfg?.classes || ""} gap-1.5 rounded-bl-xl rounded-tr-xl rounded-tl-none rounded-br-none px-3 py-1 text-[11px] font-medium shadow-none absolute top-0 right-0 z-[1]`}>
                                                {cfg?.icon || null}
                                                {cfg?.label || null}
                                            </Badge>
                                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cfg?.gradientBg || "from-slate-400 to-slate-500"} shadow-md`}>
                                                <ClipboardCheck className="h-5 w-5 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-sm font-bold text-slate-800">{opname.opnameNumber}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(opname.opnameNumber); }} className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-100">
                                                        <Copy className="w-3 h-3 text-slate-400" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{opname.branch?.name || "Semua Cabang"}</span>
                                                    <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3 text-slate-400" />{format(date, "dd MMM yyyy", { locale: idLocale })}<span className="text-slate-300 ml-0.5">({formatDistanceToNow(date, { addSuffix: true, locale: idLocale })})</span></span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                                        <Package className="w-3 h-3 text-slate-400" />{info.itemCount} item
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                                                <Button variant="ghost" size="icon-sm" className="rounded-lg hover:bg-amber-50 hover:text-amber-700" onClick={() => handleViewDetail(opname.id)}>
                                                    <Eye className="w-3.5 h-3.5" />
                                                </Button>
                                                {(opname.status === "DRAFT" || opname.status === "IN_PROGRESS") && (
                                                    <Button disabled={!canUpdate} variant="ghost" size="icon-sm" className="rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => handleCancel(opname.id)}>
                                                        <XCircle className="w-3.5 h-3.5" />
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

            {/* Detail / Edit Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl rounded-xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden border-0 shadow-2xl p-0 gap-0">
                    {/* Gradient accent line */}
                    <div className="h-1 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 shrink-0" />

                    {/* Header - sticky */}
                    <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 shrink-0">
                        <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-200/40 shrink-0">
                                    <ClipboardCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                                </div>
                                <div>
                                    <span className="text-base sm:text-lg font-bold">Detail Stock Opname</span>
                                    <p className="text-xs font-mono text-slate-400 font-normal mt-0.5">{selectedOpname?.opnameNumber}</p>
                                </div>
                            </div>
                            {selectedOpname && (
                                <Badge className={`${statusConfig[selectedOpname.status]?.classes || ""} gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-none`}>
                                    {statusConfig[selectedOpname.status]?.icon || null}
                                    {statusConfig[selectedOpname.status]?.label || null}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Body - scrollable */}
                    <DialogBody className="px-4 sm:px-6">
                        {selectedOpname && (
                            <div className="space-y-3 sm:space-y-5">
                                {/* Summary */}
                                {selectedOpname.items.length > 0 && (
                                    <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center">
                                            <p className="text-sm sm:text-lg font-bold text-slate-700">{detailSummary.total}</p>
                                            <p className="text-[8px] sm:text-[10px] text-slate-400 font-medium uppercase">Item</p>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-100 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center">
                                            <p className="text-sm sm:text-lg font-bold text-amber-700">{detailSummary.withDiff}</p>
                                            <p className="text-[8px] sm:text-[10px] text-amber-500 font-medium uppercase">Selisih</p>
                                        </div>
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center">
                                            <p className="text-sm sm:text-lg font-bold text-emerald-600">{detailSummary.surplus}</p>
                                            <p className="text-[8px] sm:text-[10px] text-emerald-500 font-medium uppercase">Lebih</p>
                                        </div>
                                        <div className="bg-red-50 border border-red-100 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center">
                                            <p className="text-sm sm:text-lg font-bold text-red-600">{detailSummary.deficit}</p>
                                            <p className="text-[8px] sm:text-[10px] text-red-400 font-medium uppercase">Kurang</p>
                                        </div>
                                    </div>
                                )}

                                {/* Info */}
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500">
                                    <span className="inline-flex items-center gap-1 bg-slate-50 rounded-full px-2 py-1 ring-1 ring-slate-100">
                                        <MapPin className="w-3 h-3" /> {selectedOpname.branch?.name || "Semua"}
                                    </span>
                                    <span className="inline-flex items-center gap-1 bg-slate-50 rounded-full px-2 py-1 ring-1 ring-slate-100">
                                        <CalendarDays className="w-3 h-3" /> {format(new Date(selectedOpname.startedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}
                                    </span>
                                    {selectedOpname.notes && (
                                        <span className="text-slate-400 truncate max-w-[200px]">{selectedOpname.notes}</span>
                                    )}
                                </div>

                                {/* Product list */}
                                {selectedOpname.items.length > 0 && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs sm:text-sm font-bold text-slate-800">Daftar Produk</p>
                                                <Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700 border border-amber-200/50 text-[10px] sm:text-xs px-1.5 sm:px-2">
                                                    {selectedOpname.items.length}
                                                </Badge>
                                            </div>
                                            {isEditable && (
                                                <p className="hidden sm:block text-xs text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1 border border-amber-100">
                                                    Masukkan stok aktual
                                                </p>
                                            )}
                                        </div>

                                        {/* Mobile: card-based items */}
                                        <div className="sm:hidden space-y-1.5">
                                            {selectedOpname.items.map((item) => {
                                                const actualStock = editedItems[item.productId] ?? item.actualStock;
                                                const diff = actualStock - item.systemStock;
                                                return (
                                                    <div key={item.id} className="rounded-lg border border-slate-200/60 p-2.5 space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-medium text-slate-700 truncate flex-1">{item.product.name}</span>
                                                            {diff !== 0 && (
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${diff > 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                                                                    {diff > 0 ? "+" : ""}{diff}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1">
                                                                <span className="text-[10px] text-slate-400">Sistem</span>
                                                                <p className="text-xs font-semibold text-slate-600">{item.systemStock}</p>
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className="text-[10px] text-slate-400">Aktual</span>
                                                                {isEditable ? (
                                                                    <Input type="number" min={0} value={actualStock}
                                                                        onChange={(e) => setEditedItems({ ...editedItems, [item.productId]: Number(e.target.value) })}
                                                                        className="w-full h-8 rounded-lg text-center text-xs border-slate-200" />
                                                                ) : (
                                                                    <p className="text-xs font-semibold">{item.actualStock}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Desktop: table */}
                                        <div className="hidden sm:block border border-slate-200/80 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100/50">
                                                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kode</TableHead>
                                                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Produk</TableHead>
                                                        <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sistem</TableHead>
                                                        <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Aktual</TableHead>
                                                        <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Selisih</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedOpname.items.map((item) => {
                                                        const actualStock = editedItems[item.productId] ?? item.actualStock;
                                                        const diff = actualStock - item.systemStock;
                                                        return (
                                                            <TableRow key={item.id} className="group hover:bg-amber-50/30 transition-colors">
                                                                <TableCell><span className="font-mono text-xs bg-slate-100 rounded px-1.5 py-0.5 text-slate-600">{item.product.code}</span></TableCell>
                                                                <TableCell className="text-sm font-medium text-slate-700">{item.product.name}</TableCell>
                                                                <TableCell className="text-center text-sm text-slate-600 font-medium">{item.systemStock}</TableCell>
                                                                <TableCell className="text-center">
                                                                    {isEditable ? (
                                                                        <Input type="number" min={0} value={actualStock}
                                                                            onChange={(e) => setEditedItems({ ...editedItems, [item.productId]: Number(e.target.value) })}
                                                                            className="w-20 mx-auto rounded-xl text-center text-sm border-slate-200 focus:border-amber-400 focus:ring-amber-400/30" />
                                                                    ) : (
                                                                        <span className="text-sm font-medium">{item.actualStock}</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    {diff > 0 ? (
                                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-0.5 border border-emerald-100"><TrendingUp className="w-3 h-3" />+{diff}</span>
                                                                    ) : diff < 0 ? (
                                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 rounded-full px-2.5 py-0.5 border border-red-100"><TrendingDown className="w-3 h-3" />{diff}</span>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-400">0</span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </DialogBody>

                    {/* Footer - sticky */}
                    <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
                        <div className="flex items-center justify-between w-full gap-2">
                            <Button variant="outline" onClick={() => setDetailOpen(false)} className="rounded-xl">
                                Tutup
                            </Button>
                            {isEditable && (
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <Button disabled={!canUpdate} variant="outline" onClick={handleSaveItems} className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50">
                                        <Save className="w-4 h-4 mr-1.5" /> Simpan
                                    </Button>
                                    <Button disabled={!canUpdate} variant="outline" onClick={() => handleCancel(selectedOpname!.id)} className="rounded-xl border-red-200 text-red-600 hover:bg-red-50">
                                        <XCircle className="w-4 h-4 mr-1.5" /> Batal
                                    </Button>
                                    <Button disabled={!canApprove} onClick={handleComplete} className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-md shadow-emerald-200/40">
                                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Selesai
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation dialog */}
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
                open={opnameCreateConfirmOpen}
                onOpenChange={setOpnameCreateConfirmOpen}
                kind="submit"
                description="Yakin ingin menyimpan stock opname ini?"
                onConfirm={executeCreateOpname}
            />
            <ActionConfirmDialog
                open={opnameSaveConfirmOpen}
                onOpenChange={setOpnameSaveConfirmOpen}
                kind="submit"
                description="Yakin ingin menyimpan perubahan data opname?"
                onConfirm={executeSaveItems}
            />
        </div>
    );
}
