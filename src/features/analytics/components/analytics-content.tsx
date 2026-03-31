"use client";

import { useState, useRef, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { useBranch } from "@/components/providers/branch-provider";
import { analyticsService } from "@/features/analytics/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import {
  TrendingUp, PackageX, Snail, Clock, Shield, Users, Download,
  DollarSign, Timer, Truck, Megaphone, ShoppingCart, AlertTriangle,
  BarChart3, Layers, Zap, CircleDot, TrendingDown,
  CheckCircle2, XCircle,
} from "lucide-react";
import { exportToCSV } from "@/lib/export";

interface Props {
  marginData: {
    id: string; name: string; code: string;
    purchasePrice: number; sellingPrice: number; stock: number;
    category: { name: string };
    margin: number; marginPercent: number;
  }[];
  categoryMargins: {
    name: string; productCount: number;
    avgCost: number; avgSell: number; avgMargin: number; avgMarginPercent: number; totalStock: number;
  }[];
  deadStock: {
    id: string; name: string; code: string; stock: number; sellingPrice: number;
    category: { name: string }; stockValue: number;
  }[];
  slowMoving: {
    id: string; name: string; code: string; stock: number;
    category: { name: string }; soldQty: number;
  }[];
  peakHours: { hour: string; transactions: number; revenue: number }[];
  voidAbuse: { userName: string; role: string; voidCount: number; suspicious: boolean }[];
  cashierPerf: { name: string; transactions: number; revenue: number; avgTransaction: number }[];
  dailyProfit: { date: string; revenue: number; cost: number; profit: number }[];
  shiftProfit: { shiftId: string; cashier: string; openedAt: string; closedAt: string; revenue: number; transactions: number }[];
  supplierRanking: { name: string; productCount: number; totalPOValue: number; poCount: number }[];
  supplierDebt: { supplierName: string; totalPO: number; totalPaid: number; debt: number }[];
  unusualDiscounts: { invoiceNumber: string; cashier: string; role: string; subtotal: number; discountAmount: number; discountPercent: number; grandTotal: number; createdAt: string }[];
  promoEffectiveness: { promoName: string; type: string; usageCount: number; totalDiscount: number; isActive: boolean }[];
  reorderRecommendations: { product: string; code: string; currentStock: number; minStock: number; avgDailySales: number; daysUntilOut: number; recommendedQty: number; supplier: string }[];
}

/* ─── Rank badge helper ─── */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 font-bold text-xs ring-2 ring-amber-200">1</span>;
  if (rank === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-xs ring-2 ring-slate-200">2</span>;
  if (rank === 3) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-bold text-xs ring-2 ring-orange-200">3</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-50 text-slate-400 font-semibold text-xs">{rank}</span>;
}

/* ─── Section header helper ─── */
function SectionHeader({ icon: Icon, title, description, accentColor = "blue" }: { icon: React.ElementType; title: string; description?: string; accentColor?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    red: "bg-red-500",
    amber: "bg-amber-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
  };
  return (
    <div className="flex items-center gap-3">
      <div className={`w-1 h-8 rounded-full ${colors[accentColor] || colors.blue}`} />
      <Icon className="w-5 h-5 text-slate-500" />
      <div>
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>
    </div>
  );
}

/* ─── Empty state helper ─── */
function EmptyState({ icon: Icon, message, colSpan }: { icon: React.ElementType; message: string; colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-40">
        <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
            <Icon className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm">{message}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}

/* ─── Custom tooltip for charts ─── */
function ChartTooltipContent({ active, payload, label, formatValue }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string; formatValue?: (value: number, name: string) => [string, string] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-slate-100 shadow-xl px-4 py-3 min-w-[160px]">
      <p className="text-xs font-medium text-slate-500 mb-2">{label}</p>
      {payload.map((entry, i) => {
        const [formattedValue, displayName] = formatValue
          ? formatValue(entry.value, entry.name)
          : [String(entry.value), entry.name];
        return (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-600">{displayName}</span>
            </div>
            <span className="font-semibold text-slate-800">{formattedValue}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Tab config ─── */
const TAB_CONFIG = [
  { value: "margin", label: "Margin Produk", icon: TrendingUp },
  { value: "category", label: "Margin Kategori", icon: Layers },
  { value: "deadstock", label: "Dead Stock", icon: PackageX },
  { value: "slowmoving", label: "Slow Moving", icon: Snail },
  { value: "peakhours", label: "Jam Ramai", icon: Clock },
  { value: "fraud", label: "Fraud", icon: Shield },
  { value: "cashier", label: "Kasir", icon: Users },
  { value: "dailyprofit", label: "Laba Harian", icon: DollarSign },
  { value: "shiftprofit", label: "Laba per Shift", icon: Timer },
  { value: "supplierintel", label: "Supplier Intel", icon: Truck },
  { value: "promo", label: "Promo Report", icon: Megaphone },
  { value: "reorder", label: "Smart Reorder", icon: ShoppingCart },
  { value: "unusualdiscount", label: "Diskon Unusual", icon: AlertTriangle },
];

export function AnalyticsContent({
  marginData: initialMarginData, categoryMargins: initialCategoryMargins, deadStock: initialDeadStock, slowMoving: initialSlowMoving, peakHours: initialPeakHours, voidAbuse: initialVoidAbuse, cashierPerf: initialCashierPerf,
  dailyProfit: initialDailyProfit, shiftProfit: initialShiftProfit, supplierRanking: initialSupplierRanking, supplierDebt: initialSupplierDebt, unusualDiscounts: initialUnusualDiscounts, promoEffectiveness: initialPromoEffectiveness, reorderRecommendations: initialReorderRecommendations,
}: Props) {
  const [marginData, setMarginData] = useState(initialMarginData);
  const [categoryMargins, setCategoryMargins] = useState(initialCategoryMargins);
  const [deadStock, setDeadStock] = useState(initialDeadStock);
  const [slowMoving, setSlowMoving] = useState(initialSlowMoving);
  const [peakHours, setPeakHours] = useState(initialPeakHours);
  const [voidAbuse, setVoidAbuse] = useState(initialVoidAbuse);
  const [cashierPerf, setCashierPerf] = useState(initialCashierPerf);
  const [dailyProfit, setDailyProfit] = useState(initialDailyProfit);
  const [shiftProfit, setShiftProfit] = useState(initialShiftProfit);
  const [supplierRanking, setSupplierRanking] = useState(initialSupplierRanking);
  const [supplierDebt, setSupplierDebt] = useState(initialSupplierDebt);
  const [unusualDiscounts, setUnusualDiscounts] = useState(initialUnusualDiscounts);
  const [promoEffectiveness, setPromoEffectiveness] = useState(initialPromoEffectiveness);
  const [reorderRecommendations, setReorderRecommendations] = useState(initialReorderRecommendations);

  const { selectedBranchId } = useBranch();
  const prevBranchRef = useRef(selectedBranchId);

  useEffect(() => {
    const loadData = async () => {
      const branchId = selectedBranchId || undefined;
      const [m, cm, ds, sm, ph, va, cp, dp, sp, sr, sd, ud, pe, rr] = await Promise.all([
        analyticsService.getMarginAnalysis(branchId),
        analyticsService.getCategoryMarginAnalysis(branchId),
        analyticsService.getDeadStock(branchId),
        analyticsService.getSlowMoving(branchId),
        analyticsService.getPeakHours(branchId),
        analyticsService.getVoidAbuseDetection(branchId),
        analyticsService.getCashierPerformance(branchId),
        analyticsService.getDailyProfit(branchId),
        analyticsService.getShiftProfit(branchId),
        analyticsService.getSupplierRanking(branchId),
        analyticsService.getSupplierDebt(branchId),
        analyticsService.getUnusualDiscounts(branchId),
        analyticsService.getPromoEffectiveness(branchId),
        analyticsService.getReorderRecommendations(branchId),
      ]);
      setMarginData(m); setCategoryMargins(cm); setDeadStock(ds); setSlowMoving(sm);
      setPeakHours(ph); setVoidAbuse(va); setCashierPerf(cp); setDailyProfit(dp);
      setShiftProfit(sp); setSupplierRanking(sr); setSupplierDebt(sd);
      setUnusualDiscounts(ud); setPromoEffectiveness(pe); setReorderRecommendations(rr);
    };

    if (prevBranchRef.current !== selectedBranchId) {
      prevBranchRef.current = selectedBranchId;
      loadData();
    } else if (selectedBranchId) {
      loadData();
    }
  }, [selectedBranchId]);

  const negativeMargins = marginData.filter((p) => p.margin <= 0);
  const deadStockValue = deadStock.reduce((sum, p) => sum + p.stockValue, 0);
  const suspiciousCount = voidAbuse.filter((v) => v.suspicious).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Business Intelligence</h1>
              <p className="text-slate-400 text-sm">Analisis profit, stok, dan performa bisnis</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Negative Margins */}
        <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-rose-500/10 group-hover:from-red-500/10 group-hover:to-rose-500/15 transition-colors duration-300" />
          <CardContent className="pt-6 pb-5 relative">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Margin Negatif</p>
                <p className="text-3xl font-bold text-slate-900 tabular-nums">{negativeMargins.length}</p>
                <p className="text-xs text-slate-400">produk merugi</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dead Stock Count */}
        <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/10 group-hover:from-orange-500/10 group-hover:to-amber-500/15 transition-colors duration-300" />
          <CardContent className="pt-6 pb-5 relative">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Dead Stock (30 hari)</p>
                <p className="text-3xl font-bold text-orange-600 tabular-nums">{deadStock.length}</p>
                <p className="text-xs text-slate-400">produk tidak terjual</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
                <PackageX className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dead Stock Value */}
        <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-yellow-500/10 group-hover:from-amber-500/10 group-hover:to-yellow-500/15 transition-colors duration-300" />
          <CardContent className="pt-6 pb-5 relative">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Nilai Dead Stock</p>
                <p className="text-3xl font-bold text-amber-600 tabular-nums">{formatCurrency(deadStockValue)}</p>
                <p className="text-xs text-slate-400">modal tertahan</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Slow Moving */}
        <Card className="rounded-2xl shadow-sm border-border/30 hover:shadow-md transition-shadow duration-300 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-violet-500/10 group-hover:from-purple-500/10 group-hover:to-violet-500/15 transition-colors duration-300" />
          <CardContent className="pt-6 pb-5 relative">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Slow Moving</p>
                <p className="text-3xl font-bold text-purple-600 tabular-nums">{slowMoving.length}</p>
                <p className="text-xs text-slate-400">produk lambat terjual</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Snail className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="margin" className="space-y-6">
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <TabsList className="inline-flex h-12 items-center gap-1 rounded-xl bg-slate-100/80 p-1 min-w-max">
            {TAB_CONFIG.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm whitespace-nowrap"
              >
                <Icon className="w-4 h-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ═══════════════════ Margin per Product ═══════════════════ */}
        <TabsContent value="margin">
          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <SectionHeader icon={TrendingUp} title="Margin Analyzer per Produk" description="Analisis margin keuntungan setiap produk" accentColor="blue" />
                <Button variant="outline" size="sm" className="rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() =>
                  exportToCSV(marginData.map((p) => ({
                    Kode: p.code, Produk: p.name, Kategori: p.category.name,
                    HargaBeli: p.purchasePrice, HargaJual: p.sellingPrice,
                    Margin: p.margin, MarginPersen: p.marginPercent.toFixed(1) + "%",
                  })), "margin-analysis")
                }>
                  <Download className="w-4 h-4 mr-1.5" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Produk</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kategori</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Harga Beli</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Harga Jual</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Margin</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marginData.slice(0, 30).map((p) => (
                      <TableRow key={p.id} className="hover:bg-blue-50/30 transition-colors">
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs font-normal">{p.category.name}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-600 tabular-nums">{formatCurrency(p.purchasePrice)}</TableCell>
                        <TableCell className="text-right text-sm text-slate-600 tabular-nums">{formatCurrency(p.sellingPrice)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={`font-semibold ${p.margin > 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {formatCurrency(p.margin)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={`text-xs font-semibold ${p.marginPercent > 20 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : p.marginPercent > 0 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                            {p.marginPercent.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ Margin per Category ═══════════════════ */}
        <TabsContent value="category">
          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <SectionHeader icon={Layers} title="Margin Analyzer per Kategori" description="Rata-rata margin keuntungan per kategori" accentColor="purple" />
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kategori</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">Produk</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Avg Beli</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Avg Jual</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Avg Margin</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Margin %</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total Stok</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryMargins.map((c, i) => (
                      <TableRow key={c.name} className="hover:bg-purple-50/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <RankBadge rank={i + 1} />
                            <span className="font-medium text-slate-800">{c.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">{c.productCount}</span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-600 tabular-nums">{formatCurrency(c.avgCost)}</TableCell>
                        <TableCell className="text-right text-sm text-slate-600 tabular-nums">{formatCurrency(c.avgSell)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-emerald-600 tabular-nums">{formatCurrency(c.avgMargin)}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={`text-xs font-semibold ${c.avgMarginPercent > 20 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                            {c.avgMarginPercent.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-600 tabular-nums">{c.totalStock.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ Dead Stock ═══════════════════ */}
        <TabsContent value="deadstock">
          <div className="space-y-6">
            {/* Alert Banner */}
            {deadStock.length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800">Peringatan Dead Stock</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {deadStock.length} produk tidak terjual selama 30 hari dengan total nilai {formatCurrency(deadStockValue)} tertahan.
                  </p>
                </div>
              </div>
            )}

            <Card className="rounded-2xl shadow-sm border-border/30">
              <CardHeader className="pb-4">
                <SectionHeader icon={PackageX} title="Dead Stock (Tidak Terjual 30 Hari)" description="Produk yang tidak memiliki penjualan dalam 30 hari" accentColor="red" />
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Produk</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kategori</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Stok</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Nilai Stok</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deadStock.map((p) => (
                        <TableRow key={p.id} className="hover:bg-red-50/30 transition-colors">
                          <TableCell>
                            <div>
                              <p className="font-medium text-slate-800">{p.name}</p>
                              <p className="text-xs text-slate-400">{p.code}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs font-normal">{p.category.name}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold">{p.stock}</span>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-red-600 tabular-nums">{formatCurrency(p.stockValue)}</TableCell>
                        </TableRow>
                      ))}
                      {deadStock.length === 0 && <EmptyState icon={CheckCircle2} message="Tidak ada dead stock - semua produk terjual" colSpan={4} />}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ Slow Moving ═══════════════════ */}
        <TabsContent value="slowmoving">
          <div className="space-y-6">
            {slowMoving.length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Snail className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Perhatian Slow Moving</p>
                  <p className="text-xs text-amber-600 mt-0.5">{slowMoving.length} produk terjual kurang dari 5 unit dalam 30 hari terakhir.</p>
                </div>
              </div>
            )}

            <Card className="rounded-2xl shadow-sm border-border/30">
              <CardHeader className="pb-4">
                <SectionHeader icon={Snail} title="Slow Moving (Terjual <5 dalam 30 Hari)" description="Produk dengan perputaran sangat rendah" accentColor="amber" />
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Produk</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kategori</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Stok</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Terjual (30h)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slowMoving.map((p) => (
                        <TableRow key={p.id} className="hover:bg-amber-50/30 transition-colors">
                          <TableCell>
                            <div>
                              <p className="font-medium text-slate-800">{p.name}</p>
                              <p className="text-xs text-slate-400">{p.code}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs font-normal">{p.category.name}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-slate-600 tabular-nums">{p.stock}</TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">{p.soldQty}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {slowMoving.length === 0 && <EmptyState icon={CheckCircle2} message="Tidak ada slow moving - perputaran stok baik" colSpan={4} />}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ Peak Hours ═══════════════════ */}
        <TabsContent value="peakhours">
          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <SectionHeader icon={Clock} title="Jam Ramai Penjualan (30 Hari)" description="Distribusi transaksi berdasarkan jam operasional" accentColor="blue" />
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-slate-50/50 p-4">
                <ResponsiveContainer width="100%" height={380}>
                  <AreaChart data={peakHours}>
                    <defs>
                      <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => (
                        <ChartTooltipContent
                          active={active}
                          payload={payload as Array<{ value: number; name: string; color: string }>}
                          label={label}
                          formatValue={(value, name) => [
                            name === "transactions" ? `${value} transaksi` : formatCurrency(Number(value)),
                            name === "transactions" ? "Transaksi" : "Revenue",
                          ]}
                        />
                      )}
                    />
                    <Area type="monotone" dataKey="transactions" stroke="#3b82f6" strokeWidth={2.5} fill="url(#peakGradient)" dot={{ r: 3, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ Fraud Detection ═══════════════════ */}
        <TabsContent value="fraud">
          <div className="space-y-6">
            {suspiciousCount > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border-l-4 border-red-500">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Shield className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800">Fraud Alert</p>
                  <p className="text-xs text-red-600 mt-0.5">{suspiciousCount} kasir terdeteksi dengan pola void yang mencurigakan. Segera lakukan investigasi.</p>
                </div>
              </div>
            )}

            <Card className="rounded-2xl shadow-sm border-border/30">
              <CardHeader className="pb-4">
                <SectionHeader icon={Shield} title="Fraud Detection - Void Abuse (7 Hari)" description="Deteksi pola void yang mencurigakan" accentColor="red" />
              </CardHeader>
              <CardContent>
                {voidAbuse.length > 0 ? (
                  <div className="space-y-3">
                    {voidAbuse.map((v, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                          v.suspicious
                            ? "bg-red-50/50 border-red-200 hover:bg-red-50"
                            : "bg-white border-slate-100 hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${v.suspicious ? "bg-red-100" : "bg-emerald-100"}`}>
                            {v.suspicious ? <XCircle className="w-5 h-5 text-red-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{v.userName}</p>
                            <p className="text-xs text-slate-400">{v.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-slate-800 tabular-nums">{v.voidCount}</p>
                            <p className="text-xs text-slate-400">void</p>
                          </div>
                          <Badge className={`text-xs font-semibold px-3 py-1 ${v.suspicious ? "bg-red-100 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                            {v.suspicious ? "Suspicious" : "Normal"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                      <Shield className="w-7 h-7 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium">Tidak ada void tercatat</p>
                    <p className="text-xs text-slate-300 mt-1">Belum ada aktivitas void dalam 7 hari terakhir</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ Cashier Performance ═══════════════════ */}
        <TabsContent value="cashier">
          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <SectionHeader icon={Users} title="Performa Kasir (30 Hari)" description="Ranking kasir berdasarkan transaksi dan revenue" accentColor="blue" />
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 w-16">Rank</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kasir</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Transaksi</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total Revenue</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Avg/Transaksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashierPerf.map((c, i) => (
                      <TableRow key={i} className={`hover:bg-blue-50/30 transition-colors ${i === 0 ? "bg-amber-50/30" : ""}`}>
                        <TableCell><RankBadge rank={i + 1} /></TableCell>
                        <TableCell>
                          <span className="font-medium text-slate-800">{c.name}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">{c.transactions}</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-800 tabular-nums">{formatCurrency(c.revenue)}</TableCell>
                        <TableCell className="text-right text-sm text-slate-500 tabular-nums">{formatCurrency(c.avgTransaction)}</TableCell>
                      </TableRow>
                    ))}
                    {cashierPerf.length === 0 && <EmptyState icon={Users} message="Belum ada data performa kasir" colSpan={5} />}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ Daily Profit ═══════════════════ */}
        <TabsContent value="dailyprofit">
          <div className="space-y-6">
            <Card className="rounded-2xl shadow-sm border-border/30">
              <CardHeader className="pb-4">
                <SectionHeader icon={DollarSign} title="Laba Harian (30 Hari Terakhir)" description="Tren pendapatan, biaya, dan profit harian" accentColor="emerald" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl bg-slate-50/50 p-4">
                  <ResponsiveContainer width="100%" height={380}>
                    <AreaChart data={dailyProfit}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
                        </linearGradient>
                        <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        content={({ active, payload, label }) => (
                          <ChartTooltipContent
                            active={active}
                            payload={payload as Array<{ value: number; name: string; color: string }>}
                            label={label}
                            formatValue={(value, name) => [
                              formatCurrency(Number(value)),
                              name === "revenue" ? "Revenue" : name === "cost" ? "Cost" : "Profit",
                            ]}
                          />
                        )}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revenueGradient)" name="revenue" dot={false} />
                      <Area type="monotone" dataKey="cost" stroke="#f97316" strokeWidth={2} fill="transparent" strokeDasharray="5 5" name="cost" dot={false} />
                      <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="url(#profitGradient)" name="profit" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs text-slate-500">Revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-orange-400 inline-block" style={{ borderBottom: "2px dashed #fb923c" }} />
                    <span className="text-xs text-slate-500">Cost</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-500">Profit</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tanggal</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Revenue</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Cost</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Profit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyProfit.map((d) => (
                        <TableRow key={d.date} className="hover:bg-emerald-50/30 transition-colors">
                          <TableCell className="font-medium text-slate-700">{d.date}</TableCell>
                          <TableCell className="text-right text-sm text-blue-600 tabular-nums font-medium">{formatCurrency(d.revenue)}</TableCell>
                          <TableCell className="text-right text-sm text-orange-600 tabular-nums">{formatCurrency(d.cost)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={`font-semibold ${d.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {formatCurrency(d.profit)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {dailyProfit.length === 0 && <EmptyState icon={DollarSign} message="Belum ada data profit harian" colSpan={4} />}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ Shift Profit ═══════════════════ */}
        <TabsContent value="shiftprofit">
          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <SectionHeader icon={Timer} title="Laba per Shift" description="Performa pendapatan setiap shift kasir" accentColor="purple" />
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kasir</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mulai</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selesai</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Transaksi</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shiftProfit.map((s) => (
                      <TableRow key={s.shiftId} className="hover:bg-purple-50/30 transition-colors">
                        <TableCell className="font-medium text-slate-800">{s.cashier}</TableCell>
                        <TableCell className="text-sm text-slate-500">{new Date(s.openedAt).toLocaleString("id-ID")}</TableCell>
                        <TableCell className="text-sm text-slate-500">{new Date(s.closedAt).toLocaleString("id-ID")}</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-xs font-semibold">{s.transactions}</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-800 tabular-nums">{formatCurrency(s.revenue)}</TableCell>
                      </TableRow>
                    ))}
                    {shiftProfit.length === 0 && <EmptyState icon={Timer} message="Belum ada data shift" colSpan={5} />}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ Supplier Intel ═══════════════════ */}
        <TabsContent value="supplierintel">
          <div className="space-y-6">
            <Card className="rounded-2xl shadow-sm border-border/30">
              <CardHeader className="pb-4">
                <SectionHeader icon={Truck} title="Supplier Ranking" description="Peringkat supplier berdasarkan volume dan nilai PO" accentColor="blue" />
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 w-16">Rank</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Produk</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total PO</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Nilai PO</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierRanking.map((s, i) => (
                        <TableRow key={s.name} className={`hover:bg-blue-50/30 transition-colors ${i === 0 ? "bg-amber-50/30" : ""}`}>
                          <TableCell><RankBadge rank={i + 1} /></TableCell>
                          <TableCell className="font-medium text-slate-800">{s.name}</TableCell>
                          <TableCell className="text-right text-sm text-slate-600 tabular-nums">{s.productCount}</TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">{s.poCount}</span>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-800 tabular-nums">{formatCurrency(s.totalPOValue)}</TableCell>
                        </TableRow>
                      ))}
                      {supplierRanking.length === 0 && <EmptyState icon={Truck} message="Belum ada data supplier" colSpan={5} />}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-border/30">
              <CardHeader className="pb-4">
                <SectionHeader icon={DollarSign} title="Supplier Debt Tracking" description="Monitoring hutang ke setiap supplier" accentColor="red" />
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total PO (Received)</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total Dibayar</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Sisa Hutang</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierDebt.map((s) => (
                        <TableRow key={s.supplierName} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-medium text-slate-800">{s.supplierName}</TableCell>
                          <TableCell className="text-right text-sm text-slate-600 tabular-nums">{formatCurrency(s.totalPO)}</TableCell>
                          <TableCell className="text-right text-sm text-emerald-600 font-medium tabular-nums">{formatCurrency(s.totalPaid)}</TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            <span className={s.debt > 0 ? "text-red-600" : "text-emerald-600"}>{formatCurrency(s.debt)}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`text-xs font-semibold ${s.debt <= 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : s.debt > s.totalPO * 0.5 ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                              {s.debt <= 0 ? "Lunas" : "Hutang"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {supplierDebt.length === 0 && <EmptyState icon={DollarSign} message="Tidak ada data hutang supplier" colSpan={5} />}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ Promo Report ═══════════════════ */}
        <TabsContent value="promo">
          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <SectionHeader icon={Megaphone} title="Promo Effectiveness Report" description="Efektivitas dan penggunaan setiap promosi" accentColor="purple" />
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nama Promo</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tipe</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Penggunaan</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total Diskon</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promoEffectiveness.map((p, i) => (
                      <TableRow key={i} className="hover:bg-purple-50/30 transition-colors">
                        <TableCell className="font-medium text-slate-800">{p.promoName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">{p.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-xs font-bold">{p.usageCount}</span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-slate-700 tabular-nums">{formatCurrency(p.totalDiscount)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs font-semibold ${p.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-400 border border-slate-200"}`}>
                            <CircleDot className="w-3 h-3 mr-1" />
                            {p.isActive ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {promoEffectiveness.length === 0 && <EmptyState icon={Megaphone} message="Belum ada data promosi" colSpan={5} />}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ Smart Reorder ═══════════════════ */}
        <TabsContent value="reorder">
          <div className="space-y-6">
            {reorderRecommendations.filter(r => r.daysUntilOut <= 3 && r.daysUntilOut < 999).length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border-l-4 border-red-500">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800">Urgent Reorder</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {reorderRecommendations.filter(r => r.daysUntilOut <= 3 && r.daysUntilOut < 999).length} produk akan habis dalam 3 hari. Segera lakukan pemesanan.
                  </p>
                </div>
              </div>
            )}

            <Card className="rounded-2xl shadow-sm border-border/30">
              <CardHeader className="pb-4">
                <SectionHeader icon={ShoppingCart} title="Smart Reorder Recommendations" description="Rekomendasi pemesanan otomatis berdasarkan tren penjualan" accentColor="emerald" />
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Produk</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Stok</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Min Stok</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Avg Jual/Hari</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Hari Tersisa</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Rekomendasi</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reorderRecommendations.map((r, i) => (
                        <TableRow key={i} className={`transition-colors ${r.daysUntilOut <= 3 && r.daysUntilOut < 999 ? "bg-red-50/40 hover:bg-red-50/60" : "hover:bg-emerald-50/30"}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-slate-800">{r.product}</p>
                              <p className="text-xs text-slate-400">{r.code}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={`text-xs font-semibold ${r.currentStock === 0 ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                              {r.currentStock}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-slate-500 tabular-nums">{r.minStock}</TableCell>
                          <TableCell className="text-right text-sm text-slate-500 tabular-nums">{r.avgDailySales}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={`text-xs font-semibold ${r.daysUntilOut <= 3 ? "bg-red-50 text-red-700 border border-red-200 animate-pulse" : r.daysUntilOut <= 7 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                              {r.daysUntilOut >= 999 ? "Aman" : `${r.daysUntilOut} hari`}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center justify-center min-w-[36px] px-2.5 py-1 rounded-lg bg-blue-500 text-white text-sm font-bold shadow-sm shadow-blue-500/20">{r.recommendedQty}</span>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">{r.supplier}</TableCell>
                        </TableRow>
                      ))}
                      {reorderRecommendations.length === 0 && <EmptyState icon={CheckCircle2} message="Semua stok dalam kondisi aman" colSpan={7} />}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ Unusual Discounts ═══════════════════ */}
        <TabsContent value="unusualdiscount">
          <div className="space-y-6">
            {unusualDiscounts.length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border-l-4 border-amber-500">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Diskon Abnormal Terdeteksi</p>
                  <p className="text-xs text-amber-600 mt-0.5">{unusualDiscounts.length} transaksi dengan diskon lebih dari 20% dalam 7 hari terakhir membutuhkan review.</p>
                </div>
              </div>
            )}

            <Card className="rounded-2xl shadow-sm border-border/30">
              <CardHeader className="pb-4">
                <SectionHeader icon={AlertTriangle} title="Diskon Unusual (>20%) - 7 Hari Terakhir" description="Transaksi dengan diskon di atas ambang batas normal" accentColor="amber" />
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Invoice</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kasir</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Subtotal</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Diskon</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">%</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Grand Total</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tanggal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unusualDiscounts.map((d, i) => (
                        <TableRow key={i} className="hover:bg-amber-50/30 transition-colors">
                          <TableCell>
                            <span className="font-mono text-sm font-medium text-slate-700">{d.invoiceNumber}</span>
                          </TableCell>
                          <TableCell className="font-medium text-slate-800">{d.cashier}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs">{d.role}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-slate-600 tabular-nums">{formatCurrency(d.subtotal)}</TableCell>
                          <TableCell className="text-right font-bold text-red-600 tabular-nums">{formatCurrency(d.discountAmount)}</TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">{d.discountPercent.toFixed(1)}%</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-slate-700 tabular-nums">{formatCurrency(d.grandTotal)}</TableCell>
                          <TableCell className="text-sm text-slate-400">{new Date(d.createdAt).toLocaleString("id-ID")}</TableCell>
                        </TableRow>
                      ))}
                      {unusualDiscounts.length === 0 && <EmptyState icon={CheckCircle2} message="Tidak ada diskon unusual - semua transaksi normal" colSpan={8} />}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
