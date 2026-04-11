"use client";

import { useEffect, useState, useCallback } from "react";
import { getPlatformDashboardStats } from "@/server/actions/platform-dashboard";
import { useRealtimeEvents } from "@/hooks/use-socket";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Building2, Users, Package, GitBranch, Crown, Zap, Shield,
    ArrowUpRight, ArrowDownRight, ShoppingCart, CalendarClock,
    AlertTriangle, Loader2, DollarSign, Activity, TrendingUp, UserPlus,
} from "lucide-react";
import Link from "next/link";

type Stats = Awaited<ReturnType<typeof getPlatformDashboardStats>>;

function formatCurrency(v: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);
}

function formatCompact(v: number) {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toString();
}

const planColors: Record<string, string> = {
    FREE: "bg-slate-100 text-slate-700",
    PRO: "bg-amber-100 text-amber-700",
    ENTERPRISE: "bg-purple-100 text-purple-700",
};

export function PlatformDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const { on } = useRealtimeEvents();

    const refresh = useCallback(() => {
        getPlatformDashboardStats().then(setStats);
    }, []);

    useEffect(() => {
        getPlatformDashboardStats().then(setStats).finally(() => setLoading(false));
    }, []);

    // Realtime: refresh dashboard on subscription/registration events
    useEffect(() => {
        const unsub1 = on("subscription:updated", refresh);
        const unsub2 = on("company:registered", refresh);
        return () => { unsub1(); unsub2(); };
    }, [on, refresh]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold">Platform Overview</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Ringkasan semua tenant dan aktivitas platform</p>
            </div>

            {/* Top metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard icon={Building2} label="Total Perusahaan" value={stats.totalCompanies} color="from-blue-500 to-indigo-600" />
                <MetricCard icon={Users} label="Total Pengguna" value={stats.totalUsers} color="from-emerald-500 to-green-600" />
                <MetricCard icon={GitBranch} label="Total Cabang" value={stats.totalBranches} color="from-amber-500 to-orange-600" />
                <MetricCard icon={Package} label="Total Produk" value={formatCompact(stats.totalProducts)} color="from-purple-500 to-violet-600" />
            </div>

            {/* Revenue + Plan distribution */}
            <div className="grid sm:grid-cols-2 gap-4">
                {/* Subscription Revenue */}
                <Card className="rounded-2xl border-border/50">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                                    <DollarSign className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Pendapatan Bulan Ini</p>
                                    <p className="text-xl font-bold">{formatCurrency(stats.subscriptionRevenue)}</p>
                                </div>
                            </div>
                            {stats.revenueGrowth !== 0 && (
                                <Badge className={cn("rounded-full text-xs", stats.revenueGrowth > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                                    {stats.revenueGrowth > 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                                    {Math.abs(stats.revenueGrowth)}%
                                </Badge>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-[10px]">Pembayaran Sub</p>
                                <p className="font-semibold">{stats.subscriptionCount}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-[10px]">Transaksi Hari Ini</p>
                                <p className="font-semibold flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> {stats.todayTransactions}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-[10px]">Transaksi Bulan Ini</p>
                                <p className="font-semibold">{formatCompact(stats.monthTransactions)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-[10px]">Revenue Tenant</p>
                                <p className="font-semibold">{formatCurrency(stats.tenantTotalRevenue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Plan Distribution */}
                <Card className="rounded-2xl border-border/50">
                    <CardContent className="p-5">
                        <p className="text-xs text-muted-foreground mb-3">Distribusi Plan</p>
                        <div className="space-y-3">
                            {(["FREE", "PRO", "ENTERPRISE"] as const).map((plan) => {
                                const count = stats.planDistribution[plan];
                                const pct = stats.totalCompanies > 0 ? (count / stats.totalCompanies) * 100 : 0;
                                const icons = { FREE: Zap, PRO: Crown, ENTERPRISE: Shield };
                                const colors = { FREE: "bg-slate-400", PRO: "bg-amber-500", ENTERPRISE: "bg-purple-500" };
                                const Icon = icons[plan];
                                return (
                                    <div key={plan} className="flex items-center gap-3">
                                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="font-medium">{plan}</span>
                                                <span className="text-muted-foreground">{count} ({Math.round(pct)}%)</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div className={cn("h-full rounded-full transition-all", colors[plan])} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Expiring soon + Recent companies */}
            <div className="grid sm:grid-cols-2 gap-4">
                {/* Expiring soon */}
                <Card className="rounded-2xl border-border/50">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-500" /> Segera Expired
                            </p>
                            <Badge variant="secondary" className="text-[10px] rounded-full">{stats.expiringSoon.length}</Badge>
                        </div>
                        {stats.expiringSoon.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-4 text-center">Tidak ada plan yang segera expired</p>
                        ) : (
                            <div className="space-y-2">
                                {stats.expiringSoon.map((c) => {
                                    const daysLeft = Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                    return (
                                        <div key={c.id} className="flex items-center justify-between rounded-lg bg-amber-50/50 border border-amber-100 px-3 py-2">
                                            <div>
                                                <p className="text-sm font-medium">{c.name}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Exp: {new Date(c.expiresAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0 rounded-full">{daysLeft}h lagi</Badge>
                                                <Button asChild size="sm" variant="outline" className="h-7 text-xs rounded-lg">
                                                    <Link href="/subscription-admin">Perpanjang</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent companies */}
                <Card className="rounded-2xl border-border/50">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-blue-500" /> Tenant Terbaru
                            </p>
                            <Button asChild size="sm" variant="ghost" className="h-7 text-xs rounded-lg">
                                <Link href="/subscription-admin">Lihat Semua</Link>
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {stats.recentCompanies.map((c) => (
                                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
                                    <div>
                                        <p className="text-sm font-medium">{c.name}</p>
                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                            <Users className="w-3 h-3" /> {c.userCount} user
                                            <span className="mx-1">·</span>
                                            <CalendarClock className="w-3 h-3" /> {new Date(c.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                                        </p>
                                    </div>
                                    <Badge className={cn("text-[10px] px-2 py-0 rounded-full", planColors[c.plan])}>{c.plan}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Activity row */}
            <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-3 rounded-xl border p-3">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    <div>
                        <p className="text-lg font-bold">{stats.activeShifts}</p>
                        <p className="text-[10px] text-muted-foreground">Shift Aktif Sekarang</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border p-3">
                    <UserPlus className="w-5 h-5 text-blue-500" />
                    <div>
                        <p className="text-lg font-bold">{stats.newRegistrations}</p>
                        <p className="text-[10px] text-muted-foreground">Registrasi Minggu Ini</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border p-3">
                    <TrendingUp className="w-5 h-5 text-amber-500" />
                    <div>
                        <p className="text-lg font-bold">{formatCurrency(stats.tenantTotalRevenue)}</p>
                        <p className="text-[10px] text-muted-foreground">GMV Bulan Ini</p>
                    </div>
                </div>
            </div>

            {/* Top tenants + Recent payments */}
            <div className="grid sm:grid-cols-2 gap-4">
                {/* Top tenants by revenue */}
                <Card className="rounded-2xl border-border/50">
                    <CardContent className="p-5">
                        <p className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                            <TrendingUp className="w-4 h-4 text-emerald-500" /> Top Tenant (Revenue)
                        </p>
                        {stats.topTenants.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-4 text-center">Belum ada data</p>
                        ) : (
                            <div className="space-y-2">
                                {stats.topTenants.map((t, i) => (
                                    <div key={t.companyId} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2">
                                        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                                            i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-slate-300"
                                        )}>{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{t.companyName}</p>
                                            <p className="text-[10px] text-muted-foreground">{t.txCount} transaksi</p>
                                        </div>
                                        <p className="text-sm font-bold tabular-nums">{formatCurrency(t.revenue)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent subscription payments */}
                <Card className="rounded-2xl border-border/50">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold flex items-center gap-1.5">
                                <DollarSign className="w-4 h-4 text-emerald-500" /> Pembayaran Terbaru
                            </p>
                            <Button asChild size="sm" variant="ghost" className="h-7 text-xs rounded-lg">
                                <Link href="/subscription-admin">Lihat Semua</Link>
                            </Button>
                        </div>
                        {stats.recentPayments.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-4 text-center">Belum ada pembayaran</p>
                        ) : (
                            <div className="space-y-2">
                                {stats.recentPayments.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
                                        <div>
                                            <p className="text-sm font-medium">{p.companyName}</p>
                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <Badge className={cn("text-[9px] px-1.5 py-0 rounded-full", planColors[p.plan])}>{p.plan}</Badge>
                                                <span>{new Date(p.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span>
                                            </p>
                                        </div>
                                        <p className="text-sm font-bold tabular-nums text-emerald-600">{formatCurrency(p.amount)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: typeof Building2; label: string; value: string | number; color: string }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-white p-3 sm:p-4">
            <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0", color)}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
                <p className="text-lg sm:text-xl font-bold tabular-nums">{value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
            </div>
        </div>
    );
}
