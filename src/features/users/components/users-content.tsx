"use client";

import { useState, useTransition } from "react";
import { createUser, updateUser, deleteUser, getUsers } from "@/features/users";
import { useBranch } from "@/components/providers/branch-provider";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { SmartSelect } from "@/components/ui/smart-select";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import type { Branch, User } from "@/types";

import { DEFAULT_ROLE_COLOR } from "@/constants/roles";

interface AppRoleData {
    id: string;
    key: string;
    name: string;
    color: string | null;
    isActive: boolean;
}
interface Props {
    initialData: { users: User[]; total: number; totalPages: number };
    roles: AppRoleData[];
    branches: Branch[];
}

export function UsersContent({ initialData, roles, branches }: Props) {
    const { selectedBranchId } = useBranch();
    const roleColors = Object.fromEntries(roles.map((r) => [r.key, r.color ?? DEFAULT_ROLE_COLOR]));
    const roleOptions = roles.filter((role) => role.isActive).map((role) => ({ value: role.key, label: role.name }));
    const branchOptions = branches.map((branch) => ({ value: branch.id, label: branch.name }));
    const defaultRole = roleOptions[0]?.value ?? "";
    const [data, setData] = useState(initialData);
    const [open, setOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formRole, setFormRole] = useState(defaultRole);
    const [formBranchId, setFormBranchId] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ role: "ALL", branchId: "ALL" });
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [loading, startTransition] = useTransition();
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

    const handleSubmit = async (formData: FormData) => {
        const result = editingUser ? await updateUser(editingUser.id, formData) : await createUser(formData);
        if (result.error) toast.error(result.error);
        else { toast.success(editingUser ? "User berhasil diupdate" : "User berhasil ditambahkan"); setOpen(false); setEditingUser(null); fetchData({}); }
    };

    const handleDelete = async (id: string) => {
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

    const columns: SmartColumn<User>[] = [
        { key: "name", header: "Nama", sortable: true, render: (row) => <span className="font-medium text-sm">{row.name}</span>, exportValue: (row) => row.name },
        { key: "email", header: "Email", sortable: true, render: (row) => <span className="text-xs text-muted-foreground">{row.email}</span>, exportValue: (row) => row.email },
        { key: "branch", header: "Lokasi", sortable: true, render: (row) => <span className="text-xs">{row.branch?.name ?? "-"}</span>, exportValue: (row) => row.branch?.name ?? "-" },
        { key: "role", header: "Role", align: "center", render: (row) => <Badge className={`rounded-lg ${roleColors[row.role]}`}>{row.role}</Badge>, exportValue: (row) => row.role },
        { key: "transactions", header: "Transaksi", align: "center", sortable: true, render: (row) => <span className="text-xs">{row._count.transactions}</span>, exportValue: (row) => row._count.transactions },
        { key: "status", header: "Status", align: "center", render: (row) => <Badge className={row.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>{row.isActive ? "Aktif" : "Nonaktif"}</Badge>, exportValue: (row) => row.isActive ? "Aktif" : "Nonaktif" },
        { key: "createdAt", header: "Terdaftar", render: (row) => <span className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</span>, exportValue: (row) => formatDate(row.createdAt) },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "90px",
            render: (row) => (
                <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEditDialog(row)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(row.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
            ),
        },
    ];

    const filters: SmartFilter[] = [
        {
            key: "role", label: "Role", type: "select", options: [
                ...roleOptions,
            ]
        },
        {
            key: "branchId", label: "Lokasi", type: "select", options: [
                { value: "ALL", label: "Semua Lokasi" },
                ...branchOptions,
            ]
        },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold text-foreground">Manajemen Pengguna</h1><p className="text-muted-foreground text-sm">Kelola user dan hak akses</p></div>
                <Button className="rounded-lg" onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" /> Tambah User</Button>
            </div>
            <SmartTable<User> data={data.users} columns={columns} totalItems={data.total} totalPages={data.totalPages}
                currentPage={page} pageSize={pageSize} loading={loading} title="Daftar Pengguna" titleIcon={<Users className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari user..." onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }} onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                filters={filters} activeFilters={effectiveFilters} onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
                selectable selectedRows={selectedRows} onSelectionChange={setSelectedRows} rowKey={(r) => r.id} exportFilename="users"
                emptyIcon={<Users className="w-10 h-10 text-muted-foreground/30" />} emptyTitle="Belum ada user"
            />
            <Dialog open={open} onOpenChange={(v) => { if (v) setOpen(true); else closeDialog(); }}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader><DialogTitle>{editingUser ? "Edit User" : "Tambah User"}</DialogTitle></DialogHeader>
                    <form action={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5"><Label className="text-sm">Nama <span className="text-red-400">*</span></Label><Input name="name" defaultValue={editingUser?.name || ""} required className="rounded-lg" autoFocus /></div>
                        <div className="space-y-1.5"><Label className="text-sm">Email <span className="text-red-400">*</span></Label><Input name="email" type="email" defaultValue={editingUser?.email || ""} required className="rounded-lg" /></div>
                        <div className="space-y-1.5"><Label className="text-sm">Password {editingUser && "(kosongkan jika tidak diubah)"}</Label><Input name="password" type="password" required={!editingUser} minLength={6} className="rounded-lg" /></div>
                        <div className="space-y-1.5"><Label className="text-sm">Role <span className="text-red-400">*</span></Label>
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
                        <div className="space-y-1.5"><Label className="text-sm">Lokasi</Label>
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
                        {editingUser && <input type="hidden" name="isActive" value={editingUser.isActive ? "true" : "false"} />}
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-lg">Batal</Button>
                            <Button type="submit" className="rounded-lg">{editingUser ? "Update" : "Simpan"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <DialogHeader><DialogTitle>Konfirmasi</DialogTitle></DialogHeader>
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
