"use client";

import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ExportMenu } from "@/components/ui/export-menu";
import { Copy, DollarSign } from "lucide-react";

export function BranchPricesHeader(props: {
  selectedBranchName: string | null | undefined;
  customCount: number;
  totalProducts: number;
  canCreate: boolean;
  cannotMessage: (action: string) => string;
  onOpenCopy: () => void;
}) {
  const { selectedBranchName, customCount, totalProducts, canCreate, cannotMessage, onOpenCopy } = props;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20 shrink-0">
          <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Harga per Cabang</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            <strong>{selectedBranchName || "cabang terpilih"}</strong>
            {" · "}{customCount}/{totalProducts} harga khusus
          </p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2">
        <ExportMenu module="branch-prices" />
        <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="branch-prices" actionKey="copy">
          <Button
            disabled={!canCreate || customCount === 0}
            className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all"
            onClick={onOpenCopy}
          >
            <Copy className="w-4 h-4 mr-2" /> Salin Harga
          </Button>
        </DisabledActionTooltip>
      </div>

      {/* Mobile: Floating button */}
      {canCreate && (
        <div className="sm:hidden fixed bottom-4 right-4 z-50">
          <Button
            onClick={onOpenCopy}
            disabled={customCount === 0}
            size="icon"
            className="h-12 w-12 rounded-full shadow-xl shadow-violet-300/50 bg-gradient-to-br from-violet-500 to-purple-600 disabled:opacity-50"
          >
            <Copy className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}

