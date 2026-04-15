"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createUser, updateUser, deleteUser, getUsers, getActiveRoles, getUserStats, bulkDeleteUsers } from "@/features/users";
import { getBranches } from "@/features/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { useBranch } from "@/components/providers/branch-provider";
import { toast } from "sonner";
import type { Branch, User } from "@/types";
import { PaginationControl } from "@/components/ui/pagination-control";

import { DEFAULT_ROLE_COLOR } from "@/constants/roles";
import { UsersConfirmDeleteDialog } from "./users-confirm-delete-dialog";
import { UsersFilters } from "./users-filters";
import { UsersFormDialog } from "./users-form-dialog";
import { UsersGrid } from "./users-grid";
import { UsersHeader } from "./users-header";
import { UserImportDialog } from "./user-import-dialog";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { Trash2 } from "lucide-react";

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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
    const [open, setOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formRole, setFormRole] = useState(defaultRole);
    const [formBranchId, setFormBranchId] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);
    const [search, setSearch] = useState("");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
            const [usersData, rolesData, branchesData, statsData] = await Promise.all([
                getUsers({ perPage: pageSize, ...(selectedBranchId ? { branchId: selectedBranchId } : {}) }),
                getActiveRoles(),
                getBranches({ page: 1, perPage: 200 }),
                getUserStats(selectedBranchId || undefined),
            ]);
            setData(usersData);
            setRoles(rolesData as AppRoleData[]);
            setBranches(branchesData.branches);
            setStats(statsData);
        });
    }, []);

    useEffect(() => {
        if (!branchReady) return;
        if (prevBranchRef.current !== selectedBranchId) {
            prevBranchRef.current = selectedBranchId;
            fetchData({ page: 1 });
            refreshStats();
        }
    }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (formData: FormData) => {
        if (editingUser ? !canUpdate : !canCreate) { toast.error(cannotMessage(editingUser ? "update" : "create")); return; }
        const result = editingUser ? await updateUser(editingUser.id, formData) : await createUser(formData);
        if (result.error) toast.error(result.error);
        else { toast.success(editingUser ? "User berhasil diupdate" : "User berhasil ditambahkan"); setOpen(false); setEditingUser(null); fetchData({}); refreshStats(); }
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
        setConfirmText("Yakin ingin menghapus user ini?");
        setPendingConfirmAction(() => async () => {
            const result = await deleteUser(id);
            if (result.error) toast.error(result.error); else { toast.success("User berhasil dihapus"); fetchData({}); refreshStats(); }
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
    const [stats, setStats] = useState<{ total: number; active: number; topRoles: [string, number][] }>({ total: 0, active: 0, topRoles: [] });
    const refreshStats = () => { getUserStats(selectedBranchId || undefined).then(setStats); };


    /* ---------- Search handler ---------- */
    const handleSearch = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setPage(1);
            fetchData({ search: value, page: 1 });
        }, 300);
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
            <UsersHeader canCreate={canCreate} cannotMessage={cannotMessage} onCreate={openCreateDialog} onImport={() => setImportOpen(true)} />

            <UsersFilters
                search={search}
                loading={loading}
                effectiveRole={effectiveFilters.role || ""}
                roleOptions={roleOptions}
                stats={stats}
                onSearchChange={handleSearch}
                onRoleFilterChange={handleRoleFilter}
            />

            <UsersGrid
                key={`page-${page}`}
                users={data.users}
                loading={loading}
                roleColors={roleColors}
                canUpdate={canUpdate}
                canDelete={canDelete}
                cannotMessage={cannotMessage}
                onEdit={openEditDialog}
                onDelete={handleDelete}
                selectedIds={selectedIds}
                onToggleSelect={(id) => { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next); }}
            />

            {/* Pagination */}
            <PaginationControl
                currentPage={page}
                totalPages={data.totalPages}
                totalItems={data.total}
                pageSize={pageSize}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
            />

            <UsersFormDialog
                open={open}
                onOpenChange={(v) => { if (v) setOpen(true); else closeDialog(); }}
                editing={!!editingUser}
                defaultValues={{ name: editingUser?.name || "", email: editingUser?.email || "", isActive: editingUser?.isActive ?? true }}
                canSubmit={editingUser ? canUpdate : canCreate}
                cannotMessage={cannotMessage(editingUser ? "update" : "create")}
                roleOptions={roleOptions}
                branchOptions={branchOptions}
                formRole={formRole}
                onFormRoleChange={setFormRole}
                formBranchId={formBranchId}
                onFormBranchIdChange={setFormBranchId}
                onCancel={closeDialog}
                onSubmit={handleSubmit}
            />

            <UsersConfirmDeleteDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                confirmText={confirmText}
                canDelete={canDelete}
                cannotMessage={cannotMessage}
                onCancel={() => { setConfirmOpen(false); setPendingConfirmAction(null); }}
                onConfirm={async () => { await pendingConfirmAction?.(); }}
            />
            <UserImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => { fetchData({}); refreshStats(); }} />
            <BulkActionBar
                selectedCount={selectedIds.size}
                actions={[{
                    label: "Hapus",
                    variant: "destructive",
                    icon: <Trash2 className="w-3 h-3" />,
                    onClick: () => { if (canDelete) setBulkConfirmOpen(true); },
                }]}
                onClear={() => setSelectedIds(new Set())}
            />
            <ActionConfirmDialog
                open={bulkConfirmOpen}
                onOpenChange={setBulkConfirmOpen}
                title={`Hapus ${selectedIds.size} User`}
                description={`Yakin ingin menghapus ${selectedIds.size} user? Tindakan ini tidak dapat dibatalkan.`}
                kind="delete"
                onConfirm={async () => {
                    const { count } = await bulkDeleteUsers([...selectedIds]);
                    toast.success(`${count} user dihapus`);
                    setSelectedIds(new Set());
                    fetchData({});
                    refreshStats();
                    setBulkConfirmOpen(false);
                }}
            />
        </div>
    );
}
