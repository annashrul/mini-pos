"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createUser, updateUser, deleteUser, getUsers, getActiveRoles } from "@/features/users";
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
import { UsersStatsBar } from "./users-stats-bar";

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
            <UsersHeader canCreate={canCreate} cannotMessage={cannotMessage} onCreate={openCreateDialog} />

            <UsersStatsBar stats={stats} statColors={statColors} />

            <UsersFilters
                search={search}
                loading={loading}
                effectiveRole={effectiveFilters.role || ""}
                roleOptions={roleOptions}
                onSearchChange={handleSearch}
                onRoleFilterChange={handleRoleFilter}
            />

            <UsersGrid
                users={data.users}
                loading={loading}
                roleColors={roleColors}
                canUpdate={canUpdate}
                canDelete={canDelete}
                cannotMessage={cannotMessage}
                onEdit={openEditDialog}
                onDelete={handleDelete}
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
        </div>
    );
}
