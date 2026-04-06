"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Truck } from "lucide-react";
import { RankBadge, SectionHeader, EmptyState } from "./analytics-shared";
import { getDebtStatusClass, getDebtStatusLabel } from "@/features/analytics/utils";
import type { SupplierRankingItem, SupplierDebtItem } from "@/features/analytics/types";

interface AnalyticsSupplierSectionProps {
  supplierRanking: SupplierRankingItem[];
  supplierDebt: SupplierDebtItem[];
}

export function AnalyticsSupplierSection({ supplierRanking, supplierDebt }: AnalyticsSupplierSectionProps) {
  return (
    <TabsContent value="supplierintel">
      <div className="space-y-4 sm:space-y-6">
        <Card className="rounded-xl sm:rounded-2xl shadow-sm border-border/30">
          <CardHeader className="pb-4 p-3 sm:p-5">
            <SectionHeader icon={Truck} title="Supplier Ranking" description="Peringkat supplier berdasarkan volume dan nilai PO" accentColor="blue" />
          </CardHeader>
          <CardContent className="px-3 sm:px-5">
            <div className="rounded-xl border border-slate-100 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 w-16">Rank</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Produk</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total PO</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Nilai PO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierRanking.map((s, i) => (
                    <TableRow key={s.name} className={`hover:bg-blue-50/30 transition-colors ${i === 0 ? "bg-amber-50/30" : ""}`}>
                      <TableCell><RankBadge rank={i + 1} /></TableCell>
                      <TableCell className="font-medium text-slate-800">{s.name}</TableCell>
                      <TableCell className="text-right text-sm text-slate-600 tabular-nums">{s.productCount}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">{s.poCount}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-800 tabular-nums">{formatCurrency(s.totalPOValue)}</TableCell>
                    </TableRow>
                  ))}
                  {supplierRanking.length === 0 && <EmptyState icon={Truck} message="Belum ada data supplier" colSpan={5} />}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl sm:rounded-2xl shadow-sm border-border/30">
          <CardHeader className="pb-4 p-3 sm:p-5">
            <SectionHeader icon={DollarSign} title="Supplier Debt Tracking" description="Monitoring hutang ke setiap supplier" accentColor="red" />
          </CardHeader>
          <CardContent className="px-3 sm:px-5">
            <div className="rounded-xl border border-slate-100 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total PO (Received)</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total Dibayar</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Sisa Hutang</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierDebt.map((s) => (
                    <TableRow key={s.supplierName} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium text-slate-800">{s.supplierName}</TableCell>
                      <TableCell className="text-right text-sm text-slate-600 tabular-nums">{formatCurrency(s.totalPO)}</TableCell>
                      <TableCell className="text-right text-sm text-emerald-600 font-medium tabular-nums">{formatCurrency(s.totalPaid)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        <span className={s.debt > 0 ? "text-red-600" : "text-emerald-600"}>{formatCurrency(s.debt)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-xs font-semibold ${getDebtStatusClass(s.debt, s.totalPO)}`}>
                          {getDebtStatusLabel(s.debt)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {supplierDebt.length === 0 && <EmptyState icon={DollarSign} message="Tidak ada data hutang supplier" colSpan={5} />}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
