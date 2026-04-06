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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Trophy, Target, Award, Crown, Medal,
  Plus, Trash2, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { SetTargetDialog } from "./set-target-dialog";
import { BadgeDisplay } from "./badge-display";

// ── Types ─────────────────────────────────────────────────────────────────────

type PeriodType = "DAILY" | "WEEKLY" | "MONTHLY";
type TabKey = "leaderboard" | "targets" | "badges";

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
  const podiumHeights = top3.length === 3
    ? ["h-28", "h-36", "h-24"]
    : top3.map((_, i) => i === 0 ? "h-36" : "h-28");
  const podiumColors = top3.length === 3
    ? ["from-gray-300 to-gray-400", "from-yellow-300 to-amber-400", "from-amber-600 to-amber-700"]
    : ["from-yellow-300 to-amber-400", "from-gray-300 to-gray-400", "from-amber-600 to-amber-700"];
  const podiumLabels = top3.length === 3
    ? ["2nd", "1st", "3rd"]
    : ["1st", "2nd", "3rd"];
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
      <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-fit overflow-x-auto scrollbar-hide">
        {([
          { key: "leaderboard" as TabKey, label: "Leaderboard", shortLabel: "Board", icon: Trophy },
          { key: "targets" as TabKey, label: "Target", shortLabel: "Target", icon: Target },
          { key: "badges" as TabKey, label: "Badges", shortLabel: "Badge", icon: Award },
        ]).map(({ key, label, shortLabel, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 flex-1 sm:flex-none justify-center ${
              tab === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </button>
        ))}
      </div>

      {/* ─── Leaderboard Tab ──────────────────────────────────────────────── */}
      {tab === "leaderboard" && (
        <div className="space-y-4 sm:space-y-6">
          {/* Period Selector */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {(["DAILY", "WEEKLY", "MONTHLY"] as PeriodType[]).map((t) => (
              <button
                key={t}
                onClick={() => setPeriodType(t)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  periodType === t
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

          {/* Podium */}
          {top3.length > 0 && (
            <Card className="overflow-hidden border-0 shadow-lg rounded-xl sm:rounded-2xl">
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
                    return (
                      <div key={entry.userId} className="flex flex-col items-center">
                        {/* Avatar */}
                        <div className="relative mb-2 sm:mb-3">
                          <div className={`w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br ${podiumColors[i]} flex items-center justify-center text-lg sm:text-3xl font-bold text-white shadow-xl`}>
                            {entry.avatarInitial}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br ${podiumColors[i]} flex items-center justify-center shadow-lg border-2 border-slate-900`}>
                            {renderPodiumIcon(i)}
                          </div>
                        </div>

                        {/* Name & Revenue */}
                        <p className="text-white font-semibold text-[11px] sm:text-base truncate max-w-[70px] sm:max-w-[140px]">
                          {entry.name}
                        </p>
                        <p className="text-amber-400 font-bold text-xs sm:text-lg">
                          {fmtCompact(entry.revenue)}
                        </p>
                        {entry.target > 0 && (
                          <p className={`text-[10px] sm:text-xs font-medium ${entry.percentage >= 100 ? "text-emerald-400" : "text-slate-400"}`}>
                            {entry.percentage}%
                          </p>
                        )}

                        {/* Podium bar */}
                        <div className={`${podiumHeights[i]} w-16 sm:w-28 mt-2 sm:mt-3 rounded-t-xl bg-gradient-to-t ${podiumColors[i]} flex items-start justify-center pt-2 sm:pt-3 shadow-lg`}>
                          <span className="text-white/90 font-bold text-base sm:text-xl">{podiumLabels[i]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* Empty state */}
          {top3.length === 0 && !isPending && (
            <Card className="border-0 shadow-lg rounded-xl sm:rounded-2xl">
              <CardContent className="py-10 sm:py-16 text-center">
                <Trophy className="w-10 h-10 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-sm sm:text-lg font-semibold text-gray-500">Belum ada data penjualan</h3>
                <p className="text-gray-400 text-xs sm:text-sm mt-1">Data akan muncul saat ada transaksi</p>
              </CardContent>
            </Card>
          )}

          {/* Full Ranking Table */}
          {leaderboard.length > 0 && (
            <Card className="border-0 shadow-lg overflow-hidden rounded-xl sm:rounded-2xl">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kasir</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Target</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Transaksi</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Items</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Badges</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {leaderboard.map((entry) => {
                        const rankColor =
                          entry.rank === 1 ? "text-yellow-500" :
                          entry.rank === 2 ? "text-gray-400" :
                          entry.rank === 3 ? "text-amber-600" : "text-gray-400";
                        const progressColor =
                          entry.percentage >= 100 ? "bg-emerald-500" :
                          entry.percentage >= 80 ? "bg-amber-500" :
                          entry.percentage >= 50 ? "bg-blue-500" : "bg-gray-300";

                        return (
                          <tr key={entry.userId} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className={`font-bold text-lg ${rankColor}`}>
                                #{entry.rank}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                                  {entry.avatarInitial}
                                </div>
                                <span className="font-medium text-gray-900 truncate max-w-[120px]">{entry.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold text-gray-900">{formatCurrency(entry.revenue)}</span>
                            </td>
                            <td className="px-4 py-3 text-right hidden sm:table-cell">
                              <span className="text-gray-500 text-sm">
                                {entry.target > 0 ? formatCurrency(entry.target) : "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 justify-center">
                                <div className="w-20 sm:w-32 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${progressColor}`}
                                    style={{ width: `${Math.min(entry.percentage, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-semibold min-w-[40px] text-right ${
                                  entry.percentage >= 100 ? "text-emerald-600" : "text-gray-500"
                                }`}>
                                  {entry.target > 0 ? `${entry.percentage}%` : "-"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right hidden md:table-cell">
                              <span className="text-gray-600">{fmt(entry.transactions)}</span>
                            </td>
                            <td className="px-4 py-3 text-right hidden md:table-cell">
                              <span className="text-gray-600">{fmt(entry.itemsSold)}</span>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <div className="flex items-center justify-center gap-1">
                                {entry.badges.length > 0 ? (
                                  entry.badges.slice(0, 3).map((b) => (
                                    <span
                                      key={b.badge}
                                      title={b.title}
                                      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[10px]"
                                    >
                                      {b.title.charAt(0)}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-gray-300 text-xs">-</span>
                                )}
                                {entry.badges.length > 3 && (
                                  <span className="text-xs text-gray-400">+{entry.badges.length - 3}</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Targets Tab ──────────────────────────────────────────────────── */}
      {tab === "targets" && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Target Penjualan</h2>
            <Button
              onClick={() => setShowSetTarget(true)}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md text-xs sm:text-sm w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1.5 sm:mr-2" />
              Set Target
            </Button>
          </div>

          {targets.length === 0 && !isPending && (
            <Card className="border-0 shadow-lg rounded-xl sm:rounded-2xl">
              <CardContent className="py-10 sm:py-16 text-center">
                <Target className="w-10 h-10 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-sm sm:text-lg font-semibold text-gray-500">Belum ada target</h3>
                <p className="text-gray-400 text-xs sm:text-sm mt-1">Buat target untuk kasir atau cabang</p>
              </CardContent>
            </Card>
          )}

          {targets.length > 0 && (
            <Card className="border-0 shadow-lg overflow-hidden rounded-xl sm:rounded-2xl">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User / Branch</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipe</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Target Revenue</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Target Tx</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Periode</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {targets.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                                {(t.user?.name || t.branch?.name || "?").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{t.user?.name || t.branch?.name || "-"}</p>
                                <p className="text-xs text-gray-400">{t.user ? "Kasir" : t.branch ? "Cabang" : "-"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                              t.type === "DAILY" ? "bg-blue-100 text-blue-700" :
                              t.type === "WEEKLY" ? "bg-purple-100 text-purple-700" :
                              "bg-amber-100 text-amber-700"
                            }`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {t.targetRevenue ? formatCurrency(t.targetRevenue) : "-"}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">
                            {t.targetTx ? fmt(t.targetTx) : "-"}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">{t.period}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              t.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                            }`}>
                              {t.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTarget(t.id)}
                              disabled={isPending}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Badges & Achievements</h2>
            <Button
              onClick={handleEvaluateBadges}
              disabled={isPending}
              className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-md text-xs sm:text-sm w-full sm:w-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${isPending ? "animate-spin" : ""}`} />
              Evaluasi Badges
            </Button>
          </div>

          {/* All available badges */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3">Badge Tersedia</h3>
            <BadgeDisplay definitions={BADGE_DEFINITIONS} earned={badges} />
          </div>

          {/* Badge history */}
          {badges.length > 0 && (
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3">Riwayat Penghargaan</h3>
              <Card className="border-0 shadow-lg overflow-hidden rounded-xl sm:rounded-2xl">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kasir</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Badge</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Deskripsi</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Periode</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {badges.map((b) => {
                          const def = BADGE_DEFINITIONS.find((d) => d.key === b.badge);
                          return (
                            <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white">
                                    {b.user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-medium text-gray-900 text-sm">{b.user.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${def?.color || "from-gray-400 to-gray-500"} text-white`}>
                                  {b.title}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                                {b.description || def?.description || "-"}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-600">{b.period || "-"}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-500">
                                {new Date(b.earnedAt).toLocaleDateString("id-ID")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {badges.length === 0 && !isPending && (
            <Card className="border-0 shadow-lg rounded-xl sm:rounded-2xl">
              <CardContent className="py-10 sm:py-12 text-center">
                <Award className="w-10 h-10 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-sm sm:text-lg font-semibold text-gray-500">Belum ada badge</h3>
                <p className="text-gray-400 text-xs sm:text-sm mt-1">Klik &quot;Evaluasi Badges&quot; untuk memberikan penghargaan</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
