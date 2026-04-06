"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Download } from "lucide-react";
import { exportToCSV } from "@/lib/export";
import { chartTooltipStyle, chartAxisStyle } from "../utils";
import type { SalesData } from "../types";

interface ReportsSalesTabProps {
  dailySales: SalesData[];
  monthlySales: SalesData[];
  variant: "daily" | "monthly";
}

export function ReportsSalesTab({ dailySales, monthlySales, variant }: ReportsSalesTabProps) {
  const isDaily = variant === "daily";
  const data = isDaily ? dailySales : monthlySales;
  const title = isDaily ? "Grafik Penjualan Harian" : "Grafik Penjualan Bulanan";
  const subtitle = isDaily ? "Tren penjualan 30 hari terakhir" : "Tren penjualan 12 bulan terakhir";
  const gradientId = isDaily ? "dailySalesGradient" : "monthlySalesGradient";
  const color = isDaily ? "#6366f1" : "#0ea5e9";

  const handleExport = () => {
    if (isDaily) {
      exportToCSV(
        dailySales.map((d) => ({ Tanggal: d.label, Penjualan: d.sales, Transaksi: d.transactions, Diskon: d.discount, Pajak: d.tax })),
        "laporan-penjualan-harian"
      );
    } else {
      exportToCSV(
        monthlySales.map((d) => ({ Bulan: d.label, Penjualan: d.sales, Transaksi: d.transactions, Diskon: d.discount, Pajak: d.tax })),
        "laporan-penjualan-bulanan"
      );
    }
  };

  return (
    <Card className="rounded-xl sm:rounded-2xl shadow-sm border border-border/30 bg-white">
      <CardHeader className="pb-2 p-3 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm sm:text-base font-semibold">{title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-xl text-xs h-8 hover:bg-slate-100" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2 pb-4 px-3 sm:px-5">
        <ResponsiveContainer width="100%" height={180} className="sm:!h-[280px]">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.15} />
                <stop offset="100%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={chartAxisStyle} stroke="transparent" tickLine={false} />
            <YAxis tick={chartAxisStyle} stroke="transparent" tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value)), "Penjualan"]}
              contentStyle={chartTooltipStyle}
              cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={isDaily ? false : { r: 4, fill: color, strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: isDaily ? 5 : 6, fill: color, strokeWidth: 2, stroke: "#fff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
