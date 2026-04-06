"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, TrendingUp, Layers } from "lucide-react";
import { chartTooltipStyle, chartAxisStyle } from "../utils";
import type { CategorySalesReport } from "../types";

interface ReportsCategoryTabProps {
  categorySales: CategorySalesReport[];
}

export function ReportsCategoryTab({ categorySales }: ReportsCategoryTabProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
        <Card className="rounded-xl sm:rounded-2xl shadow-sm border-0 bg-gradient-to-br from-amber-50 to-amber-50/30">
          <CardContent className="p-2.5 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <Layers className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-[11px] font-semibold text-amber-600/70 bg-amber-100/80 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                Kategori
              </span>
            </div>
            <p className="text-sm sm:text-xl font-extrabold text-amber-900 tracking-tight">
              {categorySales.length}
            </p>
            <p className="text-xs text-amber-600/60 mt-2 font-medium">Total kategori aktif</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl sm:rounded-2xl shadow-sm border-0 bg-gradient-to-br from-blue-50 to-blue-50/30">
          <CardContent className="p-2.5 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-100 rounded-xl">
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-[11px] font-semibold text-blue-600/70 bg-blue-100/80 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                Revenue
              </span>
            </div>
            <p className="text-sm sm:text-xl font-extrabold text-blue-900 tracking-tight">
              {formatCurrency(categorySales.reduce((s, c) => s + c.totalRevenue, 0))}
            </p>
            <p className="text-xs text-blue-600/60 mt-2 font-medium">Total pendapatan semua kategori</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl sm:rounded-2xl shadow-sm border-0 bg-gradient-to-br from-emerald-50 to-emerald-50/30 col-span-2 sm:col-span-1">
          <CardContent className="p-2.5 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-emerald-100 rounded-xl">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-[11px] font-semibold text-emerald-600/70 bg-emerald-100/80 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                Rata-rata
              </span>
            </div>
            <p className="text-sm sm:text-xl font-extrabold text-emerald-900 tracking-tight">
              {formatCurrency(categorySales.length > 0 ? categorySales.reduce((s, c) => s + c.totalRevenue, 0) / categorySales.length : 0)}
            </p>
            <p className="text-xs text-emerald-600/60 mt-2 font-medium">Revenue rata-rata per kategori</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Bar Chart - Top 10 */}
      <Card className="rounded-xl sm:rounded-2xl shadow-sm border border-border/30 bg-white">
        <CardHeader className="pb-2 p-3 sm:p-5">
          <div>
            <CardTitle className="text-sm sm:text-base font-semibold">Top 10 Kategori berdasarkan Revenue</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Perbandingan pendapatan antar kategori</p>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-4 px-3 sm:px-5">
          <ResponsiveContainer width="100%" height={180} className="sm:!h-[280px]">
            <BarChart data={categorySales.slice(0, 10)} layout="vertical" barSize={24}>
              <defs>
                <linearGradient id="catBarGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={chartAxisStyle} stroke="transparent" tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="categoryName" tick={chartAxisStyle} stroke="transparent" tickLine={false} width={120} />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                contentStyle={chartTooltipStyle}
                cursor={{ fill: "rgba(245, 158, 11, 0.04)" }}
              />
              <Bar dataKey="totalRevenue" fill="url(#catBarGradient)" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Cards */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 bg-amber-500 rounded-full" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Detail per Kategori</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
          {categorySales.map((cat) => {
            const profitMargin = cat.totalRevenue > 0 ? (cat.profit / cat.totalRevenue) * 100 : 0;
            return (
              <Card key={cat.categoryId} className="rounded-xl sm:rounded-2xl shadow-sm border border-border/30 bg-white hover:shadow-md transition-shadow duration-300">
                <CardContent className="p-3 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-bold text-foreground">{cat.categoryName}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.transactionCount} transaksi</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 bg-amber-50 rounded-lg text-xs font-semibold text-amber-700">
                      {cat.totalQuantity} item
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Revenue</p>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(cat.totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Modal</p>
                      <p className="text-sm font-bold text-rose-600">{formatCurrency(cat.totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Profit</p>
                      <p className={`text-sm font-bold ${cat.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(cat.profit)}</p>
                    </div>
                  </div>
                  {/* Profit margin bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-muted-foreground font-medium">Profit Margin</span>
                      <span className="text-[11px] font-semibold text-foreground">{profitMargin.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${profitMargin >= 30 ? "bg-emerald-500" : profitMargin >= 15 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${Math.min(Math.max(profitMargin, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                  {/* Top products */}
                  {cat.topProducts.length > 0 && (
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2">Top Produk</p>
                      <div className="space-y-1.5">
                        {cat.topProducts.map((prod, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 truncate mr-2">{prod.name}</span>
                            <span className="font-semibold text-slate-700 whitespace-nowrap">{formatCurrency(prod.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {categorySales.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <Layers className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Belum ada data kategori</p>
              <p className="text-xs text-slate-400 mt-0.5">Data penjualan per kategori akan muncul di sini</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
