"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency } from "@/lib/utils";
import { Check, DollarSign, TrendingUp } from "lucide-react";
import type { BranchPriceItemRow } from "./branch-prices-list";

export function BranchPricesEditDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BranchPriceItemRow | null;
  buyPrice: number;
  sellPrice: number;
  margin: number;
  onBuyPriceChange: (v: number) => void;
  onSellPriceChange: (v: number) => void;
  onMarginChange: (v: number) => void;
  canUpdate: boolean;
  cannotMessage: (action: string) => string;
  onCancel: () => void;
  onSave: () => void;
}) {
  const {
    open,
    onOpenChange,
    item,
    buyPrice,
    sellPrice,
    margin,
    onBuyPriceChange,
    onSellPriceChange,
    onMarginChange,
    canUpdate,
    cannotMessage,
    onCancel,
    onSave,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-t-2xl -mt-6 mb-2" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-500/20">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold">Set Harga Cabang</span>
          </DialogTitle>
        </DialogHeader>

        {item && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-violet-50/80 to-purple-50/80 rounded-xl p-3.5 border border-violet-100/50">
              <p className="font-bold text-sm text-foreground">{item.productName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.productCode} · Default: {formatCurrency(item.defaultSellingPrice)}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Harga Beli</Label>
                <Input type="number" value={buyPrice} onChange={(e) => onBuyPriceChange(Number(e.target.value))} className="rounded-xl h-10 border-slate-200/60" min={0} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Margin %</Label>
                <Input type="number" value={margin} onChange={(e) => onMarginChange(Number(e.target.value))} className="rounded-xl h-10 border-slate-200/60" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Harga Jual</Label>
                <Input type="number" value={sellPrice} onChange={(e) => onSellPriceChange(Number(e.target.value))} className="rounded-xl h-10 border-slate-200/60" min={0} />
              </div>
            </div>
            {buyPrice > 0 && sellPrice > 0 && (
              <div className="flex items-center gap-3 bg-slate-50/80 rounded-xl px-3.5 py-2.5 border border-slate-100">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Profit:</span>
                <span className={cn("text-sm font-bold", sellPrice - buyPrice > 0 ? "text-emerald-600" : "text-red-600")}>
                  {formatCurrency(sellPrice - buyPrice)}
                </span>
                <Badge
                  className={cn(
                    "text-[10px] ring-1 ml-auto",
                    margin > 0 ? "bg-emerald-50 text-emerald-700 ring-emerald-500/20 hover:bg-emerald-50" : "bg-red-50 text-red-700 ring-red-500/20 hover:bg-red-50"
                  )}
                >
                  {margin > 0 ? "+" : ""}
                  {margin}%
                </Badge>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} className="rounded-xl border-slate-200/60">
            Batal
          </Button>
          <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
            <Button
              disabled={!canUpdate}
              onClick={onSave}
              className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all"
            >
              <Check className="w-4 h-4 mr-1.5" /> Simpan
            </Button>
          </DisabledActionTooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

