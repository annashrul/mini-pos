"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { cn, formatCurrency } from "@/lib/utils";
import { ArrowRight, DollarSign, MoreVertical, Package, Pencil, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface BranchPriceItemRow {
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

export function BranchPricesList(props: {
  items: BranchPriceItemRow[];
  loading: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  cannotMessage: (action: string) => string;
  onEdit: (item: BranchPriceItemRow) => void;
  onRemove: (productId: string) => void;
}) {
  const { items, loading, canUpdate, canDelete, cannotMessage, onEdit, onRemove } = props;

  if (loading && items.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-white p-3 sm:p-3.5 animate-pulse">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 rounded-lg bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 sm:w-40 bg-gray-200 rounded" />
                <div className="h-3 w-20 sm:w-24 bg-gray-200 rounded" />
              </div>
              <div className="hidden sm:block w-24 space-y-1">
                <div className="h-3 w-12 bg-gray-200 rounded" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
              <div className="hidden sm:block w-4 h-4 bg-gray-200 rounded shrink-0" />
              <div className="hidden sm:block w-24 space-y-1">
                <div className="h-3 w-12 bg-gray-200 rounded" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="flex sm:hidden items-center gap-2 mt-2.5">
              <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2.5", loading && items.length > 0 && "opacity-50 pointer-events-none transition-opacity")}>
      {items.map((item) => {
        const effectiveSell = item.branchSellingPrice ?? item.defaultSellingPrice;
        const diff = effectiveSell - item.defaultSellingPrice;
        return (
          <div
            key={item.productId}
            className={cn(
              "bg-white rounded-xl border p-3 sm:p-4 group transition-all hover:shadow-md hover:shadow-slate-100",
              item.hasCustomPrice ? "border-violet-200/60 ring-1 ring-violet-500/5" : "border-slate-200/60"
            )}
          >
            {/* Mobile layout: stacked */}
            <div className="flex sm:hidden flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-50 to-purple-50 shrink-0">
                  <Package className="w-4 h-4 text-violet-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground truncate">{item.productName}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground/70 font-mono">{item.productCode}</span>
                    <Badge className="text-[10px] rounded-md shrink-0 bg-violet-50 text-violet-600 border-violet-200/50 hover:bg-violet-50">
                      {item.category}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-8 w-8 rounded-xl flex items-center justify-center hover:bg-muted shrink-0">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl w-44">
                    <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="branch-prices" actionKey="update">
                      <DropdownMenuItem disabled={!canUpdate} onClick={() => onEdit(item)} className="text-xs gap-2">
                        <Pencil className="w-3.5 h-3.5" /> Edit Harga
                      </DropdownMenuItem>
                    </DisabledActionTooltip>
                    {item.hasCustomPrice && (
                      <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="branch-prices" actionKey="delete">
                        <DropdownMenuItem disabled={!canDelete} onClick={() => onRemove(item.productId)} className="text-xs gap-2 text-red-600 focus:text-red-600">
                          <X className="w-3.5 h-3.5" /> Hapus Harga Cabang
                        </DropdownMenuItem>
                      </DisabledActionTooltip>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-2 justify-between">
                <div className="bg-slate-50/80 rounded-lg px-3 py-1.5 flex-1">
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Default</p>
                  <p className="text-xs text-slate-600 font-medium">{formatCurrency(item.defaultSellingPrice)}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/25 shrink-0" />
                <div className={cn("rounded-lg px-3 py-1.5 flex-1 text-right", item.hasCustomPrice ? "bg-violet-50/50" : "")}>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Cabang</p>
                  {item.hasCustomPrice ? (
                    <p className="text-sm font-bold text-violet-600">{formatCurrency(item.branchSellingPrice!)}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/40 italic">-- default --</p>
                  )}
                </div>
                {item.hasCustomPrice && diff !== 0 ? (
                  <Badge className={cn("text-[10px] ring-1 shrink-0", diff > 0 ? "bg-emerald-50 text-emerald-700 ring-emerald-500/20 hover:bg-emerald-50" : "bg-red-50 text-red-700 ring-red-500/20 hover:bg-red-50")}>
                    {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                  </Badge>
                ) : null}
              </div>
            </div>

            {/* Desktop layout: horizontal row */}
            <div className="hidden sm:flex items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-50 to-purple-50 shrink-0">
                  <Package className="w-4 h-4 text-violet-500" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground truncate">{item.productName}</span>
                    <Badge className="text-[10px] rounded-md shrink-0 bg-violet-50 text-violet-600 border-violet-200/50 hover:bg-violet-50">
                      {item.category}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground/70 font-mono">{item.productCode}</span>
                </div>
              </div>

              <div className="shrink-0 w-28">
                <div className="bg-slate-50/80 rounded-lg px-3 py-1.5 text-right">
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Default</p>
                  <p className="text-xs text-slate-600 font-medium">{formatCurrency(item.defaultSellingPrice)}</p>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-muted-foreground/25 shrink-0" />

              <div className="text-right shrink-0 w-28">
                <div className={cn("rounded-lg px-3 py-1.5", item.hasCustomPrice ? "bg-violet-50/50" : "")}>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Cabang</p>
                  {item.hasCustomPrice ? (
                    <p className="text-sm font-bold text-violet-600">{formatCurrency(item.branchSellingPrice!)}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/40 italic">-- default --</p>
                  )}
                </div>
              </div>

              <div className="w-20 text-center shrink-0">
                {item.hasCustomPrice && diff !== 0 ? (
                  <Badge
                    className={cn(
                      "text-[10px] ring-1",
                      diff > 0 ? "bg-emerald-50 text-emerald-700 ring-emerald-500/20 hover:bg-emerald-50" : "bg-red-50 text-red-700 ring-red-500/20 hover:bg-red-50"
                    )}
                  >
                    {diff > 0 ? "+" : ""}
                    {formatCurrency(diff)}
                  </Badge>
                ) : null}
              </div>

              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="branch-prices" actionKey="update">
                  <Button disabled={!canUpdate} variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => onEdit(item)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </DisabledActionTooltip>
                {item.hasCustomPrice && (
                  <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="branch-prices" actionKey="delete">
                    <Button disabled={!canDelete} variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => onRemove(item.productId)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </DisabledActionTooltip>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {items.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 mb-3">
            <DollarSign className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-foreground">Tidak ada produk ditemukan</p>
          <p className="text-xs text-muted-foreground mt-1">Coba ubah kata kunci pencarian</p>
        </div>
      )}
    </div>
  );
}

