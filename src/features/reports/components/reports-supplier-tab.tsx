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
import { DollarSign, TrendingUp, Truck } from "lucide-react";
import { chartTooltipStyle, chartAxisStyle } from "../utils";
import type { SupplierSalesReport } from "../types";

interface ReportsSupplierTabProps {
  supplierSales: SupplierSalesReport[];
}

export function ReportsSupplierTab({ supplierSales }: ReportsSupplierTabProps) {
  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl shadow-sm border-0 bg-gradient-to-br from-indigo-50 to-indigo-50/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-indigo-100 rounded-xl">
                <Truck className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="text-[11px] font-semibold text-indigo-600/70 bg-indigo-100/80 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                Supplier
              </span>
            </div>
            <p className="text-3xl font-extrabold text-indigo-900 tracking-tight">
              {supplierSales.length}
            </p>
            <p className="text-xs text-indigo-600/60 mt-2 font-medium">Total supplier aktif</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-0 bg-gradient-to-br from-blue-50 to-blue-50/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-100 rounded-xl">
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-[11px] font-semibold text-blue-600/70 bg-blue-100/80 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                Revenue
              </span>
            </div>
            <p className="text-3xl font-extrabold text-blue-900 tracking-tight">
              {formatCurrency(supplierSales.reduce((s, sup) => s + sup.totalRevenue, 0))}
            </p>
            <p className="text-xs text-blue-600/60 mt-2 font-medium">Total pendapatan semua supplier</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-0 bg-gradient-to-br from-emerald-50 to-emerald-50/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-emerald-100 rounded-xl">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-[11px] font-semibold text-emerald-600/70 bg-emerald-100/80 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                Rata-rata
              </span>
            </div>
            <p className="text-3xl font-extrabold text-emerald-900 tracking-tight">
              {formatCurrency(supplierSales.length > 0 ? supplierSales.reduce((s, sup) => s + sup.totalRevenue, 0) / supplierSales.length : 0)}
            </p>
            <p className="text-xs text-emerald-600/60 mt-2 font-medium">Revenue rata-rata per supplier</p>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Bar Chart - Top 10 */}
      <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
        <CardHeader className="pb-2">
          <div>
            <CardTitle className="text-base font-semibold">Top 10 Supplier berdasarkan Revenue</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Perbandingan pendapatan antar supplier</p>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={supplierSales.slice(0, 10)} layout="vertical" barSize={24}>
              <defs>
                <linearGradient id="supBarGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={chartAxisStyle} stroke="transparent" tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="supplierName" tick={chartAxisStyle} stroke="transparent" tickLine={false} width={120} />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                contentStyle={chartTooltipStyle}
                cursor={{ fill: "rgba(99, 102, 241, 0.04)" }}
              />
              <Bar dataKey="totalRevenue" fill="url(#supBarGradient)" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Supplier Cards */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 bg-indigo-500 rounded-full" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Detail per Supplier</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {supplierSales.map((sup) => {
            const profitMarginSup = sup.totalRevenue > 0 ? (sup.profit / sup.totalRevenue) * 100 : 0;
            return (
              <Card key={sup.supplierId || "__none__"} className="rounded-2xl shadow-sm border border-border/30 bg-white hover:shadow-md transition-shadow duration-300">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-bold text-foreground">{sup.supplierName}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{sup.productCount} produk</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 bg-indigo-50 rounded-lg text-xs font-semibold text-indigo-700">
                      {sup.totalQuantity} item
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Revenue</p>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(sup.totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Modal</p>
                      <p className="text-sm font-bold text-rose-600">{formatCurrency(sup.totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Profit</p>
                      <p className={`text-sm font-bold ${sup.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(sup.profit)}</p>
                    </div>
                  </div>
                  {/* Profit margin bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-muted-foreground font-medium">Profit Margin</span>
                      <span className="text-[11px] font-semibold text-foreground">{profitMarginSup.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${profitMarginSup >= 30 ? "bg-emerald-500" : profitMarginSup >= 15 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${Math.min(Math.max(profitMarginSup, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                  {/* Top products */}
                  {sup.topProducts.length > 0 && (
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2">Top Produk</p>
                      <div className="space-y-1.5">
                        {sup.topProducts.map((prod, idx) => (
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
          {supplierSales.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <Truck className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Belum ada data supplier</p>
              <p className="text-xs text-slate-400 mt-0.5">Data penjualan per supplier akan muncul di sini</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
