"use client";

import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Activity, Calendar, ChevronDown, ChevronUp, ScrollText } from "lucide-react";
import {
    auditLogActionConfig,
    auditLogEntityIcons,
    defaultAuditLogAction,
    getAuditLogAvatarColor,
    getAuditLogEntityLabel,
    tryParseAuditLogDetailsJson,
} from "../utils";
import { AuditLogsDetailCard } from "./audit-logs-detail-card";

export function AuditLogsTimeline(props: {
    groups: { date: string; logs: Array<{ id: string; action: string; entity: string; entityId: string | null; details: string | null; createdAt: string | Date; user: { name: string } }> }[];
    expandedIds: Set<string>;
    onToggleExpand: (id: string) => void;
    loading: boolean;
    hasLogs: boolean;
}) {
    const { groups, expandedIds, onToggleExpand, loading, hasLogs } = props;

    if (loading && !hasLogs) {
        return (
            <div className="space-y-6">
                {Array.from({ length: 2 }).map((_, gi) => (
                    <div key={gi}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-1.5 bg-white border border-border/50 rounded-full px-3 py-1 animate-pulse">
                                <div className="w-3.5 h-3.5 bg-gray-200 rounded" />
                                <div className="h-3 w-36 bg-gray-200 rounded" />
                            </div>
                            <div className="flex-1 h-px bg-border/30" />
                        </div>
                        <div className="space-y-2 ml-1">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="rounded-xl border border-border/30 bg-white p-4 flex items-center gap-3 animate-pulse">
                                    <div className="w-8 h-8 rounded-lg bg-gray-200 shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-16 bg-gray-200 rounded" />
                                            <div className="h-4 w-20 bg-gray-200 rounded-md" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gray-200" />
                                        <div className="h-3 w-16 bg-gray-200 rounded" />
                                    </div>
                                    <div className="text-right space-y-1">
                                        <div className="h-3 w-12 bg-gray-200 rounded" />
                                        <div className="h-2 w-16 bg-gray-200 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (!hasLogs) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center">
                    <ScrollText className="w-8 h-8 text-teal-400" />
                </div>
                <p className="text-sm font-medium text-foreground">Tidak ada log ditemukan</p>
                <p className="text-xs text-muted-foreground">Belum ada aktivitas yang tercatat atau filter tidak menampilkan hasil.</p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-6", loading && "opacity-50 pointer-events-none transition-opacity")}>
            {groups.map((group) => (
                <div key={group.date}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-1.5 bg-white border border-border/50 rounded-full px-3 py-1 shadow-sm">
                            <Calendar className="w-3.5 h-3.5 text-teal-500" />
                            <span className="text-xs font-semibold text-foreground">
                                {format(new Date(group.date), "EEEE, dd MMMM yyyy", { locale: idLocale })}
                            </span>
                        </div>
                        <div className="flex-1 h-px bg-border/30" />
                        <span className="text-[10px] text-muted-foreground font-mono">{group.logs.length} log</span>
                    </div>

                    <div className="space-y-2 ml-1">
                        {group.logs.map((log) => {
                            const cfg = auditLogActionConfig[log.action] || defaultAuditLogAction;
                            const Icon = cfg.icon;
                            const EntityIcon = auditLogEntityIcons[log.entity] || Activity;
                            const isExpanded = expandedIds.has(log.id);
                            const hasDetails = !!log.details;
                            const d = new Date(log.createdAt);
                            const relative = formatDistanceToNow(d, { addSuffix: true, locale: idLocale });

                            return (
                                <div
                                    key={log.id}
                                    className={cn(
                                        "group rounded-xl border transition-all duration-200 cursor-pointer",
                                        isExpanded ? "border-border/60 bg-white shadow-sm" : "border-border/30 bg-white hover:border-border/50 hover:shadow-sm"
                                    )}
                                    onClick={() => hasDetails && onToggleExpand(log.id)}
                                >
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg text-white shadow-sm shrink-0", cfg.iconBg)}>
                                            <Icon className="w-4 h-4" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={cn("text-xs font-bold", cfg.text)}>{cfg.label}</span>
                                                <div className="flex items-center gap-1 bg-slate-50 rounded-md px-1.5 py-0.5 ring-1 ring-slate-200/60">
                                                    <EntityIcon className="w-3 h-3 text-slate-400" />
                                                    <span className="text-[11px] font-medium text-slate-600">{getAuditLogEntityLabel(log.entity)}</span>
                                                </div>
                                                {log.entityId && (
                                                    <span className="text-[10px] font-mono text-muted-foreground/50 truncate max-w-[120px]">
                                                        #{log.entityId.slice(0, 8)}
                                                    </span>
                                                )}
                                            </div>
                                            {!isExpanded && log.details && !tryParseAuditLogDetailsJson(log.details) && (
                                                <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[400px]">{log.details}</p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className={cn(
                                                        "w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                                                        getAuditLogAvatarColor(log.user.name)
                                                    )}
                                                >
                                                    {log.user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-medium text-foreground hidden sm:block">{log.user.name}</span>
                                            </div>

                                            <div className="text-right hidden md:block">
                                                <p className="text-[11px] font-mono tabular-nums text-muted-foreground">{format(d, "HH:mm:ss")}</p>
                                                <p className="text-[10px] text-muted-foreground/50">{relative}</p>
                                            </div>

                                            {hasDetails && (
                                                <div
                                                    className={cn(
                                                        "w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                                                        isExpanded ? "bg-teal-50 text-teal-600" : "text-muted-foreground/30 group-hover:text-muted-foreground/60"
                                                    )}
                                                >
                                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {isExpanded && hasDetails && (
                                        <div className="px-4 pb-4 pt-0">
                                            <div className="ml-11 rounded-lg bg-slate-50/80 border border-slate-100 p-3">
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detail Perubahan</p>
                                                <AuditLogsDetailCard details={log.details} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
