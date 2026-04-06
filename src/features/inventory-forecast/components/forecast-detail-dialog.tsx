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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">{product.productName}</p>
              <p className="text-sm text-slate-400 font-normal">{product.productCode}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Info row */}
          <div className="flex flex-wrap items-center gap-2">
            <TrendBadge />
            <Badge variant="outline" className={riskColors[product.riskLevel]}>
              {riskLabels[product.riskLevel]}
            </Badge>
            <Badge variant="outline" className="text-slate-600">{product.categoryName}</Badge>
            {product.supplierName && (
              <Badge variant="outline" className="text-slate-600">{product.supplierName}</Badge>
            )}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Stok Saat Ini", value: `${product.currentStock} unit`, icon: Package, color: "text-violet-600 bg-violet-50" },
              { label: "Rata-rata/Hari", value: `${product.avgDailySales} unit`, icon: Calendar, color: "text-blue-600 bg-blue-50" },
              { label: "Penjualan Puncak", value: `${peak} unit`, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
              { label: "Penjualan Minimum", value: `${minDay} unit`, icon: TrendingDown, color: "text-slate-600 bg-slate-50" },
            ].map(m => (
              <div key={m.label} className="rounded-xl border border-slate-100 p-3">
                <div className={`w-8 h-8 rounded-lg ${m.color} flex items-center justify-center mb-2`}>
                  <m.icon className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-500">{m.label}</p>
                <p className="text-sm font-semibold text-slate-800">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Sales Trend Chart */}
          <div className="rounded-xl border border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Tren Penjualan (30 Hari Terakhir)</h3>
            {isPending ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">Memuat data...</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={salesTrend} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={v => v.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="quantity" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-slate-400 mt-2 text-center">Total terjual: {totalSold} unit dalam 30 hari</p>
          </div>

          {/* Projected Stock Chart */}
          <div className="rounded-xl border border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Proyeksi Level Stok (30 Hari ke Depan)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={projectedStock} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.[0]) return null;
                    return (
                      <div className="rounded-xl border border-border/40 bg-white/95 backdrop-blur-sm px-4 py-2.5 shadow-xl">
                        <p className="text-xs text-slate-500 mb-1">{label}</p>
                        <p className="text-sm font-semibold">{payload[0].value} unit tersisa</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={product.minStock} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Min Stock", position: "right", fill: "#ef4444", fontSize: 10 }} />
                <Area type="monotone" dataKey="stock" stroke="#8b5cf6" strokeWidth={2} fill="url(#stockGrad)" />
              </AreaChart>
            </ResponsiveContainer>
            {product.daysUntilStockout < 9999 && (
              <div className="flex items-center gap-2 mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700">
                  Estimasi kehabisan stok dalam <strong>{product.daysUntilStockout} hari</strong>. Disarankan untuk memesan <strong>{product.recommendedReorderQty} unit</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Reorder Recommendation */}
          {product.recommendedReorderQty > 0 && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-4 h-4 text-violet-600" />
                <h3 className="text-sm font-semibold text-violet-700">Rekomendasi Pemesanan</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-violet-700">{product.recommendedReorderQty}</p>
                  <p className="text-xs text-violet-500">Unit direkomendasikan</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-violet-700">{formatCurrency(product.recommendedReorderQty * product.purchasePrice)}</p>
                  <p className="text-xs text-violet-500">Estimasi biaya</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-violet-700">{Math.ceil(product.recommendedReorderQty / Math.max(product.avgDailySales, 0.1))}</p>
                  <p className="text-xs text-violet-500">Hari tercukupi</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
