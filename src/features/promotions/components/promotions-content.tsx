"use client";

import { useState, useTransition, useMemo } from "react";
import { deletePromotion, getPromotions } from "@/features/promotions";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, Percent, Tag, Gift, Ticket, Package, CalendarDays, Sparkles, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Promotion } from "@/types";
import { PromotionForm } from "./promotion-form";

interface Props {
    initialData: { promotions: Promotion[]; total: number; totalPages: number };
}

const typeLabels: Record<string, { label: string; icon: typeof Percent; color: string; gradient: string; iconBg: string }> = {
    DISCOUNT_PERCENT: { label: "Diskon %", icon: Percent, color: "bg-blue-100 text-blue-700", gradient: "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-200", iconBg: "bg-blue-100 text-blue-600" },
    DISCOUNT_AMOUNT: { label: "Diskon Rp", icon: Tag, color: "bg-green-100 text-green-700", gradient: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm shadow-green-200", iconBg: "bg-emerald-100 text-emerald-600" },
    BUY_X_GET_Y: { label: "Beli X Gratis Y", icon: Gift, color: "bg-purple-100 text-purple-700", gradient: "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-sm shadow-purple-200", iconBg: "bg-purple-100 text-purple-600" },
    VOUCHER: { label: "Voucher", icon: Ticket, color: "bg-orange-100 text-orange-700", gradient: "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-200", iconBg: "bg-orange-100 text-orange-600" },
    BUNDLE: { label: "Tebus Murah", icon: Package, color: "bg-pink-100 text-pink-700", gradient: "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm shadow-pink-200", iconBg: "bg-pink-100 text-pink-600" },
};

export function PromotionsContent({ initialData }: Props) {
    const [data, setData] = useState(initialData);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Promotion | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ type: "ALL" });
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [sortKey, setSortKey] = useState("");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();

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

    const openForm = (promo: Promotion | null) => {
        setEditing(promo);
        setOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus promo ini?")) return;
        const result = await deletePromotion(id);
        if (result.error) toast.error(result.error);
        else { toast.success("Promo dihapus"); fetchData({}); }
    };

    const columns: SmartColumn<Promotion>[] = [
        {
            key: "name", header: "Nama Promo", sortable: true,
            render: (row) => {
                const t = typeLabels[row.type];
                const TypeIcon = t?.icon || Percent;
                return (
                    <div className="flex items-center gap-2.5">
                        <div className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${t?.iconBg || "bg-slate-100 text-slate-500"}`}>
                            <TypeIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{row.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                                {row.product ? `Produk: ${row.product.name}` : row.category ? `Kategori: ${row.category.name}` : "Semua produk"}
                            </p>
                        </div>
                    </div>
                );
            },
            exportValue: (row) => row.name,
        },
        {
            key: "type", header: "Tipe",
            render: (row) => {
                const t = typeLabels[row.type];
                return (
                    <Badge className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border-0 ${t?.gradient || "bg-slate-500 text-white"}`}>
                        {t?.label || row.type}
                    </Badge>
                );
            },
            exportValue: (row) => typeLabels[row.type]?.label || row.type,
        },
        {
            key: "value", header: "Nilai", sortable: true, align: "right",
            render: (row) => {
                if (row.type === "BUY_X_GET_Y") {
                    return (
                        <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                            Beli {(row as Promotion & { buyQty?: number }).buyQty || 1} Gratis {(row as Promotion & { getQty?: number }).getQty || 1}
                        </span>
                    );
                }
                if (row.type === "BUNDLE") {
                    return (
                        <span className="text-xs font-medium text-pink-700 bg-pink-50 px-2 py-0.5 rounded-md font-mono tabular-nums">
                            Tebus {formatCurrency(row.value)}
                        </span>
                    );
                }
                return (
                    <span className="text-sm font-semibold text-foreground font-mono tabular-nums">
                        {row.type === "DISCOUNT_PERCENT" ? `${row.value}%` : formatCurrency(row.value)}
                    </span>
                );
            },
            exportValue: (row) => row.value,
        },
        {
            key: "period", header: "Periode",
            render: (row) => {
                const isExpired = new Date(row.endDate) < new Date();
                return (
                    <div className={`flex items-center gap-1.5 text-xs ${isExpired ? "text-red-400" : "text-muted-foreground"}`}>
                        <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${isExpired ? "text-red-400" : "text-muted-foreground/60"}`} />
                        <div className="flex flex-col leading-tight">
                            <span className="font-mono tabular-nums">{format(new Date(row.startDate), "dd/MM/yy")}</span>
                            <span className={`font-mono tabular-nums ${isExpired ? "line-through decoration-red-300" : ""}`}>{format(new Date(row.endDate), "dd/MM/yy")}</span>
                        </div>
                        {isExpired && (
                            <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded ml-0.5">Exp</span>
                        )}
                    </div>
                );
            },
            exportValue: (row) => `${format(new Date(row.startDate), "dd/MM/yy")} - ${format(new Date(row.endDate), "dd/MM/yy")}`,
        },
        {
            key: "status", header: "Status", align: "center",
            render: (row) => {
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
            },
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "90px",
            render: (row) => (
                <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => openForm(row)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors" onClick={() => handleDelete(row.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
            ),
        },
    ];

    const filters: SmartFilter[] = [
        { key: "type", label: "Tipe Promo", type: "select", options: Object.entries(typeLabels).map(([k, v]) => ({ value: k, label: v.label })) },
    ];

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
                <Button className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all" onClick={() => openForm(null)}>
                    <Plus className="w-4 h-4 mr-2" /> Tambah Promo
                </Button>
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

            <SmartTable<Promotion>
                data={data.promotions} columns={columns} totalItems={data.total} totalPages={data.totalPages}
                currentPage={page} pageSize={pageSize} loading={loading}
                title="Daftar Promo" titleIcon={<Percent className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari promo..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                sortKey={sortKey} sortDir={sortDir} onSort={(k, d) => { setSortKey(k); setSortDir(d); setPage(1); fetchData({ page: 1, sortKey: k, sortDir: d }); }}
                filters={filters} activeFilters={activeFilters}
                onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
                selectable selectedRows={selectedRows} onSelectionChange={setSelectedRows} rowKey={(r) => r.id}
                exportFilename="promo" emptyIcon={<Percent className="w-10 h-10 text-muted-foreground/30" />} emptyTitle="Belum ada promo"
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
