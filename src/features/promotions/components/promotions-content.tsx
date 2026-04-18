"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { useEffect, useState, useTransition, useRef } from "react";
import { useQueryParams } from "@/hooks/use-query-params";
import { deletePromotion, getPromotions, getPromotionStats } from "@/features/promotions";
import { useMenuActionAccess } from "@/features/access-control";
import { useBranch } from "@/components/providers/branch-provider";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Percent, Tag, Gift, Ticket, Package, CalendarDays, Sparkles, Clock, CheckCircle2, XCircle, Search, Loader2, SlidersHorizontal, Check, MapPin } from "lucide-react";
import { PaginationControl } from "@/components/ui/pagination-control";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Promotion } from "@/types";
import { PromotionForm } from "./promotion-form";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ExportMenu } from "@/components/ui/export-menu";
import { Skeleton } from "@/components/ui/skeleton";

const typeLabels: Record<string, { label: string; icon: typeof Percent; color: string; gradient: string; iconBg: string; borderColor: string }> = {
    DISCOUNT_PERCENT: { label: "Diskon %", icon: Percent, color: "bg-blue-100 text-blue-700", gradient: "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-200", iconBg: "bg-blue-100 text-blue-600", borderColor: "border-l-blue-500" },
    DISCOUNT_AMOUNT: { label: "Diskon Rp", icon: Tag, color: "bg-green-100 text-green-700", gradient: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm shadow-green-200", iconBg: "bg-emerald-100 text-emerald-600", borderColor: "border-l-emerald-500" },
    BUY_X_GET_Y: { label: "Beli X Gratis Y", icon: Gift, color: "bg-purple-100 text-purple-700", gradient: "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-sm shadow-purple-200", iconBg: "bg-purple-100 text-purple-600", borderColor: "border-l-purple-500" },
    VOUCHER: { label: "Voucher", icon: Ticket, color: "bg-orange-100 text-orange-700", gradient: "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-200", iconBg: "bg-orange-100 text-orange-600", borderColor: "border-l-orange-500" },
    BUNDLE: { label: "Tebus Murah", icon: Package, color: "bg-pink-100 text-pink-700", gradient: "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm shadow-pink-200", iconBg: "bg-pink-100 text-pink-600", borderColor: "border-l-pink-500" },
};

const typeFilterOptions = [
    { value: "ALL", label: "Semua" },
    { value: "DISCOUNT_PERCENT", label: "Diskon %" },
    { value: "DISCOUNT_AMOUNT", label: "Diskon Rp" },
    { value: "BUY_X_GET_Y", label: "Beli X Gratis Y" },
    { value: "VOUCHER", label: "Voucher" },
    { value: "BUNDLE", label: "Tebus Murah" },
];

export function PromotionsContent() {
    const [data, setData] = useState<{ promotions: Promotion[]; total: number; totalPages: number }>({ promotions: [], total: 0, totalPages: 0 });
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Promotion | null>(null);
    const qp = useQueryParams({ pageSize: 10, filters: { type: "ALL" } });
    const { page, pageSize, search, filters: activeFilters } = qp;
    const [searchInput, setSearchInput] = useState(search);
    const [sortKey] = useState("");
    const [sortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const { canAction, cannotMessage } = useMenuActionAccess("promotions");
    const { canAction: canPlan } = usePlanAccess();
    const canCreate = canAction("create") && canPlan("promotions", "create");
    const canUpdate = canAction("update") && canPlan("promotions", "update");
    const canDelete = canAction("delete") && canPlan("promotions", "delete");
    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);

    const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, vouchers: 0 });

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const [result, statsResult] = await Promise.all([
                getPromotions({
                    search: params.search ?? search,
                    ...(f.type !== "ALL" ? { type: f.type } : {}),
                    ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
                    page: params.page ?? page,
                    perPage: params.pageSize ?? pageSize,
                    ...(sk ? { sortBy: sk, sortDir: sd } : {}),
                }),
                getPromotionStats(),
            ]);
            setData(result as never);
            setStats(statsResult);
        });
    };

    useEffect(() => {
        if (!branchReady) return;
        prevBranchRef.current = selectedBranchId;
        fetchData({});
    }, [branchReady, selectedBranchId, page, pageSize, search, activeFilters.type]); // eslint-disable-line react-hooks/exhaustive-deps

    const openForm = (promo: Promotion | null) => {
        if (promo ? !canUpdate : !canCreate) { toast.error(cannotMessage(promo ? "update" : "create")); return; }
        setEditing(promo);
        setOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
        setConfirmText("Hapus promo ini?");
        setPendingConfirmAction(() => async () => {
            const result = await deletePromotion(id);
            if (result.error) toast.error(result.error);
            else { toast.success("Promo dihapus"); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const handleSearch = (value: string) => {
        setSearchInput(value);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => { qp.setSearch(value); }, 400);
    };

    const handleFilterType = (type: string) => {
        qp.setFilter("type", type === "ALL" ? null : type);
    };

    const renderValue = (row: Promotion) => {
        if (row.type === "BUY_X_GET_Y") {
            return (
                <span className="text-sm font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
                    Beli {(row as Promotion & { buyQty?: number }).buyQty || 1} Gratis {(row as Promotion & { getQty?: number }).getQty || 1}
                </span>
            );
        }
        if (row.type === "BUNDLE") {
            return (
                <span className="text-sm font-semibold text-pink-700 bg-pink-50 px-2.5 py-1 rounded-lg font-mono tabular-nums">
                    Tebus {formatCurrency(row.value)}
                </span>
            );
        }
        return (
            <span className="text-lg font-bold text-foreground font-mono tabular-nums">
                {row.type === "DISCOUNT_PERCENT" ? `${row.value}%` : formatCurrency(row.value)}
            </span>
        );
    };

    const renderStatus = (row: Promotion) => {
        const expired = new Date(row.endDate) < new Date();
        if (expired) {
            return (
                <Badge variant="outline" className="text-[11px] font-medium border-red-200 bg-red-50/50 text-red-600 ring-1 ring-red-100 rounded-full px-2.5">
                    <XCircle className="w-3 h-3 mr-1" />
                    Expired
                </Badge>
            );
        }
        if (row.isActive) {
            return (
                <Badge variant="outline" className="text-[11px] font-medium border-emerald-200 bg-emerald-50/50 text-emerald-600 ring-1 ring-emerald-100 rounded-full px-2.5">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Aktif
                </Badge>
            );
        }
        return (
            <Badge variant="outline" className="text-[11px] font-medium border-slate-200 bg-slate-50/50 text-slate-500 ring-1 ring-slate-100 rounded-full px-2.5">
                <Clock className="w-3 h-3 mr-1" />
                Nonaktif
            </Badge>
        );
    };

    return (
        <div className="space-y-4 sm:space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex items-center justify-center w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-200/50 shrink-0">
                        <Sparkles className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Promo</h1>
                        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Kelola promosi, diskon, voucher, dan bundle</p>
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    <ExportMenu module="promotions" branchId={selectedBranchId || undefined} />
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="promotions" actionKey="create">
                        <Button disabled={!canCreate} className="rounded-xl shadow-md shadow-primary/20 text-sm" onClick={() => openForm(null)}>
                            <Plus className="w-4 h-4 mr-2" /> Tambah Promo
                        </Button>
                    </DisabledActionTooltip>
                </div>
            </div>
            {/* Mobile: Floating button */}
            {canCreate && (
                <div className="sm:hidden fixed bottom-4 right-4 z-50">
                    <Button onClick={() => openForm(null)} size="icon" className="h-12 w-12 rounded-full shadow-xl shadow-primary/30 bg-gradient-to-br from-violet-500 to-purple-600">
                        <Plus className="w-5 h-5" />
                    </Button>
                </div>
            )}

            {/* Search + Filter Bar */}
            {/* Mobile: search + filter button + stats below */}
            <div className="sm:hidden space-y-2">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Cari promo..." value={searchInput} onChange={(e) => handleSearch(e.target.value)} className="pl-9 rounded-xl h-9 text-sm" />
                        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 rounded-xl h-9 gap-1.5 relative" onClick={() => setFilterSheetOpen(true)}>
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span className="text-xs">Filter</span>
                        {activeFilters.type !== "ALL" && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">1</span>
                        )}
                    </Button>
                    <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-0" showCloseButton={false}>
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                            </div>
                            <SheetHeader className="p-0 pb-4">
                                <SheetTitle className="text-base font-bold">Filter Tipe Promo</SheetTitle>
                            </SheetHeader>
                            <div className="space-y-1">
                                {typeFilterOptions.map((opt) => {
                                    const isActive = activeFilters.type === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            onClick={() => { handleFilterType(opt.value); setFilterSheetOpen(false); }}
                                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}
                                        >
                                            <span>{opt.label}</span>
                                            {isActive && <Check className="w-4 h-4" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
                {/* Mobile: Stats below search */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                    <div className="inline-flex items-center gap-1 bg-slate-100/80 text-slate-600 rounded-full px-2 py-1 text-[11px] font-medium shrink-0">
                        <Package className="w-3 h-3" />
                        <span className="font-mono tabular-nums">{stats.total}</span> Total
                    </div>
                    <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-emerald-100 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="font-mono tabular-nums">{stats.active}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 bg-red-50 text-red-500 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-red-100 shrink-0">
                        <XCircle className="w-3 h-3" />
                        <span className="font-mono tabular-nums">{stats.expired}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-orange-100 shrink-0">
                        <Ticket className="w-3 h-3" />
                        <span className="font-mono tabular-nums">{stats.vouchers}</span>
                    </div>
                </div>
            </div>

            {/* Desktop: search left + pills right, 1 row */}
            <div className="hidden sm:flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Cari promo..." value={searchInput} onChange={(e) => handleSearch(e.target.value)} className="pl-9 rounded-xl h-10" />
                    {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {typeFilterOptions.map((opt) => (
                        <button key={opt.value} onClick={() => handleFilterType(opt.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${activeFilters.type === opt.value ? "bg-foreground text-background shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Desktop: stats bar below search */}
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 bg-slate-100/80 text-slate-600 rounded-full px-3 py-1.5 text-xs font-medium">
                    <Package className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{stats.total}</span> Total
                </div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-emerald-100">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{stats.active}</span> Aktif
                </div>
                <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-500 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-red-100">
                    <XCircle className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{stats.expired}</span> Expired
                </div>
                <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-orange-100">
                    <Ticket className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{stats.vouchers}</span> Voucher
                </div>
            </div>

            {/* Card List */}
            <div className="space-y-3">
                {loading && data.promotions.length === 0 ? (
                    <>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-xl border bg-white p-4 border-l-4 border-l-slate-200">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-4 w-36" />
                                            <Skeleton className="h-4 w-16 rounded-full" />
                                        </div>
                                        <Skeleton className="h-3 w-28" />
                                        <Skeleton className="h-3 w-40" />
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                        <Skeleton className="h-6 w-16" />
                                        <Skeleton className="h-5 w-14 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                ) : data.promotions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <Percent className="w-10 h-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-medium">Belum ada promo</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Tambahkan promo pertama Anda</p>
                    </div>
                ) : (
                    <div className={loading ? "space-y-2 sm:space-y-3 opacity-50 pointer-events-none transition-opacity" : "space-y-2 sm:space-y-3"}>
                        {data.promotions.map((row) => {
                            const t = typeLabels[row.type];
                            const TypeIcon = t?.icon || Percent;
                            const isExpired = new Date(row.endDate) < new Date();

                            return (
                                <div key={row.id} className={`rounded-lg sm:rounded-xl border bg-white hover:shadow-md transition-all group border-l-4 ${t?.borderColor || "border-l-slate-300"}`}>
                                    {/* Mobile */}
                                    <div className="sm:hidden px-2.5 py-2 space-y-1">
                                        <div className="flex items-center justify-between gap-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <TypeIcon className={`w-3.5 h-3.5 shrink-0 ${t?.iconBg ? t.iconBg.split(" ")[1] : "text-slate-500"}`} />
                                                <p className="text-xs font-bold text-foreground truncate">{row.name}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {renderStatus(row)}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                                                <Badge className={`text-[8px] font-medium px-1.5 py-0 rounded-full border-0 ${t?.gradient || "bg-slate-500 text-white"}`}>
                                                    {t?.label || row.type}
                                                </Badge>
                                                {row.branch && (
                                                    <span className="flex items-center gap-0.5 text-[10px] text-blue-600">
                                                        <MapPin className="w-2.5 h-2.5" />{row.branch.name}
                                                    </span>
                                                )}
                                                <span className="font-mono tabular-nums">
                                                    {format(new Date(row.startDate), "dd/MM")} → {format(new Date(row.endDate), "dd/MM")}
                                                </span>
                                                {isExpired && <span className="text-[8px] font-medium text-red-500 bg-red-50 px-1 rounded">Exp</span>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="text-[11px]">{renderValue(row)}</div>
                                                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="promotions" actionKey="update">
                                                    <Button disabled={!canUpdate} variant="ghost" size="icon-xs" className="rounded-md hover:bg-blue-50 hover:text-blue-600" onClick={() => openForm(row)}>
                                                        <Pencil className="w-3 h-3" />
                                                    </Button>
                                                </DisabledActionTooltip>
                                                <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="promotions" actionKey="delete">
                                                    <Button disabled={!canDelete} variant="ghost" size="icon-xs" className="rounded-md text-red-500 hover:bg-red-50" onClick={() => handleDelete(row.id)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </DisabledActionTooltip>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Desktop */}
                                    <div className="hidden sm:flex items-center gap-4 p-4">
                                        <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${t?.iconBg || "bg-slate-100 text-slate-500"}`}>
                                            <TypeIcon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-foreground truncate">{row.name}</p>
                                                <Badge className={`text-[10px] font-medium px-2 py-0 rounded-full border-0 shrink-0 ${t?.gradient || "bg-slate-500 text-white"}`}>{t?.label || row.type}</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate flex items-center gap-2">
                                                <span>{row.product ? `Produk: ${row.product.name}` : row.category ? `Kategori: ${row.category.name}` : "Semua produk"}</span>
                                                {row.branch && (
                                                    <span className="inline-flex items-center gap-0.5 text-blue-600 shrink-0">
                                                        <MapPin className="w-3 h-3" />{row.branch.name}
                                                    </span>
                                                )}
                                            </p>
                                            <div className={`flex items-center gap-1.5 text-xs ${isExpired ? "text-red-400" : "text-muted-foreground"}`}>
                                                <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${isExpired ? "text-red-400" : "text-muted-foreground/60"}`} />
                                                <span className="font-mono tabular-nums text-xs">{format(new Date(row.startDate), "dd/MM/yy")} → {format(new Date(row.endDate), "dd/MM/yy")}</span>
                                                {isExpired && <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Expired</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            <div className="text-right">{renderValue(row)}</div>
                                            <div>{renderStatus(row)}</div>
                                            <div className="flex gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="promotions" actionKey="update">
                                                    <Button disabled={!canUpdate} variant="ghost" size="icon-sm" className="rounded-lg hover:bg-blue-50 hover:text-blue-600" onClick={() => openForm(row)}><Pencil className="w-3.5 h-3.5" /></Button>
                                                </DisabledActionTooltip>
                                                <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="promotions" actionKey="delete">
                                                    <Button disabled={!canDelete} variant="ghost" size="icon-sm" className="rounded-lg text-red-500 hover:bg-red-50" onClick={() => handleDelete(row.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                                </DisabledActionTooltip>
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
                onPageChange={(p) => qp.setPage(p)}
                onPageSizeChange={(s) => qp.setParams({ pageSize: s, page: 1 })}
            />

            {/* Promo Form Dialog */}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
                <DialogContent className="rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-t-2xl shrink-0" />
                    <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 shrink-0"><DialogTitle className="text-base sm:text-lg font-bold">{editing ? "Edit Promo" : "Tambah Promo Baru"}</DialogTitle></DialogHeader>
                    {open && (
                        <PromotionForm
                            key={editing?.id ?? "new"}
                            editing={editing}
                            branchId={selectedBranchId || undefined}
                            onSuccess={() => { setOpen(false); setEditing(null); fetchData({}); }}
                            onCancel={() => { setOpen(false); setEditing(null); }}
                        />
                    )}
                </DialogContent>
            </Dialog>
            <ActionConfirmDialog
                open={confirmOpen}
                onOpenChange={(v) => { setConfirmOpen(v); if (!v) setPendingConfirmAction(null); }}
                kind="delete"
                title="Konfirmasi Hapus"
                description={confirmText}
                confirmLabel="Ya, Hapus"
                onConfirm={async () => { await pendingConfirmAction?.(); }}
                confirmDisabled={!canDelete}
                size="sm"
            />
        </div>
    );
}
