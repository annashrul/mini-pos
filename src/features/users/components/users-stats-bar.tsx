"use client";

import { CheckCircle2, Shield, Users } from "lucide-react";

export function UsersStatsBar(props: {
    stats: { total: number; active: number; topRoles: Array<[string, number]> };
    statColors: Record<number, string>;
}) {
    const { stats, statColors } = props;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">
                    {stats.total} <span className="text-slate-400 font-normal">total</span>
                </span>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 ring-1 ring-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-700">
                    {stats.active} <span className="text-emerald-400 font-normal">aktif</span>
                </span>
            </div>
            {stats.topRoles.map(([role, count], idx) => (
                <div key={role} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ring-1 ${statColors[idx] ?? "bg-slate-50 text-slate-700 ring-slate-200"}`}>
                    <Shield className="w-4 h-4 opacity-70" />
                    <span className="text-sm font-medium">
                        {role} <span className="opacity-60 font-normal">({count})</span>
                    </span>
                </div>
            ))}
        </div>
    );
}

