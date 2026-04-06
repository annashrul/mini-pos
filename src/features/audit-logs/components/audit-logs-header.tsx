"use client";

import { Button } from "@/components/ui/button";
import { ScrollText, ChevronDown, ChevronUp, Plus, Pencil, Trash2 } from "lucide-react";

export function AuditLogsHeader(props: {
  stats: { total: number; create: number; update: number; delete: number };
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const { stats, onExpandAll, onCollapseAll } = props;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg shadow-teal-200/50">
            <ScrollText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Audit Log</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Riwayat semua aktivitas sistem</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={onExpandAll}>
            <ChevronDown className="w-3.5 h-3.5 mr-1" /> Buka Semua
          </Button>
          <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={onCollapseAll}>
            <ChevronUp className="w-3.5 h-3.5 mr-1" /> Tutup Semua
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1.5 bg-slate-100/80 text-slate-600 rounded-full px-3 py-1.5 text-xs font-medium">
          <ScrollText className="w-3.5 h-3.5" />
          <span className="font-mono tabular-nums">{stats.total}</span> Total Log
        </div>
        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-emerald-100">
          <Plus className="w-3.5 h-3.5" />
          <span className="font-mono tabular-nums">{stats.create}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-blue-100">
          <Pencil className="w-3.5 h-3.5" />
          <span className="font-mono tabular-nums">{stats.update}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-500 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-red-100">
          <Trash2 className="w-3.5 h-3.5" />
          <span className="font-mono tabular-nums">{stats.delete}</span>
        </div>
      </div>
    </div>
  );
}

