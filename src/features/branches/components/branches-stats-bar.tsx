"use client";

import { CheckCircle2, Store, XCircle } from "lucide-react";

export function BranchesStatsBar(props: {
    loading: boolean;
    hasData: boolean;
    stats: { total: number; active: number; inactive: number };
}) {
    const { loading, hasData, stats } = props;

    if (loading && !hasData) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-white animate-pulse">
                        <div className="w-9 h-9 rounded-xl bg-gray-200" />
                        <div className="space-y-1.5">
                            <div className="h-5 w-10 bg-gray-200 rounded" />
                            <div className="h-3 w-20 bg-gray-200 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3${loading ? " opacity-50 pointer-events-none transition-opacity" : ""}`}>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/80 border border-slate-200/60">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shadow-sm">
                    <Store className="w-4 h-4 text-white" />
                </div>
                <div>
                    <p className="text-lg font-bold tabular-nums text-foreground">{stats.total}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">Total Cabang</p>
                </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50/80 border border-emerald-200/60">
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-emerald-100">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Aktif
                </div>
                <div>
                    <p className="text-lg font-bold tabular-nums text-foreground">{stats.active}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">Cabang Aktif</p>
                </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50/80 border border-red-200/60">
                <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-red-100">
                    <XCircle className="w-3.5 h-3.5" />
                    Nonaktif
                </div>
                <div>
                    <p className="text-lg font-bold tabular-nums text-foreground">{stats.inactive}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">Cabang Nonaktif</p>
                </div>
            </div>
        </div>
    );
}

