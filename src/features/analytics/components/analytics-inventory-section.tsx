"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PackageX, Snail, AlertTriangle, ShoppingCart, Zap, CheckCircle2 } from "lucide-react";
import { SectionHeader, EmptyState } from "./analytics-shared";
import { getDaysUntilOutBadgeClass, getDaysUntilOutLabel, getStockBadgeClass } from "@/features/analytics/utils";
import type { DeadStockItem, SlowMovingItem, ReorderRecommendation } from "@/features/analytics/types";

interface AnalyticsInventorySectionProps {
  deadStock: DeadStockItem[];
  slowMoving: SlowMovingItem[];
  reorderRecommendations: ReorderRecommendation[];
  deadStockValue: number;
}

export function AnalyticsInventorySection({ deadStock, slowMoving, reorderRecommendations, deadStockValue }: AnalyticsInventorySectionProps) {
  return (
    <>
      {/* ═══════════════════ Dead Stock ═══════════════════ */}
      <TabsContent value="deadstock">
        <div className="space-y-6">
          {/* Alert Banner */}
          {deadStock.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">Peringatan Dead Stock</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {deadStock.length} produk tidak terjual selama 30 hari dengan total nilai {formatCurrency(deadStockValue)} tertahan.
                </p>
              </div>
            </div>
          )}

          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <SectionHeader icon={PackageX} title="Dead Stock (Tidak Terjual 30 Hari)" description="Produk yang tidak memiliki penjualan dalam 30 hari" accentColor="red" />
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Produk</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kategori</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Stok</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Nilai Stok</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deadStock.map((p) => (
                      <TableRow key={p.id} className="hover:bg-red-50/30 transition-colors">
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs font-normal">{p.category.name}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold">{p.stock}</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600 tabular-nums">{formatCurrency(p.stockValue)}</TableCell>
                      </TableRow>
                    ))}
                    {deadStock.length === 0 && <EmptyState icon={CheckCircle2} message="Tidak ada dead stock - semua produk terjual" colSpan={4} />}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* ═══════════════════ Slow Moving ═══════════════════ */}
      <TabsContent value="slowmoving">
        <div className="space-y-6">
          {slowMoving.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Snail className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Perhatian Slow Moving</p>
                <p className="text-xs text-amber-600 mt-0.5">{slowMoving.length} produk terjual kurang dari 5 unit dalam 30 hari terakhir.</p>
              </div>
            </div>
          )}

          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <SectionHeader icon={Snail} title="Slow Moving (Terjual <5 dalam 30 Hari)" description="Produk dengan perputaran sangat rendah" accentColor="amber" />
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Produk</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kategori</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Stok</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Terjual (30h)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slowMoving.map((p) => (
                      <TableRow key={p.id} className="hover:bg-amber-50/30 transition-colors">
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs font-normal">{p.category.name}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-600 tabular-nums">{p.stock}</TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">{p.soldQty}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {slowMoving.length === 0 && <EmptyState icon={CheckCircle2} message="Tidak ada slow moving - perputaran stok baik" colSpan={4} />}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* ═══════════════════ Smart Reorder ═══════════════════ */}
      <TabsContent value="reorder">
        <div className="space-y-6">
          {reorderRecommendations.filter(r => r.daysUntilOut <= 3 && r.daysUntilOut < 999).length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border-l-4 border-red-500">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">Urgent Reorder</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {reorderRecommendations.filter(r => r.daysUntilOut <= 3 && r.daysUntilOut < 999).length} produk akan habis dalam 3 hari. Segera lakukan pemesanan.
                </p>
              </div>
            </div>
          )}

          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <SectionHeader icon={ShoppingCart} title="Smart Reorder Recommendations" description="Rekomendasi pemesanan otomatis berdasarkan tren penjualan" accentColor="emerald" />
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Produk</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Stok</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Min Stok</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Avg Jual/Hari</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Hari Tersisa</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Rekomendasi</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reorderRecommendations.map((r, i) => (
                      <TableRow key={i} className={`transition-colors ${r.daysUntilOut <= 3 && r.daysUntilOut < 999 ? "bg-red-50/40 hover:bg-red-50/60" : "hover:bg-emerald-50/30"}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-800">{r.product}</p>
                            <p className="text-xs text-slate-400">{r.code}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={`text-xs font-semibold ${getStockBadgeClass(r.currentStock)}`}>
                            {r.currentStock}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-500 tabular-nums">{r.minStock}</TableCell>
                        <TableCell className="text-right text-sm text-slate-500 tabular-nums">{r.avgDailySales}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={`text-xs font-semibold ${getDaysUntilOutBadgeClass(r.daysUntilOut)}`}>
                            {getDaysUntilOutLabel(r.daysUntilOut)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center justify-center min-w-[36px] px-2.5 py-1 rounded-lg bg-blue-500 text-white text-sm font-bold shadow-sm shadow-blue-500/20">{r.recommendedQty}</span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">{r.supplier}</TableCell>
                      </TableRow>
                    ))}
                    {reorderRecommendations.length === 0 && <EmptyState icon={CheckCircle2} message="Semua stok dalam kondisi aman" colSpan={7} />}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </>
  );
}
