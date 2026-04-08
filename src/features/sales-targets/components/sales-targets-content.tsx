"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import { useBranch } from "@/components/providers/branch-provider";
import {
    getLeaderboard,
    getSalesTargets,
    deleteSalesTarget,
    getBadges,
    evaluateAndAwardBadges,
} from "@/server/actions/sales-targets";
import { BADGE_DEFINITIONS } from "@/server/actions/sales-targets-types";
import type { LeaderboardEntry } from "@/server/actions/sales-targets-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SmartTable, type SmartColumn } from "@/components/ui/smart-table";
import { Badge } from "@/components/ui/badge";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
    Trophy, Target, Award, Crown, Medal,
    Plus, Trash2, RefreshCw, SlidersHorizontal, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SetTargetDialog } from "./set-target-dialog";
import { BadgeDisplay } from "./badge-display";

// ── Types ─────────────────────────────────────────────────────────────────────

type PeriodType = "DAILY" | "WEEKLY" | "MONTHLY";
type TabKey = "leaderboard" | "targets" | "badges";
type TargetRow = Awaited<ReturnType<typeof getSalesTargets>>[number];
type BadgeRow = Awaited<ReturnType<typeof getBadges>>[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentPeriod(type: PeriodType): string {
    const now = new Date();
    if (type === "DAILY") return now.toISOString().slice(0, 10);
    if (type === "WEEKLY") {
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const periodLabels: Record<PeriodType, string> = {
    DAILY: "Hari Ini",
    WEEKLY: "Minggu Ini",
    MONTHLY: "Bulan Ini",
};

const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID").format(n);

function fmtCompact(value: number): string {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}rb`;
    return formatCurrency(value);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SalesTargetsContent() {
    const { selectedBranchId } = useBranch();
    const branchId = selectedBranchId || undefined;
    const [tab, setTab] = useState<TabKey>("leaderboard");
    const [tabSheetOpen, setTabSheetOpen] = useState(false);
    const [periodType, setPeriodType] = useState<PeriodType>("MONTHLY");
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [targets, setTargets] = useState<Awaited<ReturnType<typeof getSalesTargets>>>([]);
    const [badges, setBadges] = useState<Awaited<ReturnType<typeof getBadges>>>([]);
    const [showSetTarget, setShowSetTarget] = useState(false);
    const [isPending, startTransition] = useTransition();

    const loadLeaderboard = useCallback(() => {
        startTransition(async () => {
            try {
                const period = getCurrentPeriod(periodType);
                const res = await getLeaderboard({
                    period,
                    type: periodType,
                    branchId: branchId,
                });
                setLeaderboard(res.leaderboard);
            } catch (e: unknown) {
                toast.error("Gagal memuat leaderboard");
            }
        });
    }, [periodType, branchId]);

    const loadTargets = useCallback(() => {
        startTransition(async () => {
            try {
                const res = await getSalesTargets({
                    branchId: branchId,
                });
                setTargets(res);
            } catch {
                toast.error("Gagal memuat target");
            }
        });
    }, [branchId]);

    const loadBadges = useCallback(() => {
        startTransition(async () => {
            try {
                const res = await getBadges();
                setBadges(res);
            } catch {
                toast.error("Gagal memuat badges");
            }
        });
    }, []);

    useEffect(() => {
        if (tab === "leaderboard") loadLeaderboard();
        else if (tab === "targets") loadTargets();
        else loadBadges();
    }, [tab, loadLeaderboard, loadTargets, loadBadges]);

    const handleDeleteTarget = (id: string) => {
        startTransition(async () => {
            try {
                await deleteSalesTarget(id);
                toast.success("Target dihapus");
                loadTargets();
            } catch {
                toast.error("Gagal menghapus target");
            }
        });
    };

    const handleEvaluateBadges = () => {
        startTransition(async () => {
            try {
                const res = await evaluateAndAwardBadges();
                toast.success(`${res.awarded.length} badge baru diberikan!`);
                loadBadges();
                loadLeaderboard();
            } catch {
                toast.error("Gagal mengevaluasi badges");
            }
        });
    };

    // ── Podium ────────────────────────────────────────────────────────────────

    const top3 = leaderboard.slice(0, 3);
    const podiumOrder = top3.length === 3
        ? [top3[1], top3[0], top3[2]]
        : top3;
    const podiumColors = top3.length === 3
        ? ["from-gray-300 to-gray-400", "from-yellow-300 to-amber-400", "from-amber-600 to-amber-700"]
        : ["from-yellow-300 to-amber-400", "from-gray-300 to-gray-400", "from-amber-600 to-amber-700"];
    // Icon rendering helper for podium
    const renderPodiumIcon = (idx: number) => {
        // For 3 entries: [2nd, 1st, 3rd] layout
        if (top3.length === 3) {
            return idx === 1 ? <Crown className="w-3.5 h-3.5 text-white" /> : <Medal className="w-3.5 h-3.5 text-white" />;
        }
        return idx === 0 ? <Crown className="w-3.5 h-3.5 text-white" /> : <Medal className="w-3.5 h-3.5 text-white" />;
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shrink-0">
                        <Trophy className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Sales Target</h1>
                        <p className="text-xs sm:text-sm text-gray-500">Leaderboard, target & pencapaian</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            {(() => {
                const tabOptions = [
                    { key: "leaderboard" as TabKey, label: "Leaderboard", icon: Trophy },
                    { key: "targets" as TabKey, label: "Target", icon: Target },
                    { key: "badges" as TabKey, label: "Badges", icon: Award },
                ];
                const activeOption = tabOptions.find((t) => t.key === tab);
                const ActiveIcon = activeOption?.icon || Trophy;
                return (
                    <>
                        {/* Mobile: button + bottom sheet */}
                        <div className="sm:hidden">
                            <Button variant="outline" className="w-full justify-between rounded-xl" onClick={() => setTabSheetOpen(true)}>
                                <span className="flex items-center gap-2">
                                    <ActiveIcon className="w-3.5 h-3.5 text-amber-600" />
                                    <span className="text-xs font-medium">{activeOption?.label}</span>
                                </span>
                                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                            <Sheet open={tabSheetOpen} onOpenChange={setTabSheetOpen}>
                                <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                                    <div className="shrink-0">
                                        <div className="flex justify-center pt-3 pb-2">
                                            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                                        </div>
                                        <SheetHeader className="px-4 pb-3 pt-0">
                                            <SheetTitle className="text-base font-bold">Pilih Tab</SheetTitle>
                                        </SheetHeader>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                                        {tabOptions.map(({ key, label, icon: Icon }) => {
                                            const isActive = tab === key;
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => { setTab(key); setTabSheetOpen(false); }}
                                                    className={cn(
                                                        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                                        isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"
                                                    )}
                                                >
                                                    <span className="flex items-center gap-2.5">
                                                        <Icon className={cn("w-4 h-4", isActive ? "text-background" : "text-muted-foreground")} />
                                                        {label}
                                                    </span>
                                                    {isActive && <Check className="w-4 h-4" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                        {/* Desktop: inline tabs */}
                        <div className="hidden sm:flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                            {tabOptions.map(({ key, label, icon: Icon }) => (
                                <button
                                    key={key}
                                    onClick={() => setTab(key)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === key
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </>
                );
            })()}

            {/* ─── Leaderboard Tab ──────────────────────────────────────────────── */}
            {tab === "leaderboard" && (
                <div className="space-y-4 sm:space-y-6">
                    {/* Period Selector */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {(["DAILY", "WEEKLY", "MONTHLY"] as PeriodType[]).map((t) => (
                            <button
                                key={t}
                                onClick={() => setPeriodType(t)}
                                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${periodType === t
                                    ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md"
                                    : "bg-white text-gray-600 border border-gray-200 hover:border-amber-300"
                                    }`}
                            >
                                {periodLabels[t]}
                            </button>
                        ))}
                        <Button
                            variant="outline"
                            size="icon"
                            className="ml-auto rounded-full h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:rounded-full"
                            onClick={loadLeaderboard}
                            disabled={isPending}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isPending ? "animate-spin" : ""}`} />
                            <span className="hidden sm:inline ml-1 text-xs">Refresh</span>
                        </Button>
                    </div>

                    {/* Top 3 Performers - Podium */}
                    {top3.length > 0 && (
                        <Card className="overflow-hidden border-0 shadow-lg rounded-xl sm:rounded-2xl py-0 gap-0">
                            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-8">
                                <div className="text-center mb-4 sm:mb-8">
                                    <h2 className="text-base sm:text-xl font-bold text-white flex items-center justify-center gap-2">
                                        <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                                        Top Performers
                                    </h2>
                                    <p className="text-slate-400 text-[10px] sm:text-sm mt-1">{periodLabels[periodType]} - {getCurrentPeriod(periodType)}</p>
                                </div>

                                <div className="flex items-end justify-center gap-2 sm:gap-8">
                                    {podiumOrder.map((entry, i) => {
                                        if (!entry) return null;
                                        const heights = top3.length === 3 ? ["h-20 sm:h-28", "h-28 sm:h-36", "h-16 sm:h-24"] : ["h-28 sm:h-36", "h-20 sm:h-28", "h-16 sm:h-24"];
                                        const labels = top3.length === 3 ? ["2nd", "1st", "3rd"] : ["1st", "2nd", "3rd"];
                                        return (
                                            <div key={entry.userId} className="flex flex-col items-center">
                                                <div className="relative mb-1.5 sm:mb-3">
                                                    <div className={`w-10 h-10 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br ${podiumColors[i]} flex items-center justify-center text-sm sm:text-3xl font-bold text-white shadow-xl`}>
                                                        {entry.avatarInitial}
                                                    </div>
                                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br ${podiumColors[i]} flex items-center justify-center shadow-lg border-2 border-slate-900`}>
                                                        {renderPodiumIcon(i)}
                                                    </div>
                                                </div>
                                                <p className="text-white font-semibold text-[10px] sm:text-base truncate max-w-[60px] sm:max-w-[140px]">{entry.name}</p>
                                                <p className="text-amber-400 font-bold text-[11px] sm:text-lg font-mono tabular-nums">{fmtCompact(entry.revenue)}</p>
                                                {entry.target > 0 && (
                                                    <p className={`text-[9px] sm:text-xs font-medium ${entry.percentage >= 100 ? "text-emerald-400" : "text-slate-400"}`}>{entry.percentage}%</p>
                                                )}
                                                <div className={`${heights[i]} w-14 sm:w-28 mt-1.5 sm:mt-3 rounded-t-xl bg-gradient-to-t ${podiumColors[i]} flex items-start justify-center pt-1.5 sm:pt-3 shadow-lg`}>
                                                    <span className="text-white/90 font-bold text-xs sm:text-xl">{labels[i]}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Ranking SmartTable */}
                    <SmartTable<LeaderboardEntry>
                        data={leaderboard}
                        columns={[
                            {
                                key: "rank",
                                header: "#",
                                render: (e) => {
                                    const color = e.rank === 1 ? "text-yellow-500" : e.rank === 2 ? "text-gray-400" : e.rank === 3 ? "text-amber-600" : "text-gray-400";
                                    return <span className={`font-bold text-sm ${color}`}>#{e.rank}</span>;
                                },
                            },
                            {
                                key: "name",
                                header: "Kasir",
                                render: (e) => (
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0">{e.avatarInitial}</div>
                                        <span className="font-medium text-gray-900 truncate text-xs sm:text-sm">{e.name}</span>
                                    </div>
                                ),
                            },
                            {
                                key: "revenue",
                                header: "Revenue",
                                align: "right",
                                render: (e) => <span className="font-semibold text-xs sm:text-sm font-mono tabular-nums">{formatCurrency(e.revenue)}</span>,
                            },
                            {
                                key: "progress",
                                header: "Progress",
                                render: (e) => {
                                    const color = e.percentage >= 100 ? "bg-emerald-500" : e.percentage >= 80 ? "bg-amber-500" : e.percentage >= 50 ? "bg-blue-500" : "bg-gray-300";
                                    return (
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 sm:w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(e.percentage, 100)}%` }} />
                                            </div>
                                            <span className={`text-[10px] sm:text-xs font-semibold ${e.percentage >= 100 ? "text-emerald-600" : "text-gray-500"}`}>
                                                {e.target > 0 ? `${e.percentage}%` : "-"}
                                            </span>
                                        </div>
                                    );
                                },
                            },
                            {
                                key: "transactions",
                                header: "Tx",
                                align: "right",
                                render: (e) => <span className="text-gray-600 text-xs sm:text-sm">{fmt(e.transactions)}</span>,
                            },
                        ] as SmartColumn<LeaderboardEntry>[]}
                        totalItems={leaderboard.length}
                        totalPages={1}
                        currentPage={1}
                        pageSize={leaderboard.length || 10}
                        loading={isPending}
                        title="Peringkat"
                        titleIcon={<Trophy className="w-4 h-4 text-amber-500" />}
                        searchPlaceholder="Cari kasir..."
                        onSearch={() => { }}
                        onPageChange={() => { }}
                        onPageSizeChange={() => { }}
                        emptyIcon={<Trophy className="w-6 h-6 text-muted-foreground/40" />}
                        emptyTitle="Belum ada data"
                        emptyDescription="Data akan muncul saat ada transaksi"
                        mobileRender={(e) => {
                            const rankColor = e.rank === 1 ? "text-yellow-500" : e.rank === 2 ? "text-gray-400" : e.rank === 3 ? "text-amber-600" : "text-gray-400";
                            const progressColor = e.percentage >= 100 ? "bg-emerald-500" : e.percentage >= 80 ? "bg-amber-500" : "bg-blue-500";
                            return (
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold text-sm shrink-0 w-7 ${rankColor}`}>#{e.rank}</span>
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">{e.avatarInitial}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-900 truncate">{e.name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${Math.min(e.percentage, 100)}%` }} />
                                            </div>
                                            <span className="text-[9px] text-gray-400">{e.target > 0 ? `${e.percentage}%` : ""}</span>
                                        </div>
                                    </div>
                                    <span className="text-xs font-semibold font-mono tabular-nums shrink-0">{fmtCompact(e.revenue)}</span>
                                </div>
                            );
                        }}
                    />
                </div>
            )}

            {/* ─── Targets Tab ──────────────────────────────────────────────────── */}
            {tab === "targets" && (
                <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm sm:text-lg font-semibold text-gray-900">Target Penjualan</h2>
                        <Button
                            onClick={() => setShowSetTarget(true)}
                            className="hidden sm:inline-flex rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md text-sm"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Set Target
                        </Button>
                    </div>
                    {/* Mobile: floating button */}
                    <div className="sm:hidden fixed bottom-4 right-4 z-50">
                        <Button onClick={() => setShowSetTarget(true)} size="icon" className="h-12 w-12 rounded-full shadow-xl shadow-amber-300/50 bg-gradient-to-br from-amber-500 to-orange-500">
                            <Plus className="w-5 h-5" />
                        </Button>
                    </div>

                    <SmartTable<TargetRow>
                        data={targets}
                        columns={[
                            {
                                key: "name",
                                header: "User / Cabang",
                                render: (t) => (
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0">
                                            {(t.user?.name || t.branch?.name || "?").charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">{t.user?.name || t.branch?.name || "-"}</p>
                                            <p className="text-[10px] text-gray-400">{t.user ? "Kasir" : t.branch ? "Cabang" : "-"}</p>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: "type",
                                header: "Tipe",
                                render: (t) => (
                                    <Badge variant="secondary" className={`rounded-full px-2 py-0.5 text-[10px] sm:text-xs border-0 ${t.type === "DAILY" ? "bg-blue-100 text-blue-700" :
                                        t.type === "WEEKLY" ? "bg-purple-100 text-purple-700" :
                                            "bg-amber-100 text-amber-700"
                                        }`}>{t.type === "DAILY" ? "Harian" : t.type === "WEEKLY" ? "Mingguan" : "Bulanan"}</Badge>
                                ),
                            },
                            {
                                key: "targetRevenue",
                                header: "Revenue",
                                align: "right",
                                render: (t) => <span className="font-medium text-xs sm:text-sm font-mono tabular-nums">{t.targetRevenue ? formatCurrency(t.targetRevenue) : "-"}</span>,
                            },
                            {
                                key: "period",
                                header: "Periode",
                                render: (t) => <span className="text-xs sm:text-sm text-gray-600">{t.period}</span>,
                            },
                            {
                                key: "status",
                                header: "Status",
                                render: (t) => (
                                    <Badge variant="secondary" className={`rounded-full px-2 py-0.5 text-[10px] sm:text-xs border-0 ${t.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                        {t.isActive ? "Aktif" : "Nonaktif"}
                                    </Badge>
                                ),
                            },
                            {
                                key: "actions",
                                header: "",
                                render: (t) => (
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTarget(t.id)} disabled={isPending} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                ),
                            },
                        ] as SmartColumn<TargetRow>[]}
                        totalItems={targets.length}
                        totalPages={1}
                        currentPage={1}
                        pageSize={targets.length || 10}
                        loading={isPending}
                        title="Target Penjualan"
                        titleIcon={<Target className="w-4 h-4 text-amber-600" />}
                        searchPlaceholder="Cari target..."
                        emptyIcon={<Target className="w-6 h-6 text-muted-foreground/40" />}
                        emptyTitle="Belum ada target"
                        emptyDescription='Buat target untuk kasir atau cabang'
                        onSearch={() => { }}
                        onPageChange={() => { }}
                        onPageSizeChange={() => { }}
                        mobileRender={(t) => (
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                        {(t.user?.name || t.branch?.name || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-gray-900 truncate">{t.user?.name || t.branch?.name || "-"}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[10px] text-gray-400">{t.period}</span>
                                            <Badge variant="secondary" className={`rounded-full px-1.5 py-0 text-[9px] border-0 ${t.type === "DAILY" ? "bg-blue-100 text-blue-700" : t.type === "WEEKLY" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
                                                {t.type === "DAILY" ? "Harian" : t.type === "WEEKLY" ? "Mggu" : "Bulan"}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs font-semibold font-mono tabular-nums">{t.targetRevenue ? formatCurrency(t.targetRevenue) : "-"}</p>
                                    <Badge variant="secondary" className={`rounded-full px-1.5 py-0 text-[9px] border-0 mt-0.5 ${t.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                        {t.isActive ? "Aktif" : "Off"}
                                    </Badge>
                                </div>
                            </div>
                        )}
                    />

                    <SetTargetDialog
                        open={showSetTarget}
                        onOpenChange={setShowSetTarget}
                        onSuccess={() => {
                            setShowSetTarget(false);
                            loadTargets();
                        }}
                    />
                </div>
            )}

            {/* ─── Badges Tab ───────────────────────────────────────────────────── */}
            {tab === "badges" && (
                <div className="space-y-4 sm:space-y-6">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm sm:text-lg font-semibold text-gray-900">Badges & Achievements</h2>
                        <Button
                            onClick={handleEvaluateBadges}
                            disabled={isPending}
                            className="hidden sm:inline-flex rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-md text-sm"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isPending ? "animate-spin" : ""}`} />
                            Evaluasi Badges
                        </Button>
                    </div>
                    {/* Mobile: floating button */}
                    <div className="sm:hidden fixed bottom-4 right-4 z-50">
                        <Button onClick={handleEvaluateBadges} disabled={isPending} size="icon" className="h-12 w-12 rounded-full shadow-xl shadow-purple-300/50 bg-gradient-to-br from-purple-500 to-indigo-500">
                            <RefreshCw className={`w-5 h-5 ${isPending ? "animate-spin" : ""}`} />
                        </Button>
                    </div>

                    {/* All available badges */}
                    <div>
                        <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3">Badge Tersedia</h3>
                        <BadgeDisplay definitions={BADGE_DEFINITIONS} earned={badges} />
                    </div>

                    {/* Badge history */}
                    <SmartTable<BadgeRow>
                        data={badges}
                        columns={[
                            {
                                key: "user",
                                header: "Kasir",
                                render: (b) => (
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0">
                                            {b.user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-gray-900 text-xs sm:text-sm truncate">{b.user.name}</span>
                                    </div>
                                ),
                            },
                            {
                                key: "badge",
                                header: "Badge",
                                render: (b) => {
                                    const def = BADGE_DEFINITIONS.find((d) => d.key === b.badge);
                                    return (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-gradient-to-r ${def?.color || "from-gray-400 to-gray-500"} text-white`}>
                                            {b.title}
                                        </span>
                                    );
                                },
                            },
                            {
                                key: "period",
                                header: "Periode",
                                render: (b) => <span className="text-xs sm:text-sm text-gray-600">{b.period || "-"}</span>,
                            },
                            {
                                key: "earnedAt",
                                header: "Tanggal",
                                render: (b) => <span className="text-xs sm:text-sm text-gray-500">{new Date(b.earnedAt).toLocaleDateString("id-ID")}</span>,
                            },
                        ] as SmartColumn<BadgeRow>[]}
                        totalItems={badges.length}
                        totalPages={1}
                        currentPage={1}
                        pageSize={badges.length || 10}
                        loading={isPending}
                        title="Riwayat Penghargaan"
                        titleIcon={<Award className="w-4 h-4 text-purple-600" />}
                        searchPlaceholder="Cari badge..."
                        emptyIcon={<Award className="w-6 h-6 text-muted-foreground/40" />}
                        emptyTitle="Belum ada badge"
                        emptyDescription='Klik "Evaluasi Badges" untuk memberikan penghargaan'
                        onSearch={() => { }}
                        onPageChange={() => { }}
                        onPageSizeChange={() => { }}
                        mobileRender={(b) => {
                            const def = BADGE_DEFINITIONS.find((d) => d.key === b.badge);
                            return (
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                            {b.user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-gray-900 truncate">{b.user.name}</p>
                                            <span className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium bg-gradient-to-r ${def?.color || "from-gray-400 to-gray-500"} text-white mt-0.5`}>
                                                {b.title}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] text-gray-500">{new Date(b.earnedAt).toLocaleDateString("id-ID")}</p>
                                        <p className="text-[10px] text-gray-400">{b.period || "-"}</p>
                                    </div>
                                </div>
                            );
                        }}
                    />
                </div>
            )}
        </div>
    );
}
