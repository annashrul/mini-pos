"use client";

import { useState, useEffect, useCallback, useMemo, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import { useBranch } from "@/components/providers/branch-provider";
import {
  getInventoryForecast,
  getForecastSummary,
  type ForecastProduct,
  type ForecastSummary,
  type RiskLevel,
} from "@/server/actions/inventory-forecast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmartTable, type SmartColumn, type SmartFilter } from "@/components/ui/smart-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle,
  BarChart3,
  Package,
  ShieldAlert,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Minus,
  RefreshCw,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ForecastDetailDialog } from "./forecast-detail-dialog";
import { AutoReorderList } from "./auto-reorder-list";

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  CRITICAL: { label: "Kritis", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: ShieldAlert },
  WARNING: { label: "Peringatan", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: AlertTriangle },
  LOW: { label: "Risiko Rendah", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: Package },
  SAFE: { label: "Aman", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: BarChart3 },
};

const PIE_COLORS: Record<RiskLevel, string> = {
  CRITICAL: "#ef4444",
  WARNING: "#f59e0b",
  LOW: "#3b82f6",
  SAFE: "#10b981",
};

function RiskBadge({ level }: { level: RiskLevel }) {
  const cfg = RISK_CONFIG[level];
  return (
    <Badge variant="outline" className={`${cfg.bg} ${cfg.color} ${cfg.border} font-medium text-xs`}>
      {cfg.label}
    </Badge>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "INCREASING") return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (trend === "DECREASING") return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

function DaysLeftBar({ days }: { days: number }) {
  const maxDays = 30;
  const pct = Math.min(100, (days / maxDays) * 100);
  let barColor = "bg-emerald-500";
  if (days < 3) barColor = "bg-red-500";
  else if (days < 7) barColor = "bg-amber-500";
  else if (days < 14) barColor = "bg-blue-500";

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums text-slate-600 whitespace-nowrap">
        {days >= 9999 ? "N/A" : `${days} hari`}
      </span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieTooltipContent({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-xl border border-border/40 bg-white/95 backdrop-blur-sm px-4 py-2.5 shadow-xl">
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
        <span className="font-medium">{payload[0].name}</span>
        <span className="text-slate-500">{payload[0].value} produk</span>
      </div>
    </div>
  );
}

type TabView = "forecast" | "reorder";

const forecastColumns: SmartColumn<ForecastProduct>[] = [
  {
    key: "name",
    header: "Produk",
    sortable: true,
    render: (p) => (
      <div>
        <p className="font-medium text-sm text-slate-800">{p.productName}</p>
        <p className="text-xs text-slate-400">{p.productCode}</p>
      </div>
    ),
    exportValue: (p) => p.productName,
  },
  {
    key: "category",
    header: "Kategori",
    render: (p) => <span className="text-sm text-slate-600">{p.categoryName}</span>,
    exportValue: (p) => p.categoryName,
  },
  {
    key: "stock",
    header: "Stok",
    sortable: true,
    align: "right",
    render: (p) => (
      <span className={`text-sm font-medium tabular-nums ${p.currentStock <= p.minStock ? "text-red-600" : "text-slate-700"}`}>
        {p.currentStock}
      </span>
    ),
    exportValue: (p) => p.currentStock,
  },
  {
    key: "avgSales",
    header: "Rata-rata/Hari",
    sortable: true,
    align: "right",
    render: (p) => <span className="text-sm tabular-nums text-slate-700">{p.avgDailySales}</span>,
    exportValue: (p) => p.avgDailySales,
  },
  {
    key: "daysLeft",
    header: "Sisa Hari",
    sortable: true,
    render: (p) => <DaysLeftBar days={p.daysUntilStockout} />,
    exportValue: (p) => p.daysUntilStockout >= 9999 ? "N/A" : p.daysUntilStockout,
  },
  {
    key: "trend",
    header: "Tren",
    render: (p) => <TrendIcon trend={p.trend} />,
    exportValue: (p) => p.trend,
  },
  {
    key: "riskLevel",
    header: "Risiko",
    render: (p) => <RiskBadge level={p.riskLevel} />,
    exportValue: (p) => RISK_CONFIG[p.riskLevel].label,
  },
  {
    key: "supplier",
    header: "Supplier",
    render: (p) => <span className="text-sm text-slate-600">{p.supplierName || "-"}</span>,
    exportValue: (p) => p.supplierName || "-",
  },
  {
    key: "reorderQty",
    header: "Reorder Qty",
    align: "right",
    render: (p) =>
      p.recommendedReorderQty > 0 ? (
        <span className="text-sm font-semibold text-violet-700 tabular-nums">{p.recommendedReorderQty}</span>
      ) : (
        <span className="text-xs text-slate-400">-</span>
      ),
    exportValue: (p) => p.recommendedReorderQty,
  },
];

const riskFilterOptions: SmartFilter[] = [
  {
    key: "riskLevel",
    label: "Risiko",
    type: "select",
    options: [
      { value: "CRITICAL", label: "Kritis" },
      { value: "WARNING", label: "Peringatan" },
      { value: "LOW", label: "Risiko Rendah" },
      { value: "SAFE", label: "Aman" },
    ],
  },
];

export function InventoryForecastContent() {
  const { selectedBranchId } = useBranch();
  const [isPending, startTransition] = useTransition();

  const [allProducts, setAllProducts] = useState<ForecastProduct[]>([]);
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<string>("daysLeft");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<ForecastProduct | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>("forecast");

  const effectiveRiskFilter = activeFilters.riskLevel
    ? (activeFilters.riskLevel as RiskLevel)
    : riskFilter === "ALL"
      ? undefined
      : riskFilter;

  const loadData = useCallback(() => {
    startTransition(async () => {
      const branchId = selectedBranchId || undefined;
      const [forecastData, summaryData] = await Promise.all([
        getInventoryForecast({
          branchId,
          riskLevel: effectiveRiskFilter,
          search: search || undefined,
          sortBy: sortBy as "daysLeft" | "avgSales" | "stock" | "name",
          sortDir,
        }),
        getForecastSummary(branchId),
      ]);
      setAllProducts(forecastData);
      setSummary(summaryData);
    });
  }, [selectedBranchId, effectiveRiskFilter, search, sortBy, sortDir]);

  useEffect(() => { loadData(); }, [loadData]);

  // Client-side pagination
  const totalItems = allProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allProducts.slice(start, start + pageSize);
  }, [allProducts, currentPage, pageSize]);

  // Reset page when data changes
  useEffect(() => { setCurrentPage(1); }, [effectiveRiskFilter, search, sortBy, sortDir]);

  const pieData = summary ? [
    { name: "Kritis", value: summary.criticalCount, fill: PIE_COLORS.CRITICAL },
    { name: "Peringatan", value: summary.warningCount, fill: PIE_COLORS.WARNING },
    { name: "Risiko Rendah", value: summary.lowCount, fill: PIE_COLORS.LOW },
    { name: "Aman", value: summary.safeCount, fill: PIE_COLORS.SAFE },
  ].filter(d => d.value > 0) : [];

  const handleFilterChange = (filters: Record<string, string>) => {
    setActiveFilters(filters);
    if (filters.riskLevel) {
      setRiskFilter(filters.riskLevel as RiskLevel);
    } else {
      setRiskFilter("ALL");
    }
  };

  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
            <BarChart3 className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-800">Prediksi Inventaris</h1>
            <p className="text-xs sm:text-sm text-slate-500">Analisis stok dan prediksi kehabisan barang</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isPending}
          className="w-full sm:w-auto text-xs sm:text-sm gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-6 sm:grid-cols-5 gap-1.5 sm:gap-3">
          {([
            { count: summary.criticalCount, label: "Kritis", sublabel: "<3 hari", gradient: "from-red-500 to-rose-600", bg: "bg-red-50", text: "text-red-700" },
            { count: summary.warningCount, label: "Waspada", sublabel: "<7 hari", gradient: "from-amber-500 to-orange-500", bg: "bg-amber-50", text: "text-amber-700" },
          ]).map((card, i) => (
            <Card key={i} className="col-span-3 sm:col-span-1 py-0 gap-0 rounded-xl sm:rounded-2xl border-0 shadow-sm">
              <CardContent className="p-2.5 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-sm shrink-0`}>
                  <span className="text-white font-bold text-xs sm:text-lg font-mono">{card.count}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-slate-800">{card.label}</p>
                  <p className="text-[9px] sm:text-[11px] text-slate-400">{card.sublabel}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {([
            { count: summary.lowCount, label: "Rendah", gradient: "from-blue-500 to-indigo-500" },
            { count: summary.safeCount, label: "Aman", gradient: "from-emerald-500 to-green-600" },
            { count: summary.productsNeedingReorder, label: "Reorder", gradient: "from-slate-500 to-slate-700", isReorder: true },
          ]).map((card, i) => (
            <Card key={i} className="col-span-2 sm:col-span-1 py-0 gap-0 rounded-xl sm:rounded-2xl border-0 shadow-sm">
              <CardContent className="p-2.5 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-sm shrink-0`}>
                  {card.isReorder
                    ? <ShoppingCart className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" />
                    : <span className="text-white font-bold text-xs sm:text-lg font-mono">{card.count}</span>
                  }
                </div>
                <div className="min-w-0">
                  {card.isReorder && <p className="text-xs sm:text-lg font-bold text-slate-800 font-mono tabular-nums">{card.count}</p>}
                  <p className="text-[10px] sm:text-xs text-slate-500 font-medium">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Risk Chart + Value at Risk */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4">
          <Card className="lg:col-span-1 py-0 gap-0 rounded-xl sm:rounded-2xl">
            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-base font-semibold text-slate-700">Distribusi Risiko</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value" stroke="none">
                      {pieData.map((entry, idx) => (<Cell key={idx} fill={entry.fill} />))}
                    </Pie>
                    <Tooltip content={<PieTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[150px] flex items-center justify-center text-xs text-slate-400">Tidak ada data</div>
              )}
              <div className="flex flex-wrap gap-2 sm:gap-3 mt-1.5 sm:mt-2 justify-center">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-600">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2 py-0 gap-0 rounded-xl sm:rounded-2xl">
            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-base font-semibold text-slate-700">Ringkasan Risiko</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 space-y-2 sm:space-y-4">
              <div className="grid grid-cols-2 gap-1.5 sm:gap-4">
                <div className="rounded-lg sm:rounded-xl bg-red-50 border border-red-100 p-2.5 sm:p-4">
                  <p className="text-[10px] sm:text-xs text-red-600 font-medium mb-0.5 sm:mb-1">Stok Berisiko</p>
                  <p className="text-sm sm:text-xl font-bold text-red-700">{formatCurrency(summary.totalStockValueAtRisk)}</p>
                </div>
                <div className="rounded-lg sm:rounded-xl bg-violet-50 border border-violet-100 p-2.5 sm:p-4">
                  <p className="text-[10px] sm:text-xs text-violet-600 font-medium mb-0.5 sm:mb-1">Dipantau</p>
                  <p className="text-sm sm:text-xl font-bold text-violet-700">{summary.totalProducts}</p>
                </div>
              </div>
              <div className="rounded-lg sm:rounded-xl bg-slate-50 border border-slate-100 p-2.5 sm:p-4 space-y-1 sm:space-y-1.5">
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Aksi</p>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 shrink-0" />
                  <span className="text-[11px] sm:text-sm text-slate-700 font-medium">{summary.criticalCount} kritis</span>
                  <span className="text-[10px] sm:text-sm text-slate-400">→ segera order</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-[11px] sm:text-sm text-slate-700 font-medium">{summary.warningCount} waspada</span>
                  <span className="text-[10px] sm:text-sm text-slate-400">→ rencanakan</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabView)} className="space-y-4 sm:space-y-5">
        <div className="flex justify-end">
          <TabsList className="!h-auto bg-slate-100/80 rounded-xl p-1 gap-0.5">
            <TabsTrigger value="forecast" className="rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Prediksi
            </TabsTrigger>
            <TabsTrigger value="reorder" className="rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Reorder
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="forecast" className="mt-0">
        <SmartTable<ForecastProduct>
          data={paginatedProducts}
          columns={forecastColumns}
          totalItems={totalItems}
          totalPages={totalPages}
          currentPage={currentPage}
          pageSize={pageSize}
          loading={isPending}
          searchPlaceholder="Cari produk..."
          onSearch={setSearch}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          sortKey={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          filters={riskFilterOptions}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onRowClick={setSelectedProduct}
          planMenuKey="inventory-forecast" exportFilename="prediksi-stok"
          mobileRender={(row) => {
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{row.productName}</p>
                    <p className="text-[10px] text-muted-foreground">{row.categoryName}{row.supplierName ? ` • ${row.supplierName}` : ""}</p>
                  </div>
                  <RiskBadge level={row.riskLevel} />
                </div>
                <DaysLeftBar days={row.daysUntilStockout} />
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2.5">
                    <span className={row.currentStock <= row.minStock ? "text-red-600 font-semibold" : "text-muted-foreground"}>Stok: {row.currentStock}</span>
                    <span className="text-muted-foreground">{row.avgDailySales.toFixed(1)}/hari</span>
                    <TrendIcon trend={row.trend} />
                  </div>
                  {row.recommendedReorderQty > 0 && (
                    <span className="text-violet-600 font-medium">Reorder: {row.recommendedReorderQty}</span>
                  )}
                </div>
              </div>
            );
          }}
          emptyIcon={<Package className="w-10 h-10 text-slate-300" />}
          emptyTitle="Tidak ada produk ditemukan"
          emptyDescription="Coba ubah filter atau kata kunci pencarian"
          title="Prediksi Stok"
          titleIcon={<BarChart3 className="w-5 h-5 text-violet-600" />}
        />
        </TabsContent>

        <TabsContent value="reorder" className="mt-0">
          <AutoReorderList branchId={selectedBranchId || undefined} />
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <ForecastDetailDialog
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        branchId={selectedBranchId || undefined}
      />
    </div>
  );
}
