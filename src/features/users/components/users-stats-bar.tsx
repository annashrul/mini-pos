"use client";

import { CheckCircle2, Shield, Users } from "lucide-react";

export function UsersStatsBar(props: {
    stats: { total: number; active: number; topRoles: Array<[string, number]> };
    statColors: Record<number, string>;
}) {
    const { stats, statColors } = props;

    return (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 sm:pb-0 sm:flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100/80 shrink-0">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-700 font-mono tabular-nums">{stats.total}</span>
                <span className="text-xs text-slate-400">Total</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 ring-1 ring-emerald-100 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-700 font-mono tabular-nums">{stats.active}</span>
                <span className="text-xs text-emerald-500">Aktif</span>
            </div>
            {stats.topRoles.map(([role, count], idx) => (
                <div key={role} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-1 shrink-0 ${statColors[idx] ?? "bg-slate-50 text-slate-700 ring-slate-200"}`}>
                    <Shield className="w-3.5 h-3.5 opacity-60" />
                    <span className="text-xs font-medium whitespace-nowrap">{role}</span>
                    <span className="text-xs opacity-50 font-mono tabular-nums">{count}</span>
                </div>
            ))}
        </div>
    );
}

