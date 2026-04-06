"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { getBranchPrices, setBranchPrice, removeBranchPrice, copyBranchPrices } from "@/features/branch-prices";
import { getAllBranches } from "@/features/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { useBranch } from "@/components/providers/branch-provider";
import { PaginationControl } from "@/components/ui/pagination-control";
import { AlertTriangle, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { BranchPricesCopyDialog } from "./branch-prices-copy-dialog";
import { BranchPricesEditDialog } from "./branch-prices-edit-dialog";
import { BranchPricesHeader } from "./branch-prices-header";
import { BranchPricesList } from "./branch-prices-list";
import { BranchPricesSearch } from "./branch-prices-search";
import { BranchPricesStatsBar } from "./branch-prices-stats-bar";

interface BranchPriceItem {
    productId: string;
    productCode: string;
    productName: string;
    category: string;
    defaultSellingPrice: number;
    defaultPurchasePrice: number;
    branchSellingPrice: number | null;
    branchPurchasePrice: number | null;
    hasCustomPrice: boolean;
}

interface Branch { id: string; name: string; isActive: boolean }

export function BranchPricesContent() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [data, setData] = useState<{ items: BranchPriceItem[]; total: number; totalPages: number }>({ items: [], total: 0, totalPages: 0 });
    const [fallbackBranchId, setFallbackBranchId] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [loading, startTransition] = useTransition();
    const [editOpen, setEditOpen] = useState(false);
    const [editItem, setEditItem] = useState<BranchPriceItem | null>(null);
    const [editSellPrice, setEditSellPrice] = useState(0);
    const [editBuyPrice, setEditBuyPrice] = useState(0);
    const [editMargin, setEditMargin] = useState(0);
    const [copyOpen, setCopyOpen] = useState(false);
    const [copyTarget, setCopyTarget] = useState("");
    const { canAction, cannotMessage } = useMenuActionAccess("branch-prices");
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canDelete = canAction("delete");

    const { selectedBranchId, selectedBranchName } = useBranch();
    const activeBranchId = selectedBranchId || fallbackBranchId;
    const activeBranches = branches.filter((b) => b.isActive);
    const customCount = data.items.filter((i) => i.hasCustomPrice).length;

    const stats = useMemo(() => {
        const totalProducts = data.total;
        const customPrices = data.items.filter((i) => i.hasCustomPrice).length;
        const defaultPrices = data.items.length - customPrices;
        return { totalProducts, customPrices, defaultPrices };
    }, [data]);

    function fetchData(params: { branchId?: string; search?: string; page?: number }) {
        const branchId = params.branchId ?? activeBranchId;
        if (!branchId) return;
        startTransition(async () => {
            const result = await getBranchPrices({ branchId, search: params.search ?? search, page: params.page ?? page });
            setData(result);
        });
    }

    // Load branches once on mount
    const initRef = useRef(false);
    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;
        startTransition(async () => {
            const allBranches = await getAllBranches();
            setBranches(allBranches);
            const firstActive = allBranches.find((b) => b.isActive)?.id ?? "";
            setFallbackBranchId(firstActive);
            const branchToUse = selectedBranchId || firstActive;
            if (branchToUse) fetchData({ branchId: branchToUse, search: "", page: 1 });
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-fetch when sidebar branch changes
    const prevBranchRef = useRef(selectedBranchId);
    useEffect(() => {
        if (!initRef.current) return; // skip if init hasn't finished
        if (prevBranchRef.current === selectedBranchId) return; // skip if same
        prevBranchRef.current = selectedBranchId;
        if (selectedBranchId) {
            setPage(1); setSearch("");
            fetchData({ branchId: selectedBranchId, search: "", page: 1 });
        }
    }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const openEdit = (item: BranchPriceItem) => {
        setEditItem(item);
        const sell = item.branchSellingPrice ?? item.defaultSellingPrice;
        const buy = item.branchPurchasePrice ?? item.defaultPurchasePrice;
        setEditSellPrice(sell);
        setEditBuyPrice(buy);
        setEditMargin(buy > 0 ? Math.round((sell - buy) / buy * 100) : 0);
        setEditOpen(true);
    };

    const handleEditBuyChange = (v: number) => {
        setEditBuyPrice(v);
        if (v > 0 && editMargin > 0) setEditSellPrice(Math.round(v * (1 + editMargin / 100)));
    };
    const handleEditSellChange = (v: number) => {
        setEditSellPrice(v);
        if (editBuyPrice > 0) setEditMargin(Math.round((v - editBuyPrice) / editBuyPrice * 100));
    };
    const handleEditMarginChange = (v: number) => {
        setEditMargin(v);
        if (editBuyPrice > 0) setEditSellPrice(Math.round(editBuyPrice * (1 + v / 100)));
    };

    const handleSavePrice = async () => {
        if (!canUpdate) { toast.error(cannotMessage("update")); return; }
        if (!editItem || !activeBranchId) return;
        const result = await setBranchPrice(activeBranchId, editItem.productId, editSellPrice, editBuyPrice);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Harga berhasil disimpan");
        setEditOpen(false);
        fetchData({});
    };

    const handleRemovePrice = async (productId: string) => {
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
        if (!activeBranchId) return;
        await removeBranchPrice(activeBranchId, productId);
        toast.success("Harga cabang dihapus, kembali ke default");
        fetchData({});
    };

    const handleCopy = async () => {
        if (!canCreate) { toast.error(cannotMessage("create")); return; }
        if (!activeBranchId || !copyTarget) return;
        const result = await copyBranchPrices(activeBranchId, copyTarget);
        if (result.error) { toast.error(result.error); return; }
        toast.success(`${result.count ?? 0} harga berhasil disalin`);
        setCopyOpen(false); setCopyTarget("");
    };

    // No branch selected
    if (!activeBranchId) {
        return (
            <div className="space-y-6">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
                            <DollarSign className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Harga per Cabang</h1>
                            <p className="text-muted-foreground text-sm mt-0.5">Set harga produk berbeda untuk setiap cabang</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 mb-4">
                        <AlertTriangle className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-lg font-semibold text-foreground">Pilih lokasi terlebih dahulu</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs text-center">Gunakan filter lokasi di sidebar untuk memilih cabang yang ingin dikelola harganya</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <BranchPricesHeader
                selectedBranchName={selectedBranchName}
                customCount={customCount}
                totalProducts={data.total}
                canCreate={canCreate}
                cannotMessage={cannotMessage}
                onOpenCopy={() => setCopyOpen(true)}
            />

            {/* Stats Bar */}
            <BranchPricesStatsBar stats={stats} selectedBranchName={selectedBranchName} />

            {/* Search */}
            <BranchPricesSearch
                value={search}
                loading={loading}
                onChange={(v) => { setSearch(v); setPage(1); fetchData({ search: v, page: 1 }); }}
            />

            {/* Product List */}
            <BranchPricesList
                items={data.items}
                loading={loading}
                canUpdate={canUpdate}
                canDelete={canDelete}
                cannotMessage={cannotMessage}
                onEdit={openEdit}
                onRemove={handleRemovePrice}
            />

            {/* Pagination */}
            <PaginationControl
                currentPage={page}
                totalPages={data.totalPages}
                totalItems={data.total}
                pageSize={pageSize}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ page: 1 }); }}
            />

            {/* Edit Price Dialog */}
            <BranchPricesEditDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                item={editItem}
                buyPrice={editBuyPrice}
                sellPrice={editSellPrice}
                margin={editMargin}
                onBuyPriceChange={handleEditBuyChange}
                onSellPriceChange={handleEditSellChange}
                onMarginChange={handleEditMarginChange}
                canUpdate={canUpdate}
                cannotMessage={cannotMessage}
                onCancel={() => setEditOpen(false)}
                onSave={handleSavePrice}
            />

            {/* Copy Dialog */}
            <BranchPricesCopyDialog
                open={copyOpen}
                onOpenChange={setCopyOpen}
                selectedBranchName={selectedBranchName}
                customCount={customCount}
                activeBranchId={activeBranchId}
                activeBranches={activeBranches}
                copyTarget={copyTarget}
                onCopyTargetChange={setCopyTarget}
                canCreate={canCreate}
                cannotMessage={cannotMessage}
                onCancel={() => setCopyOpen(false)}
                onConfirm={handleCopy}
            />
        </div>
    );
}
