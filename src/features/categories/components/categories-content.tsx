"use client";

import { useEffect, useState, useMemo, useTransition , useRef } from "react";
import { createCategory, updateCategory, deleteCategory, getCategories } from "@/features/categories";
import { useMenuActionAccess } from "@/features/access-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import type { SmartColumn } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, FolderTree, Folder, Layers, PackageCheck, FolderOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/types";

export function CategoriesContent() {
    const [data, setData] = useState<{ categories: Category[]; total: number; totalPages: number }>({ categories: [], total: 0, totalPages: 0 });
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Category | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [loading, startTransition] = useTransition();
    const { canAction, cannotMessage } = useMenuActionAccess("categories");
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canDelete = canAction("delete");

    // --- Stats ---
    const stats = useMemo(() => {
        const categories = data.categories;
        const total = data.total;
        const withProducts = categories.filter((c) => c._count.products > 0).length;
        const empty = categories.filter((c) => c._count.products === 0).length;
        return { total, withProducts, empty };
    }, [data.categories, data.total]);

    const fetchData = (params: { search?: string; page?: number; pageSize?: number }) => {
        startTransition(async () => {
            const result = await getCategories({ search: params.search ?? search, page: params.page ?? page, perPage: params.pageSize ?? pageSize });
            setData(result);
        });
    };

    const didFetchRef = useRef(false);
    useEffect(() => {
        if (didFetchRef.current) return;
        didFetchRef.current = true;
        fetchData({});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (formData: FormData) => {
        if (editing ? !canUpdate : !canCreate) { toast.error(cannotMessage(editing ? "update" : "create")); return; }
        const result = editing ? await updateCategory(editing.id, formData) : await createCategory(formData);
        if (result.error) { toast.error(result.error); }
        else { toast.success(editing ? "Kategori berhasil diupdate" : "Kategori berhasil ditambahkan"); setOpen(false); setEditing(null); fetchData({}); }
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
        setPendingDeleteId(id);
        setConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
        if (!pendingDeleteId) return;
        const id = pendingDeleteId;
        setPendingDeleteId(null);
        setConfirmOpen(false);
        const result = await deleteCategory(id);
        if (result.error) toast.error(result.error); else { toast.success("Kategori berhasil dihapus"); fetchData({}); }
    };

    const columns: SmartColumn<Category>[] = [
        {
            key: "name", header: "Nama Kategori", sortable: true,
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 shrink-0">
                        <Folder className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-sm truncate text-foreground">{row.name}</p>
                        {row.description && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{row.description}</p>
                        )}
                    </div>
                </div>
            ),
            exportValue: (row) => row.name,
        },
        {
            key: "description", header: "Deskripsi",
            render: (row) => (
                <span className="text-xs text-muted-foreground line-clamp-1">{row.description || "-"}</span>
            ),
            exportValue: (row) => row.description || "-",
        },
        {
            key: "products", header: "Jumlah Produk", align: "center", sortable: true,
            render: (row) => {
                const count = row._count.products;
                if (count === 0) {
                    return (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-slate-500 bg-slate-100">
                            0
                        </span>
                    );
                }
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-sm">
                        {count}
                    </span>
                );
            },
            exportValue: (row) => row._count.products,
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "90px",
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                        <Button
                            disabled={!canUpdate}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            onClick={() => { setEditing(row); setOpen(true); }}
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                    </DisabledActionTooltip>
                    <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                        <Button
                            disabled={!canDelete}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                            onClick={() => handleDelete(row.id)}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </DisabledActionTooltip>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* --- Header --- */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/20">
                        <FolderTree className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Kategori Produk</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Kelola kategori produk Anda{" "}
                            <Badge variant="secondary" className="ml-1 rounded-full text-xs tabular-nums font-medium">
                                {data.total} kategori
                            </Badge>
                        </p>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                    <Button
                        disabled={!canCreate}
                        className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-md shadow-emerald-500/20 text-white"
                        onClick={() => { setEditing(null); setOpen(true); }}
                    >
                        <Plus className="w-4 h-4 mr-2" /> Tambah Kategori
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* --- Stats Bar --- */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/80 border border-slate-200/60">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shadow-sm">
                        <Layers className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-lg font-bold tabular-nums text-foreground">{stats.total}</p>
                        <p className="text-[11px] text-muted-foreground font-medium">Total Kategori</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50/80 border border-emerald-200/60">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-sm">
                        <PackageCheck className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-lg font-bold tabular-nums text-foreground">{stats.withProducts}</p>
                        <p className="text-[11px] text-muted-foreground font-medium">Memiliki Produk</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/80 border border-amber-200/60">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
                        <FolderOpen className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-lg font-bold tabular-nums text-foreground">{stats.empty}</p>
                        <p className="text-[11px] text-muted-foreground font-medium">Kategori Kosong</p>
                    </div>
                </div>
            </div>

            {/* --- Table --- */}
            <SmartTable<Category> data={data.categories} columns={columns} totalItems={data.total} totalPages={data.totalPages}
                currentPage={page} pageSize={pageSize} loading={loading} title="Daftar Kategori"
                mobileRender={(row) => (
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm truncate text-foreground">{row.name}</p>
                            <Badge variant="secondary" className="rounded-full text-[10px] font-medium shrink-0">
                                {row._count.products} produk
                            </Badge>
                        </div>
                        {row.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.description}</p>
                        )}
                    </div>
                )} titleIcon={<FolderTree className="w-4 h-4 text-emerald-500" />}
                searchPlaceholder="Cari kategori..." onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }} onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                selectable selectedRows={selectedRows} onSelectionChange={setSelectedRows} rowKey={(r) => r.id} exportFilename="kategori"
                emptyIcon={
                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 mx-auto">
                        <FolderTree className="w-8 h-8 text-emerald-400" />
                    </div>
                }
                emptyTitle="Belum ada kategori"
                emptyDescription="Mulai tambahkan kategori pertama untuk mengelompokkan produk Anda."
                emptyAction={
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                        <Button
                            disabled={!canCreate}
                            variant="outline"
                            size="sm"
                            className="rounded-xl mt-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => setOpen(true)}
                        >
                            <Plus className="w-3 h-3 mr-1" /> Tambah Kategori
                        </Button>
                    </DisabledActionTooltip>
                }
            />

            {/* --- Create/Edit Dialog --- */}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
                <DialogContent className="rounded-2xl max-w-sm p-0 overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500" />
                    <div className="px-6 pt-4 pb-6">
                        <DialogHeader className="pb-4">
                            <DialogTitle className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-md shadow-emerald-500/20">
                                    {editing ? (
                                        <Pencil className="w-5 h-5 text-white" />
                                    ) : (
                                        <Plus className="w-5 h-5 text-white" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-lg font-bold">{editing ? "Edit Kategori" : "Tambah Kategori"}</p>
                                    <p className="text-xs font-normal text-muted-foreground mt-0.5">
                                        {editing ? "Perbarui informasi kategori" : "Buat kategori baru untuk produk"}
                                    </p>
                                </div>
                            </DialogTitle>
                        </DialogHeader>
                        <form action={handleSubmit} className={`space-y-4 ${editing ? (!canUpdate ? "pointer-events-none opacity-70" : "") : (!canCreate ? "pointer-events-none opacity-70" : "")}`}>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Nama Kategori <span className="text-red-400">*</span></Label>
                                <Input name="name" defaultValue={editing?.name || ""} required className="rounded-xl" autoFocus placeholder="Masukkan nama kategori" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Deskripsi</Label>
                                <Input name="description" defaultValue={editing?.description || ""} className="rounded-xl" placeholder="Deskripsi singkat (opsional)" />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }} className="rounded-xl">
                                    Batal
                                </Button>
                                <Button
                                    disabled={editing ? !canUpdate : !canCreate}
                                    type="submit"
                                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-md shadow-emerald-500/20 text-white"
                                >
                                    {editing ? "Update" : "Simpan"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>

            {/* --- Confirm Delete Dialog --- */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm p-0 overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-orange-500" />
                    <div className="px-6 pt-4 pb-6">
                        <DialogHeader className="pb-4">
                            <DialogTitle className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-md shadow-red-500/20">
                                    <AlertTriangle className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold">Hapus Kategori</p>
                                    <p className="text-xs font-normal text-muted-foreground mt-0.5">Tindakan ini tidak dapat dibatalkan</p>
                                </div>
                            </DialogTitle>
                        </DialogHeader>
                        <div className="rounded-xl bg-red-50 border border-red-100 p-3 mb-4">
                            <p className="text-sm text-red-700">
                                Yakin ingin menghapus kategori ini? Semua data terkait kategori akan dihapus secara permanen.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingDeleteId(null); }} className="rounded-xl">
                                Batal
                            </Button>
                            <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                                <Button
                                    disabled={!canDelete}
                                    variant="destructive"
                                    onClick={confirmDelete}
                                    className="rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-md shadow-red-500/20"
                                >
                                    Ya, Hapus
                                </Button>
                            </DisabledActionTooltip>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
