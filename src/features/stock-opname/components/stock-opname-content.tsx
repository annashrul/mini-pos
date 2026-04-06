"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    getStockOpnames,
    getStockOpnameById,
    createStockOpname,
    updateOpnameItems,
    completeStockOpname,
    cancelStockOpname,
} from "@/features/stock-opname";
import { createStockOpnameSchema, type CreateStockOpnameInput } from "@/features/stock-opname/schemas/stock-opname.schema";
import { getAllBranches } from "@/features/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BranchMultiSelect } from "@/components/ui/branch-multi-select";
import {
    Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Plus, Eye, ClipboardCheck,
    CheckCircle2, XCircle, Save,
    FileEdit, Loader2, Copy,
    Package, TrendingUp, TrendingDown, AlertTriangle,
    Search, CalendarDays, MapPin,
} from "lucide-react";
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
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
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

    // Detail edit state
    const [editedItems, setEditedItems] = useState<Record<string, number>>({});
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [confirmRequiredAction, setConfirmRequiredAction] = useState<null | "approve" | "update">(null);
    const { canAction, cannotMessage } = useMenuActionAccess("stock-opname");
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canApprove = canAction("approve");

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
    }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const onCreateSubmit = async (values: CreateStockOpnameInput) => {
        if (!canCreate) { toast.error(cannotMessage("create")); return; }
        const result = await createStockOpname(values.branchIds.length === branches.length ? null : values.branchIds, values.notes || undefined);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Stock Opname berhasil dibuat");
            setCreateOpen(false);
            createForm.reset();
            fetchData({});
        }
    };

    const handleSaveItems = async () => {
        if (!canUpdate) { toast.error(cannotMessage("update")); return; }
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
        if (!canApprove) { toast.error(cannotMessage("approve")); return; }
        if (!selectedOpname) return;
        setConfirmRequiredAction("approve");
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
            setConfirmRequiredAction(null);
        });
        setConfirmOpen(true);
    };

    const handleCancel = async (id: string) => {
        if (!canUpdate) { toast.error(cannotMessage("update")); return; }
        setConfirmRequiredAction("update");
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
            setConfirmRequiredAction(null);
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200/50">
                        <ClipboardCheck className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">Stock Opname</h1>
                            <Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-medium px-2.5">
                                {data.total} opname
                            </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm mt-0.5">Penyesuaian stok berdasarkan penghitungan fisik</p>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                    <Button disabled={!canCreate} className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-200/50 transition-all duration-200 hover:shadow-xl hover:shadow-amber-200/50 hover:-translate-y-0.5" onClick={() => setCreateOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Buat Opname
                    </Button>
                </DisabledActionTooltip>
                <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) createForm.reset(); }}>
                    <DialogContent className="rounded-2xl border-0 shadow-2xl">
                        {/* Gradient accent line */}
                        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
                        <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
                            <DialogHeader className="pt-2">
                                <DialogTitle className="text-xl font-bold">Buat Stock Opname Baru</DialogTitle>
                            </DialogHeader>
                            <DialogBody className={`space-y-5 ${!canCreate ? "pointer-events-none opacity-70" : ""}`}>
                                <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 p-3.5">
                                    <p className="text-sm text-amber-800">
                                        Semua produk aktif akan dimuat dengan stok sistem saat ini. Anda dapat memasukkan stok aktual setelah opname dibuat.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Lokasi <span className="text-red-400">*</span></Label>
                                    <div className="rounded-xl border border-slate-200 bg-white p-0.5">
                                        <Controller
                                            control={createForm.control}
                                            name="branchIds"
                                            render={({ field }) => (
                                                <BranchMultiSelect
                                                    branches={branches}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Pilih lokasi"
                                                />
                                            )}
                                        />
                                    </div>
                                    {createForm.formState.errors.branchIds && (
                                        <p className="text-sm text-red-500">{createForm.formState.errors.branchIds.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Catatan (opsional)</Label>
                                    <textarea
                                        {...createForm.register("notes")}
                                        className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all resize-none min-h-[80px]"
                                        placeholder="Tambahkan catatan untuk opname ini, misalnya: Opname akhir bulan Maret 2026..."
                                    />
                                </div>
                            </DialogBody>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); createForm.reset(); }} className="rounded-xl px-5">
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={!canCreate}
                                    className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-200/40 px-6"
                                >
                                    Simpan
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200/60 px-4 py-2">
                    <FileEdit className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">{stats.draft}</span>
                    <span className="text-xs text-slate-500">Draft</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200/60 px-4 py-2">
                    <Loader2 className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold text-blue-700">{stats.inProgress}</span>
                    <span className="text-xs text-blue-500">Berlangsung</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200/60 px-4 py-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-700">{stats.completed}</span>
                    <span className="text-xs text-emerald-500">Selesai</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-50 to-red-100 border border-red-200/60 px-4 py-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-semibold text-red-700">{stats.cancelled}</span>
                    <span className="text-xs text-red-400">Dibatalkan</span>
                </div>
            </div>

            {/* Search bar + Status filter pills */}
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="Cari nomor opname..."
                            className="pl-10 rounded-xl border-slate-200 focus:border-amber-400 focus:ring-amber-400/30"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100/80 rounded-xl p-1">
                        {statusPills.map((pill) => (
                            <button
                                key={pill.value}
                                onClick={() => handleStatusFilter(pill.value)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                                    activeFilters.status === pill.value
                                        ? "bg-white text-slate-800 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                                }`}
                            >
                                {pill.label}
                            </button>
                        ))}
                    </div>
                </div>
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
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 mb-4">
                            <ClipboardCheck className="w-8 h-8 text-amber-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-1">Belum ada stock opname</h3>
                        <p className="text-sm text-slate-400 text-center max-w-sm">Buat stock opname pertama untuk mulai menghitung stok fisik</p>
                    </div>
                ) : (
                    /* Opname card grid — 2 columns */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {data.opnames.map((opname) => {
                            const cfg = statusConfig[opname.status];
                            const info = getDiscrepancyInfo(opname);
                            const date = new Date(opname.startedAt);

                            return (
                                <div
                                    key={opname.id}
                                    className={`group relative rounded-xl border border-slate-200/60 bg-white border-l-4 ${cfg?.borderColor || "border-l-slate-300"} shadow-sm hover:shadow-md transition-all duration-200`}
                                >
                                    {/* Status badge — absolute top right */}
                                    <Badge className={`${cfg?.classes || ""} gap-1.5 rounded-bl-xl rounded-tr-xl rounded-tl-none rounded-br-none px-3 py-1 text-[11px] font-medium shadow-none absolute top-0 right-0 z-[1]`}>
                                        {cfg?.icon || null}
                                        {cfg?.label || null}
                                    </Badge>

                                    <div className="flex items-center gap-4 p-4">
                                        {/* Left icon */}
                                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cfg?.gradientBg || "from-slate-400 to-slate-500"} shadow-md`}>
                                            <ClipboardCheck className="h-5 w-5 text-white" />
                                        </div>

                                        {/* Middle content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-sm font-bold text-slate-800">{opname.opnameNumber}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(opname.opnameNumber); }}
                                                    className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-100"
                                                >
                                                    <Copy className="w-3 h-3 text-slate-400" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                                <span className="inline-flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-slate-400" />
                                                    {opname.branch?.name || "Semua Cabang"}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarDays className="w-3 h-3 text-slate-400" />
                                                    {format(date, "dd MMM yyyy", { locale: idLocale })}
                                                    <span className="text-slate-300 ml-0.5">({formatDistanceToNow(date, { addSuffix: true, locale: idLocale })})</span>
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                                    <Package className="w-3 h-3 text-slate-400" />
                                                    {info.itemCount} item
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-amber-50 hover:text-amber-700 transition-colors" onClick={() => handleViewDetail(opname.id)}>
                                                <Eye className="w-3.5 h-3.5" />
                                            </Button>
                                            {(opname.status === "DRAFT" || opname.status === "IN_PROGRESS") && (
                                                <>
                                                    <DisabledActionTooltip disabled={!canApprove} message={cannotMessage("approve")}>
                                                        <Button disabled={!canApprove} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                                                            onClick={async () => { await handleViewDetail(opname.id); }}>
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </DisabledActionTooltip>
                                                    <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                                                        <Button disabled={!canUpdate} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                            onClick={() => handleCancel(opname.id)}>
                                                            <XCircle className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </DisabledActionTooltip>
                                                </>
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

            {/* Detail / Edit Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="rounded-2xl max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border-0 shadow-2xl p-0">
                    {/* Gradient accent line */}
                    <div className="h-1 rounded-t-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 shrink-0" />

                    {/* Header - sticky */}
                    <DialogHeader className="px-6 pt-4 pb-3 shrink-0">
                        <DialogTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-200/40">
                                    <ClipboardCheck className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <span className="text-lg font-bold">Detail Stock Opname</span>
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
                    <DialogBody className="px-6">
                        {selectedOpname && (
                            <div className="space-y-5">
                                {/* Summary - at top */}
                                {selectedOpname.items.length > 0 && (
                                    <div className="grid grid-cols-4 gap-3">
                                        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-100 rounded-xl p-3 text-center">
                                            <Package className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                                            <p className="text-lg font-bold text-slate-700">{detailSummary.total}</p>
                                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total Item</p>
                                        </div>
                                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-3 text-center">
                                            <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                                            <p className="text-lg font-bold text-amber-700">{detailSummary.withDiff}</p>
                                            <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wider">Ada Selisih</p>
                                        </div>
                                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-xl p-3 text-center">
                                            <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                                            <p className="text-lg font-bold text-emerald-600">{detailSummary.surplus}</p>
                                            <p className="text-[10px] text-emerald-500 font-medium uppercase tracking-wider">Kelebihan</p>
                                        </div>
                                        <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 rounded-xl p-3 text-center">
                                            <TrendingDown className="w-4 h-4 text-red-400 mx-auto mb-1" />
                                            <p className="text-lg font-bold text-red-600">{detailSummary.deficit}</p>
                                            <p className="text-[10px] text-red-400 font-medium uppercase tracking-wider">Kekurangan</p>
                                        </div>
                                    </div>
                                )}

                                {/* Info cards */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-100 p-3.5">
                                        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Cabang</p>
                                        <p className="font-semibold text-sm text-slate-700 mt-1">{selectedOpname.branch?.name || "Semua Cabang"}</p>
                                    </div>
                                    <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-100 p-3.5">
                                        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Tanggal Mulai</p>
                                        <p className="font-semibold text-sm text-slate-700 mt-1">{format(new Date(selectedOpname.startedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}</p>
                                    </div>
                                    <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-100 p-3.5">
                                        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Catatan</p>
                                        <p className="text-sm text-slate-700 mt-1">{selectedOpname.notes || "-"}</p>
                                    </div>
                                </div>

                                {/* Product table */}
                                {selectedOpname.items.length > 0 && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-slate-800">Daftar Produk</p>
                                                <Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700 border border-amber-200/50 text-xs px-2">
                                                    {selectedOpname.items.length} item
                                                </Badge>
                                            </div>
                                            {isEditable && (
                                                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1 border border-amber-100">
                                                    Masukkan stok aktual hasil penghitungan fisik
                                                </p>
                                            )}
                                        </div>
                                        <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100/50">
                                                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kode</TableHead>
                                                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Produk</TableHead>
                                                        <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Stok Sistem</TableHead>
                                                        <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Stok Aktual</TableHead>
                                                        <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Selisih</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedOpname.items.map((item) => {
                                                        const actualStock = editedItems[item.productId] ?? item.actualStock;
                                                        const diff = actualStock - item.systemStock;
                                                        return (
                                                            <TableRow key={item.id} className="group hover:bg-amber-50/30 transition-colors">
                                                                <TableCell>
                                                                    <span className="font-mono text-xs bg-slate-100 rounded px-1.5 py-0.5 text-slate-600">{item.product.code}</span>
                                                                </TableCell>
                                                                <TableCell className="text-sm font-medium text-slate-700">{item.product.name}</TableCell>
                                                                <TableCell className="text-center text-sm text-slate-600 font-medium">{item.systemStock}</TableCell>
                                                                <TableCell className="text-center">
                                                                    {isEditable ? (
                                                                        <Input
                                                                            type="number"
                                                                            min={0}
                                                                            value={actualStock}
                                                                            onChange={(e) => setEditedItems({ ...editedItems, [item.productId]: Number(e.target.value) })}
                                                                            className="w-20 mx-auto rounded-xl text-center text-sm border-slate-200 focus:border-amber-400 focus:ring-amber-400/30"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-sm font-medium">{item.actualStock}</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    {diff > 0 ? (
                                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-0.5 border border-emerald-100">
                                                                            <TrendingUp className="w-3 h-3" />+{diff}
                                                                        </span>
                                                                    ) : diff < 0 ? (
                                                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 rounded-full px-2.5 py-0.5 border border-red-100">
                                                                            <TrendingDown className="w-3 h-3" />{diff}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-400 font-medium">0</span>
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
                    <DialogFooter className="px-6 py-4 shrink-0">
                        <Button variant="outline" onClick={() => setDetailOpen(false)} className="rounded-xl px-5">
                            Tutup
                        </Button>
                        {isEditable && (
                            <>
                                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                                    <Button disabled={!canUpdate} variant="outline" onClick={handleSaveItems} className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50">
                                        <Save className="w-4 h-4 mr-2" /> Simpan
                                    </Button>
                                </DisabledActionTooltip>
                                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                                    <Button disabled={!canUpdate} variant="outline" onClick={() => handleCancel(selectedOpname!.id)} className="rounded-xl border-red-200 text-red-600 hover:bg-red-50">
                                        <XCircle className="w-4 h-4 mr-2" /> Batalkan
                                    </Button>
                                </DisabledActionTooltip>
                                <DisabledActionTooltip disabled={!canApprove} message={cannotMessage("approve")}>
                                    <Button disabled={!canApprove} onClick={handleComplete} className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-md shadow-emerald-200/40">
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Selesaikan Opname
                                    </Button>
                                </DisabledActionTooltip>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation dialog */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm border-0 shadow-2xl p-0">
                    <div className="h-1 rounded-t-2xl bg-gradient-to-r from-red-400 to-orange-400" />
                    <div className="px-6 pb-6 pt-4">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50">
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                </div>
                                Konfirmasi
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground mt-3">{confirmText}</p>
                        <div className="flex justify-end gap-2 mt-5">
                            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-xl px-5">
                                Batal
                            </Button>
                            <DisabledActionTooltip
                                disabled={confirmRequiredAction === "approve" ? !canApprove : confirmRequiredAction === "update" ? !canUpdate : false}
                                message={cannotMessage(confirmRequiredAction === "approve" ? "approve" : "update")}
                            >
                                <Button
                                    disabled={confirmRequiredAction === "approve" ? !canApprove : confirmRequiredAction === "update" ? !canUpdate : false}
                                    variant="destructive"
                                    onClick={async () => { await pendingConfirmAction?.(); }}
                                    className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-md shadow-red-200/40 px-5"
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
