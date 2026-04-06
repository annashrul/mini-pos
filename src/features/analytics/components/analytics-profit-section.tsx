"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { DollarSign, Timer, Users } from "lucide-react";
import { RankBadge, SectionHeader, EmptyState, ChartTooltipContent } from "./analytics-shared";
import type { DailyProfit, ShiftProfit, CashierPerformanceItem } from "@/features/analytics/types";

interface AnalyticsProfitSectionProps {
  dailyProfit: DailyProfit[];
  shiftProfit: ShiftProfit[];
  cashierPerf: CashierPerformanceItem[];
}

export function AnalyticsProfitSection({ dailyProfit, shiftProfit, cashierPerf }: AnalyticsProfitSectionProps) {
  return (
    <>
      {/* ═══════════════════ Cashier Performance ═══════════════════ */}
      <TabsContent value="cashier">
        <Card className="rounded-2xl shadow-sm border-border/30">
          <CardHeader className="pb-4">
            <SectionHeader icon={Users} title="Performa Kasir (30 Hari)" description="Ranking kasir berdasarkan transaksi dan revenue" accentColor="blue" />
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 w-16">Rank</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kasir</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Transaksi</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Total Revenue</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Avg/Transaksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashierPerf.map((c, i) => (
                    <TableRow key={i} className={`hover:bg-blue-50/30 transition-colors ${i === 0 ? "bg-amber-50/30" : ""}`}>
                      <TableCell><RankBadge rank={i + 1} /></TableCell>
                      <TableCell>
                        <span className="font-medium text-slate-800">{c.name}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">{c.transactions}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-800 tabular-nums">{formatCurrency(c.revenue)}</TableCell>
                      <TableCell className="text-right text-sm text-slate-500 tabular-nums">{formatCurrency(c.avgTransaction)}</TableCell>
                    </TableRow>
                  ))}
                  {cashierPerf.length === 0 && <EmptyState icon={Users} message="Belum ada data performa kasir" colSpan={5} />}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ═══════════════════ Daily Profit ═══════════════════ */}
      <TabsContent value="dailyprofit">
        <div className="space-y-6">
          <Card className="rounded-2xl shadow-sm border-border/30">
            <CardHeader className="pb-4">
              <SectionHeader icon={DollarSign} title="Laba Harian (30 Hari Terakhir)" description="Tren pendapatan, biaya, dan profit harian" accentColor="emerald" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl bg-slate-50/50 p-4">
                <ResponsiveContainer width="100%" height={380}>
                  <AreaChart data={dailyProfit}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => (
                        <ChartTooltipContent
                          active={active}
                          payload={payload}
                          label={label}
                          formatValue={(value, name) => [
                            formatCurrency(Number(value)),
                            name === "revenue" ? "Revenue" : name === "cost" ? "Cost" : "Profit",
                          ]}
                        />
                      )}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revenueGradient)" name="revenue" dot={false} />
                    <Area type="monotone" dataKey="cost" stroke="#f97316" strokeWidth={2} fill="transparent" strokeDasharray="5 5" name="cost" dot={false} />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="url(#profitGradient)" name="profit" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-xs text-slate-500">Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-orange-400 inline-block" style={{ borderBottom: "2px dashed #fb923c" }} />
                  <span className="text-xs text-slate-500">Cost</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-500">Profit</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tanggal</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Revenue</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Cost</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyProfit.map((d) => (
                      <TableRow key={d.date} className="hover:bg-emerald-50/30 transition-colors">
                        <TableCell className="font-medium text-slate-700">{d.date}</TableCell>
                        <TableCell className="text-right text-sm text-blue-600 tabular-nums font-medium">{formatCurrency(d.revenue)}</TableCell>
                        <TableCell className="text-right text-sm text-orange-600 tabular-nums">{formatCurrency(d.cost)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={`font-semibold ${d.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {formatCurrency(d.profit)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {dailyProfit.length === 0 && <EmptyState icon={DollarSign} message="Belum ada data profit harian" colSpan={4} />}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* ═══════════════════ Shift Profit ═══════════════════ */}
      <TabsContent value="shiftprofit">
        <Card className="rounded-2xl shadow-sm border-border/30">
          <CardHeader className="pb-4">
            <SectionHeader icon={Timer} title="Laba per Shift" description="Performa pendapatan setiap shift kasir" accentColor="purple" />
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kasir</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mulai</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selesai</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Transaksi</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftProfit.map((s) => (
                    <TableRow key={s.shiftId} className="hover:bg-purple-50/30 transition-colors">
                      <TableCell className="font-medium text-slate-800">{s.cashier}</TableCell>
                      <TableCell className="text-sm text-slate-500">{new Date(s.openedAt).toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-sm text-slate-500">{new Date(s.closedAt).toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-xs font-semibold">{s.transactions}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-800 tabular-nums">{formatCurrency(s.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {shiftProfit.length === 0 && <EmptyState icon={Timer} message="Belum ada data shift" colSpan={5} />}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </>
  );
}
