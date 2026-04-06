"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Download, Layers } from "lucide-react";
import { exportToCSV } from "@/lib/export";
import { RankBadge, SectionHeader } from "./analytics-shared";
import { getMarginBadgeClass } from "@/features/analytics/utils";
import type { MarginProduct, CategoryMargin } from "@/features/analytics/types";

interface AnalyticsMarginSectionProps {
  marginData: MarginProduct[];
  categoryMargins: CategoryMargin[];
}

export function AnalyticsMarginSection({ marginData, categoryMargins }: AnalyticsMarginSectionProps) {
  return (
    <>
      {/* ═══════════════════ Margin per Product ═══════════════════ */}
      <TabsContent value="margin">
        <Card className="rounded-2xl shadow-sm border-border/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <SectionHeader icon={TrendingUp} title="Margin Analyzer per Produk" description="Analisis margin keuntungan setiap produk" accentColor="blue" />
              <Button variant="outline" size="sm" className="rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() =>
                exportToCSV(marginData.map((p) => ({
                  Kode: p.code, Produk: p.name, Kategori: p.category.name,
                  HargaBeli: p.purchasePrice, HargaJual: p.sellingPrice,
                  Margin: p.margin, MarginPersen: p.marginPercent.toFixed(1) + "%",
                })), "margin-analysis")
              }>
                <Download className="w-4 h-4 mr-1.5" /> Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Produk</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kategori</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Harga Beli</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Harga Jual</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Margin</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marginData.slice(0, 30).map((p) => (
                    <TableRow key={p.id} className="hover:bg-blue-50/30 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs font-normal">{p.category.name}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600 tabular-nums">{formatCurrency(p.purchasePrice)}</TableCell>
                      <TableCell className="text-right text-sm text-slate-600 tabular-nums">{formatCurrency(p.sellingPrice)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={`font-semibold ${p.margin > 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {formatCurrency(p.margin)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={`text-xs font-semibold ${getMarginBadgeClass(p.marginPercent)}`}>
                          {p.marginPercent.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ═══════════════════ Margin per Category ═══════════════════ */}
      <TabsContent value="category">
        <Card className="rounded-2xl shadow-sm border-border/30">
          <CardHeader className="pb-4">
            <SectionHeader icon={Layers} title="Margin Analyzer per Kategori" description="Rata-rata margin keuntungan per kategori" accentColor="purple" />
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kategori</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">Produk</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Avg Beli</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Avg Jual</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Avg Margin</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Margin %</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total Stok</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryMargins.map((c, i) => (
                    <TableRow key={c.name} className="hover:bg-purple-50/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <RankBadge rank={i + 1} />
                          <span className="font-medium text-slate-800">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">{c.productCount}</span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600 tabular-nums">{formatCurrency(c.avgCost)}</TableCell>
                      <TableCell className="text-right text-sm text-slate-600 tabular-nums">{formatCurrency(c.avgSell)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-emerald-600 tabular-nums">{formatCurrency(c.avgMargin)}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={`text-xs font-semibold ${getMarginBadgeClass(c.avgMarginPercent)}`}>
                          {c.avgMarginPercent.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600 tabular-nums">{c.totalStock.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </>
  );
}
