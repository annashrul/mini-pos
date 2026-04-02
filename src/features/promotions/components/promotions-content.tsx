"use client";

import { useEffect, useState, useTransition, useMemo , useRef } from "react";
import { deletePromotion, getPromotions } from "@/features/promotions";
import { useMenuActionAccess } from "@/features/access-control";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Percent, Tag, Gift, Ticket, Package, CalendarDays, Sparkles, Clock, CheckCircle2, XCircle, Search, Loader2 } from "lucide-react";
import { PaginationControl } from "@/components/ui/pagination-control";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Promotion } from "@/types";
import { PromotionForm } from "./promotion-form";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
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
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ type: "ALL" });
    const [sortKey] = useState("");
    const [sortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();
    const { canAction, cannotMessage } = useMenuActionAccess("promotions");
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canDelete = canAction("delete");

    const stats = useMemo(() => {
        const now = new Date();
        const promos = data.promotions;
        return {
            total: data.total,
            active: promos.filter((p) => p.isActive && new Date(p.endDate) >= now).length,
            expired: promos.filter((p) => new Date(p.endDate) < now).length,
            vouchers: promos.filter((p) => p.type === "VOUCHER").length,
        };
    }, [data]);

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const result = await getPromotions({
                search: params.search ?? search,
                ...(f.type !== "ALL" ? { type: f.type } : {}),
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(sk ? { sortBy: sk, sortDir: sd } : {}),
            });
            setData(result as never);
        });
    };

    const didFetchRef = useRef(false);
    useEffect(() => {
        if (didFetchRef.current) return;
        didFetchRef.current = true;
        fetchData({});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const openForm = (promo: Promotion | null) => {
        if (promo ? !canUpdate : !canCreate) { toast.error(cannotMessage(promo ? "update" : "create")); return; }
        setEditing(promo);
        setOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
        if (!confirm("Hapus promo ini?")) return;
        const result = await deletePromotion(id);
        if (result.error) toast.error(result.error);
        else { toast.success("Promo dihapus"); fetchData({}); }
    };

    const handleSearch = (value: string) => {
        setSearch(value);
        setPage(1);
        fetchData({ search: value, page: 1 });
    };

    const handleFilterType = (type: string) => {
        const newFilters = { ...activeFilters, type };
        setActiveFilters(newFilters);
        setPage(1);
        fetchData({ filters: newFilters, page: 1 });
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
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-200/50">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Promo</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">Kelola promosi, diskon, voucher, dan program bundle</p>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                    <Button disabled={!canCreate} className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all" onClick={() => openForm(null)}>
                        <Plus className="w-4 h-4 mr-2" /> Tambah Promo
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-2 flex-wrap">
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

            {/* Search + Filter Bar */}
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari promo..."
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9 rounded-xl h-10"
                        />
                    </div>
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {typeFilterOptions.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handleFilterType(opt.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                activeFilters.type === opt.value
                                    ? "bg-foreground text-background shadow-sm"
                                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
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
                    <div className={loading ? "space-y-3 opacity-50 pointer-events-none transition-opacity" : "space-y-3"}>
                    {data.promotions.map((row) => {
                        const t = typeLabels[row.type];
                        const TypeIcon = t?.icon || Percent;
                        const isExpired = new Date(row.endDate) < new Date();

                        return (
                            <div
                                key={row.id}
                                className={`rounded-xl border bg-white hover:shadow-md transition-all group p-4 border-l-4 ${t?.borderColor || "border-l-slate-300"}`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Left: Type Icon */}
                                    <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${t?.iconBg || "bg-slate-100 text-slate-500"}`}>
                                        <TypeIcon className="w-5 h-5" />
                                    </div>

                                    {/* Middle: Info */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-foreground truncate">{row.name}</p>
                                            <Badge className={`text-[10px] font-medium px-2 py-0 rounded-full border-0 shrink-0 ${t?.gradient || "bg-slate-500 text-white"}`}>
                                                {t?.label || row.type}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {row.product ? `Produk: ${row.product.name}` : row.category ? `Kategori: ${row.category.name}` : "Semua produk"}
                                        </p>
                                        <div className={`flex items-center gap-1.5 text-xs ${isExpired ? "text-red-400" : "text-muted-foreground"}`}>
                                            <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${isExpired ? "text-red-400" : "text-muted-foreground/60"}`} />
                                            <span className="font-mono tabular-nums">
                                                {format(new Date(row.startDate), "dd/MM/yy")} → {format(new Date(row.endDate), "dd/MM/yy")}
                                            </span>
                                            {isExpired && (
                                                <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded ml-0.5">Expired</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Value + Status + Actions */}
                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="text-right">
                                            {renderValue(row)}
                                        </div>
                                        <div>
                                            {renderStatus(row)}
                                        </div>
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                                                <Button disabled={!canUpdate} variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => openForm(row)}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                            </DisabledActionTooltip>
                                            <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                                                <Button disabled={!canDelete} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors" onClick={() => handleDelete(row.id)}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
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
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
            />

            {/* Promo Form Dialog */}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
                <DialogContent className="rounded-2xl w-[95vw] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader><DialogTitle className="text-lg font-bold">{editing ? "Edit Promo" : "Tambah Promo Baru"}</DialogTitle></DialogHeader>
                    {open && (
                        <PromotionForm
                            key={editing?.id ?? "new"}
                            editing={editing}
                            onSuccess={() => { setOpen(false); setEditing(null); fetchData({}); }}
                            onCancel={() => { setOpen(false); setEditing(null); }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
