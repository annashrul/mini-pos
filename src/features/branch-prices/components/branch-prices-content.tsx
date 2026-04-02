"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { getBranchPrices, setBranchPrice, removeBranchPrice, copyBranchPrices } from "@/features/branch-prices";
import { getAllBranches } from "@/features/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { useBranch } from "@/components/providers/branch-provider";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PaginationControl } from "@/components/ui/pagination-control";
import { Search, DollarSign, Copy, Pencil, X, Loader2, Check, ArrowRight, AlertTriangle, Package, TrendingUp, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";

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
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">Harga per Cabang</h1>
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
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
                        <DollarSign className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Harga per Cabang</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                            Menampilkan harga untuk <strong>{selectedBranchName || "cabang terpilih"}</strong>
                            {" · "}{customCount} harga khusus dari {data.total} produk
                        </p>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                    <Button
                        disabled={!canCreate || customCount === 0}
                        className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all"
                        onClick={() => setCopyOpen(true)}
                    >
                        <Copy className="w-4 h-4 mr-2" /> Salin Harga
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-xl px-3.5 py-2">
                    <Package className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">{stats.totalProducts} Produk</span>
                </div>
                <div className="flex items-center gap-2 bg-violet-50 border border-violet-200/60 ring-1 ring-violet-500/10 rounded-xl px-3.5 py-2">
                    <DollarSign className="w-4 h-4 text-violet-600" />
                    <span className="text-sm font-medium text-violet-700">{stats.customPrices} Harga Khusus</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-xl px-3.5 py-2">
                    <Check className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">{stats.defaultPrices} Default</span>
                </div>
                <Badge variant="outline" className="rounded-full px-3 py-1.5 text-xs font-medium bg-white border-violet-200 text-violet-700">
                    {selectedBranchName || "Cabang"}
                </Badge>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <Input
                    placeholder="Cari nama produk atau kode..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); fetchData({ search: e.target.value, page: 1 }); }}
                    className="pl-10 rounded-xl h-10 border-slate-200/60 bg-white shadow-sm focus-visible:ring-violet-500/20"
                />
                {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-violet-500" />}
            </div>

            {/* Product List */}
            {loading && data.items.length === 0 ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-border/40 bg-white p-3.5 flex items-center gap-4 animate-pulse">
                            <div className="w-9 h-9 rounded-lg bg-gray-200 shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-4 w-40 bg-gray-200 rounded" />
                                <div className="h-3 w-24 bg-gray-200 rounded" />
                            </div>
                            <div className="w-24 space-y-1">
                                <div className="h-3 w-12 bg-gray-200 rounded" />
                                <div className="h-4 w-20 bg-gray-200 rounded" />
                            </div>
                            <div className="w-4 h-4 bg-gray-200 rounded shrink-0" />
                            <div className="w-24 space-y-1">
                                <div className="h-3 w-12 bg-gray-200 rounded" />
                                <div className="h-4 w-20 bg-gray-200 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
            <div className={cn("space-y-2.5", loading && data.items.length > 0 && "opacity-50 pointer-events-none transition-opacity")}>
                {data.items.map((item) => {
                    const effectiveSell = item.branchSellingPrice ?? item.defaultSellingPrice;
                    const diff = effectiveSell - item.defaultSellingPrice;
                    return (
                        <div key={item.productId} className={cn(
                            "bg-white rounded-xl border p-4 flex items-center gap-4 group transition-all hover:shadow-md hover:shadow-slate-100",
                            item.hasCustomPrice ? "border-violet-200/60 ring-1 ring-violet-500/5" : "border-slate-200/60"
                        )}>
                            {/* Product Info */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-50 to-purple-50 shrink-0">
                                    <Package className="w-4 h-4 text-violet-500" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-foreground truncate">{item.productName}</span>
                                        <Badge className="text-[10px] rounded-md shrink-0 bg-violet-50 text-violet-600 border-violet-200/50 hover:bg-violet-50">{item.category}</Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground/70 font-mono">{item.productCode}</span>
                                </div>
                            </div>

                            {/* Default Price */}
                            <div className="shrink-0 w-28">
                                <div className="bg-slate-50/80 rounded-lg px-3 py-1.5 text-right">
                                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Default</p>
                                    <p className="text-xs text-slate-600 font-medium">{formatCurrency(item.defaultSellingPrice)}</p>
                                </div>
                            </div>

                            {/* Arrow */}
                            <ArrowRight className="w-4 h-4 text-muted-foreground/25 shrink-0" />

                            {/* Branch Price */}
                            <div className="text-right shrink-0 w-28">
                                <div className={cn("rounded-lg px-3 py-1.5", item.hasCustomPrice ? "bg-violet-50/50" : "")}>
                                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Cabang</p>
                                    {item.hasCustomPrice ? (
                                        <p className="text-sm font-bold text-violet-600">{formatCurrency(item.branchSellingPrice!)}</p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground/40 italic">— default —</p>
                                    )}
                                </div>
                            </div>

                            {/* Diff Badge */}
                            <div className="w-20 text-center shrink-0">
                                {item.hasCustomPrice && diff !== 0 ? (
                                    <Badge className={cn(
                                        "text-[10px] ring-1",
                                        diff > 0
                                            ? "bg-emerald-50 text-emerald-700 ring-emerald-500/20 hover:bg-emerald-50"
                                            : "bg-red-50 text-red-700 ring-red-500/20 hover:bg-red-50"
                                    )}>
                                        {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                                    </Badge>
                                ) : null}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                                    <Button disabled={!canUpdate} variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => openEdit(item)}>
                                        <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                </DisabledActionTooltip>
                                {item.hasCustomPrice && (
                                    <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                                        <Button disabled={!canDelete} variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => handleRemovePrice(item.productId)}>
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </DisabledActionTooltip>
                                )}
                            </div>
                        </div>
                    );
                })}

                {data.items.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 mb-3">
                            <DollarSign className="w-7 h-7 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-foreground">Tidak ada produk ditemukan</p>
                        <p className="text-xs text-muted-foreground mt-1">Coba ubah kata kunci pencarian</p>
                    </div>
                )}
            </div>
            )}

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
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="rounded-2xl max-w-sm p-6 overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-500/20">
                                <DollarSign className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold">Set Harga Cabang</span>
                        </DialogTitle>
                    </DialogHeader>
                    {editItem && (
                        <div className="space-y-4">
                            <div className="bg-gradient-to-r from-violet-50/80 to-purple-50/80 rounded-xl p-3.5 border border-violet-100/50">
                                <p className="font-bold text-sm text-foreground">{editItem.productName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{editItem.productCode} · Default: {formatCurrency(editItem.defaultSellingPrice)}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground font-medium">Harga Beli</Label>
                                    <Input type="number" value={editBuyPrice} onChange={(e) => handleEditBuyChange(Number(e.target.value))} className="rounded-xl h-10 border-slate-200/60" min={0} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground font-medium">Margin %</Label>
                                    <Input type="number" value={editMargin} onChange={(e) => handleEditMarginChange(Number(e.target.value))} className="rounded-xl h-10 border-slate-200/60" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground font-medium">Harga Jual</Label>
                                    <Input type="number" value={editSellPrice} onChange={(e) => handleEditSellChange(Number(e.target.value))} className="rounded-xl h-10 border-slate-200/60" min={0} />
                                </div>
                            </div>
                            {editBuyPrice > 0 && editSellPrice > 0 && (
                                <div className="flex items-center gap-3 bg-slate-50/80 rounded-xl px-3.5 py-2.5 border border-slate-100">
                                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground font-medium">Profit:</span>
                                    <span className={cn("text-sm font-bold", editSellPrice - editBuyPrice > 0 ? "text-emerald-600" : "text-red-600")}>
                                        {formatCurrency(editSellPrice - editBuyPrice)}
                                    </span>
                                    <Badge className={cn(
                                        "text-[10px] ring-1 ml-auto",
                                        editMargin > 0
                                            ? "bg-emerald-50 text-emerald-700 ring-emerald-500/20 hover:bg-emerald-50"
                                            : "bg-red-50 text-red-700 ring-red-500/20 hover:bg-red-50"
                                    )}>
                                        {editMargin > 0 ? "+" : ""}{editMargin}%
                                    </Badge>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-1">
                                <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl border-slate-200/60">Batal</Button>
                                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                                    <Button
                                        disabled={!canUpdate}
                                        onClick={handleSavePrice}
                                        className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all"
                                    >
                                        <Check className="w-4 h-4 mr-1.5" /> Simpan
                                    </Button>
                                </DisabledActionTooltip>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Copy Dialog */}
            <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
                <DialogContent className="rounded-2xl max-w-sm p-6 overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-500/20">
                                <Copy className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold">Salin Harga ke Cabang Lain</span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Salin <strong className="text-violet-600">{customCount}</strong> harga khusus dari <strong>{selectedBranchName}</strong> ke cabang tujuan.
                        </p>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Cabang Tujuan</Label>
                            <Select value={copyTarget} onValueChange={setCopyTarget}>
                                <SelectTrigger className="rounded-xl w-full h-10 border-slate-200/60"><SelectValue placeholder="Pilih cabang tujuan..." /></SelectTrigger>
                                <SelectContent>
                                    {activeBranches.filter((b) => b.id !== activeBranchId).map((b) => (
                                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-start gap-2 bg-blue-50/80 rounded-xl px-3.5 py-2.5 border border-blue-100/50">
                            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-blue-600">Semua harga khusus (beli & jual) akan disalin ke cabang tujuan. Harga yang sudah ada di cabang tujuan akan ditimpa.</p>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="outline" onClick={() => setCopyOpen(false)} className="rounded-xl border-slate-200/60">Batal</Button>
                            <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                                <Button
                                    disabled={!canCreate || !copyTarget}
                                    onClick={handleCopy}
                                    className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all"
                                >
                                    <Copy className="w-4 h-4 mr-1.5" /> Salin Harga
                                </Button>
                            </DisabledActionTooltip>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
