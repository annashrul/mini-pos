"use client";

import { useEffect, useState, useTransition, useMemo , useRef } from "react";
import { createSupplier, updateSupplier, deleteSupplier, getSuppliers } from "@/features/suppliers";
import { useMenuActionAccess } from "@/features/access-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, Truck, Phone, Mail, MapPin, CheckCircle2, XCircle, Building2, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Supplier } from "@/types";

export function SuppliersContent() {
    const [data, setData] = useState<{ suppliers: Supplier[]; total: number; totalPages: number }>({ suppliers: [], total: 0, totalPages: 0 });
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Supplier | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ status: "ALL" });
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [loading, startTransition] = useTransition();
    const [formIsActive, setFormIsActive] = useState(true);
    const { canAction, cannotMessage } = useMenuActionAccess("suppliers");
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canDelete = canAction("delete");

    // --- Stats ---
    const stats = useMemo(() => {
        const suppliers = data.suppliers;
        const total = data.total;
        const active = suppliers.filter((s) => s.isActive).length;
        const inactive = suppliers.filter((s) => !s.isActive).length;
        const withProducts = suppliers.filter((s) => s._count.products > 0).length;
        return { total, active, inactive, withProducts };
    }, [data.suppliers, data.total]);

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string> }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(f.status !== "ALL" ? { status: f.status } : {}),
            };
            const result = await getSuppliers(query);
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
        formData.set("isActive", String(formIsActive));
        const result = editing ? await updateSupplier(editing.id, formData) : await createSupplier(formData);
        if (result.error) { toast.error(result.error); }
        else { toast.success(editing ? "Supplier berhasil diupdate" : "Supplier berhasil ditambahkan"); setOpen(false); setEditing(null); fetchData({}); }
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
                    <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                        <Button
                            disabled={!canUpdate}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            onClick={() => { setEditing(row); setFormIsActive(row.isActive); setOpen(true); }}
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

    const filters: SmartFilter[] = [
        { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Aktif" }, { value: "inactive", label: "Nonaktif" }] },
    ];

    return (
        <div className="space-y-6">
            {/* --- Header --- */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
                        <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Supplier</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Kelola data supplier Anda{" "}
                            <Badge variant="secondary" className="ml-1 rounded-full text-xs tabular-nums font-medium">
                                {data.total} supplier
                            </Badge>
                        </p>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                    <Button
                        disabled={!canCreate}
                        className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                        onClick={() => { setEditing(null); setFormIsActive(true); setOpen(true); }}
                    >
                        <Plus className="w-4 h-4 mr-2" /> Tambah Supplier
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* --- Stats Bar --- */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/80 border border-slate-200/60">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shadow-sm">
                        <Building2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-lg font-bold tabular-nums text-foreground">{stats.total}</p>
                        <p className="text-[11px] text-muted-foreground font-medium">Total Supplier</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50/80 border border-emerald-200/60">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-lg font-bold tabular-nums text-foreground">{stats.active}</p>
                        <p className="text-[11px] text-muted-foreground font-medium">Supplier Aktif</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50/80 border border-red-200/60">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 shadow-sm">
                        <XCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-lg font-bold tabular-nums text-foreground">{stats.inactive}</p>
                        <p className="text-[11px] text-muted-foreground font-medium">Supplier Nonaktif</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/80 border border-amber-200/60">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
                        <Package className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-lg font-bold tabular-nums text-foreground">{stats.withProducts}</p>
                        <p className="text-[11px] text-muted-foreground font-medium">Punya Produk</p>
                    </div>
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
                selectable selectedRows={selectedRows} onSelectionChange={setSelectedRows} rowKey={(r) => r.id}
                exportFilename="supplier"
                emptyIcon={
                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 mx-auto">
                        <Truck className="w-8 h-8 text-amber-400" />
                    </div>
                }
                emptyTitle="Belum ada supplier"
                emptyDescription="Mulai tambahkan supplier pertama Anda untuk mengelola rantai pasokan."
                emptyAction={
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                        <Button
                            disabled={!canCreate}
                            className="rounded-xl mt-3 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                            onClick={() => { setEditing(null); setFormIsActive(true); setOpen(true); }}
                        >
                            <Plus className="w-4 h-4 mr-2" /> Tambah Supplier Pertama
                        </Button>
                    </DisabledActionTooltip>
                }
            />

            {/* --- Form Dialog --- */}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
                <DialogContent className="rounded-2xl max-w-md p-0 overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
                    <div className="px-6 pt-4 pb-6">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
                                    <Truck className="w-4 h-4 text-white" />
                                </div>
                                {editing ? "Edit Supplier" : "Tambah Supplier"}
                            </DialogTitle>
                        </DialogHeader>
                        <form action={handleSubmit} className={`space-y-4 mt-4 ${editing ? (!canUpdate ? "pointer-events-none opacity-70" : "") : (!canCreate ? "pointer-events-none opacity-70" : "")}`}>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Nama Supplier <span className="text-red-400">*</span></Label>
                                <Input name="name" defaultValue={editing?.name || ""} required className="rounded-xl" autoFocus placeholder="Masukkan nama supplier" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">Kontak</Label>
                                    <Input name="contact" defaultValue={editing?.contact || ""} className="rounded-xl" placeholder="No. telepon" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-medium">Email</Label>
                                    <Input name="email" type="email" defaultValue={editing?.email || ""} className="rounded-xl" placeholder="email@example.com" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Alamat</Label>
                                <Input name="address" defaultValue={editing?.address || ""} className="rounded-xl" placeholder="Alamat lengkap supplier" />
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 bg-muted/30">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">Status Aktif</Label>
                                    <p className="text-[11px] text-muted-foreground">Supplier dapat digunakan dalam transaksi</p>
                                </div>
                                <Switch
                                    disabled={!canUpdate && Boolean(editing)}
                                    checked={formIsActive}
                                    onCheckedChange={setFormIsActive}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }} className="rounded-xl">
                                    Batal
                                </Button>
                                <DisabledActionTooltip disabled={editing ? !canUpdate : !canCreate} message={cannotMessage(editing ? "update" : "create")}>
                                    <Button disabled={editing ? !canUpdate : !canCreate} type="submit" className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">
                                        {editing ? "Update" : "Simpan"}
                                    </Button>
                                </DisabledActionTooltip>
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
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-sm">
                                    <AlertTriangle className="w-4 h-4 text-white" />
                                </div>
                                Hapus Supplier
                            </DialogTitle>
                        </DialogHeader>
                        <div className="mt-3 p-3 rounded-xl bg-red-50/50 border border-red-100">
                            <p className="text-sm text-red-700">
                                Apakah Anda yakin ingin menghapus supplier ini? Tindakan ini tidak dapat dibatalkan.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingDeleteId(null); }} className="rounded-xl">
                                Batal
                            </Button>
                            <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                                <Button disabled={!canDelete} variant="destructive" onClick={confirmDelete} className="rounded-xl shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30 transition-all">
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
