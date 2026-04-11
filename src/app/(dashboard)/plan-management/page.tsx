"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { getPlanAccessMatrix, updatePlanMenuAccess, updatePlanActionAccess } from "@/server/actions/plan-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    ChevronDown, ChevronRight, Crown, Loader2, Search, Settings2, Shield, Zap,
    Check, X, Filter,
} from "lucide-react";
import { toast } from "sonner";
import type { PlanKey } from "@/lib/plan-config";

type MenuRow = Awaited<ReturnType<typeof getPlanAccessMatrix>>[number];

const PLANS: { key: PlanKey; name: string; icon: typeof Zap; color: string; bg: string; border: string }[] = [
    { key: "FREE", name: "Free", icon: Zap, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
    { key: "PRO", name: "Pro", icon: Crown, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
    { key: "ENTERPRISE", name: "Enterprise", icon: Shield, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
];

export default function PlanManagementPage() {
    const [matrix, setMatrix] = useState<MenuRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
    const [updating, startTransition] = useTransition();
    const [search, setSearch] = useState("");
    const [filterGroup, setFilterGroup] = useState("ALL");

    useEffect(() => {
        getPlanAccessMatrix().then((data) => {
            setMatrix(data);
            // Expand all by default
            setExpandedMenus(new Set(data.filter((m) => m.actions.length > 0).map((m) => m.key)));
        }).finally(() => setLoading(false));
    }, []);

    const toggleExpand = (key: string) => {
        setExpandedMenus((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const handleMenuToggle = (menuKey: string, plan: PlanKey, allowed: boolean) => {
        setMatrix((prev) => prev.map((m) => {
            if (m.key !== menuKey) return m;
            const newPlans = { ...m.plans, [plan]: allowed };
            const newActions = allowed ? m.actions : m.actions.map((a: MenuRow["actions"][number]) => ({ ...a, plans: { ...a.plans, [plan]: false } }));
            return { ...m, plans: newPlans, actions: newActions };
        }));
        startTransition(async () => {
            const result = await updatePlanMenuAccess(menuKey, plan, allowed);
            if (!result.success) toast.error("Gagal mengupdate");
        });
    };

    const handleActionToggle = (menuKey: string, actionKey: string, plan: PlanKey, allowed: boolean) => {
        setMatrix((prev) => prev.map((m) => {
            if (m.key !== menuKey) return m;
            return { ...m, actions: m.actions.map((a: MenuRow["actions"][number]) => a.key === actionKey ? { ...a, plans: { ...a.plans, [plan]: allowed } } : a) };
        }));
        startTransition(async () => {
            const result = await updatePlanActionAccess(menuKey, actionKey, plan, allowed);
            if (!result.success) toast.error("Gagal mengupdate");
        });
    };

    // Stats
    const stats = useMemo(() => {
        const total = matrix.length;
        const free = matrix.filter((m) => m.plans.FREE).length;
        const pro = matrix.filter((m) => m.plans.PRO).length;
        const ent = matrix.filter((m) => m.plans.ENTERPRISE).length;
        return { total, free, pro, enterprise: ent };
    }, [matrix]);

    // Groups
    const allGroups = useMemo(() => [...new Set(matrix.map((m) => m.group))], [matrix]);

    const filteredMatrix = useMemo(() => {
        let result = matrix;
        if (filterGroup !== "ALL") result = result.filter((m) => m.group === filterGroup);
        if (search) {
            const q = search.toLowerCase();
            result = result.filter((m) => m.name.toLowerCase().includes(q) || m.key.toLowerCase().includes(q));
        }
        return result;
    }, [matrix, filterGroup, search]);

    const groups = useMemo(() => {
        const map = new Map<string, MenuRow[]>();
        for (const menu of filteredMatrix) {
            const list = map.get(menu.group) ?? [];
            list.push(menu);
            map.set(menu.group, list);
        }
        return map;
    }, [filteredMatrix]);

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Settings2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                            Kelola Fitur Plan
                            {updating && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground">{stats.total} menu terdaftar</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="rounded-lg text-xs h-8" onClick={() => setExpandedMenus(new Set(matrix.filter((m) => m.actions.length > 0).map((m) => m.key)))}>
                        Expand All
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-lg text-xs h-8" onClick={() => setExpandedMenus(new Set())}>
                        Collapse All
                    </Button>
                </div>
            </div>

            {/* Plan summary cards */}
            <div className="grid grid-cols-3 gap-3">
                {PLANS.map((p) => {
                    const count = p.key === "FREE" ? stats.free : p.key === "PRO" ? stats.pro : stats.enterprise;
                    const Icon = p.icon;
                    return (
                        <div key={p.key} className={cn("rounded-xl border p-3 sm:p-4", p.bg, p.border)}>
                            <div className="flex items-center gap-2 mb-2">
                                <Icon className={cn("w-4 h-4", p.color)} />
                                <span className={cn("text-sm font-bold", p.color)}>{p.name}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold">{count}</span>
                                <span className="text-xs text-muted-foreground">/ {stats.total} menu</span>
                            </div>
                            <div className="mt-2 h-1.5 bg-white/80 rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full transition-all",
                                    p.key === "FREE" ? "bg-slate-400" : p.key === "PRO" ? "bg-amber-500" : "bg-purple-500"
                                )} style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Search + group filter */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari menu..." className="pl-9 rounded-xl h-9 text-sm" />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <Button size="sm" variant={filterGroup === "ALL" ? "default" : "outline"} className="rounded-full h-7 text-[11px] shrink-0" onClick={() => setFilterGroup("ALL")}>
                        <Filter className="w-3 h-3 mr-1" /> Semua
                    </Button>
                    {allGroups.map((g) => (
                        <Button key={g} size="sm" variant={filterGroup === g ? "default" : "outline"} className="rounded-full h-7 text-[11px] shrink-0" onClick={() => setFilterGroup(g)}>
                            {g}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Matrix table */}
            <div className="rounded-2xl border border-border/50 bg-white overflow-hidden shadow-sm">
                {/* Sticky header */}
                <div className="grid grid-cols-[1fr_72px_72px_72px] sm:grid-cols-[1fr_100px_100px_100px] items-center px-4 py-3 bg-muted/40 border-b sticky top-0 z-10">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Menu / Aksi</span>
                    {PLANS.map((p) => {
                        const Icon = p.icon;
                        return (
                            <div key={p.key} className="flex flex-col items-center gap-0.5">
                                <Icon className={cn("w-4 h-4", p.color)} />
                                <span className={cn("text-[10px] font-bold", p.color)}>{p.name}</span>
                            </div>
                        );
                    })}
                </div>

                {filteredMatrix.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">Tidak ada menu ditemukan</div>
                )}

                {Array.from(groups.entries()).map(([group, menus]) => (
                    <div key={group}>
                        {/* Group header */}
                        <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{group}</p>
                        </div>

                        {menus.map((menu) => {
                            const hasActions = menu.actions.length > 0;
                            const isExpanded = expandedMenus.has(menu.key);
                            return (
                                <div key={menu.key}>
                                    {/* Menu row */}
                                    <div className={cn(
                                        "grid grid-cols-[1fr_72px_72px_72px] sm:grid-cols-[1fr_100px_100px_100px] items-center px-4 py-2.5 border-b border-border/20 transition-colors",
                                        isExpanded ? "bg-primary/[0.02]" : "hover:bg-muted/10",
                                    )}>
                                        <button onClick={() => hasActions && toggleExpand(menu.key)} className="flex items-center gap-2 min-w-0 text-left group">
                                            {hasActions ? (
                                                isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-primary shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                                            ) : (
                                                <span className="w-3.5" />
                                            )}
                                            <span className="text-sm font-medium truncate">{menu.name}</span>
                                            {hasActions && (
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-full shrink-0 font-normal">
                                                    {menu.actions.length} aksi
                                                </Badge>
                                            )}
                                        </button>
                                        {PLANS.map((p) => (
                                            <div key={p.key} className="flex justify-center">
                                                <PlanToggle checked={menu.plans[p.key]} onChange={(v) => handleMenuToggle(menu.key, p.key, v)} plan={p.key} />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action rows */}
                                    {isExpanded && hasActions && (
                                        <div >
                                            {menu.actions.map((action: MenuRow["actions"][number]) => (
                                                <div key={action.key} className="grid grid-cols-[1fr_72px_72px_72px] sm:grid-cols-[1fr_100px_100px_100px] items-center px-4 py-2 border-b border-border/55 last:border-b-0 hover:bg-muted/5 transition-colors">
                                                    <div className="flex items-center gap-2 pl-6 min-w-0">
                                                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0" />
                                                        <span className="text-xs text-muted-foreground truncate">{action.name}</span>
                                                    </div>
                                                    {PLANS.map((p) => (
                                                        <div key={p.key} className="flex justify-center">
                                                            <PlanToggle
                                                                checked={action.plans[p.key]}
                                                                onChange={(v) => handleActionToggle(menu.key, action.key, p.key, v)}
                                                                plan={p.key}
                                                                disabled={!menu.plans[p.key]}
                                                                small
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

function PlanToggle({ checked, onChange, plan, disabled = false, small = false }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    plan: PlanKey;
    disabled?: boolean;
    small?: boolean;
}) {
    if (disabled) {
        return (
            <div className={cn("rounded-full flex items-center justify-center", small ? "w-5 h-5" : "w-6 h-6", "bg-muted/30")}>
                <X className="w-3 h-3 text-muted-foreground/30" />
            </div>
        );
    }

    return (
        <button
            onClick={() => onChange(!checked)}
            className={cn(
                "rounded-full flex items-center justify-center transition-all",
                small ? "w-5 h-5" : "w-7 h-7",
                checked
                    ? plan === "FREE" ? "bg-slate-500 text-white" : plan === "PRO" ? "bg-amber-500 text-white" : "bg-purple-500 text-white"
                    : "bg-muted/40 text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground",
            )}
        >
            {checked ? <Check className={small ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} /> : <X className={small ? "w-2.5 h-2.5" : "w-3 h-3"} />}
        </button>
    );
}
