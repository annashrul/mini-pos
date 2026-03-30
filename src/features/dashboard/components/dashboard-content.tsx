"use client";

import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, ShoppingCart, Package, TrendingUp,
  AlertTriangle, Users, CreditCard, Clock, BarChart3, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { DashboardStats } from "@/types";

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash", TRANSFER: "Transfer", QRIS: "QRIS",
  EWALLET: "E-Wallet", DEBIT: "Debit", CREDIT_CARD: "Kartu Kredit",
};

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function GrowthBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${value > 0 ? "text-emerald-600" : "text-red-500"}`}>
      {value > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(value)}%
    </span>
  );
}

export function DashboardContent({ stats }: { stats: DashboardStats }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Ringkasan bisnis Anda hari ini</p>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <GrowthBadge value={stats.salesGrowthDay} />
            </div>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(stats.todaySales)}</p>
            <p className="text-xs text-muted-foreground mt-1">Penjualan Hari Ini</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-xs text-muted-foreground">Kemarin: {stats.todayTransactionCount}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{stats.todayTransactionCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Transaksi Hari Ini</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <GrowthBadge value={stats.salesGrowthMonth} />
            </div>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(stats.monthRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Pendapatan Bulan Ini</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <Package className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-xs text-muted-foreground">{stats.totalCustomers} customer</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{stats.totalProducts}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Produk Aktif</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== ROW 2: Monthly Comparison + Daily Sales ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Monthly Comparison Chart */}
        <Card className="lg:col-span-3 rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" /> Perbandingan Penjualan Bulanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Penjualan"]} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", fontSize: "12px" }} />
                <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {/* Month vs Month comparison */}
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/30">
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bulan Ini</p>
                <p className="text-lg font-bold tabular-nums">{formatCurrency(stats.monthRevenue)}</p>
                <p className="text-xs text-muted-foreground">{stats.monthTransactionCount} transaksi</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bulan Lalu</p>
                <p className="text-lg font-bold tabular-nums">{formatCurrency(stats.prevMonthRevenue)}</p>
                <p className="text-xs text-muted-foreground">{stats.prevMonthTransactionCount} transaksi</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Breakdown */}
        <Card className="lg:col-span-2 rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" /> Metode Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.paymentBreakdown.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={stats.paymentBreakdown} dataKey="total" nameKey="method" cx="50%" cy="50%" innerRadius={45} outerRadius={75} strokeWidth={2}>
                      {stats.paymentBreakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length] ?? "#3b82f6"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {stats.paymentBreakdown.map((p, i) => (
                    <div key={p.method} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{PAYMENT_LABELS[p.method] || p.method}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium tabular-nums">{formatCurrency(p.total)}</span>
                        <span className="text-muted-foreground text-xs ml-1">({p.count})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== ROW 3: Daily Trend + Hourly ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Trend (30 days) */}
        <Card className="rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tren Penjualan 30 Hari</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.dailySales}>
                <defs>
                  <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={4} />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Penjualan"]} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", fontSize: "12px" }} />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fill="url(#dailyGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hourly Sales Today */}
        <Card className="rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Penjualan Per Jam (Hari Ini)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.hourlySales.filter((h) => h.count > 0 || Number(h.hour.split(":")[0]) >= 6 && Number(h.hour.split(":")[0]) <= 22)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Penjualan"]} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", fontSize: "12px" }} />
                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ===== ROW 4: Top Products + Category Breakdown ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products */}
        <Card className="rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Produk Terlaris</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topProducts.map((product, i) => (
                <div key={product.productName} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.productName}</p>
                    <p className="text-xs text-muted-foreground">{product._sum.quantity} terjual</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(product._sum.subtotal || 0)}</p>
                </div>
              ))}
              {stats.topProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada data</p>}
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Penjualan per Kategori</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.categoryBreakdown.length > 0 ? (
              <div className="space-y-2.5">
                {stats.categoryBreakdown.slice(0, 8).map((cat, i) => {
                  const maxTotal = stats.categoryBreakdown[0]?.total || 1;
                  const percent = Math.round((cat.total / maxTotal) * 100);
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground truncate">{cat.name}</span>
                        <span className="font-medium tabular-nums ml-2">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada data</p>
            )}
          </CardContent>
        </Card>

        {/* Top Cashiers */}
        <Card className="rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" /> Performa Kasir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topCashiers.map((cashier, i) => (
                <div key={cashier.name} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${i === 0 ? "bg-yellow-50 text-yellow-600" : i === 1 ? "bg-slate-100 text-slate-500" : i === 2 ? "bg-orange-50 text-orange-500" : "bg-muted/50 text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cashier.name}</p>
                    <p className="text-xs text-muted-foreground">{cashier.count} transaksi</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(cashier.total)}</p>
                </div>
              ))}
              {stats.topCashiers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada data</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== ROW 5: Recent Transactions + Low Stock ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card className="rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Transaksi Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Invoice</TableHead>
                  <TableHead className="text-xs">Kasir</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{tx.invoiceNumber}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(tx.createdAt)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{tx.user.name}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-sm tabular-nums">{formatCurrency(tx.grandTotal)}</span>
                    </TableCell>
                  </TableRow>
                ))}
                {stats.recentTransactions.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Belum ada transaksi</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card className="rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Stok Menipis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Produk</TableHead>
                  <TableHead className="text-xs">Kategori</TableHead>
                  <TableHead className="text-xs text-right">Stok</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.lowStockProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium text-sm">{product.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{product.category.name}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={product.stock <= 3 ? "destructive" : "secondary"} className="rounded-lg tabular-nums">
                        {product.stock}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {stats.lowStockProducts.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Semua stok aman</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
