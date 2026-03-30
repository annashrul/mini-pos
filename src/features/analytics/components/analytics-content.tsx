"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, PackageX, Snail, Clock, Shield, Users, Download,
  DollarSign, Timer, Truck, Megaphone, ShoppingCart, AlertTriangle,
} from "lucide-react";
import { exportToCSV } from "@/lib/export";

interface Props {
  marginData: {
    id: string; name: string; code: string;
    purchasePrice: number; sellingPrice: number; stock: number;
    category: { name: string };
    margin: number; marginPercent: number;
  }[];
  categoryMargins: {
    name: string; productCount: number;
    avgCost: number; avgSell: number; avgMargin: number; avgMarginPercent: number; totalStock: number;
  }[];
  deadStock: {
    id: string; name: string; code: string; stock: number; sellingPrice: number;
    category: { name: string }; stockValue: number;
  }[];
  slowMoving: {
    id: string; name: string; code: string; stock: number;
    category: { name: string }; soldQty: number;
  }[];
  peakHours: { hour: string; transactions: number; revenue: number }[];
  voidAbuse: { userName: string; role: string; voidCount: number; suspicious: boolean }[];
  cashierPerf: { name: string; transactions: number; revenue: number; avgTransaction: number }[];
  dailyProfit: { date: string; revenue: number; cost: number; profit: number }[];
  shiftProfit: { shiftId: string; cashier: string; openedAt: string; closedAt: string; revenue: number; transactions: number }[];
  supplierRanking: { name: string; productCount: number; totalPOValue: number; poCount: number }[];
  supplierDebt: { supplierName: string; totalPO: number; totalPaid: number; debt: number }[];
  unusualDiscounts: { invoiceNumber: string; cashier: string; role: string; subtotal: number; discountAmount: number; discountPercent: number; grandTotal: number; createdAt: string }[];
  promoEffectiveness: { promoName: string; type: string; usageCount: number; totalDiscount: number; isActive: boolean }[];
  reorderRecommendations: { product: string; code: string; currentStock: number; minStock: number; avgDailySales: number; daysUntilOut: number; recommendedQty: number; supplier: string }[];
}

export function AnalyticsContent({
  marginData, categoryMargins, deadStock, slowMoving, peakHours, voidAbuse, cashierPerf,
  dailyProfit, shiftProfit, supplierRanking, supplierDebt, unusualDiscounts, promoEffectiveness, reorderRecommendations,
}: Props) {
  const negativeMargins = marginData.filter((p) => p.margin <= 0);
  const deadStockValue = deadStock.reduce((sum, p) => sum + p.stockValue, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Business Intelligence</h1>
          <p className="text-slate-500 text-sm">Analisis profit, stok, dan performa</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Margin Negatif</p>
            <p className="text-2xl font-bold text-red-600">{negativeMargins.length} produk</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Dead Stock (30 hari)</p>
            <p className="text-2xl font-bold text-orange-600">{deadStock.length} produk</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Nilai Dead Stock</p>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(deadStockValue)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Slow Moving</p>
            <p className="text-2xl font-bold text-yellow-600">{slowMoving.length} produk</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="margin" className="space-y-4">
        <TabsList className="rounded-xl flex-wrap">
          <TabsTrigger value="margin" className="rounded-lg">Margin Produk</TabsTrigger>
          <TabsTrigger value="category" className="rounded-lg">Margin Kategori</TabsTrigger>
          <TabsTrigger value="deadstock" className="rounded-lg">Dead Stock</TabsTrigger>
          <TabsTrigger value="slowmoving" className="rounded-lg">Slow Moving</TabsTrigger>
          <TabsTrigger value="peakhours" className="rounded-lg">Jam Ramai</TabsTrigger>
          <TabsTrigger value="fraud" className="rounded-lg">Fraud</TabsTrigger>
          <TabsTrigger value="cashier" className="rounded-lg">Kasir</TabsTrigger>
          <TabsTrigger value="dailyprofit" className="rounded-lg">Laba Harian</TabsTrigger>
          <TabsTrigger value="shiftprofit" className="rounded-lg">Laba per Shift</TabsTrigger>
          <TabsTrigger value="supplierintel" className="rounded-lg">Supplier Intel</TabsTrigger>
          <TabsTrigger value="promo" className="rounded-lg">Promo Report</TabsTrigger>
          <TabsTrigger value="reorder" className="rounded-lg">Smart Reorder</TabsTrigger>
          <TabsTrigger value="unusualdiscount" className="rounded-lg">Diskon Unusual</TabsTrigger>
        </TabsList>

        {/* Margin per Product */}
        <TabsContent value="margin">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="w-5 h-5" /> Margin Analyzer per Produk
                </CardTitle>
                <Button variant="ghost" size="sm" className="rounded-lg" onClick={() =>
                  exportToCSV(marginData.map((p) => ({
                    Kode: p.code, Produk: p.name, Kategori: p.category.name,
                    HargaBeli: p.purchasePrice, HargaJual: p.sellingPrice,
                    Margin: p.margin, MarginPersen: p.marginPercent.toFixed(1) + "%",
                  })), "margin-analysis")
                }>
                  <Download className="w-4 h-4 mr-1" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Harga Beli</TableHead>
                    <TableHead className="text-right">Harga Jual</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marginData.slice(0, 30).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{p.category.name}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(p.purchasePrice)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(p.sellingPrice)}</TableCell>
                      <TableCell className="text-right">
                        <span className={p.margin > 0 ? "text-green-600" : "text-red-600 font-bold"}>
                          {formatCurrency(p.margin)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={p.marginPercent > 20 ? "bg-green-100 text-green-700" : p.marginPercent > 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                          {p.marginPercent.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Margin per Category */}
        <TabsContent value="category">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="text-lg">Margin Analyzer per Kategori</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-center">Produk</TableHead>
                    <TableHead className="text-right">Avg Beli</TableHead>
                    <TableHead className="text-right">Avg Jual</TableHead>
                    <TableHead className="text-right">Avg Margin</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                    <TableHead className="text-right">Total Stok</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryMargins.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-center">{c.productCount}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(c.avgCost)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(c.avgSell)}</TableCell>
                      <TableCell className="text-right text-sm text-green-600">{formatCurrency(c.avgMargin)}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={c.avgMarginPercent > 20 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                          {c.avgMarginPercent.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{c.totalStock}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dead Stock */}
        <TabsContent value="deadstock">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PackageX className="w-5 h-5" /> Dead Stock (Tidak Terjual 30 Hari)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead className="text-right">Nilai Stok</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deadStock.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{p.category.name}</TableCell>
                      <TableCell className="text-right">{p.stock}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(p.stockValue)}</TableCell>
                    </TableRow>
                  ))}
                  {deadStock.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">Tidak ada dead stock</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Slow Moving */}
        <TabsContent value="slowmoving">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Snail className="w-5 h-5" /> Slow Moving (Terjual &lt;5 dalam 30 Hari)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead className="text-right">Terjual (30h)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slowMoving.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{p.category.name}</TableCell>
                      <TableCell className="text-right">{p.stock}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">{p.soldQty}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {slowMoving.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">Tidak ada slow moving</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Peak Hours */}
        <TabsContent value="peakhours">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5" /> Jam Ramai Penjualan (30 Hari)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={peakHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "transactions" ? `${value} transaksi` : formatCurrency(Number(value)),
                      name === "transactions" ? "Transaksi" : "Revenue",
                    ]}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey="transactions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fraud Detection */}
        <TabsContent value="fraud">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5" /> Fraud Detection - Void Abuse (7 Hari)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kasir</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Void Count</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voidAbuse.map((v, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{v.userName}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{v.role}</TableCell>
                      <TableCell className="text-right font-bold">{v.voidCount}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={v.suspicious ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}>
                          {v.suspicious ? "Suspicious" : "Normal"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {voidAbuse.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">Tidak ada void tercatat</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cashier Performance */}
        <TabsContent value="cashier">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" /> Performa Kasir (30 Hari)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Kasir</TableHead>
                    <TableHead className="text-right">Transaksi</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                    <TableHead className="text-right">Avg/Transaksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashierPerf.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-bold text-primary">{i + 1}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right">{c.transactions}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(c.revenue)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(c.avgTransaction)}</TableCell>
                    </TableRow>
                  ))}
                  {cashierPerf.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">Belum ada data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Daily Profit */}
        <TabsContent value="dailyprofit">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="w-5 h-5" /> Laba Harian (30 Hari Terakhir)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={dailyProfit}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(Number(value)),
                      name === "revenue" ? "Revenue" : name === "cost" ? "Cost" : "Profit",
                    ]}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="revenue" />
                  <Bar dataKey="cost" fill="#f97316" radius={[4, 4, 0, 0]} name="cost" />
                  <Bar dataKey="profit" fill="#22c55e" radius={[4, 4, 0, 0]} name="profit" />
                </BarChart>
              </ResponsiveContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyProfit.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="font-medium">{d.date}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(d.revenue)}</TableCell>
                      <TableCell className="text-right text-sm text-orange-600">{formatCurrency(d.cost)}</TableCell>
                      <TableCell className="text-right">
                        <span className={d.profit >= 0 ? "text-green-600 font-medium" : "text-red-600 font-bold"}>
                          {formatCurrency(d.profit)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {dailyProfit.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">Belum ada data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shift Profit */}
        <TabsContent value="shiftprofit">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Timer className="w-5 h-5" /> Laba per Shift
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kasir</TableHead>
                    <TableHead>Mulai</TableHead>
                    <TableHead>Selesai</TableHead>
                    <TableHead className="text-right">Transaksi</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftProfit.map((s) => (
                    <TableRow key={s.shiftId}>
                      <TableCell className="font-medium">{s.cashier}</TableCell>
                      <TableCell className="text-sm text-slate-500">{new Date(s.openedAt).toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-sm text-slate-500">{new Date(s.closedAt).toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-right">{s.transactions}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(s.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {shiftProfit.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">Belum ada data shift</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Supplier Intel */}
        <TabsContent value="supplierintel">
          <div className="space-y-6">
            <Card className="rounded-2xl shadow-sm border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="w-5 h-5" /> Supplier Ranking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Produk</TableHead>
                      <TableHead className="text-right">Total PO</TableHead>
                      <TableHead className="text-right">Nilai PO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierRanking.map((s, i) => (
                      <TableRow key={s.name}>
                        <TableCell className="font-bold text-primary">{i + 1}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-right">{s.productCount}</TableCell>
                        <TableCell className="text-right">{s.poCount}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(s.totalPOValue)}</TableCell>
                      </TableRow>
                    ))}
                    {supplierRanking.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">Belum ada data supplier</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="w-5 h-5" /> Supplier Debt Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Total PO (Received)</TableHead>
                      <TableHead className="text-right">Total Dibayar</TableHead>
                      <TableHead className="text-right">Sisa Hutang</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierDebt.map((s) => (
                      <TableRow key={s.supplierName}>
                        <TableCell className="font-medium">{s.supplierName}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(s.totalPO)}</TableCell>
                        <TableCell className="text-right text-sm text-green-600">{formatCurrency(s.totalPaid)}</TableCell>
                        <TableCell className="text-right font-bold">
                          <span className={s.debt > 0 ? "text-red-600" : "text-green-600"}>{formatCurrency(s.debt)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={s.debt <= 0 ? "bg-green-100 text-green-700" : s.debt > s.totalPO * 0.5 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}>
                            {s.debt <= 0 ? "Lunas" : "Hutang"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {supplierDebt.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">Tidak ada data hutang</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Promo Report */}
        <TabsContent value="promo">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Megaphone className="w-5 h-5" /> Promo Effectiveness Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Promo</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">Penggunaan</TableHead>
                    <TableHead className="text-right">Total Diskon</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promoEffectiveness.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.promoName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">{p.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">{p.usageCount}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(p.totalDiscount)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={p.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                          {p.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {promoEffectiveness.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">Belum ada data promo</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Smart Reorder */}
        <TabsContent value="reorder">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="w-5 h-5" /> Smart Reorder Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead className="text-right">Min Stok</TableHead>
                    <TableHead className="text-right">Avg Jual/Hari</TableHead>
                    <TableHead className="text-right">Hari Tersisa</TableHead>
                    <TableHead className="text-right">Rekomendasi Order</TableHead>
                    <TableHead>Supplier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reorderRecommendations.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{r.product}</p>
                          <p className="text-xs text-slate-400">{r.code}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={r.currentStock === 0 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}>
                          {r.currentStock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{r.minStock}</TableCell>
                      <TableCell className="text-right text-sm">{r.avgDailySales}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={r.daysUntilOut <= 3 ? "bg-red-100 text-red-700" : r.daysUntilOut <= 7 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}>
                          {r.daysUntilOut >= 999 ? "Aman" : `${r.daysUntilOut} hari`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">{r.recommendedQty}</TableCell>
                      <TableCell className="text-sm text-slate-500">{r.supplier}</TableCell>
                    </TableRow>
                  ))}
                  {reorderRecommendations.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">Semua stok aman</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unusual Discounts */}
        <TabsContent value="unusualdiscount">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="w-5 h-5" /> Diskon Unusual ({">"}20%) - 7 Hari Terakhir
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Kasir</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Diskon</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unusualDiscounts.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{d.invoiceNumber}</TableCell>
                      <TableCell>{d.cashier}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{d.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(d.subtotal)}</TableCell>
                      <TableCell className="text-right text-red-600 font-bold">{formatCurrency(d.discountAmount)}</TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-red-100 text-red-700">{d.discountPercent.toFixed(1)}%</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(d.grandTotal)}</TableCell>
                      <TableCell className="text-sm text-slate-500">{new Date(d.createdAt).toLocaleString("id-ID")}</TableCell>
                    </TableRow>
                  ))}
                  {unusualDiscounts.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400">Tidak ada diskon unusual</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
