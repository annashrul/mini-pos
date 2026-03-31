"use client";

import { useState, useTransition } from "react";
import { deletePromotion, getPromotions } from "@/features/promotions";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, Percent, Tag, Gift, Ticket, Package } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Promotion } from "@/types";
import { PromotionForm } from "./promotion-form";

interface Props {
    initialData: { promotions: Promotion[]; total: number; totalPages: number };
}

const typeLabels: Record<string, { label: string; icon: typeof Percent; color: string }> = {
    DISCOUNT_PERCENT: { label: "Diskon %", icon: Percent, color: "bg-blue-100 text-blue-700" },
    DISCOUNT_AMOUNT: { label: "Diskon Rp", icon: Tag, color: "bg-green-100 text-green-700" },
    BUY_X_GET_Y: { label: "Beli X Gratis Y", icon: Gift, color: "bg-purple-100 text-purple-700" },
    VOUCHER: { label: "Voucher", icon: Ticket, color: "bg-orange-100 text-orange-700" },
    BUNDLE: { label: "Tebus Murah", icon: Package, color: "bg-pink-100 text-pink-700" },
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
            render: (row) => (
                <div>
                    <p className="text-sm font-medium">{row.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                        {row.product ? `Produk: ${row.product.name}` : row.category ? `Kategori: ${row.category.name}` : "Semua produk"}
                    </p>
                </div>
            ),
            exportValue: (row) => row.name,
        },
        {
            key: "type", header: "Tipe",
            render: (row) => {
                const t = typeLabels[row.type];
                return <Badge className={t?.color || ""}>{t?.label || row.type}</Badge>;
            },
            exportValue: (row) => typeLabels[row.type]?.label || row.type,
        },
        {
            key: "value", header: "Nilai", sortable: true, align: "right",
            render: (row) => {
                if (row.type === "BUY_X_GET_Y") return <span className="text-xs">Beli {(row as Promotion & { buyQty?: number }).buyQty || 1} Gratis {(row as Promotion & { getQty?: number }).getQty || 1}</span>;
                if (row.type === "BUNDLE") return <span className="text-xs">Tebus {formatCurrency(row.value)} (maks {(row as Promotion & { maxDiscount?: number }).maxDiscount ? Math.floor((row as Promotion & { maxDiscount?: number }).maxDiscount || 0) : "otomatis"})</span>;
                return <span className="text-xs">{row.type === "DISCOUNT_PERCENT" ? `${row.value}%` : formatCurrency(row.value)}</span>;
            },
            exportValue: (row) => row.value,
        },
        {
            key: "period", header: "Periode",
            render: (row) => <span className="text-xs text-muted-foreground">{format(new Date(row.startDate), "dd/MM/yy")} - {format(new Date(row.endDate), "dd/MM/yy")}</span>,
            exportValue: (row) => `${format(new Date(row.startDate), "dd/MM/yy")} - ${format(new Date(row.endDate), "dd/MM/yy")}`,
        },
        {
            key: "status", header: "Status", align: "center",
            render: (row) => {
                const expired = new Date(row.endDate) < new Date();
                return <Badge className={expired ? "bg-red-100 text-red-700" : row.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}>
                    {expired ? "Expired" : row.isActive ? "Aktif" : "Nonaktif"}
                </Badge>;
            },
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "90px",
            render: (row) => (
                <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openForm(row)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(row.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
            ),
        },
    ];

    const filters: SmartFilter[] = [
        { key: "type", label: "Tipe Promo", type: "select", options: Object.entries(typeLabels).map(([k, v]) => ({ value: k, label: v.label })) },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Promo</h1>
                    <p className="text-muted-foreground text-sm">Kelola promo, diskon, dan voucher</p>
                </div>
                <Button className="rounded-lg" onClick={() => openForm(null)}><Plus className="w-4 h-4 mr-2" /> Tambah Promo</Button>
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
                    <DialogHeader><DialogTitle>{editing ? "Edit Promo" : "Tambah Promo Baru"}</DialogTitle></DialogHeader>
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
