"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CustomerAvatar, MemberLevelBadge } from "./customer-shared";
import { getFrequencyIndicator } from "../utils";
import type { ShoppingFrequencyCustomer } from "../types";

interface ShoppingFrequencyTabProps {
  shoppingFrequency: ShoppingFrequencyCustomer[];
}

export function ShoppingFrequencyTab({ shoppingFrequency }: ShoppingFrequencyTabProps) {
  return (
    <Card className="rounded-xl sm:rounded-2xl shadow-sm border-border/30">
      <CardHeader className="pb-4 p-3 sm:p-5">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-md shadow-purple-500/20">
            <Clock className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <span className="text-slate-900">Shopping Frequency</span>
            <p className="text-xs text-slate-400 font-normal mt-0.5">Pola kunjungan 30 hari terakhir</p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-5">
        {shoppingFrequency.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">Belum ada data frekuensi</p>
            <p className="text-xs text-slate-300 mt-1">Data akan tersedia setelah pelanggan bertransaksi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Customer</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Kontak</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center hidden sm:table-cell">Level</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Kunjungan</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Aktivitas</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">Total Belanja</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right hidden sm:table-cell">Avg/Kunjungan</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Terakhir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shoppingFrequency.map((c) => {
                  const indicator = getFrequencyIndicator(c.visitCount, c.lastVisit);
                  return (
                    <TableRow key={c.id} className="border-slate-50 hover:bg-violet-50/30">
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-3">
                          <CustomerAvatar name={c.name} />
                          <span className="font-semibold text-slate-800 text-sm">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 text-slate-500 text-sm hidden sm:table-cell">{c.phone || "-"}</TableCell>
                      <TableCell className="py-3.5 text-center hidden sm:table-cell">
                        <MemberLevelBadge level={c.memberLevel} />
                      </TableCell>
                      <TableCell className="py-3.5 text-center">
                        <span className="font-bold text-slate-800 tabular-nums text-base">{c.visitCount}</span>
                      </TableCell>
                      <TableCell className="py-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${indicator.color}`} />
                          <span className={`text-[11px] font-semibold ${indicator.textColor}`}>
                            {indicator.label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 text-right font-semibold text-slate-800 tabular-nums text-sm">{formatCurrency(c.totalSpent)}</TableCell>
                      <TableCell className="py-3.5 text-right tabular-nums text-sm text-slate-600 hidden sm:table-cell">{formatCurrency(c.avgSpending)}</TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-500 hidden sm:table-cell">
                        {c.lastVisit ? format(new Date(c.lastVisit), "dd MMM", { locale: idLocale }) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
