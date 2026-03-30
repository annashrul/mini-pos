"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { deleteProduct, getProducts } from "@/features/products";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, Package, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Product, Category, Branch } from "@/types";
import { ProductFormDialog } from "./product-form-dialog";
import { ProductImportDialog } from "./product-import-dialog";

interface Props {
    productsData: {
        products: Product[];
        total: number;
        totalPages: number;
        currentPage: number;
    };
    categories: Category[];
    brands: { id: string; name: string }[];
    branches: Branch[];
    filters: { search: string; categoryId: string; status: string };
}

export function ProductsContent({ productsData: initialData, categories, brands, branches, filters: initialFilters }: Props) {
    const [data, setData] = useState(initialData);
    const [open, setOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [page, setPage] = useState(initialData.currentPage);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState(initialFilters.search);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        categoryId: initialFilters.categoryId || "ALL",
        status: initialFilters.status || "ALL",
    });
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [sortKey, setSortKey] = useState<string>("");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                limit: params.pageSize ?? pageSize,
                ...(f.categoryId !== "ALL" ? { categoryId: f.categoryId } : {}),
                ...(f.status !== "ALL" ? { status: f.status } : {}),
                ...(sk ? { sortBy: sk, sortDir: sd } : {}),
            };
            const result = await getProducts(query);
            setData(result);
        });
    };
    const openCreateDialog = () => {
        setEditingProduct(null);
        setOpen(true);
    };

    const openEditDialog = (product: Product) => {
        setEditingProduct(product);
        setOpen(true);
    };

    const handleDelete = async (id: string) => {
        setConfirmText("Yakin ingin menghapus produk ini?");
        setPendingConfirmAction(() => async () => {
            const result = await deleteProduct(id);
            if (result.error) toast.error(result.error);
            else { toast.success("Produk berhasil dihapus"); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const handleBulkDelete = async (ids: string[]) => {
        setConfirmText(`Yakin ingin menghapus ${ids.length} produk?`);
        setPendingConfirmAction(() => async () => {
            for (const id of ids) await deleteProduct(id);
            toast.success(`${ids.length} produk dihapus`);
            setSelectedRows(new Set());
            fetchData({});
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const handleFormSubmitted = () => {
        setOpen(false);
        setEditingProduct(null);
        fetchData({});
    };

    const columns: SmartColumn<Product>[] = [
        {
            key: "code", header: "Kode", sortable: true, width: "100px",
            render: (row) => <span className="font-mono text-xs">{row.code}</span>,
            exportValue: (row) => row.code,
        },
        {
            key: "name", header: "Nama Produk", sortable: true,
            render: (row) => (
                <div className="flex items-center gap-3">
                    {row.imageUrl ? (
                        <Image src={row.imageUrl} alt={row.name} width={36} height={36} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-border/30" />
                    ) : (
                        <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground">
                            {row.name.charAt(0)}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.unit}</p>
                    </div>
                </div>
            ),
            exportValue: (row) => row.name,
        },
        {
            key: "category", header: "Kategori", sortable: true,
            render: (row) => <Badge variant="secondary" className="rounded-lg text-xs">{row.category.name}</Badge>,
            exportValue: (row) => row.category.name,
        },
        {
            key: "purchasePrice", header: "Harga Beli", sortable: true, align: "right",
            render: (row) => <span className="text-xs">{formatCurrency(row.purchasePrice)}</span>,
            exportValue: (row) => row.purchasePrice,
        },
        {
            key: "sellingPrice", header: "Harga Jual", sortable: true, align: "right",
            render: (row) => <span className="text-xs font-medium">{formatCurrency(row.sellingPrice)}</span>,
            exportValue: (row) => row.sellingPrice,
        },
        {
            key: "stock", header: "Stok", sortable: true, align: "center",
            render: (row) => (
                <Badge className={row.stock <= row.minStock ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}>
                    {row.stock}
                </Badge>
            ),
            exportValue: (row) => row.stock,
        },
        {
            key: "status", header: "Status", align: "center",
            render: (row) => (
                <Badge className={row.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                    {row.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
            ),
            exportValue: (row) => row.isActive ? "Aktif" : "Nonaktif",
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "90px",
            render: (row) => (
                <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEditDialog(row)}>
                        <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(row.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    const filters: SmartFilter[] = [
        {
            key: "categoryId", label: "Kategori", type: "select",
            options: categories.map((c) => ({ value: c.id, label: c.name })),
        },
        {
            key: "status", label: "Status", type: "select",
            options: [
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Nonaktif" },
            ],
        },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Master Produk</h1>
                    <p className="text-muted-foreground text-sm">Kelola produk Anda</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="rounded-lg" onClick={() => setImportOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" /> Import
                    </Button>
                    <Button className="rounded-lg" onClick={openCreateDialog}>
                        <Plus className="w-4 h-4 mr-2" /> Tambah Produk
                    </Button>
                </div>
            </div>

            <SmartTable<Product>
                data={data.products}
                columns={columns}
                totalItems={data.total}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Daftar Produk"
                titleIcon={<Package className="w-4 h-4 text-muted-foreground" />}
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
                selectable
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                rowKey={(row) => row.id}
                bulkActions={[
                    { label: "Hapus", variant: "destructive", icon: <Trash2 className="w-3 h-3" />, onClick: handleBulkDelete },
                ]}
                exportFilename="produk"
                emptyIcon={<Package className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Tidak ada produk ditemukan"
                emptyAction={
                    <Button variant="outline" size="sm" className="rounded-lg mt-2" onClick={openCreateDialog}>
                        <Plus className="w-3 h-3 mr-1" /> Tambah Produk
                    </Button>
                }
            />

            <ProductFormDialog
                open={open}
                onOpenChange={(v) => {
                    setOpen(v);
                    if (!v) setEditingProduct(null);
                }}
                editingProduct={editingProduct}
                categories={categories}
                brands={brands}
                branches={branches}
                onSubmitted={handleFormSubmitted}
            />
            <ProductImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                onImported={() => fetchData({})}
            />

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Konfirmasi</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">{confirmText}</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-lg">Batal</Button>
                        <Button variant="destructive" onClick={async () => { await pendingConfirmAction?.(); }} className="rounded-lg">Ya, Lanjutkan</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
