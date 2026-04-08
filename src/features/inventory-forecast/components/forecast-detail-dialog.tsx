"use client";

import { useEffect, useState, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  getProductSalesTrend,
  type ForecastProduct,
  type DailySalesPoint,
} from "@/server/actions/inventory-forecast";
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Calendar,
  ShoppingCart,
  AlertTriangle,
} from "lucide-react";

interface Props {
  product: ForecastProduct | null;
  onClose: () => void;
  branchId?: string | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-xl border border-border/40 bg-white/95 backdrop-blur-sm px-4 py-2.5 shadow-xl">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-semibold">{payload[0].value} unit terjual</p>
    </div>
  );
}

export function ForecastDetailDialog({ product, onClose, branchId }: Props) {
  const [salesTrend, setSalesTrend] = useState<DailySalesPoint[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!product) return;
    startTransition(async () => {
      const data = await getProductSalesTrend(product.productId, 30, branchId);
      setSalesTrend(data);
    });
  }, [product, branchId]);

  if (!product) return null;

  const peak = salesTrend.length > 0 ? Math.max(...salesTrend.map(d => d.quantity)) : 0;
  const minDay = salesTrend.length > 0 ? Math.min(...salesTrend.map(d => d.quantity)) : 0;
  const totalSold = salesTrend.reduce((s, d) => s + d.quantity, 0);

  // Build projected stock data for next 30 days
  const projectedStock = [];
  let remainingStock = product.currentStock;
  for (let i = 0; i <= 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    projectedStock.push({
      date: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      stock: Math.max(0, Math.round(remainingStock)),
      minStock: product.minStock,
    });
    remainingStock -= product.avgDailySales;
  }

  const TrendBadge = () => {
    if (product.trend === "INCREASING") return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
        <TrendingUp className="w-3 h-3" /> Meningkat
      </Badge>
    );
    if (product.trend === "DECREASING") return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
        <TrendingDown className="w-3 h-3" /> Menurun
      </Badge>
    );
    return (
      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 gap-1">
        <Minus className="w-3 h-3" /> Stabil
      </Badge>
    );
  };

  const riskColors: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-700 border-red-200",
    WARNING: "bg-amber-100 text-amber-700 border-amber-200",
    LOW: "bg-blue-100 text-blue-700 border-blue-200",
    SAFE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };

  const riskLabels: Record<string, string> = {
    CRITICAL: "Kritis",
    WARNING: "Peringatan",
    LOW: "Risiko Rendah",
    SAFE: "Aman",
  };

  return (
    <Dialog open={!!product} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl sm:rounded-2xl p-0 gap-0">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600 shrink-0" />
        <DialogHeader className="px-4 sm:px-6 pt-3 sm:pt-5 pb-2 sm:pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm sm:text-lg font-bold text-slate-800 truncate">{product.productName}</p>
              <p className="text-[10px] sm:text-sm text-slate-400 font-normal">{product.productCode}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="px-4 sm:px-6 space-y-3 sm:space-y-5">
          {/* Info badges */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <TrendBadge />
            <Badge variant="outline" className={`text-[10px] sm:text-xs ${riskColors[product.riskLevel]}`}>
              {riskLabels[product.riskLevel]}
            </Badge>
            <Badge variant="outline" className="text-[10px] sm:text-xs text-slate-600">{product.categoryName}</Badge>
            {product.supplierName && (
              <Badge variant="outline" className="text-[10px] sm:text-xs text-slate-600">{product.supplierName}</Badge>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
            {[
              { label: "Stok", value: product.currentStock, icon: Package, color: "text-violet-600 bg-violet-50" },
              { label: "Avg/Hari", value: product.avgDailySales, icon: Calendar, color: "text-blue-600 bg-blue-50" },
              { label: "Puncak", value: peak, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
              { label: "Min", value: minDay, icon: TrendingDown, color: "text-slate-600 bg-slate-50" },
            ].map(m => (
              <div key={m.label} className="rounded-lg sm:rounded-xl border border-slate-100 p-2 sm:p-3 text-center">
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg ${m.color} flex items-center justify-center mx-auto mb-1 sm:mb-2`}>
                  <m.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">{m.value}</p>
                <p className="text-[8px] sm:text-xs text-slate-400">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Sales Trend Chart */}
          <div className="rounded-lg sm:rounded-xl border border-slate-100 p-2 sm:p-4">
            <h3 className="text-[10px] sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">Tren Penjualan (30 Hari)</h3>
            {isPending ? (
              <div className="h-[140px] sm:h-[200px] flex items-center justify-center text-xs text-slate-400">Memuat...</div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={salesTrend} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals={false} width={25} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="quantity" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1 text-center">Total: {totalSold} unit</p>
          </div>

          {/* Projected Stock Chart */}
          <div className="rounded-lg sm:rounded-xl border border-slate-100 p-2 sm:p-4">
            <h3 className="text-[10px] sm:text-sm font-semibold text-slate-700 mb-2 sm:mb-3">Proyeksi Stok (30 Hari)</h3>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={projectedStock} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals={false} width={25} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.[0]) return null;
                    return (
                      <div className="rounded-lg border bg-white/95 backdrop-blur-sm px-3 py-2 shadow-xl">
                        <p className="text-[10px] text-slate-500">{label}</p>
                        <p className="text-xs font-semibold">{payload[0].value} unit</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={product.minStock} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Min", position: "right", fill: "#ef4444", fontSize: 9 }} />
                <Area type="monotone" dataKey="stock" stroke="#8b5cf6" strokeWidth={2} fill="url(#stockGrad)" />
              </AreaChart>
            </ResponsiveContainer>
            {product.daysUntilStockout < 9999 && (
              <div className="flex items-center gap-1.5 sm:gap-2 mt-2 sm:mt-3 p-2 sm:p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 shrink-0" />
                <p className="text-[10px] sm:text-xs text-amber-700">
                  Habis dalam <strong>{product.daysUntilStockout}d</strong>. Reorder: <strong>{product.recommendedReorderQty} unit</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Reorder Recommendation */}
          {product.recommendedReorderQty > 0 && (
            <div className="rounded-lg sm:rounded-xl border border-violet-100 bg-violet-50/50 p-2.5 sm:p-4">
              <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600" />
                <h3 className="text-[10px] sm:text-sm font-semibold text-violet-700">Rekomendasi</h3>
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-4 text-center">
                <div>
                  <p className="text-sm sm:text-xl font-bold text-violet-700 font-mono tabular-nums">{product.recommendedReorderQty}</p>
                  <p className="text-[8px] sm:text-xs text-violet-500">Unit</p>
                </div>
                <div>
                  <p className="text-sm sm:text-xl font-bold text-violet-700 font-mono tabular-nums">{formatCurrency(product.recommendedReorderQty * product.purchasePrice)}</p>
                  <p className="text-[8px] sm:text-xs text-violet-500">Biaya</p>
                </div>
                <div>
                  <p className="text-sm sm:text-xl font-bold text-violet-700 font-mono tabular-nums">{Math.ceil(product.recommendedReorderQty / Math.max(product.avgDailySales, 0.1))}</p>
                  <p className="text-[8px] sm:text-xs text-violet-500">Hari</p>
                </div>
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
