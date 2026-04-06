"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Megaphone, CircleDot } from "lucide-react";
import { SectionHeader, EmptyState } from "./analytics-shared";
import type { PromoEffectivenessItem } from "@/features/analytics/types";

interface AnalyticsPromoSectionProps {
  promoEffectiveness: PromoEffectivenessItem[];
}

export function AnalyticsPromoSection({ promoEffectiveness }: AnalyticsPromoSectionProps) {
  return (
    <TabsContent value="promo">
      <Card className="rounded-xl sm:rounded-2xl shadow-sm border-border/30">
        <CardHeader className="pb-4 p-3 sm:p-5">
          <SectionHeader icon={Megaphone} title="Promo Effectiveness Report" description="Efektivitas dan penggunaan setiap promosi" accentColor="purple" />
        </CardHeader>
        <CardContent className="px-3 sm:px-5">
          <div className="rounded-xl border border-slate-100 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nama Promo</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tipe</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Penggunaan</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total Diskon</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoEffectiveness.map((p, i) => (
                  <TableRow key={i} className="hover:bg-purple-50/30 transition-colors">
                    <TableCell className="font-medium text-slate-800">{p.promoName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">{p.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-xs font-bold">{p.usageCount}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-slate-700 tabular-nums">{formatCurrency(p.totalDiscount)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-xs font-semibold ${p.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-400 border border-slate-200"}`}>
                        <CircleDot className="w-3 h-3 mr-1" />
                        {p.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {promoEffectiveness.length === 0 && <EmptyState icon={Megaphone} message="Belum ada data promosi" colSpan={5} />}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
