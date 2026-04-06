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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/20">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Cabang / Store</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Kelola cabang toko Anda{" "}
            <Badge variant="secondary" className="ml-1 rounded-full text-xs tabular-nums font-medium">
              {total} cabang
            </Badge>
          </p>
        </div>
      </div>

      <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
        <Button
          disabled={!canCreate}
          className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
          onClick={onCreate}
        >
          <Plus className="w-4 h-4 mr-2" /> Tambah Cabang
        </Button>
      </DisabledActionTooltip>
    </div>
  );
}

