"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ReceiptText, Package, DollarSign, TrendingDown, TrendingUp, BarChart3 } from "lucide-react";
import type { ProfitLoss, ReportOverviewData } from "../types";

interface ReportsOverviewSectionProps {
  profitLoss: ProfitLoss;
  overview: ReportOverviewData;
}

export function ReportsOverviewSection({ profitLoss, overview }: ReportsOverviewSectionProps) {
  const marginPercent = profitLoss.revenue > 0
    ? ((profitLoss.grossProfit / profitLoss.revenue) * 100).toFixed(1)
    : "0.0";

  return (
    <>
      {/* P&L Summary - Row 1: Primary Metrics */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-1 bg-primary rounded-full" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Laba Rugi &mdash; {profitLoss.period}
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {/* Revenue */}
          <Card className="rounded-xl sm:rounded-2xl shadow-sm border-0 bg-gradient-to-br from-blue-50 to-blue-50/30 overflow-hidden relative group hover:shadow-md transition-shadow duration-300">
            <CardContent className="p-2.5 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-blue-100 rounded-xl">
                  <DollarSign className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <span className="text-[11px] font-semibold text-blue-600/70 bg-blue-100/80 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                  Revenue
                </span>
              </div>
              <p className="text-sm sm:text-xl font-extrabold text-blue-900 tracking-tight">
                {formatCurrency(profitLoss.revenue)}
              </p>
              <p className="text-xs text-blue-600/60 mt-2 font-medium">
                Total pendapatan periode ini
              </p>
            </CardContent>
          </Card>

          {/* Cost / COGS */}
          <Card className="rounded-xl sm:rounded-2xl shadow-sm border-0 bg-gradient-to-br from-rose-50 to-rose-50/30 overflow-hidden relative group hover:shadow-md transition-shadow duration-300">
            <CardContent className="p-2.5 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-rose-100 rounded-xl">
                  <TrendingDown className="w-4.5 h-4.5 text-rose-600" />
                </div>
                <span className="text-[11px] font-semibold text-rose-600/70 bg-rose-100/80 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                  COGS
                </span>
              </div>
              <p className="text-sm sm:text-xl font-extrabold text-rose-900 tracking-tight">
                {formatCurrency(profitLoss.cost)}
              </p>
              <p className="text-xs text-rose-600/60 mt-2 font-medium">
                Harga pokok penjualan
              </p>
            </CardContent>
          </Card>

          {/* Gross Profit */}
          <Card className="rounded-xl sm:rounded-2xl shadow-sm border-0 bg-gradient-to-br from-emerald-50 to-emerald-50/30 overflow-hidden relative group hover:shadow-md transition-shadow duration-300">
            <CardContent className="p-2.5 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-emerald-100 rounded-xl">
                  <TrendingUp className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <span className="text-[11px] font-semibold text-emerald-600/70 bg-emerald-100/80 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                  Gross Profit
                </span>
              </div>
              <p className="text-sm sm:text-xl font-extrabold text-emerald-900 tracking-tight">
                {formatCurrency(profitLoss.grossProfit)}
              </p>
              <p className="text-xs text-emerald-600/60 mt-2 font-medium">
                Margin {marginPercent}%
              </p>
            </CardContent>
          </Card>

          {/* Net Profit */}
          <Card className={`rounded-xl sm:rounded-2xl shadow-sm border-0 overflow-hidden relative group hover:shadow-md transition-shadow duration-300 ${profitLoss.netProfit >= 0
            ? "bg-gradient-to-br from-teal-50 to-teal-50/30"
            : "bg-gradient-to-br from-red-50 to-red-50/30"
            }`}>
            <CardContent className="p-2.5 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 rounded-xl ${profitLoss.netProfit >= 0 ? "bg-teal-100" : "bg-red-100"}`}>
                  <BarChart3 className={`w-4.5 h-4.5 ${profitLoss.netProfit >= 0 ? "text-teal-600" : "text-red-600"}`} />
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg uppercase tracking-wider ${profitLoss.netProfit >= 0
                  ? "text-teal-600/70 bg-teal-100/80"
                  : "text-red-600/70 bg-red-100/80"
                  }`}>
                  Net Profit
                </span>
              </div>
              <p className={`text-sm sm:text-xl font-extrabold tracking-tight ${profitLoss.netProfit >= 0 ? "text-teal-900" : "text-red-900"
                }`}>
                {formatCurrency(profitLoss.netProfit)}
              </p>
              <p className={`text-xs mt-2 font-medium ${profitLoss.netProfit >= 0 ? "text-teal-600/60" : "text-red-600/60"
                }`}>
                Setelah diskon & pajak
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Overview KPI Cards - Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="rounded-xl sm:rounded-2xl shadow-sm border border-border/30 bg-white hover:shadow-md transition-shadow duration-300">
          <CardContent className="p-2.5 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-violet-50 rounded-xl">
                <ReceiptText className="w-4 h-4 text-violet-600" />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-1">Jumlah Transaksi</p>
            <p className="text-sm sm:text-xl font-extrabold tracking-tight text-foreground">
              {overview.transactions.toLocaleString("id-ID")}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl sm:rounded-2xl shadow-sm border border-border/30 bg-white hover:shadow-md transition-shadow duration-300">
          <CardContent className="p-2.5 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-amber-50 rounded-xl">
                <Package className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-1">Item Terjual</p>
            <p className="text-sm sm:text-xl font-extrabold tracking-tight text-foreground">
              {overview.totalItemsSold.toLocaleString("id-ID")}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl sm:rounded-2xl shadow-sm border border-border/30 bg-white hover:shadow-md transition-shadow duration-300">
          <CardContent className="p-2.5 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-sky-50 rounded-xl">
                <DollarSign className="w-4 h-4 text-sky-600" />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-1">Rata-rata Transaksi</p>
            <p className="text-sm sm:text-xl font-extrabold tracking-tight text-foreground">
              {formatCurrency(overview.averageTicket)}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl sm:rounded-2xl shadow-sm border border-border/30 bg-white hover:shadow-md transition-shadow duration-300">
          <CardContent className="p-2.5 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-rose-50 rounded-xl">
                <TrendingDown className="w-4 h-4 text-rose-500" />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-1">Total Diskon</p>
            <p className="text-sm sm:text-xl font-extrabold tracking-tight text-rose-600">
              {formatCurrency(overview.totalDiscount)}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
