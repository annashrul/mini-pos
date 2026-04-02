"use client";

import { useEffect, useState, useTransition, useMemo , useRef } from "react";
import { createBranch, updateBranch, deleteBranch, getBranches } from "@/features/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaginationControl } from "@/components/ui/pagination-control";
import { Plus, Pencil, Trash2, Building2, Phone, MapPin, CheckCircle2, XCircle, AlertTriangle, Store, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Branch } from "@/types";

export function BranchesContent() {
    const [data, setData] = useState<{ branches: Branch[]; total: number; totalPages: number }>({ branches: [], total: 0, totalPages: 0 });
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Branch | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [loading, startTransition] = useTransition();
    const [formIsActive, setFormIsActive] = useState(true);
    const { canAction, cannotMessage } = useMenuActionAccess("branches");
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canDelete = canAction("delete");

    // --- Stats ---
    const stats = useMemo(() => {
        const branches = data.branches;
        const total = data.total;
        const active = branches.filter((b) => b.isActive).length;
        const inactive = branches.filter((b) => !b.isActive).length;
        return { total, active, inactive };
    }, [data.branches, data.total]);

    const fetchData = (params: { search?: string; page?: number; pageSize?: number }) => {
        startTransition(async () => {
            const result = await getBranches({ search: params.search ?? search, page: params.page ?? page, perPage: params.pageSize ?? pageSize });
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
        const result = editing ? await updateBranch(editing.id, formData) : await createBranch(formData);
        if (result.error) { toast.error(result.error); }
        else { toast.success(editing ? "Cabang berhasil diupdate" : "Cabang berhasil ditambahkan"); setOpen(false); setEditing(null); fetchData({}); }
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
        const result = await deleteBranch(id);
        if (result.error) toast.error(result.error); else { toast.success("Cabang berhasil dihapus"); fetchData({}); }
    };

    return (
        <div className="space-y-6">
            {/* --- Header --- */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/20">
                        <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Cabang / Store</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Kelola cabang toko Anda{" "}
                            <Badge variant="secondary" className="ml-1 rounded-full text-xs tabular-nums font-medium">
                                {data.total} cabang
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
                        <Plus className="w-4 h-4 mr-2" /> Tambah Cabang
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* --- Stats Bar --- */}
            {loading && data.branches.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-white animate-pulse">
                            <div className="w-9 h-9 rounded-xl bg-gray-200" />
                            <div className="space-y-1.5">
                                <div className="h-5 w-10 bg-gray-200 rounded" />
                                <div className="h-3 w-20 bg-gray-200 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3${loading ? " opacity-50 pointer-events-none transition-opacity" : ""}`}>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/80 border border-slate-200/60">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shadow-sm">
                            <Store className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-lg font-bold tabular-nums text-foreground">{stats.total}</p>
                            <p className="text-[11px] text-muted-foreground font-medium">Total Cabang</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50/80 border border-emerald-200/60">
                        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-emerald-100">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aktif
                        </div>
                        <div>
                            <p className="text-lg font-bold tabular-nums text-foreground">{stats.active}</p>
                            <p className="text-[11px] text-muted-foreground font-medium">Cabang Aktif</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50/80 border border-red-200/60">
                        <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-red-100">
                            <XCircle className="w-3.5 h-3.5" />
                            Nonaktif
                        </div>
                        <div>
                            <p className="text-lg font-bold tabular-nums text-foreground">{stats.inactive}</p>
                            <p className="text-[11px] text-muted-foreground font-medium">Cabang Nonaktif</p>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Search + Card Grid --- */}
            <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <Input
                        placeholder="Cari cabang..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); fetchData({ search: e.target.value, page: 1 }); }}
                        className="pl-9 rounded-xl h-10"
                    />
                    {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
                </div>

                {/* Card Grid */}
                {loading && data.branches.length === 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-border/40 bg-white p-5 space-y-3 animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-200" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-4 w-32 bg-gray-200 rounded" />
                                        <div className="h-3 w-24 bg-gray-200 rounded" />
                                    </div>
                                </div>
                                <div className="h-3 w-full bg-gray-200 rounded" />
                                <div className="flex justify-between">
                                    <div className="h-5 w-16 bg-gray-200 rounded-full" />
                                    <div className="h-5 w-12 bg-gray-200 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : data.branches.length > 0 ? (
                    <div className={loading ? "opacity-50 pointer-events-none transition-opacity" : ""}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data.branches.map((branch) => (
                                <div
                                    key={branch.id}
                                    className="rounded-xl border border-border/40 bg-white hover:shadow-md transition-all group relative overflow-hidden"
                                >
                                    {/* Gradient accent line */}
                                    <div className={`h-1 w-full ${branch.isActive ? "bg-gradient-to-r from-cyan-500 to-teal-500" : "bg-gradient-to-r from-gray-300 to-gray-400"}`} />

                                    <div className="p-4 space-y-3">
                                        {/* Icon + Name */}
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${branch.isActive ? "bg-gradient-to-br from-cyan-100 to-teal-100" : "bg-gradient-to-br from-gray-100 to-gray-200"}`}>
                                                    <Building2 className={`w-5 h-5 ${branch.isActive ? "text-cyan-600" : "text-gray-400"}`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-foreground truncate">{branch.name}</p>
                                                    {/* Status Badge */}
                                                    {branch.isActive ? (
                                                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-emerald-200 bg-emerald-50/50 text-emerald-600 ring-1 ring-emerald-100">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            Aktif
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-red-200 bg-red-50/50 text-red-600 ring-1 ring-red-100">
                                                            <XCircle className="w-3 h-3" />
                                                            Nonaktif
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Edit & Delete buttons (hover) */}
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                                                    <Button
                                                        disabled={!canUpdate}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                        onClick={() => { setEditing(branch); setFormIsActive(branch.isActive); setOpen(true); }}
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
                                                        onClick={() => handleDelete(branch.id)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </DisabledActionTooltip>
                                            </div>
                                        </div>

                                        {/* Address */}
                                        {branch.address && (
                                            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground/60" />
                                                <span className="line-clamp-2">{branch.address}</span>
                                            </p>
                                        )}

                                        {/* Phone */}
                                        {branch.phone && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                <Phone className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                                                {branch.phone}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Empty State */
                    !loading && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-100 to-teal-100 mx-auto">
                                <Building2 className="w-8 h-8 text-cyan-400" />
                            </div>
                            <h3 className="mt-4 text-base font-semibold text-foreground">Belum ada cabang</h3>
                            <p className="text-sm text-muted-foreground mt-1">Mulai tambahkan cabang pertama untuk mengelola toko Anda.</p>
                            <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                                <Button
                                    disabled={!canCreate}
                                    className="rounded-xl mt-3 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                                    onClick={() => { setEditing(null); setFormIsActive(true); setOpen(true); }}
                                >
                                    <Plus className="w-4 h-4 mr-2" /> Tambah Cabang Pertama
                                </Button>
                            </DisabledActionTooltip>
                        </div>
                    )
                )}

                {/* Pagination */}
                <PaginationControl
                    currentPage={page}
                    totalPages={data.totalPages}
                    totalItems={data.total}
                    pageSize={pageSize}
                    onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                />
            </div>

            {/* --- Create/Edit Dialog --- */}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
                <DialogContent className="rounded-2xl max-w-md">
                    <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-lg font-bold">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-md shadow-cyan-200/50">
                                {editing ? <Pencil className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
                            </div>
                            {editing ? "Edit Cabang" : "Tambah Cabang"}
                        </DialogTitle>
                    </DialogHeader>
                    <form action={handleSubmit} className="space-y-4 mt-1">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Nama Cabang <span className="text-red-400">*</span></Label>
                            <Input name="name" defaultValue={editing?.name || ""} required className="rounded-xl h-10" autoFocus placeholder="Masukkan nama cabang" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Alamat</Label>
                            <Input name="address" defaultValue={editing?.address || ""} className="rounded-xl h-10" placeholder="Alamat lengkap cabang" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Telepon</Label>
                            <Input name="phone" defaultValue={editing?.phone || ""} className="rounded-xl h-10" placeholder="No. telepon cabang" />
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 bg-muted/30">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium">Status Aktif</Label>
                                <p className="text-[11px] text-muted-foreground">Cabang dapat digunakan dalam transaksi</p>
                            </div>
                            <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }} className="rounded-xl">Batal</Button>
                            <DisabledActionTooltip disabled={editing ? !canUpdate : !canCreate} message={cannotMessage(editing ? "update" : "create")}>
                                <Button disabled={editing ? !canUpdate : !canCreate} type="submit" className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">{editing ? "Update" : "Simpan"}</Button>
                            </DisabledActionTooltip>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* --- Confirm Delete Dialog --- */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-lg font-bold">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-md shadow-red-200/50">
                                <AlertTriangle className="w-4 h-4 text-white" />
                            </div>
                            Hapus Cabang
                        </DialogTitle>
                    </DialogHeader>
                    <div className="rounded-xl bg-red-50/50 border border-red-100 p-3 mt-1">
                        <p className="text-sm text-red-700 font-medium">Yakin ingin menghapus cabang ini?</p>
                        <p className="text-xs text-red-500/70 mt-1">Tindakan ini tidak dapat dibatalkan.</p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingDeleteId(null); }} className="rounded-xl">Batal</Button>
                        <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                            <Button disabled={!canDelete} variant="destructive" onClick={confirmDelete} className="rounded-xl shadow-md shadow-red-200/50 hover:shadow-lg hover:shadow-red-300/50 transition-all">Ya, Hapus</Button>
                        </DisabledActionTooltip>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
