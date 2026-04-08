"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Building2, Plus } from "lucide-react";

export function BranchesHeader(props: {
  total: number;
  canCreate: boolean;
  cannotMessage: (action: string) => string;
  onCreate: () => void;
}) {
  const { total, canCreate, cannotMessage, onCreate } = props;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/20 shrink-0">
          <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Cabang</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Kelola cabang toko
            <Badge variant="secondary" className="ml-1.5 rounded-full text-[10px] sm:text-xs tabular-nums font-medium">
              {total}
            </Badge>
          </p>
        </div>
      </div>

      <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
        <Button
          disabled={!canCreate}
          className="hidden sm:inline-flex rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
          onClick={onCreate}
        >
          <Plus className="w-4 h-4 mr-2" /> Tambah Cabang
        </Button>
      </DisabledActionTooltip>

      {/* Mobile: Floating button */}
      {canCreate && (
        <div className="sm:hidden fixed bottom-4 right-4 z-50">
          <Button
            onClick={onCreate}
            size="icon"
            className="h-12 w-12 rounded-full shadow-xl shadow-primary/30 bg-gradient-to-br from-primary to-primary/80"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}

