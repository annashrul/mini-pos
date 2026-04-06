"use client";

import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Plus, Users } from "lucide-react";

export function UsersHeader(props: {
  canCreate: boolean;
  cannotMessage: (action: string) => string;
  onCreate: () => void;
}) {
  const { canCreate, cannotMessage, onCreate } = props;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-200/50">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Manajemen Pengguna</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Kelola user dan hak akses sistem</p>
        </div>
      </div>
      <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
        <Button
          disabled={!canCreate}
          className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
          onClick={onCreate}
        >
          <Plus className="w-4 h-4 mr-2" /> Tambah User
        </Button>
      </DisabledActionTooltip>
    </div>
  );
}

