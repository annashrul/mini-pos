"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { getBranchPrices, setBranchPrice, removeBranchPrice, copyBranchPrices } from "@/features/branch-prices";
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
import { Search, DollarSign, Copy, Pencil, X, ChevronLeft, ChevronRight, Loader2, Check, ArrowRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface Props {
  branches: Branch[];
  initialData: { items: BranchPriceItem[]; total: number; totalPages: number };
  initialBranchId: string;
}

export function BranchPricesContent({ branches, initialData, initialBranchId }: Props) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<BranchPriceItem | null>(null);
  const [editSellPrice, setEditSellPrice] = useState(0);
  const [editBuyPrice, setEditBuyPrice] = useState(0);
  const [editMargin, setEditMargin] = useState(0);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState("");

  const { selectedBranchId, selectedBranchName } = useBranch();
  const activeBranchId = selectedBranchId || initialBranchId;
  const activeBranches = branches.filter((b) => b.isActive);
  const customCount = data.items.filter((i) => i.hasCustomPrice).length;

  // Auto-fetch when sidebar branch changes
  const prevBranchRef = useRef(selectedBranchId);
  useEffect(() => {
    if (prevBranchRef.current !== selectedBranchId || selectedBranchId) {
      prevBranchRef.current = selectedBranchId;
      if (selectedBranchId) {
        setPage(1); setSearch("");
        fetchData({ branchId: selectedBranchId, search: "", page: 1 });
      }
    }
  }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = (params: { branchId?: string; search?: string; page?: number }) => {
    const branchId = params.branchId ?? activeBranchId;
    if (!branchId) return;
    startTransition(async () => {
      const result = await getBranchPrices({ branchId, search: params.search ?? search, page: params.page ?? page });
      setData(result);
    });
  };

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
    if (!editItem || !activeBranchId) return;
    const result = await setBranchPrice(activeBranchId, editItem.productId, editSellPrice, editBuyPrice);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Harga berhasil disimpan");
    setEditOpen(false);
    fetchData({});
  };

  const handleRemovePrice = async (productId: string) => {
    if (!activeBranchId) return;
    await removeBranchPrice(activeBranchId, productId);
    toast.success("Harga cabang dihapus, kembali ke default");
    fetchData({});
  };

  const handleCopy = async () => {
    if (!activeBranchId || !copyTarget) return;
    const result = await copyBranchPrices(activeBranchId, copyTarget);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`${result.count ?? 0} harga berhasil disalin`);
    setCopyOpen(false); setCopyTarget("");
  };

  const startItem = (page - 1) * 20 + 1;
  const endItem = Math.min(page * 20, data.total);

  // No branch selected
  if (!activeBranchId) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-primary" /> Harga per Cabang
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Set harga produk berbeda untuk setiap cabang</p>
        </div>
        <div className="text-center py-16 text-muted-foreground/40">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
          <p className="text-base font-medium text-foreground">Pilih lokasi terlebih dahulu</p>
          <p className="text-sm mt-1">Gunakan filter lokasi di sidebar untuk memilih cabang</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-primary" /> Harga per Cabang
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Menampilkan harga untuk <strong>{selectedBranchName || "cabang terpilih"}</strong>
            {" · "}{customCount} harga khusus dari {data.total} produk
          </p>
        </div>
        <Button variant="outline" className="rounded-lg" onClick={() => setCopyOpen(true)} disabled={customCount === 0}>
          <Copy className="w-4 h-4 mr-2" /> Salin Harga
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Cari produk..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); fetchData({ search: e.target.value, page: 1 }); }}
          className="pl-9 rounded-lg" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
      </div>

      {/* Product List */}
      <div className="space-y-2">
        {data.items.map((item) => {
          const effectiveSell = item.branchSellingPrice ?? item.defaultSellingPrice;
          const diff = effectiveSell - item.defaultSellingPrice;
          return (
            <div key={item.productId} className={cn(
              "bg-white rounded-xl border p-3.5 flex items-center gap-4 group transition-all hover:shadow-sm",
              item.hasCustomPrice ? "border-primary/20" : "border-border/40"
            )}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{item.productName}</span>
                  <Badge variant="secondary" className="text-[10px] rounded-md shrink-0">{item.category}</Badge>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{item.productCode}</span>
              </div>
              <div className="text-right shrink-0 w-28">
                <p className="text-[10px] text-muted-foreground">Default</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(item.defaultSellingPrice)}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
              <div className="text-right shrink-0 w-28">
                <p className="text-[10px] text-muted-foreground">Cabang</p>
                {item.hasCustomPrice ? (
                  <p className="text-sm font-semibold text-primary">{formatCurrency(item.branchSellingPrice!)}</p>
                ) : (
                  <p className="text-xs text-muted-foreground/50">- default -</p>
                )}
              </div>
              <div className="w-20 text-center shrink-0">
                {item.hasCustomPrice && diff !== 0 ? (
                  <Badge className={cn("text-[10px]", diff > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                    {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                  </Badge>
                ) : null}
              </div>
              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEdit(item)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                {item.hasCustomPrice && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemovePrice(item.productId)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {data.items.length === 0 && (
          <div className="text-center py-12 text-muted-foreground/40">
            <DollarSign className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm">Tidak ada produk ditemukan</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-border/30">
          <span className="text-xs text-muted-foreground">{startItem}-{endItem} dari {data.total}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={page <= 1} onClick={() => { setPage(page - 1); fetchData({ page: page - 1 }); }}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground flex items-center px-2">{page}/{data.totalPages}</span>
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={page >= data.totalPages} onClick={() => { setPage(page + 1); fetchData({ page: page + 1 }); }}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Price Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>Set Harga Cabang</DialogTitle></DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="font-semibold text-sm">{editItem.productName}</p>
                <p className="text-xs text-muted-foreground">{editItem.productCode} · Default: {formatCurrency(editItem.defaultSellingPrice)}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Harga Beli</Label>
                  <Input type="number" value={editBuyPrice} onChange={(e) => handleEditBuyChange(Number(e.target.value))} className="rounded-lg h-9" min={0} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Margin %</Label>
                  <Input type="number" value={editMargin} onChange={(e) => handleEditMarginChange(Number(e.target.value))} className="rounded-lg h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Harga Jual</Label>
                  <Input type="number" value={editSellPrice} onChange={(e) => handleEditSellChange(Number(e.target.value))} className="rounded-lg h-9" min={0} />
                </div>
              </div>
              {editBuyPrice > 0 && editSellPrice > 0 && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">Profit:</span>
                  <span className={cn("font-semibold", editSellPrice - editBuyPrice > 0 ? "text-green-600" : "text-red-600")}>
                    {formatCurrency(editSellPrice - editBuyPrice)}
                  </span>
                  <Badge className={cn("text-[10px]", editMargin > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                    {editMargin > 0 ? "+" : ""}{editMargin}%
                  </Badge>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-lg">Batal</Button>
                <Button onClick={handleSavePrice} className="rounded-lg"><Check className="w-4 h-4 mr-1" /> Simpan</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Copy Dialog */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>Salin Harga ke Cabang Lain</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Salin {customCount} harga khusus dari <strong>{selectedBranchName}</strong> ke cabang tujuan.
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm">Cabang Tujuan</Label>
              <Select value={copyTarget} onValueChange={setCopyTarget}>
                <SelectTrigger className="rounded-lg w-full"><SelectValue placeholder="Pilih cabang" /></SelectTrigger>
                <SelectContent>
                  {activeBranches.filter((b) => b.id !== activeBranchId).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCopyOpen(false)} className="rounded-lg">Batal</Button>
              <Button onClick={handleCopy} disabled={!copyTarget} className="rounded-lg">Salin Harga</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
