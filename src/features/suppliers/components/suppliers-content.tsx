"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createSupplier, updateSupplier, deleteSupplier, getSuppliers, getSupplierStats } from "@/features/suppliers";
import { useMenuActionAccess } from "@/features/access-control";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, Truck, Phone, Mail, MapPin, CheckCircle2, XCircle, Building2, Package, Loader2, Upload } from "lucide-react";
import { SupplierImportDialog } from "./supplier-import-dialog";
import { toast } from "sonner";
import type { Supplier } from "@/types";

const supplierFormSchema = z.object({
    name: z.string().min(1, "Nama supplier wajib diisi"),
    contact: z.string().optional(),
    email: z.string().email("Format email tidak valid").or(z.literal("")).optional(),
    address: z.string().optional(),
    isActive: z.boolean(),
});
type SupplierFormValues = z.infer<typeof supplierFormSchema>;

export function SuppliersContent() {
    const [data, setData] = useState<{ suppliers: Supplier[]; total: number; totalPages: number }>({ suppliers: [], total: 0, totalPages: 0 });
    const [open, setOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [editing, setEditing] = useState<Supplier | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
    const [pendingSubmitValues, setPendingSubmitValues] = useState<SupplierFormValues | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ status: "ALL" });
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [loading, startTransition] = useTransition();
    const { canAction, cannotMessage } = useMenuActionAccess("suppliers");
    const { canAction: canPlan } = usePlanAccess();
    const canCreate = canAction("create") && canPlan("suppliers", "create");
    const canUpdate = canAction("update") && canPlan("suppliers", "update");
    const canDelete = canAction("delete") && canPlan("suppliers", "delete");

    // --- Stats ---
    const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, withProducts: 0 });

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string> }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(f.status !== "ALL" ? { status: f.status } : {}),
            };
            const [result, statsResult] = await Promise.all([
                getSuppliers(query),
                getSupplierStats(),
            ]);
            setData(result);
            setStats(statsResult);
        });
    };

    const didFetchRef = useRef(false);
    useEffect(() => {
        if (didFetchRef.current) return;
        didFetchRef.current = true;
        fetchData({});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const form = useForm<SupplierFormValues>({
        resolver: zodResolver(supplierFormSchema),
        defaultValues: { name: "", contact: "", email: "", address: "", isActive: true },
    });

    const executeSubmit = async (values: SupplierFormValues) => {
        if (editing ? !canUpdate : !canCreate) { toast.error(cannotMessage(editing ? "update" : "create")); return; }
        const fd = new FormData();
        fd.set("name", values.name);
        if (values.contact) fd.set("contact", values.contact);
        if (values.email) fd.set("email", values.email);
        if (values.address) fd.set("address", values.address);
        fd.set("isActive", String(values.isActive));
        const result = editing ? await updateSupplier(editing.id, fd) : await createSupplier(fd);
        if (result.error) { toast.error(result.error); }
        else { toast.success(editing ? "Supplier berhasil diupdate" : "Supplier berhasil ditambahkan"); setOpen(false); setEditing(null); fetchData({}); }
    };

    const onSubmit = async (values: SupplierFormValues) => {
        setPendingSubmitValues(values);
        setSubmitConfirmOpen(true);
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
        const result = await deleteSupplier(id);
        if (result.error) toast.error(result.error);
        else { toast.success("Supplier berhasil dihapus"); fetchData({}); }
    };

    const columns: SmartColumn<Supplier>[] = [
        {
            key: "name", header: "Nama Supplier", sortable: true,
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-100 shrink-0">
                        <Truck className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-sm truncate text-foreground">{row.name}</p>
                        {row.address && (
                            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {row.address}
                            </p>
                        )}
                    </div>
                </div>
            ),
            exportValue: (row) => row.name,
        },
        {
            key: "contact", header: "Kontak",
            render: (row) => (
                row.contact ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3 text-amber-500" />
                        {row.contact}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground/50">-</span>
                )
            ),
            exportValue: (row) => row.contact || "-",
        },
        {
            key: "email", header: "Email",
            render: (row) => (
                row.email ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3 text-amber-500" />
                        {row.email}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground/50">-</span>
                )
            ),
            exportValue: (row) => row.email || "-",
        },
        {
            key: "products", header: "Produk", align: "center",
            render: (row) => (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
                    {row._count.products}
                </span>
            ),
            exportValue: (row) => row._count.products,
        },
        {
            key: "status", header: "Status", align: "center",
            render: (row) => (
                row.isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-emerald-200 bg-emerald-50/50 text-emerald-600 ring-1 ring-emerald-100">
                        <CheckCircle2 className="w-3 h-3" />
                        Aktif
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-red-200 bg-red-50/50 text-red-600 ring-1 ring-red-100">
                        <XCircle className="w-3 h-3" />
                        Nonaktif
                    </span>
                )
            ),
            exportValue: (row) => row.isActive ? "Aktif" : "Nonaktif",
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "100px",
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="suppliers" actionKey="update">
                        <Button
                            disabled={!canUpdate}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            onClick={() => { setEditing(row); form.reset({ name: row.name, contact: row.contact || "", email: row.email || "", address: row.address || "", isActive: row.isActive }); setOpen(true); }}
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                    </DisabledActionTooltip>
                    <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="suppliers" actionKey="delete">
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

    const filters: SmartFilter[] = [
        { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Aktif" }, { value: "inactive", label: "Nonaktif" }] },
    ];

    return (
        <div className="space-y-6">
            {/* --- Header --- */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
                        <Truck className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-3xl font-bold tracking-tight text-foreground">Supplier</h1>
                        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                            Kelola data supplier Anda{" "}
                            <Badge variant="secondary" className="ml-1 rounded-full text-[10px] sm:text-xs tabular-nums font-medium">
                                {data.total} supplier
                            </Badge>
                        </p>
                    </div>
                </div>
                <div className="hidden sm:flex gap-2">
                    <Button variant="outline" className="rounded-xl border-dashed" onClick={() => setImportOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" /> Import
                    </Button>
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="suppliers" actionKey="create">
                        <Button disabled={!canCreate} className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                            onClick={() => { setEditing(null); form.reset({ name: "", contact: "", email: "", address: "", isActive: true }); setOpen(true); }}>
                            <Plus className="w-4 h-4 mr-2" /> Tambah Supplier
                        </Button>
                    </DisabledActionTooltip>
                </div>
            </div>

            {/* --- Table --- */}
            <SmartTable<Supplier>
                data={data.suppliers} columns={columns} totalItems={data.total} totalPages={data.totalPages}
                currentPage={page} pageSize={pageSize} loading={loading}
                title="Daftar Supplier"
                mobileRender={(row) => (
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm truncate text-foreground">{row.name}</p>
                            {row.isActive ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-emerald-200 bg-emerald-50 text-emerald-600 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Aktif
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-red-200 bg-red-50 text-red-600 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    Nonaktif
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {row.contact || "-"} &middot; {row.email || "-"}
                        </p>
                        {row.address && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{row.address}</p>
                        )}
                    </div>
                )} titleIcon={<Truck className="w-4 h-4 text-amber-500" />}
                searchPlaceholder="Cari supplier..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                filters={filters} activeFilters={activeFilters}
                onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
                afterFilters={
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 px-3 sm:px-5 pb-2">
                        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/80 border border-slate-200/60">
                            <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shadow-sm">
                                <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-sm sm:text-lg font-bold tabular-nums text-foreground">{stats.total}</p>
                                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Total</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50/80 border border-emerald-200/60">
                            <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-sm">
                                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-sm sm:text-lg font-bold tabular-nums text-foreground">{stats.active}</p>
                                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Aktif</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50/80 border border-red-200/60">
                            <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-red-500 to-rose-500 shadow-sm">
                                <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-sm sm:text-lg font-bold tabular-nums text-foreground">{stats.inactive}</p>
                                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Nonaktif</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/80 border border-amber-200/60">
                            <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
                                <Package className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-sm sm:text-lg font-bold tabular-nums text-foreground">{stats.withProducts}</p>
                                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Punya Produk</p>
                            </div>
                        </div>
                    </div>
                }
                selectable selectedRows={selectedRows} onSelectionChange={setSelectedRows} rowKey={(r) => r.id}
                planMenuKey="suppliers" exportModule="suppliers"
                emptyIcon={
                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 mx-auto">
                        <Truck className="w-8 h-8 text-amber-400" />
                    </div>
                }
                emptyTitle="Belum ada supplier"
                emptyDescription="Mulai tambahkan supplier pertama Anda untuk mengelola rantai pasokan."
                emptyAction={
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="suppliers" actionKey="create">
                        <Button
                            disabled={!canCreate}
                            className="rounded-xl mt-3 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                            onClick={() => { setEditing(null); form.reset({ name: "", contact: "", email: "", address: "", isActive: true }); setOpen(true); }}
                        >
                            <Plus className="w-4 h-4 mr-2" /> Tambah Supplier Pertama
                        </Button>
                    </DisabledActionTooltip>
                }
            />

            {/* Floating button mobile */}
            {canCreate && (
                <button onClick={() => { setEditing(null); form.reset({ name: "", contact: "", email: "", address: "", isActive: true }); setOpen(true); }} className="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30 flex items-center justify-center active:scale-95 transition-transform">
                    <Plus className="w-6 h-6" />
                </button>
            )}

            {/* --- Form Dialog --- */}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); form.reset(); } }}>
                <DialogContent className="rounded-2xl max-w-md p-0 overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
                    <div className="px-6 pt-4 pb-6">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
                                    <Truck className="w-4 h-4 text-white" />
                                </div>
                                {editing ? "Edit Supplier" : "Tambah Supplier"}
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={form.handleSubmit(onSubmit)} className={`space-y-4 mt-4 ${editing ? (!canUpdate ? "pointer-events-none opacity-70" : "") : (!canCreate ? "pointer-events-none opacity-70" : "")}`}>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Nama Supplier <span className="text-red-400">*</span></Label>
                                <Input {...form.register("name")} className="rounded-xl" autoFocus placeholder="Masukkan nama supplier" />
                                {form.formState.errors.name && <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">Kontak</Label>
                                    <Input {...form.register("contact")} className="rounded-xl" placeholder="No. telepon" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">Email</Label>
                                    <Input {...form.register("email")} type="email" className="rounded-xl" placeholder="email@example.com" />
                                    {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Alamat</Label>
                                <Input {...form.register("address")} className="rounded-xl" placeholder="Alamat lengkap supplier" />
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 bg-muted/30">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">Status Aktif</Label>
                                    <p className="text-[11px] text-muted-foreground">Supplier dapat digunakan dalam transaksi</p>
                                </div>
                                <Switch
                                    disabled={!canUpdate && Boolean(editing)}
                                    checked={form.watch("isActive")}
                                    onCheckedChange={(v) => form.setValue("isActive", v)}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); form.reset(); }} className="rounded-xl">Batal</Button>
                                <DisabledActionTooltip disabled={editing ? !canUpdate : !canCreate} message={cannotMessage(editing ? "update" : "create")}>
                                    <Button disabled={(editing ? !canUpdate : !canCreate) || form.formState.isSubmitting} type="submit" className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">
                                        {form.formState.isSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</> : editing ? "Update" : "Simpan"}
                                    </Button>
                                </DisabledActionTooltip>
                            </div>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>

            <ActionConfirmDialog
                open={confirmOpen}
                onOpenChange={(v) => { setConfirmOpen(v); if (!v) setPendingDeleteId(null); }}
                kind="delete"
                title="Hapus Supplier"
                description="Apakah Anda yakin ingin menghapus supplier ini? Tindakan ini tidak dapat dibatalkan."
                confirmLabel="Ya, Hapus"
                onConfirm={confirmDelete}
                confirmDisabled={!canDelete}
            />
            <ActionConfirmDialog
                open={submitConfirmOpen}
                onOpenChange={(v) => { setSubmitConfirmOpen(v); if (!v) setPendingSubmitValues(null); }}
                kind="submit"
                title={editing ? "Update Supplier?" : "Simpan Supplier?"}
                description={editing ? "Perubahan supplier akan disimpan." : "Supplier baru akan ditambahkan."}
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
            <SupplierImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => fetchData({})} />
        </div>
    );
}
