"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteBranch, getBranches, getBranchStats, bulkDeleteBranches } from "@/features/branches";
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
import { BranchesMap } from "./branches-map";
import { BranchImportDialog } from "./branch-import-dialog";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { Trash2 } from "lucide-react";

export function BranchesContent() {
    const [data, setData] = useState<{ branches: Branch[]; total: number; totalPages: number }>({ branches: [], total: 0, totalPages: 0 });
    const [open, setOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
    const [focusBranchId, setFocusBranchId] = useState<string | null>(null);
    const [editing, setEditing] = useState<Branch | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [loading, startTransition] = useTransition();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { canAction, cannotMessage } = useMenuActionAccess("branches");
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canDelete = canAction("delete");

    // --- Stats ---
    const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
    const refreshStats = () => { getBranchStats().then(setStats); };

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
        refreshStats();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleFormSuccess = () => { setEditing(null); fetchData({}); refreshStats(); };

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
        if (result.error) toast.error(result.error); else { toast.success("Cabang berhasil dihapus"); fetchData({}); refreshStats(); }
    };

    return (
        <div className="space-y-6">
            <BranchesHeader
                total={data.total}
                canCreate={canCreate}
                cannotMessage={cannotMessage}
                onCreate={() => { setEditing(null); setOpen(true); }}
                onImport={() => setImportOpen(true)}
            />

            <BranchesStatsBar loading={loading} hasData={data.branches.length > 0} stats={stats} />

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

            <div className="flex flex-col lg:flex-row gap-4">
                {/* Left: List */}
                <div className="flex-1 min-w-0 space-y-4">
                    <BranchesGrid
                        branches={data.branches}
                        loading={loading}
                        canCreate={canCreate}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        cannotMessage={cannotMessage}
                        onCreateFirst={() => { setEditing(null); setOpen(true); }}
                        onEdit={(branch) => { setEditing(branch); setOpen(true); }}
                        onDelete={(id) => handleDelete(id)}
                        selectedIds={selectedIds}
                        onToggleSelect={(id) => { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next); }}
                        onCardClick={(branch) => setFocusBranchId(branch.id)}
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

                {/* Right: Map (sticky) */}
                <div className="lg:w-[480px] lg:shrink-0">
                    <div className="lg:sticky lg:top-4">
                        <BranchesMap
                            branches={data.branches}
                            focusBranchId={focusBranchId}
                            onEdit={(branch) => { setEditing(branch); setOpen(true); }}
                        />
                    </div>
                </div>
            </div>

            <BranchesDialog
                open={open}
                onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
                editing={editing}
                canSubmit={editing ? canUpdate : canCreate}
                cannotMessage={cannotMessage(editing ? "update" : "create")}
                onSuccess={handleFormSuccess}
            />

            <BranchesConfirmDeleteDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                canDelete={canDelete}
                cannotMessage={cannotMessage("delete")}
                onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
                onConfirm={confirmDelete}
            />
            <BranchImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => { fetchData({}); refreshStats(); }} />
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
                title={`Hapus ${selectedIds.size} Cabang`}
                description={`Yakin ingin menghapus ${selectedIds.size} cabang? Tindakan ini tidak dapat dibatalkan.`}
                kind="delete"
                onConfirm={async () => {
                    const { count } = await bulkDeleteBranches([...selectedIds]);
                    toast.success(`${count} cabang dihapus`);
                    setSelectedIds(new Set());
                    fetchData({});
                    refreshStats();
                    setBulkConfirmOpen(false);
                }}
            />
        </div>
    );
}
