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
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border/40 bg-white p-3 sm:p-4 animate-pulse">
                        <div className="h-3 w-12 bg-gray-200 rounded mb-2" />
                        <div className="h-6 w-8 bg-gray-200 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    const items = [
        { label: "Total", value: stats.total, icon: Store, gradient: "from-slate-500 to-slate-600", shadow: "shadow-slate-500/25", bg: "from-slate-50 to-slate-100/80", border: "border-slate-200/60" },
        { label: "Aktif", value: stats.active, icon: CheckCircle2, gradient: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/25", bg: "from-emerald-50 to-green-50/80", border: "border-emerald-200/60" },
        { label: "Nonaktif", value: stats.inactive, icon: XCircle, gradient: "from-red-500 to-red-600", shadow: "shadow-red-500/25", bg: "from-red-50 to-rose-50/80", border: "border-red-200/60" },
    ];

    return (
        <div className={`grid grid-cols-3 gap-2 sm:gap-3${loading ? " opacity-50 pointer-events-none transition-opacity" : ""}`}>
            {items.map((item) => (
                <div key={item.label} className={`rounded-xl bg-gradient-to-r ${item.bg} border ${item.border} p-2.5 sm:p-4`}>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ${item.gradient} shadow-sm ${item.shadow} shrink-0`}>
                            <item.icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-lg sm:text-xl font-bold tabular-nums text-foreground">{item.value}</p>
                            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">{item.label}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
