"use client";

import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CashierSalesReport } from "../types";

interface ReportsCashierTabProps {
  cashierSales: CashierSalesReport[];
}

export function ReportsCashierTab({ cashierSales }: ReportsCashierTabProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="rounded-xl sm:rounded-2xl shadow-sm border-slate-200/60">
          <CardContent className="p-2.5 sm:p-5">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Kasir</p>
            <p className="text-sm sm:text-xl font-bold mt-1 tabular-nums">{cashierSales.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl sm:rounded-2xl shadow-sm border-slate-200/60">
          <CardContent className="p-2.5 sm:p-5">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Pendapatan</p>
            <p className="text-sm sm:text-xl font-bold mt-1 tabular-nums text-emerald-700">{formatCurrency(cashierSales.reduce((s, c) => s + c.totalRevenue, 0))}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl sm:rounded-2xl shadow-sm border-slate-200/60">
          <CardContent className="p-2.5 sm:p-5">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Transaksi</p>
            <p className="text-sm sm:text-xl font-bold mt-1 tabular-nums">{cashierSales.reduce((s, c) => s + c.transactionCount, 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl sm:rounded-2xl shadow-sm border-slate-200/60">
          <CardContent className="p-2.5 sm:p-5">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Profit</p>
            <p className="text-sm sm:text-xl font-bold mt-1 tabular-nums text-blue-700">{formatCurrency(cashierSales.reduce((s, c) => s + c.profit, 0))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cashier chart */}
      {cashierSales.length > 0 && (
        <Card className="rounded-xl sm:rounded-2xl shadow-sm border-slate-200/60">
          <CardHeader className="pb-2 p-3 sm:p-5">
            <CardTitle className="text-sm font-semibold">Performa Kasir — Revenue</CardTitle>
          </CardHeader>
          <CardContent className="h-[180px] sm:h-[280px] px-3 sm:px-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashierSales.slice(0, 10)} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} className="text-xs" />
                <YAxis dataKey="name" type="category" width={75} className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="totalRevenue" name="Revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Cashier detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4">
        {cashierSales.map((cashier, idx) => {
          const margin = cashier.totalRevenue > 0 ? Math.round((cashier.profit / cashier.totalRevenue) * 100) : 0;
          return (
            <Card key={cashier.userId} className="rounded-xl sm:rounded-2xl shadow-sm border-slate-200/60 hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
                    {cashier.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{cashier.name}</p>
                        <p className="text-xs text-muted-foreground">{cashier.email} · {cashier.role}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs font-mono">#{idx + 1}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Revenue</p>
                        <p className="text-sm font-bold tabular-nums text-emerald-700">{formatCurrency(cashier.totalRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Profit</p>
                        <p className="text-sm font-bold tabular-nums text-blue-700">{formatCurrency(cashier.profit)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Avg Tiket</p>
                        <p className="text-sm font-bold tabular-nums">{formatCurrency(cashier.averageTicket)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{cashier.transactionCount} transaksi</span>
                      <span>{cashier.itemsSold} item terjual</span>
                      <span>Diskon: {formatCurrency(cashier.totalDiscount)}</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">Margin</span>
                        <span className={`font-semibold ${margin >= 20 ? "text-emerald-600" : margin >= 10 ? "text-amber-600" : "text-red-600"}`}>{margin}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${margin >= 20 ? "bg-emerald-500" : margin >= 10 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(margin, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
