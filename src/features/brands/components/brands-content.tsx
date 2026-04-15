"use client";

import { useEffect, useState, useMemo, useTransition, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createBrand, updateBrand, deleteBrand, getBrands, bulkDeleteBrands } from "@/features/brands";
import { useMenuActionAccess } from "@/features/access-control";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import type { SmartColumn } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, Tag, Package, AlertTriangle, Loader2, Upload } from "lucide-react";
import { BrandImportDialog } from "./brand-import-dialog";
import { toast } from "sonner";
import type { Brand } from "@/types";

const brandFormSchema = z.object({
    name: z.string().min(1, "Nama brand wajib diisi"),
});
type BrandFormValues = z.infer<typeof brandFormSchema>;

export function BrandsContent() {
    const [data, setData] = useState<{ brands: Brand[]; total: number; totalPages: number }>({ brands: [], total: 0, totalPages: 0 });
    const [open, setOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [editing, setEditing] = useState<Brand | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
    const [pendingSubmitValues, setPendingSubmitValues] = useState<BrandFormValues | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [loading, startTransition] = useTransition();
    const { canAction, cannotMessage } = useMenuActionAccess("brands");
    const { canAction: canPlan } = usePlanAccess();
    const canCreate = canAction("create") && canPlan("brands", "create");
    const canUpdate = canAction("update") && canPlan("brands", "update");
    const canDelete = canAction("delete") && canPlan("brands", "delete");

    const stats = useMemo(() => {
        const totalBrands = data.total;
        const withProducts = data.brands.filter((b) => b._count.products > 0).length;
        const withoutProducts = data.brands.filter((b) => b._count.products === 0).length;
        return { totalBrands, withProducts, withoutProducts };
    }, [data]);

    const fetchData = (params: { search?: string; page?: number; pageSize?: number }) => {
        startTransition(async () => {
            const result = await getBrands({
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
            });
            setData(result);
        });
    };

    const didFetchRef = useRef(false);
    useEffect(() => {
        if (didFetchRef.current) return;
        didFetchRef.current = true;
        fetchData({});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const form = useForm<BrandFormValues>({
        resolver: zodResolver(brandFormSchema),
        defaultValues: { name: "" },
    });

    const executeSubmit = async (values: BrandFormValues) => {
        if (editing ? !canUpdate : !canCreate) { toast.error(cannotMessage(editing ? "update" : "create")); return; }
        const fd = new FormData();
        fd.set("name", values.name);
        const result = editing ? await updateBrand(editing.id, fd) : await createBrand(fd);
        if (result.error) { toast.error(result.error); }
        else { toast.success(editing ? "Brand berhasil diupdate" : "Brand berhasil ditambahkan"); setOpen(false); setEditing(null); fetchData({}); }
    };

    const onSubmit = async (values: BrandFormValues) => {
        setPendingSubmitValues(values);
        setSubmitConfirmOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
        setConfirmText("Yakin ingin menghapus brand ini?");
        setPendingConfirmAction(() => async () => {
            const result = await deleteBrand(id);
            if (result.error) toast.error(result.error);
            else { toast.success("Brand berhasil dihapus"); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const columns: SmartColumn<Brand>[] = [
        {
            key: "name",
            header: "Nama Brand",
            sortable: true,
            render: (row) => (
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <span className="font-semibold text-sm text-slate-800">{row.name}</span>
                </div>
            ),
            exportValue: (row) => row.name,
        },
        {
            key: "products",
            header: "Jumlah Produk",
            align: "center",
            sortable: true,
            render: (row) => (
                <Badge className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-sm px-3 py-0.5 text-xs font-semibold">
                    {row._count.products}
                </Badge>
            ),
            exportValue: (row) => row._count.products,
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "90px",
            render: (row) => (
                <div className="flex justify-end gap-0.5">
                    <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="brands" actionKey="update">
                        <Button disabled={!canUpdate} variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => { setEditing(row); form.reset({ name: row.name }); setOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                    </DisabledActionTooltip>
                    <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="brands" actionKey="delete">
                        <Button disabled={!canDelete} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors" onClick={() => handleDelete(row.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </DisabledActionTooltip>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-5">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
                        <Tag className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-800">Brand Produk</h1>
                        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Kelola brand dan merek produk</p>
                    </div>
                </div>
                <div className="hidden sm:flex gap-2">
                    <Button variant="outline" className="rounded-xl border-dashed" onClick={() => setImportOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" /> Import
                    </Button>
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="brands" actionKey="create">
                        <Button disabled={!canCreate} className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all text-xs sm:text-sm"
                            onClick={() => { setEditing(null); form.reset({ name: "" }); setOpen(true); }}>
                            <Plus className="w-4 h-4 mr-1.5 sm:mr-2" /> Tambah Brand
                        </Button>
                    </DisabledActionTooltip>
                </div>
            </div>

            <SmartTable<Brand>
                data={data.brands} columns={columns} totalItems={data.total} totalPages={data.totalPages}
                currentPage={page} pageSize={pageSize} loading={loading}
                title="Daftar Brand"
                mobileRender={(row) => (
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <Tag className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            <span className="font-semibold text-sm text-foreground truncate">{row.name}</span>
                        </div>
                        <Badge className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-sm px-2.5 py-0.5 text-[10px] font-semibold shrink-0">
                            {row._count.products} produk
                        </Badge>
                    </div>
                )}
                titleIcon={<div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"><Tag className="w-4 h-4 text-white" /></div>}
                searchPlaceholder="Cari brand..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                afterFilters={
                    <div className="flex items-center gap-2 flex-wrap px-3 sm:px-5 pb-2">
                        <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] sm:text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                            <Tag className="w-3 h-3 mr-1.5" />
                            Total: {stats.totalBrands}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] sm:text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                            <Package className="w-3 h-3 mr-1.5" />
                            Punya Produk: {stats.withProducts}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] sm:text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                            <AlertTriangle className="w-3 h-3 mr-1.5" />
                            Tanpa Produk: {stats.withoutProducts}
                        </Badge>
                    </div>
                }
                selectable selectedRows={selectedRows} onSelectionChange={setSelectedRows} rowKey={(r) => r.id}
                bulkActions={[{
                    label: "Hapus",
                    variant: "destructive",
                    icon: <Trash2 className="w-3 h-3" />,
                    onClick: async (ids) => {
                        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
                        setConfirmText(`Hapus ${ids.length} brand?`);
                        setPendingConfirmAction(() => async () => {
                            await bulkDeleteBrands(ids);
                            toast.success("Brand dihapus");
                            setSelectedRows(new Set());
                            fetchData({});
                            setConfirmOpen(false);
                            setPendingConfirmAction(null);
                        });
                        setConfirmOpen(true);
                    },
                }]}
                planMenuKey="brands" exportModule="brands"
                emptyIcon={<Tag className="w-10 h-10 text-muted-foreground/30" />} emptyTitle="Belum ada brand"
                emptyAction={
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="brands" actionKey="create">
                        <Button disabled={!canCreate} variant="outline" size="sm" className="rounded-xl mt-2" onClick={() => setOpen(true)}><Plus className="w-3 h-3 mr-1" /> Tambah Brand</Button>
                    </DisabledActionTooltip>
                }
            />

            {/* Floating button mobile */}
            {canCreate && (
                <button onClick={() => { setEditing(null); form.reset({ name: "" }); setOpen(true); }} className="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-95 transition-transform">
                    <Plus className="w-6 h-6" />
                </button>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); form.reset(); } }}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-lg font-bold">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200/50">
                                <Tag className="w-4 h-4 text-white" />
                            </div>
                            {editing ? "Edit Brand" : "Tambah Brand"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className={`space-y-4 mt-1 ${editing ? (!canUpdate ? "pointer-events-none opacity-70" : "") : (!canCreate ? "pointer-events-none opacity-70" : "")}`}>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Nama Brand <span className="text-red-400">*</span></Label>
                            <Input {...form.register("name")} className="rounded-xl h-10" autoFocus placeholder="Masukkan nama brand" />
                            {form.formState.errors.name && <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); form.reset(); }} className="rounded-xl">Batal</Button>
                            <DisabledActionTooltip disabled={editing ? !canUpdate : !canCreate} message={cannotMessage(editing ? "update" : "create")}>
                                <Button disabled={(editing ? !canUpdate : !canCreate) || form.formState.isSubmitting} type="submit" className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">{form.formState.isSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</> : editing ? "Update" : "Simpan"}</Button>
                            </DisabledActionTooltip>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <ActionConfirmDialog
                open={confirmOpen}
                onOpenChange={(v) => { setConfirmOpen(v); if (!v) setPendingConfirmAction(null); }}
                kind="delete"
                title="Konfirmasi Hapus"
                description={confirmText || "Tindakan ini tidak dapat dibatalkan."}
                confirmLabel="Ya, Hapus"
                onConfirm={async () => { await pendingConfirmAction?.(); }}
                confirmDisabled={!canDelete}
            />
            <ActionConfirmDialog
                open={submitConfirmOpen}
                onOpenChange={(v) => { setSubmitConfirmOpen(v); if (!v) setPendingSubmitValues(null); }}
                kind="submit"
                title={editing ? "Update Brand?" : "Simpan Brand?"}
                description={editing ? "Perubahan brand akan disimpan." : "Brand baru akan ditambahkan."}
                confirmLabel={editing ? "Update" : "Simpan"}
                loading={confirmLoading}
                onConfirm={async () => {
                    if (!pendingSubmitValues) return;
                    setConfirmLoading(true);
                    await executeSubmit(pendingSubmitValues);
                    setConfirmLoading(false);
                    setSubmitConfirmOpen(false);
                    setPendingSubmitValues(null);
                }}
            />
            <BrandImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => fetchData({})} />
        </div>
    );
}
