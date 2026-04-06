"use client";

import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
          <DollarSign className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Harga per Cabang</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Menampilkan harga untuk <strong>{selectedBranchName || "cabang terpilih"}</strong>
            {" · "}{customCount} harga khusus dari {totalProducts} produk
          </p>
        </div>
      </div>

      <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
        <Button
          disabled={!canCreate || customCount === 0}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all"
          onClick={onOpenCopy}
        >
          <Copy className="w-4 h-4 mr-2" /> Salin Harga
        </Button>
      </DisabledActionTooltip>
    </div>
  );
}

