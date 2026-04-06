"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { useBranch } from "@/components/providers/branch-provider";
import {
  getProfitOverview,
  getProfitByCategory,
  getProfitByProduct,
  getProfitByBranch,
  getProfitTrend,
  getMarginDistribution,
} from "@/server/actions/profit-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  TrendingUp, TrendingDown, DollarSign, Package, Receipt,
  BarChart3, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight,
  Building2, Loader2,
} from "lucide-react";
import {
  Area, BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type Period = "today" | "week" | "month" | "year";

const PERIOD_TABS: { value: Period; label: string; trendDays: number }[] = [
  { value: "today", label: "Hari Ini", trendDays: 7 },
  { value: "week", label: "Minggu Ini", trendDays: 14 },
  { value: "month", label: "Bulan Ini", trendDays: 30 },
  { value: "year", label: "Tahun Ini", trendDays: 365 },
];

const DONUT_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

function GrowthIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">--</span>;
  const isPositive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(value)}%
    </span>
  );
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

interface ProfitOverview {
  revenue: number; cogs: number; grossProfit: number; grossMargin: number;
  expenses: number; netProfit: number; netMargin: number;
  revenueGrowth: number; grossProfitGrowth: number; netProfitGrowth: number;
  cogsGrowth: number; expensesGrowth: number; transactionCount: number;
}
interface CategoryProfit {
  category: string; revenue: number; cost: number; profit: number;
  margin: number; contribution: number; units: number;
}
interface ProductProfit {
  productName: string; productCode: string; unitsSold: number;
  revenue: number; cost: number; profit: number; margin: number;
}
interface BranchProfit {
  branchId: string; branchName: string; revenue: number; cost: number;
  grossProfit: number; expenses: number; netProfit: number;
  grossMargin: number; netMargin: number; contribution: number;
}
interface TrendPoint { date: string; revenue: number; cost: number; profit: number; }
interface MarginBracket { label: string; count: number; revenue: number; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-white p-3 shadow-lg text-xs space-y-1">
      <p className="font-medium text-muted-foreground mb-1.5">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function ProfitDashboardContent() {
  const { selectedBranchId } = useBranch();
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState<ProfitOverview | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryProfit[]>([]);
  const [topProducts, setTopProducts] = useState<ProductProfit[]>([]);
  const [bottomProducts, setBottomProducts] = useState<ProductProfit[]>([]);
  const [branchData, setBranchData] = useState<BranchProfit[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [marginDist, setMarginDist] = useState<MarginBracket[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const trendDays = PERIOD_TABS.find((t) => t.value === period)?.trendDays ?? 30;
      const branchArg = selectedBranchId || undefined;

      const [ov, cats, top, bottom, trend, margin, branches] = await Promise.all([
        getProfitOverview(period, branchArg),
        getProfitByCategory(period, branchArg),
        getProfitByProduct(period, branchArg, 10, "top"),
        getProfitByProduct(period, branchArg, 10, "bottom"),
        getProfitTrend(trendDays, branchArg),
        getMarginDistribution(branchArg),
        !branchArg ? getProfitByBranch(period) : Promise.resolve([]),
      ]);

      setOverview(ov);
      setCategoryData(cats);
      setTopProducts(top);
      setBottomProducts(bottom);
      setTrendData(trend);
      setMarginDist(margin);
      setBranchData(branches);
    } catch (error) {
      console.error("Failed to load profit dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [period, selectedBranchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalMarginProducts = marginDist.reduce((s, m) => s + m.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profit Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Analisis profitabilitas bisnis secara menyeluruh
          </p>
        </div>
        <div className="flex items-center bg-muted/50 rounded-xl p-1 gap-0.5">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setPeriod(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                period === tab.value
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard
            title="Revenue"
            value={overview.revenue}
            growth={overview.revenueGrowth}
            icon={<DollarSign className="w-4 h-4" />}
            color="blue"
          />
          <KPICard
            title="COGS (HPP)"
            value={overview.cogs}
            growth={overview.cogsGrowth}
            icon={<Package className="w-4 h-4" />}
            color="orange"
            invertGrowth
          />
          <KPICard
            title="Gross Profit"
            value={overview.grossProfit}
            growth={overview.grossProfitGrowth}
            icon={<TrendingUp className="w-4 h-4" />}
            color="green"
            subtitle={`Margin ${overview.grossMargin}%`}
          />
          <KPICard
            title="Expenses"
            value={overview.expenses}
            growth={overview.expensesGrowth}
            icon={<Receipt className="w-4 h-4" />}
            color="red"
            invertGrowth
          />
          <KPICard
            title="Net Profit"
            value={overview.netProfit}
            growth={overview.netProfitGrowth}
            icon={overview.netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            color={overview.netProfit >= 0 ? "green" : "red"}
            subtitle={`Margin ${overview.netMargin}%`}
            highlight
          />
        </div>
      )}

      {/* Profit Trend Chart */}
      {trendData.length > 0 && (
        <Card className="rounded-2xl shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Tren Profit Harian
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatCompact(v)}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    name="HPP"
                    fill="url(#costGrad)"
                    stroke="#f97316"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    fill="url(#profitGrad)"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two Column: Category + Margin Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Profit by Category */}
        <Card className="lg:col-span-3 rounded-2xl shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Profit per Kategori
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryData.length > 0 && (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryData.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatCompact(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={100}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} />
                    <Bar dataKey="profit" name="Profit" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Kategori</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                    <TableHead className="text-xs text-right">HPP</TableHead>
                    <TableHead className="text-xs text-right">Profit</TableHead>
                    <TableHead className="text-xs text-right">Margin</TableHead>
                    <TableHead className="text-xs text-right">Kontribusi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryData.map((cat) => (
                    <TableRow key={cat.category}>
                      <TableCell className="text-sm font-medium">{cat.category}</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(cat.revenue)}</TableCell>
                      <TableCell className="text-sm text-right text-orange-600">{formatCurrency(cat.cost)}</TableCell>
                      <TableCell className={`text-sm text-right font-semibold ${cat.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {formatCurrency(cat.profit)}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        <Badge variant="outline" className="text-[11px]">{cat.margin}%</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-right text-muted-foreground">{cat.contribution}%</TableCell>
                    </TableRow>
                  ))}
                  {categoryData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Belum ada data untuk periode ini
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Margin Distribution */}
        <Card className="lg:col-span-2 rounded-2xl shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-muted-foreground" />
              Distribusi Margin
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {totalMarginProducts > 0 && (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={marginDist.filter((m) => m.count > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="label"
                    >
                      {marginDist.filter((m) => m.count > 0).map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length] || "#8884d8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: number, name: string) => [
                        `${value} produk (${totalMarginProducts > 0 ? Math.round((value / totalMarginProducts) * 100) : 0}%)`,
                        name,
                      ]) as any}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="space-y-2">
              {marginDist.map((bracket, i) => (
                <div key={bracket.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <span className="text-muted-foreground">{bracket.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{bracket.count} produk</span>
                    <span className="text-muted-foreground text-xs">{formatCurrency(bracket.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Profitable */}
        <Card className="rounded-2xl shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Top 10 Produk Paling Menguntungkan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Produk</TableHead>
                    <TableHead className="text-xs text-right">Qty</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                    <TableHead className="text-xs text-right">Profit</TableHead>
                    <TableHead className="text-xs text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p, i) => (
                    <TableRow key={p.productCode}>
                      <TableCell className="text-sm text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium truncate max-w-[180px]">{p.productName}</div>
                        <div className="text-[11px] text-muted-foreground">{p.productCode}</div>
                      </TableCell>
                      <TableCell className="text-sm text-right">{p.unitsSold}</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(p.revenue)}</TableCell>
                      <TableCell className={`text-sm text-right font-semibold ${p.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {formatCurrency(p.profit)}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${p.margin >= 30 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : p.margin >= 15 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}`}
                        >
                          {p.margin}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {topProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Belum ada data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Bottom 10 Least Profitable */}
        <Card className="rounded-2xl shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Bottom 10 Produk Kurang Menguntungkan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Produk</TableHead>
                    <TableHead className="text-xs text-right">Qty</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                    <TableHead className="text-xs text-right">Profit</TableHead>
                    <TableHead className="text-xs text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bottomProducts.map((p, i) => (
                    <TableRow key={p.productCode}>
                      <TableCell className="text-sm text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium truncate max-w-[180px]">{p.productName}</div>
                        <div className="text-[11px] text-muted-foreground">{p.productCode}</div>
                      </TableCell>
                      <TableCell className="text-sm text-right">{p.unitsSold}</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(p.revenue)}</TableCell>
                      <TableCell className={`text-sm text-right font-semibold ${p.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {formatCurrency(p.profit)}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${p.margin < 0 ? "border-red-200 bg-red-50 text-red-700" : p.margin < 15 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                        >
                          {p.margin}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bottomProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Belum ada data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branch Comparison (only when no branch filter) */}
      {!selectedBranchId && branchData.length > 0 && (
        <Card className="rounded-2xl shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Perbandingan Profit Antar Cabang
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Cabang</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                    <TableHead className="text-xs text-right">HPP</TableHead>
                    <TableHead className="text-xs text-right">Gross Profit</TableHead>
                    <TableHead className="text-xs text-right">Gross Margin</TableHead>
                    <TableHead className="text-xs text-right">Expenses</TableHead>
                    <TableHead className="text-xs text-right">Net Profit</TableHead>
                    <TableHead className="text-xs text-right">Net Margin</TableHead>
                    <TableHead className="text-xs text-right">Kontribusi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchData.map((b) => (
                    <TableRow key={b.branchId}>
                      <TableCell className="text-sm font-medium">{b.branchName}</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(b.revenue)}</TableCell>
                      <TableCell className="text-sm text-right text-orange-600">{formatCurrency(b.cost)}</TableCell>
                      <TableCell className={`text-sm text-right font-semibold ${b.grossProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {formatCurrency(b.grossProfit)}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        <Badge variant="outline" className="text-[11px]">{b.grossMargin}%</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-right text-red-500">{formatCurrency(b.expenses)}</TableCell>
                      <TableCell className={`text-sm text-right font-bold ${b.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {formatCurrency(b.netProfit)}
                      </TableCell>
                      <TableCell className="text-sm text-right">
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${b.netMargin >= 20 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : b.netMargin >= 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"}`}
                        >
                          {b.netMargin}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-right text-muted-foreground">{b.contribution}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------- KPI Card ---------- */

interface KPICardProps {
  title: string;
  value: number;
  growth: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "orange" | "red";
  subtitle?: string;
  invertGrowth?: boolean;
  highlight?: boolean;
}

const COLOR_MAP = {
  blue: { bg: "bg-blue-50", text: "text-blue-600", icon: "bg-blue-100 text-blue-600" },
  green: { bg: "bg-emerald-50", text: "text-emerald-600", icon: "bg-emerald-100 text-emerald-600" },
  orange: { bg: "bg-orange-50", text: "text-orange-600", icon: "bg-orange-100 text-orange-600" },
  red: { bg: "bg-red-50", text: "text-red-600", icon: "bg-red-100 text-red-600" },
};

function KPICard({ title, value, growth, icon, color, subtitle, invertGrowth, highlight }: KPICardProps) {
  const c = COLOR_MAP[color];
  const displayGrowth = invertGrowth ? -growth : growth;

  return (
    <Card className={`rounded-2xl shadow-sm border ${highlight ? "ring-2 ring-emerald-200 border-emerald-100" : ""}`}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.icon}`}>
            {icon}
          </div>
          <GrowthIndicator value={displayGrowth} />
        </div>
        <div className={`text-xl font-bold tracking-tight ${value < 0 ? "text-red-600" : ""}`}>
          {formatCurrency(value)}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">{title}</span>
          {subtitle && (
            <span className={`text-[11px] font-medium ${c.text}`}>{subtitle}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
