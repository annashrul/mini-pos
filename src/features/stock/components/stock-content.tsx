"use client";

import { useState, useTransition } from "react";
import { createStockMovement, getStockMovements } from "@/features/stock";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { SmartSelect } from "@/components/ui/smart-select";
import { Plus, BoxesIcon } from "lucide-react";
import { toast } from "sonner";
import type { StockMovement, ProductBasic } from "@/types";

const typeConfig: Record<string, { label: string; color: string }> = {
    IN: { label: "Masuk", color: "bg-green-100 text-green-700" },
    OUT: { label: "Keluar", color: "bg-red-100 text-red-700" },
    ADJUSTMENT: { label: "Penyesuaian", color: "bg-blue-100 text-blue-700" },
    TRANSFER: { label: "Transfer", color: "bg-purple-100 text-purple-700" },
    OPNAME: { label: "Opname", color: "bg-orange-100 text-orange-700" },
};

interface Props {
    data: { movements: StockMovement[]; total: number; totalPages: number; currentPage: number };
    products: ProductBasic[];
    filters: Record<string, string | undefined>;
}

export function StockContent({ data: initialData, products, filters: initialFilters }: Props) {
    const [data, setData] = useState(initialData);
    const [open, setOpen] = useState(false);
    const [page, setPage] = useState(initialData.currentPage);
    const [pageSize, setPageSize] = useState(15);
    const [search, setSearch] = useState("");
    const [selectedProductId, setSelectedProductId] = useState("");
    const [selectedType, setSelectedType] = useState("IN");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        type: initialFilters.type || "ALL",
    });
    const [sortKey, setSortKey] = useState<string>("");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [loading, startTransition] = useTransition();

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const query = {
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                search: params.search ?? search,
                ...(f.type !== "ALL" ? { type: f.type } : {}),
                ...(f.date_from ? { dateFrom: f.date_from } : {}),
                ...(f.date_to ? { dateTo: f.date_to } : {}),
                ...(sk ? { sortBy: sk, sortDir: sd } : {}),
            };
            const result = await getStockMovements(query);
            setData(result);
        });
    };

    const handleSubmit = async (formData: FormData) => {
        const result = await createStockMovement(formData);
        if (result.error) toast.error(result.error);
        else {
            toast.success("Pergerakan stok berhasil disimpan");
            setOpen(false);
            setSelectedProductId("");
            setSelectedType("IN");
            fetchData({});
        }
    };

    const columns: SmartColumn<StockMovement>[] = [
        {
            key: "product", header: "Produk", sortable: true,
            render: (row) => (
                <div>
                    <p className="font-medium text-sm">{row.product.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{row.product.code}</p>
                </div>
            ),
            exportValue: (row) => `${row.product.name} (${row.product.code})`,
        },
        {
            key: "type", header: "Tipe", align: "center",
            render: (row) => {
                const cfg = typeConfig[row.type] || { label: row.type, color: "bg-slate-100 text-slate-700" };
                return <Badge className={cfg.color}>{cfg.label}</Badge>;
            },
            exportValue: (row) => typeConfig[row.type]?.label || row.type,
        },
        {
            key: "quantity", header: "Qty", align: "center", sortable: true,
            render: (row) => (
                <span className={`font-semibold text-sm ${row.type === "IN" ? "text-green-600" : row.type === "OUT" ? "text-red-600" : "text-blue-600"}`}>
                    {row.type === "OUT" ? "-" : "+"}{row.quantity}
                </span>
            ),
            exportValue: (row) => row.quantity,
        },
        {
            key: "currentStock", header: "Stok Sekarang", align: "center",
            render: (row) => <span className="text-sm">{row.product.stock}</span>,
            exportValue: (row) => row.product.stock,
        },
        {
            key: "note", header: "Catatan",
            render: (row) => <span className="text-xs text-muted-foreground">{row.note || "-"}</span>,
            exportValue: (row) => row.note || "-",
        },
        {
            key: "reference", header: "Referensi",
            render: (row) => <span className="text-xs font-mono text-muted-foreground">{row.reference || "-"}</span>,
            exportValue: (row) => row.reference || "-",
        },
        {
            key: "createdAt", header: "Waktu", sortable: true,
            render: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span>,
            exportValue: (row) => formatDateTime(row.createdAt),
        },
    ];

    const filters: SmartFilter[] = [
        {
            key: "type", label: "Tipe", type: "select",
            options: [
                { value: "IN", label: "Stok Masuk" },
                { value: "OUT", label: "Stok Keluar" },
                { value: "ADJUSTMENT", label: "Penyesuaian" },
                { value: "TRANSFER", label: "Transfer" },
                { value: "OPNAME", label: "Opname" },
            ],
        },
        { key: "date", label: "Tanggal", type: "daterange" },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Manajemen Stok</h1>
                    <p className="text-muted-foreground text-sm">Kelola pergerakan stok produk</p>
                </div>
                <Button className="rounded-lg" onClick={() => setOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Tambah Pergerakan
                </Button>
            </div>

            <SmartTable<StockMovement>
                data={data.movements}
                columns={columns}
                totalItems={data.total}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Pergerakan Stok"
                titleIcon={<BoxesIcon className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari produk..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1); fetchData({ page: 1, sortKey: key, sortDir: dir }); }}
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
                exportFilename="stock-movements"
                emptyIcon={<BoxesIcon className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Belum ada pergerakan stok"
            />

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader><DialogTitle>Tambah Pergerakan Stok</DialogTitle></DialogHeader>
                    <form action={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm">Produk <span className="text-red-400">*</span></Label>
                            <SmartSelect
                                value={selectedProductId}
                                onChange={setSelectedProductId}
                                placeholder="Pilih Produk"
                                onSearch={async (query) =>
                                    products
                                        .filter((p) => {
                                            const q = query.toLowerCase();
                                            return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
                                        })
                                        .map((p) => ({
                                            value: p.id,
                                            label: `${p.code} - ${p.name}`,
                                            description: `Stok: ${p.stock}`,
                                        }))
                                }
                            />
                            <input type="hidden" name="productId" value={selectedProductId} required />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Tipe <span className="text-red-400">*</span></Label>
                            <SmartSelect
                                value={selectedType}
                                onChange={setSelectedType}
                                onSearch={async (query) =>
                                    [
                                        { value: "IN", label: "Stok Masuk" },
                                        { value: "OUT", label: "Stok Keluar" },
                                        { value: "ADJUSTMENT", label: "Penyesuaian" },
                                    ].filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))
                                }
                            />
                            <input type="hidden" name="type" value={selectedType} required />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Quantity <span className="text-red-400">*</span></Label>
                            <Input name="quantity" type="number" min={1} required className="rounded-lg" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Catatan</Label>
                            <Input name="note" className="rounded-lg" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-lg">Batal</Button>
                            <Button type="submit" className="rounded-lg">Simpan</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
