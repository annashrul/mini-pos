"use client";

import { ArrowRight } from "lucide-react";
import { tryParseAuditLogDetailsJson } from "../utils";

export function AuditLogsDetailCard({ details }: { details: string | null }) {
    const json = tryParseAuditLogDetailsJson(details);
    if (!json && details) {
        return <p className="text-xs text-muted-foreground">{details}</p>;
    }
    if (!json) return null;

    if (json.before && json.after) {
        const before = json.before as Record<string, unknown>;
        const after = json.after as Record<string, unknown>;
        const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
        const changedKeys = allKeys.filter((k) => String(before[k] ?? "") !== String(after[k] ?? ""));

        if (changedKeys.length === 0) {
            return <p className="text-xs text-muted-foreground italic">Tidak ada perubahan data</p>;
        }

        return (
            <div className="space-y-1.5">
                {changedKeys.map((key) => (
                    <div key={key} className="flex items-start gap-2 text-xs">
                        <span className="font-medium text-muted-foreground min-w-[60px] sm:min-w-[60px] sm:min-w-[80px] capitalize">{key}</span>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-mono text-[11px] line-through truncate max-w-[100px] sm:max-w-[140px]">
                                {String(before[key] ?? "—")}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                            <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-mono text-[11px] font-medium truncate max-w-[100px] sm:max-w-[140px]">
                                {String(after[key] ?? "—")}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (json.deleted) {
        const deleted = json.deleted as Record<string, unknown>;
        return (
            <div className="space-y-1">
                {Object.entries(deleted).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-muted-foreground min-w-[60px] sm:min-w-[60px] sm:min-w-[80px] capitalize">{key}</span>
                        <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-mono text-[11px] line-through">
                            {String(val ?? "—")}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    if (json.data) {
        const data = json.data as Record<string, unknown>;
        return (
            <div className="space-y-1">
                {Object.entries(data).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-muted-foreground min-w-[60px] sm:min-w-[80px] capitalize">{key}</span>
                        <span className="bg-slate-50 text-foreground px-1.5 py-0.5 rounded font-mono text-[11px]">
                            {val === true ? "Ya" : val === false ? "Tidak" : String(val ?? "—")}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {Object.entries(json).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-muted-foreground min-w-[60px] sm:min-w-[80px] capitalize">{key}</span>
                    <span className="bg-slate-50 text-foreground px-1.5 py-0.5 rounded font-mono text-[11px]">
                        {typeof val === "object" ? JSON.stringify(val) : String(val ?? "—")}
                    </span>
                </div>
            ))}
        </div>
    );
}

