"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createBranch, updateBranch, deleteBranch, getBranches } from "@/features/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { PaginationControl } from "@/components/ui/pagination-control";
import { toast } from "sonner";
import type { Branch } from "@/types";
import { BranchesConfirmDeleteDialog } from "./branches-confirm-delete-dialog";
import { BranchesDialog } from "./branches-dialog";
import { BranchesGrid } from "./branches-grid";
import { BranchesHeader } from "./branches-header";
import { BranchesSearch } from "./branches-search";
import { BranchesStatsBar } from "./branches-stats-bar";

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
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { canAction, cannotMessage } = useMenuActionAccess("branches");
    const { canAction: canPlanAction, getPlanBlockMessage } = usePlanAccess();
    const canCreate = canAction("create") && canPlanAction("branches", "create");
    const canUpdate = canAction("update") && canPlanAction("branches", "update");
    const canDelete = canAction("delete") && canPlanAction("branches", "delete");
    const getMessage = (ak: string) => getPlanBlockMessage("branches", ak) ?? cannotMessage(ak);

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
        if (editing ? !canUpdate : !canCreate) { toast.error(getMessage(editing ? "update" : "create")); return; }
        formData.set("isActive", String(formIsActive));
        const result = editing ? await updateBranch(editing.id, formData) : await createBranch(formData);
        if (result.error) { toast.error(result.error); }
        else { toast.success(editing ? "Cabang berhasil diupdate" : "Cabang berhasil ditambahkan"); setOpen(false); setEditing(null); fetchData({}); }
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) { toast.error(getMessage("delete")); return; }
        setPendingDeleteId(id);
        setConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!canDelete) { toast.error(getMessage("delete")); return; }
        if (!pendingDeleteId) return;
        const id = pendingDeleteId;
        setPendingDeleteId(null);
        setConfirmOpen(false);
        const result = await deleteBranch(id);
        if (result.error) toast.error(result.error); else { toast.success("Cabang berhasil dihapus"); fetchData({}); }
    };

    return (
        <div className="space-y-6">
            <BranchesHeader
                total={data.total}
                canCreate={canCreate}
                cannotMessage={cannotMessage}
                onCreate={() => { setEditing(null); setFormIsActive(true); setOpen(true); }}
            />

            <BranchesStatsBar loading={loading} hasData={data.branches.length > 0} stats={stats} />

            <div className="space-y-4">
                <BranchesSearch
                    value={search}
                    loading={loading}
                    onChange={(v) => {
                        setSearch(v);
                        if (debounceRef.current) clearTimeout(debounceRef.current);
                        debounceRef.current = setTimeout(() => {
                            setPage(1);
                            fetchData({ search: v, page: 1 });
                        }, 300);
                    }}
                />

                <BranchesGrid
                    branches={data.branches}
                    loading={loading}
                    canCreate={canCreate}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    cannotMessage={cannotMessage}
                    onCreateFirst={() => { setEditing(null); setFormIsActive(true); setOpen(true); }}
                    onEdit={(branch) => { setEditing(branch); setFormIsActive(branch.isActive); setOpen(true); }}
                    onDelete={(id) => handleDelete(id)}
                />

                <PaginationControl
                    currentPage={page}
                    totalPages={data.totalPages}
                    totalItems={data.total}
                    pageSize={pageSize}
                    onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                    onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                />
            </div>

            <BranchesDialog

                open={open}
                onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
                editingName={editing?.name}
                defaultValues={{ name: editing?.name || "", address: editing?.address || "", phone: editing?.phone || "" }}
                formIsActive={formIsActive}
                onFormIsActiveChange={setFormIsActive}
                canSubmit={editing ? canUpdate : canCreate}
                cannotMessage={getMessage(editing ? "update" : "create")}
                onCancel={() => { setOpen(false); setEditing(null); }}
                onSubmit={handleSubmit}
            />

            <BranchesConfirmDeleteDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                canDelete={canDelete}
                cannotMessage={getMessage("delete")}
                onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
                onConfirm={confirmDelete}
            />
        </div>
    );
}
