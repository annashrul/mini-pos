"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { SectionHeader, EmptyState } from "./analytics-shared";
import type { VoidAbuseEntry, UnusualDiscount } from "@/features/analytics/types";

interface AnalyticsFraudSectionProps {
  voidAbuse: VoidAbuseEntry[];
  unusualDiscounts: UnusualDiscount[];
  suspiciousCount: number;
}

export function AnalyticsFraudSection({ voidAbuse, unusualDiscounts, suspiciousCount }: AnalyticsFraudSectionProps) {
  return (
    <>
      {/* ═══════════════════ Fraud Detection ═══════════════════ */}
      <TabsContent value="fraud">
        <div className="space-y-6">
          {suspiciousCount > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border-l-4 border-red-500">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">Fraud Alert</p>
                <p className="text-xs text-red-600 mt-0.5">{suspiciousCount} kasir terdeteksi dengan pola void yang mencurigakan. Segera lakukan investigasi.</p>
              </div>
            </div>
          )}

          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <SectionHeader icon={Shield} title="Fraud Detection - Void Abuse (7 Hari)" description="Deteksi pola void yang mencurigakan" accentColor="red" />
            </CardHeader>
            <CardContent>
              {voidAbuse.length > 0 ? (
                <div className="space-y-3">
                  {voidAbuse.map((v, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${v.suspicious
                        ? "bg-red-50/50 border-red-200 hover:bg-red-50"
                        : "bg-white border-slate-100 hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${v.suspicious ? "bg-red-100" : "bg-emerald-100"}`}>
                          {v.suspicious ? <XCircle className="w-5 h-5 text-red-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{v.userName}</p>
                          <p className="text-xs text-slate-400">{v.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-800 tabular-nums">{v.voidCount}</p>
                          <p className="text-xs text-slate-400">void</p>
                        </div>
                        <Badge className={`text-xs font-semibold px-3 py-1 ${v.suspicious ? "bg-red-100 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                          {v.suspicious ? "Suspicious" : "Normal"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                    <Shield className="w-7 h-7 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium">Tidak ada void tercatat</p>
                  <p className="text-xs text-slate-300 mt-1">Belum ada aktivitas void dalam 7 hari terakhir</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* ═══════════════════ Unusual Discounts ═══════════════════ */}
      <TabsContent value="unusualdiscount">
        <div className="space-y-6">
          {unusualDiscounts.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border-l-4 border-amber-500">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Diskon Abnormal Terdeteksi</p>
                <p className="text-xs text-amber-600 mt-0.5">{unusualDiscounts.length} transaksi dengan diskon lebih dari 20% dalam 7 hari terakhir membutuhkan review.</p>
              </div>
            </div>
          )}

          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <SectionHeader icon={AlertTriangle} title="Diskon Unusual (>20%) - 7 Hari Terakhir" description="Transaksi dengan diskon di atas ambang batas normal" accentColor="amber" />
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Invoice</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kasir</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Subtotal</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Diskon</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">%</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Grand Total</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tanggal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unusualDiscounts.map((d, i) => (
                      <TableRow key={i} className="hover:bg-amber-50/30 transition-colors">
                        <TableCell>
                          <span className="font-mono text-sm font-medium text-slate-700">{d.invoiceNumber}</span>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{d.cashier}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs">{d.role}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-600 tabular-nums">{formatCurrency(d.subtotal)}</TableCell>
                        <TableCell className="text-right font-bold text-red-600 tabular-nums">{formatCurrency(d.discountAmount)}</TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">{d.discountPercent.toFixed(1)}%</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-slate-700 tabular-nums">{formatCurrency(d.grandTotal)}</TableCell>
                        <TableCell className="text-sm text-slate-400">{new Date(d.createdAt).toLocaleString("id-ID")}</TableCell>
                      </TableRow>
                    ))}
                    {unusualDiscounts.length === 0 && <EmptyState icon={CheckCircle2} message="Tidak ada diskon unusual - semua transaksi normal" colSpan={8} />}
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
