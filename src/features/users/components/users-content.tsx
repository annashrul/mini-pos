"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createUser, updateUser, deleteUser, getUsers, getActiveRoles } from "@/features/users";
import { getBranches } from "@/features/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { useBranch } from "@/components/providers/branch-provider";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SmartSelect } from "@/components/ui/smart-select";
import {
    Plus, Pencil, Trash2, Users,
    UserCircle, Mail, Lock, Shield, MapPin,
    Calendar, CheckCircle2, AlertTriangle,
    Search, Loader2, ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import type { Branch, User } from "@/types";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { PaginationControl } from "@/components/ui/pagination-control";
import { Skeleton } from "@/components/ui/skeleton";

import { DEFAULT_ROLE_COLOR } from "@/constants/roles";

interface AppRoleData {
    id: string;
    key: string;
    name: string;
    color: string | null;
    isActive: boolean;
}
export function UsersContent() {
    const [roles, setRoles] = useState<AppRoleData[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);
    const roleColors = Object.fromEntries(roles.map((r) => [r.key, r.color ?? DEFAULT_ROLE_COLOR]));
    const roleOptions = roles.filter((role) => role.isActive).map((role) => ({ value: role.key, label: role.name }));
    const branchOptions = branches.map((branch) => ({ value: branch.id, label: branch.name }));
    const defaultRole = roleOptions[0]?.value ?? "";
    const [data, setData] = useState<{ users: User[]; total: number; totalPages: number }>({ users: [], total: 0, totalPages: 0 });
    const [open, setOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formRole, setFormRole] = useState(defaultRole);
    const [formBranchId, setFormBranchId] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ role: "ALL", branchId: "ALL" });
    const [loading, startTransition] = useTransition();
    const { canAction, cannotMessage } = useMenuActionAccess("users");
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canDelete = canAction("delete");
    const effectiveFilters = selectedBranchId ? { ...activeFilters, branchId: selectedBranchId } : activeFilters;

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string> }) => {
        startTransition(async () => {
            const sourceFilters = params.filters ?? activeFilters;
            const f = selectedBranchId ? { ...sourceFilters, branchId: selectedBranchId } : sourceFilters;
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(f.role !== "ALL" ? { role: f.role } : {}),
                ...(f.branchId !== "ALL" ? { branchId: f.branchId } : {}),
            };
            const result = await getUsers(query);
            setData(result);
        });
    };

    useEffect(() => {
        startTransition(async () => {
            const [usersData, rolesData, branchesData] = await Promise.all([
                getUsers(),
                getActiveRoles(),
                getBranches({ page: 1, perPage: 200 }),
            ]);
            setData(usersData);
            setRoles(rolesData as AppRoleData[]);
            setBranches(branchesData.branches);
        });
    }, []);

    useEffect(() => {
        if (!branchReady) return;
        if (prevBranchRef.current !== selectedBranchId) {
            prevBranchRef.current = selectedBranchId;
            fetchData({ page: 1 });
        }
    }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (formData: FormData) => {
        if (editingUser ? !canUpdate : !canCreate) { toast.error(cannotMessage(editingUser ? "update" : "create")); return; }
        const result = editingUser ? await updateUser(editingUser.id, formData) : await createUser(formData);
        if (result.error) toast.error(result.error);
        else { toast.success(editingUser ? "User berhasil diupdate" : "User berhasil ditambahkan"); setOpen(false); setEditingUser(null); fetchData({}); }
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
        setConfirmText("Yakin ingin menghapus user ini?");
        setPendingConfirmAction(() => async () => {
            const result = await deleteUser(id);
            if (result.error) toast.error(result.error); else { toast.success("User berhasil dihapus"); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const openCreateDialog = () => {
        setEditingUser(null);
        setFormRole(defaultRole);
        setFormBranchId("");
        setOpen(true);
    };

    const openEditDialog = (user: User) => {
        setEditingUser(user);
        setFormRole(user.role);
        setFormBranchId(user.branchId ?? "");
        setOpen(true);
    };

    const closeDialog = () => {
        setOpen(false);
        setEditingUser(null);
        setFormRole(defaultRole);
        setFormBranchId("");
    };

    /* ---------- Stats ---------- */
    const stats = useMemo(() => {
        const users = data.users;
        const total = data.total;
        const active = users.filter((u) => u.isActive).length;
        const roleCounts: Record<string, number> = {};
        users.forEach((u) => {
            roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
        });
        const topRoles = Object.entries(roleCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        return { total, active, topRoles };
    }, [data]);

    const statColors: Record<number, string> = {
        0: "bg-violet-50 text-violet-700 ring-violet-200",
        1: "bg-amber-50 text-amber-700 ring-amber-200",
        2: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    };

    /* ---------- Search handler ---------- */
    const handleSearch = (value: string) => {
        setSearch(value);
        setPage(1);
        fetchData({ search: value, page: 1 });
    };

    /* ---------- Role filter handler ---------- */
    const handleRoleFilter = (roleKey: string) => {
        const newFilters = { ...activeFilters, role: roleKey };
        setActiveFilters(newFilters);
        setPage(1);
        fetchData({ filters: newFilters, page: 1 });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-200/50">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Manajemen Pengguna</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">Kelola user dan hak akses sistem</p>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                    <Button disabled={!canCreate} className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all" onClick={openCreateDialog}>
                        <Plus className="w-4 h-4 mr-2" /> Tambah User
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">{stats.total} <span className="text-slate-400 font-normal">total</span></span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 ring-1 ring-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-700">{stats.active} <span className="text-emerald-400 font-normal">aktif</span></span>
                </div>
                {stats.topRoles.map(([role, count], idx) => (
                    <div key={role} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ring-1 ${statColors[idx] ?? "bg-slate-50 text-slate-700 ring-slate-200"}`}>
                        <Shield className="w-4 h-4 opacity-70" />
                        <span className="text-sm font-medium">{role} <span className="opacity-60 font-normal">({count})</span></span>
                    </div>
                ))}
            </div>

            {/* Search + Filter bar */}
            <div className="rounded-xl border border-border/40 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari user..."
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9 rounded-xl h-10"
                        />
                    </div>
                    {loading && <Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => handleRoleFilter("ALL")}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${effectiveFilters.role === "ALL"
                            ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                            : "bg-white text-muted-foreground border-border hover:bg-slate-50"
                            }`}
                    >
                        Semua
                    </button>
                    {roleOptions.map((role) => (
                        <button
                            key={role.value}
                            type="button"
                            onClick={() => handleRoleFilter(role.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${effectiveFilters.role === role.value
                                ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                                : "bg-white text-muted-foreground border-border hover:bg-slate-50"
                                }`}
                        >
                            {role.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* User card grid */}
            {loading && data.users.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-border/40 bg-white p-5 space-y-3">
                            <div className="flex items-center gap-3">
                                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-3 w-36" />
                                </div>
                            </div>
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-border/40">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-3 w-12" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : data.users.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-border/40 bg-white">
                    <Users className="w-10 h-10 text-muted-foreground/30" />
                    <p className="mt-3 text-sm font-medium text-muted-foreground">Belum ada user</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Tambah user baru untuk memulai</p>
                </div>
            ) : (
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${loading ? "opacity-50 pointer-events-none transition-opacity" : ""}`}>
                    {data.users.map((user) => (
                        <div
                            key={user.id}
                            className="rounded-xl border border-border/40 bg-white hover:shadow-md transition-all group p-5 relative"
                        >
                            {/* Action buttons */}
                            <div className="absolute top-3 right-3 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                                    <Button
                                        disabled={!canUpdate}
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        onClick={() => openEditDialog(user)}
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                </DisabledActionTooltip>
                                <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                                    <Button
                                        disabled={!canDelete}
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                                        onClick={() => handleDelete(user.id)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </DisabledActionTooltip>
                            </div>

                            {/* Avatar + Name + Email */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
                                    {user.name?.charAt(0)?.toUpperCase() ?? "U"}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm text-foreground truncate">{user.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                </div>
                            </div>

                            {/* Role badge */}
                            <div className="mb-3">
                                <Badge className={`rounded-full px-3 py-0.5 text-[11px] font-semibold shadow-sm ring-1 ring-inset ring-black/5 ${roleColors[user.role]}`}>
                                    {user.role}
                                </Badge>
                            </div>

                            {/* Info row */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                    {user.branch?.name ?? "-"}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                    {formatDate(user.createdAt)}
                                </span>
                            </div>

                            {/* Stats + Status row */}
                            <div className="flex items-center justify-between pt-3 border-t border-border/40">
                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <ShoppingCart className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                    <span className="font-mono tabular-nums text-foreground font-medium">{user._count.transactions}</span>
                                    <span>transaksi</span>
                                </span>
                                {user.isActive ? (
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        Aktif
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                                        Nonaktif
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
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

            {/* Create / Edit Dialog */}
            <Dialog open={open} onOpenChange={(v) => { if (v) setOpen(true); else closeDialog(); }}>
                <DialogContent className="rounded-2xl max-w-md">
                    <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-lg font-bold">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-sky-200/50">
                                {editingUser ? <Pencil className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
                            </div>
                            {editingUser ? "Edit User" : "Tambah User"}
                        </DialogTitle>
                    </DialogHeader>
                    <form action={handleSubmit} className="space-y-4 mt-1">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium inline-flex items-center gap-1.5">
                                    <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />
                                    Nama <span className="text-red-400">*</span>
                                </Label>
                                <Input name="name" defaultValue={editingUser?.name || ""} required className="rounded-xl h-10" autoFocus placeholder="Masukkan nama lengkap" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium inline-flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                    Email <span className="text-red-400">*</span>
                                </Label>
                                <Input name="email" type="email" defaultValue={editingUser?.email || ""} required className="rounded-xl h-10" placeholder="contoh@email.com" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium inline-flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                                    Password {editingUser && <span className="text-xs text-muted-foreground font-normal">(kosongkan jika tidak diubah)</span>}
                                </Label>
                                <Input name="password" type="password" required={!editingUser} minLength={6} className="rounded-xl h-10" placeholder="Minimal 6 karakter" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium inline-flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                                    Role <span className="text-red-400">*</span>
                                </Label>
                                <SmartSelect
                                    value={formRole}
                                    onChange={setFormRole}
                                    initialOptions={roleOptions}
                                    onSearch={async (query) =>
                                        roleOptions.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))
                                    }
                                />
                                <input type="hidden" name="role" value={formRole} required />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium inline-flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                    Lokasi
                                </Label>
                                <SmartSelect
                                    value={formBranchId}
                                    onChange={setFormBranchId}
                                    initialOptions={branchOptions}
                                    placeholder="Pilih lokasi (opsional)"
                                    onSearch={async (query) =>
                                        branchOptions.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))
                                    }
                                />
                                <input type="hidden" name="branchId" value={formBranchId} />
                            </div>
                        </div>
                        {editingUser && <input type="hidden" name="isActive" value={editingUser.isActive ? "true" : "false"} />}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl">Batal</Button>
                            <DisabledActionTooltip disabled={editingUser ? !canUpdate : !canCreate} message={cannotMessage(editingUser ? "update" : "create")}>
                                <Button disabled={editingUser ? !canUpdate : !canCreate} type="submit" className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">{editingUser ? "Update" : "Simpan"}</Button>
                            </DisabledActionTooltip>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm Dialog */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-lg font-bold">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-md shadow-red-200/50">
                                <AlertTriangle className="w-4 h-4 text-white" />
                            </div>
                            Konfirmasi Hapus
                        </DialogTitle>
                    </DialogHeader>
                    <div className="rounded-xl bg-red-50/50 border border-red-100 p-3 mt-1">
                        <p className="text-sm text-red-700 font-medium">{confirmText}</p>
                        <p className="text-xs text-red-500/70 mt-1">Tindakan ini tidak dapat dibatalkan.</p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-xl">Batal</Button>
                        <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                            <Button disabled={!canDelete} variant="destructive" onClick={async () => { await pendingConfirmAction?.(); }} className="rounded-xl shadow-md shadow-red-200/50 hover:shadow-lg hover:shadow-red-300/50 transition-all">Ya, Hapus</Button>
                        </DisabledActionTooltip>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
