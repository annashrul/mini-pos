"use client";

import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ExportMenu } from "@/components/ui/export-menu";
import { Plus, Users, Upload } from "lucide-react";

export function UsersHeader(props: {
  canCreate: boolean;
  cannotMessage: (action: string) => string;
  onCreate: () => void;
  onImport?: () => void;
}) {
  const { canCreate, cannotMessage, onCreate, onImport } = props;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-200/50 shrink-0">
          <Users className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Pengguna</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Kelola user dan hak akses</p>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-2">
        {onImport && (
          <Button variant="outline" className="rounded-xl border-dashed" onClick={onImport}>
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>
        )}
        <ExportMenu module="users" />
        <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="users" actionKey="create">
          <Button
            disabled={!canCreate}
            className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
            onClick={onCreate}
          >
            <Plus className="w-4 h-4 mr-2" /> Tambah User
          </Button>
        </DisabledActionTooltip>
      </div>

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

