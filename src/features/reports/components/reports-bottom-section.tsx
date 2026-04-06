"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Download, ReceiptText, ShoppingCart, Package } from "lucide-react";
import { exportToCSV } from "@/lib/export";
import { chartTooltipStyle, chartAxisStyle, PAYMENT_METHOD_LABELS } from "../utils";
import type { PaymentMethodReport, HourlySalesReport, TopProduct, ReportOverviewData } from "../types";

interface ReportsBottomSectionProps {
  paymentMethods: PaymentMethodReport[];
  hourlySales: HourlySalesReport[];
  topProducts: TopProduct[];
  overview: ReportOverviewData;
}

export function ReportsBottomSection({ paymentMethods, hourlySales, topProducts, overview }: ReportsBottomSectionProps) {
  const handleExportTopProducts = () => {
    exportToCSV(
      topProducts.map((p, i) => ({ No: i + 1, Produk: p.productName, Kode: p.productCode, QtyTerjual: p._sum.quantity || 0, TotalPenjualan: p._sum.subtotal || 0 })),
      "produk-terlaris"
    );
  };

  return (
    <>
      {/* Payment Methods & Hourly Sales */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
          <CardHeader className="pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Metode Pembayaran</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Distribusi berdasarkan metode</p>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paymentMethods} barSize={36}>
                <defs>
                  <linearGradient id="paymentBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="method"
                  tickFormatter={(value) => PAYMENT_METHOD_LABELS[value] ?? value}
                  tick={chartAxisStyle}
                  stroke="transparent"
                  tickLine={false}
                />
                <YAxis tick={chartAxisStyle} stroke="transparent" tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value, name) => [formatCurrency(Number(value)), name === "total" ? "Total Penjualan" : "Nilai"]}
                  labelFormatter={(value) => PAYMENT_METHOD_LABELS[value] ?? value}
                  contentStyle={chartTooltipStyle}
                  cursor={{ fill: "rgba(16, 185, 129, 0.04)" }}
                />
                <Bar dataKey="total" fill="url(#paymentBarGradient)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
          <CardHeader className="pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Jam Penjualan</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Distribusi transaksi per jam</p>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={hourlySales}>
                <defs>
                  <linearGradient id="hourlyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="hour" tick={chartAxisStyle} stroke="transparent" tickLine={false} />
                <YAxis tick={chartAxisStyle} stroke="transparent" tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value, name) => [name === "total" ? formatCurrency(Number(value)) : Number(value), name === "total" ? "Total Penjualan" : "Jumlah Transaksi"]}
                  contentStyle={chartTooltipStyle}
                  cursor={{ stroke: "#8b5cf6", strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                <Area
                  type="monotone"
                  dataKey="transactions"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  fill="url(#hourlyGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cashier Performance & Category Sales */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Top Kasir</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Performa kasir terbaik</p>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kasir</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Transaksi</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.topCashiers.map((cashier, index) => (
                  <TableRow key={cashier.userId} className="border-border/20 hover:bg-slate-50/50">
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 flex items-center justify-center text-xs font-bold text-violet-600">
                          {index + 1}
                        </div>
                        <span className="font-medium text-sm">{cashier.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-3.5">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                        {cashier.transactions}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-3.5 font-semibold text-sm">
                      {formatCurrency(cashier.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
                {overview.topCashiers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                          <ReceiptText className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-400 font-medium">Belum ada data kasir</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
          <CardHeader className="pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Penjualan per Kategori</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Breakdown berdasarkan kategori produk</p>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overview.categorySales} barSize={36}>
                <defs>
                  <linearGradient id="categoryBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="category" tick={chartAxisStyle} stroke="transparent" tickLine={false} />
                <YAxis tick={chartAxisStyle} stroke="transparent" tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value, name) => [name === "total" ? formatCurrency(Number(value)) : Number(value), name === "total" ? "Penjualan" : "Qty"]}
                  contentStyle={chartTooltipStyle}
                  cursor={{ fill: "rgba(245, 158, 11, 0.04)" }}
                />
                <Bar dataKey="total" fill="url(#categoryBarGradient)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card className="rounded-2xl shadow-sm border border-border/30 bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <ShoppingCart className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Produk Terlaris</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Top 10 produk berdasarkan quantity terjual</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl text-xs h-8 hover:bg-slate-100"
              onClick={handleExportTopProducts}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-14 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rank</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produk</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kode</TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Qty Terjual</TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Penjualan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topProducts.map((product, i) => (
                <TableRow key={product.productCode} className="border-border/20 hover:bg-slate-50/50">
                  <TableCell className="py-3.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${i === 0
                      ? "bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700"
                      : i === 1
                        ? "bg-gradient-to-br from-slate-200 to-slate-100 text-slate-600"
                        : i === 2
                          ? "bg-gradient-to-br from-orange-100 to-orange-50 text-orange-700"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                      {i + 1}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm py-3.5">{product.productName}</TableCell>
                  <TableCell className="py-3.5">
                    <code className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md font-mono">
                      {product.productCode}
                    </code>
                  </TableCell>
                  <TableCell className="text-right py-3.5">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 bg-emerald-50 rounded-lg text-xs font-semibold text-emerald-700">
                      {product._sum.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-3.5 font-semibold text-sm">
                    {formatCurrency(product._sum.subtotal || 0)}
                  </TableCell>
                </TableRow>
              ))}
              {topProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <Package className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 font-medium">Belum ada data</p>
                        <p className="text-xs text-slate-400 mt-0.5">Data produk terlaris akan muncul di sini</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
