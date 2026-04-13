"use client";

import { useEffect, useState, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  generateAutoReorderList,
  type SupplierReorderGroup,
} from "@/server/actions/inventory-forecast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { CreatePODialog } from "@/features/purchases/components/create-po-dialog";
import {
  Building2,
  FileText,
  Phone,
  ShoppingCart,
  Truck,
  AlertTriangle,
} from "lucide-react";

interface Props {
  branchId?: string | undefined;
}

export function AutoReorderList({ branchId }: Props) {
  const [groups, setGroups] = useState<SupplierReorderGroup[]>([]);
  const [isPending, startTransition] = useTransition();
  const [poDialogOpen, setPODialogOpen] = useState(false);
  const { canAction: canPlan } = usePlanAccess();
  const canCreatePO = canPlan("purchases", "create");

  useEffect(() => {
    startTransition(async () => {
      const data = await generateAutoReorderList(branchId);
      setGroups(data);
    });
  }, [branchId]);

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-xl" />
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-slate-200 overflow-hidden">
            <Skeleton className="h-14" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3 sm:mb-4">
          <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />
        </div>
        <h3 className="text-sm sm:text-base font-semibold text-slate-700 mb-1">Semua Stok Aman</h3>
        <p className="text-xs sm:text-sm text-slate-400 max-w-xs">Tidak ada produk yang memerlukan reorder saat ini.</p>
      </div>
    );
  }

  const totalItems = groups.reduce((s, g) => s + g.items.length, 0);
  const totalCost = groups.reduce((s, g) => s + g.totalEstimatedCost, 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-violet-50/80 border border-violet-100">
        <Truck className="w-4 h-4 text-violet-600 shrink-0" />
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 text-[11px] sm:text-sm">
          <span className="text-violet-700 font-medium">{groups.length} supplier</span>
          <span className="text-violet-500">{totalItems} produk</span>
        </div>
        <span className="font-bold text-violet-700 text-xs sm:text-sm font-mono tabular-nums shrink-0">{formatCurrency(totalCost)}</span>
      </div>

      {/* Supplier groups */}
      {groups.map(group => (
        <div key={group.supplierId} className="rounded-xl sm:rounded-2xl border border-slate-200/60 bg-white overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 p-3 sm:p-4 bg-slate-50/60 border-b border-slate-100">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{group.supplierName}</p>
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-400 mt-0.5">
                  {group.supplierContact && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{group.supplierContact}</span>}
                  <span>{group.items.length} item</span>
                  <span className="font-mono tabular-nums font-medium text-slate-600">{formatCurrency(group.totalEstimatedCost)}</span>
                </div>
              </div>
            </div>
            <DisabledActionTooltip disabled={!canCreatePO} message="Anda tidak memiliki akses" menuKey="purchases" actionKey="create">
              <Button size="sm" disabled={!canCreatePO} className="gap-1.5 shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-sm rounded-lg sm:rounded-xl" onClick={() => setPODialogOpen(true)}>
                <FileText className="w-3.5 h-3.5" />
                <span className="text-xs">Buat PO</span>
              </Button>
            </DisabledActionTooltip>
          </div>

          {/* Items */}
          <div className="divide-y divide-slate-100">
            {group.items.map(item => {
              const isUrgent = item.daysUntilStockout < 3;
              return (
                <div key={item.productId} className="px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3">
                  {/* Risk indicator */}
                  <div className={`w-1.5 sm:w-2 h-8 sm:h-10 rounded-full shrink-0 ${
                    item.riskLevel === "CRITICAL" ? "bg-red-500" :
                    item.riskLevel === "WARNING" ? "bg-amber-500" :
                    item.riskLevel === "LOW" ? "bg-blue-400" : "bg-emerald-400"
                  }`} />

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">{item.productName}</p>
                      {isUrgent && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 mt-0.5 text-[10px] sm:text-xs text-slate-400">
                      <span className="font-mono">{item.productCode}</span>
                      <span>Stok: <span className={isUrgent ? "text-red-600 font-medium" : ""}>{item.currentStock}</span></span>
                      <span className="hidden sm:inline">Avg: {item.avgDailySales}/hari</span>
                      <span className={`font-medium ${item.daysUntilStockout < 3 ? "text-red-600" : item.daysUntilStockout < 7 ? "text-amber-600" : ""}`}>
                        {item.daysUntilStockout >= 9999 ? "N/A" : `${item.daysUntilStockout}d`}
                      </span>
                    </div>
                  </div>

                  {/* Order info */}
                  <div className="text-right shrink-0">
                    <p className="text-xs sm:text-sm font-bold text-violet-700 font-mono tabular-nums">{item.recommendedQty}</p>
                    <p className="text-[9px] sm:text-[11px] text-slate-400 font-mono tabular-nums">{formatCurrency(item.estimatedCost)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Create PO Dialog */}
      <CreatePODialog open={poDialogOpen} onOpenChange={setPODialogOpen} />
    </div>
  );
}
