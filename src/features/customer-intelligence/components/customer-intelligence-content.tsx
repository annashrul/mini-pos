"use client";

import { useState, useRef, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { useBranch } from "@/components/providers/branch-provider";
import { customerIntelligenceService } from "@/features/customer-intelligence/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Repeat, Clock, Crown, Users, UserCheck, Star, Award, TrendingUp, ShoppingBag, Zap, Gem, CircleDot, UserX } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const memberColors: Record<string, string> = {
  REGULAR: "bg-slate-100 text-slate-700",
  SILVER: "bg-gray-100 text-gray-700",
  GOLD: "bg-yellow-100 text-yellow-700",
  PLATINUM: "bg-purple-100 text-purple-700",
};

const memberBadgeStyles: Record<string, string> = {
  REGULAR: "bg-slate-100 text-slate-700 border border-slate-200",
  SILVER: "bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 border border-gray-200",
  GOLD: "bg-gradient-to-r from-amber-100 to-yellow-50 text-amber-800 border border-amber-200",
  PLATINUM: "bg-gradient-to-r from-purple-100 to-violet-50 text-purple-800 border border-purple-200",
};

const loyaltyGradients: Record<string, { bg: string; icon: string; iconBg: string }> = {
  REGULAR: {
    bg: "from-slate-500 to-slate-600",
    icon: "bg-white/20",
    iconBg: "text-white",
  },
  SILVER: {
    bg: "from-gray-400 to-gray-500",
    icon: "bg-white/20",
    iconBg: "text-white",
  },
  GOLD: {
    bg: "from-amber-400 to-amber-600",
    icon: "bg-white/20",
    iconBg: "text-white",
  },
  PLATINUM: {
    bg: "from-purple-500 to-violet-600",
    icon: "bg-white/20",
    iconBg: "text-white",
  },
};

const loyaltyIcons: Record<string, typeof Star> = {
  REGULAR: CircleDot,
  SILVER: Star,
  GOLD: Award,
  PLATINUM: Gem,
};

function getFrequencyIndicator(visitCount: number, lastVisit: Date | null) {
  const now = new Date();
  const daysSinceLastVisit = lastVisit
    ? Math.floor((now.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (visitCount >= 5 && daysSinceLastVisit <= 7) {
    return { color: "bg-emerald-500", label: "Frequent", textColor: "text-emerald-700", bgLight: "bg-emerald-50" };
  }
  if (visitCount >= 2 && daysSinceLastVisit <= 14) {
    return { color: "bg-amber-500", label: "Moderate", textColor: "text-amber-700", bgLight: "bg-amber-50" };
  }
  return { color: "bg-red-400", label: "Inactive", textColor: "text-red-600", bgLight: "bg-red-50" };
}

function CustomerAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  const colors = [
    "from-violet-500 to-purple-600",
    "from-fuchsia-500 to-pink-600",
    "from-purple-500 to-indigo-600",
    "from-violet-400 to-fuchsia-500",
    "from-indigo-500 to-violet-600",
  ];
  const colorIndex = name.charCodeAt(0) % colors.length;

  return (
    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
      {initial}
    </div>
  );
}

interface Props {
  repeatCustomers: {
    id: string; name: string; phone: string | null; email: string | null;
    memberLevel: string; totalSpending: number; points: number;
    transactionCount: number; isRepeat: boolean;
  }[];
  shoppingFrequency: {
    id: string; name: string; phone: string | null; memberLevel: string;
    visitCount: number; totalSpent: number; avgSpending: number;
    lastVisit: Date | null;
  }[];
  loyaltySummary: {
    level: string; count: number; totalSpending: number; totalPoints: number;
  }[];
}

export function CustomerIntelligenceContent({ repeatCustomers: initialRepeatCustomers, shoppingFrequency: initialShoppingFrequency, loyaltySummary: initialLoyaltySummary }: Props) {
  const [repeatCustomers, setRepeatCustomers] = useState(initialRepeatCustomers);
  const [shoppingFrequency, setShoppingFrequency] = useState(initialShoppingFrequency);
  const [loyaltySummary, setLoyaltySummary] = useState(initialLoyaltySummary);

  const { selectedBranchId } = useBranch();
  const prevBranchRef = useRef(selectedBranchId);

  useEffect(() => {
    const loadData = async () => {
      const branchId = selectedBranchId || undefined;
      const [rc, sf, ls] = await Promise.all([
        customerIntelligenceService.getRepeatCustomers(branchId),
        customerIntelligenceService.getShoppingFrequency(branchId),
        customerIntelligenceService.getLoyaltySummary(branchId),
      ]);
      setRepeatCustomers(rc);
      setShoppingFrequency(sf);
      setLoyaltySummary(ls);
    };

    if (prevBranchRef.current !== selectedBranchId) {
      prevBranchRef.current = selectedBranchId;
      loadData();
    } else if (selectedBranchId) {
      loadData();
    }
  }, [selectedBranchId]);

  const totalCustomers = repeatCustomers.length;
  const repeatCount = repeatCustomers.filter((c) => c.isRepeat).length;
  const totalPoints = loyaltySummary.reduce((sum, l) => sum + l.totalPoints, 0);
  const totalSpendingAll = loyaltySummary.reduce((sum, l) => sum + l.totalSpending, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Intelligence</h1>
        <p className="text-slate-500 text-sm mt-1">Analisis pelanggan, loyalitas, dan pola belanja</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Customers */}
        <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/10 group-hover:from-violet-500/10 group-hover:to-purple-500/15 transition-colors duration-300" />
          <CardContent className="pt-6 pb-5 relative">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Customer</p>
                <p className="text-3xl font-bold text-slate-900 tabular-nums">{totalCustomers.toLocaleString()}</p>
                <p className="text-xs text-slate-400">Semua pelanggan terdaftar</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Repeat Customers */}
        <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/10 group-hover:from-emerald-500/10 group-hover:to-green-500/15 transition-colors duration-300" />
          <CardContent className="pt-6 pb-5 relative">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Repeat Customer</p>
                <p className="text-3xl font-bold text-emerald-600 tabular-nums">{repeatCount.toLocaleString()}</p>
                <p className="text-xs text-slate-400">
                  {totalCustomers > 0 ? `${Math.round((repeatCount / totalCustomers) * 100)}% retention rate` : "Belum ada data"}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Points */}
        <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/10 group-hover:from-purple-500/10 group-hover:to-fuchsia-500/15 transition-colors duration-300" />
          <CardContent className="pt-6 pb-5 relative">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Poin Beredar</p>
                <p className="text-3xl font-bold text-purple-600 tabular-nums">{totalPoints.toLocaleString()}</p>
                <p className="text-xs text-slate-400">Akumulasi loyalty points</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Spending */}
        <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/10 group-hover:from-indigo-500/10 group-hover:to-violet-500/15 transition-colors duration-300" />
          <CardContent className="pt-6 pb-5 relative">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Spending</p>
                <p className="text-2xl font-bold text-indigo-600 tabular-nums">{formatCurrency(totalSpendingAll)}</p>
                <p className="text-xs text-slate-400">Revenue dari member</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="repeat" className="space-y-6">
        <TabsList className="rounded-2xl bg-slate-100/80 p-1.5 h-auto">
          <TabsTrigger value="repeat" className="rounded-xl px-5 py-2.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm gap-2">
            <Repeat className="w-4 h-4" />
            Repeat Customer
          </TabsTrigger>
          <TabsTrigger value="frequency" className="rounded-xl px-5 py-2.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm gap-2">
            <Clock className="w-4 h-4" />
            Shopping Frequency
          </TabsTrigger>
          <TabsTrigger value="loyalty" className="rounded-xl px-5 py-2.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm gap-2">
            <Crown className="w-4 h-4" />
            Loyalty Summary
          </TabsTrigger>
        </TabsList>

        {/* Repeat Customer Tab */}
        <TabsContent value="repeat">
          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20">
                  <Repeat className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <span className="text-slate-900">Top Customer</span>
                  <p className="text-xs text-slate-400 font-normal mt-0.5">Berdasarkan total belanja</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {repeatCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <UserX className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">Belum ada data customer</p>
                  <p className="text-xs text-slate-300 mt-1">Data akan muncul setelah ada transaksi</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 hover:bg-transparent">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-10">#</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Customer</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Kontak</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Level</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">Total Belanja</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Transaksi</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Poin</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repeatCustomers.map((c, i) => (
                        <TableRow key={c.id} className="border-slate-50 hover:bg-violet-50/30">
                          <TableCell className="py-3.5 font-bold text-violet-500 tabular-nums">{i + 1}</TableCell>
                          <TableCell className="py-3.5">
                            <div className="flex items-center gap-3">
                              <CustomerAvatar name={c.name} />
                              <div>
                                <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                                {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3.5 text-slate-500 text-sm">{c.phone || "-"}</TableCell>
                          <TableCell className="py-3.5 text-center">
                            <Badge className={`${memberBadgeStyles[c.memberLevel]} text-[11px] font-semibold px-2.5 py-0.5`}>
                              {c.memberLevel}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3.5 text-right font-semibold text-slate-800 tabular-nums text-sm">{formatCurrency(c.totalSpending)}</TableCell>
                          <TableCell className="py-3.5 text-center tabular-nums font-medium text-slate-600">{c.transactionCount}</TableCell>
                          <TableCell className="py-3.5 text-center tabular-nums font-medium text-purple-600">{c.points.toLocaleString()}</TableCell>
                          <TableCell className="py-3.5 text-center">
                            <Badge className={
                              c.isRepeat
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold"
                                : "bg-slate-50 text-slate-500 border border-slate-200 text-[11px] font-semibold"
                            }>
                              {c.isRepeat ? "Repeat" : "New"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shopping Frequency Tab */}
        <TabsContent value="frequency">
          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-md shadow-purple-500/20">
                  <Clock className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <span className="text-slate-900">Shopping Frequency</span>
                  <p className="text-xs text-slate-400 font-normal mt-0.5">Pola kunjungan 30 hari terakhir</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shoppingFrequency.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <ShoppingBag className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">Belum ada data frekuensi</p>
                  <p className="text-xs text-slate-300 mt-1">Data akan tersedia setelah pelanggan bertransaksi</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 hover:bg-transparent">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Customer</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Kontak</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Level</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Kunjungan</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Aktivitas</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">Total Belanja</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">Avg/Kunjungan</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Terakhir</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shoppingFrequency.map((c) => {
                        const indicator = getFrequencyIndicator(c.visitCount, c.lastVisit);
                        return (
                          <TableRow key={c.id} className="border-slate-50 hover:bg-violet-50/30">
                            <TableCell className="py-3.5">
                              <div className="flex items-center gap-3">
                                <CustomerAvatar name={c.name} />
                                <span className="font-semibold text-slate-800 text-sm">{c.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5 text-slate-500 text-sm">{c.phone || "-"}</TableCell>
                            <TableCell className="py-3.5 text-center">
                              <Badge className={`${memberBadgeStyles[c.memberLevel]} text-[11px] font-semibold px-2.5 py-0.5`}>
                                {c.memberLevel}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3.5 text-center">
                              <span className="font-bold text-slate-800 tabular-nums text-base">{c.visitCount}</span>
                            </TableCell>
                            <TableCell className="py-3.5 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${indicator.color}`} />
                                <span className={`text-[11px] font-semibold ${indicator.textColor}`}>
                                  {indicator.label}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5 text-right font-semibold text-slate-800 tabular-nums text-sm">{formatCurrency(c.totalSpent)}</TableCell>
                            <TableCell className="py-3.5 text-right tabular-nums text-sm text-slate-600">{formatCurrency(c.avgSpending)}</TableCell>
                            <TableCell className="py-3.5 text-sm text-slate-500">
                              {c.lastVisit ? format(new Date(c.lastVisit), "dd MMM", { locale: idLocale }) : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loyalty Summary Tab */}
        <TabsContent value="loyalty">
          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Crown className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <span className="text-slate-900">Loyalty Program Summary</span>
                  <p className="text-xs text-slate-400 font-normal mt-0.5">Distribusi member berdasarkan level</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loyaltySummary.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <Crown className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">Belum ada data loyalty</p>
                  <p className="text-xs text-slate-300 mt-1">Data akan muncul setelah member terdaftar</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {loyaltySummary.map((l) => {
                    const gradient = loyaltyGradients[l.level] || loyaltyGradients.REGULAR;
                    const IconComp = loyaltyIcons[l.level] || CircleDot;
                    return (
                      <div
                        key={l.level}
                        className={`rounded-2xl bg-gradient-to-br ${gradient.bg} p-5 text-white shadow-lg hover:shadow-xl transition-shadow duration-300 relative overflow-hidden`}
                      >
                        {/* Decorative circle */}
                        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
                        <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />

                        <div className="relative space-y-4">
                          <div className="flex items-center justify-between">
                            <div className={`w-10 h-10 rounded-xl ${gradient.icon} flex items-center justify-center`}>
                              <IconComp className={`w-5 h-5 ${gradient.iconBg}`} />
                            </div>
                            <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">{l.level}</span>
                          </div>

                          <div>
                            <p className="text-4xl font-bold tabular-nums">{l.count.toLocaleString()}</p>
                            <p className="text-white/70 text-xs mt-0.5">member terdaftar</p>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-white/20">
                            <div className="flex justify-between items-center">
                              <span className="text-white/70 text-xs">Total Belanja</span>
                              <span className="font-semibold text-sm tabular-nums">{formatCurrency(l.totalSpending)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-white/70 text-xs">Total Poin</span>
                              <span className="font-semibold text-sm tabular-nums">{l.totalPoints.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-white/70 text-xs">Avg Belanja</span>
                              <span className="font-semibold text-sm tabular-nums">{formatCurrency(l.count > 0 ? l.totalSpending / l.count : 0)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
