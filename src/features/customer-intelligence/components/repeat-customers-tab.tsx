"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Repeat, UserX } from "lucide-react";
import { CustomerAvatar, MemberLevelBadge } from "./customer-shared";
import type { RepeatCustomer } from "../types";

interface RepeatCustomersTabProps {
  repeatCustomers: RepeatCustomer[];
}

export function RepeatCustomersTab({ repeatCustomers }: RepeatCustomersTabProps) {
  return (
    <Card className="rounded-2xl shadow-sm border-border/30">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20">
            <Repeat className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <span className="text-slate-900">Top Customer</span>
            <p className="text-xs text-slate-400 font-normal mt-0.5">Berdasarkan total belanja</p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {repeatCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <UserX className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">Belum ada data customer</p>
            <p className="text-xs text-slate-300 mt-1">Data akan muncul setelah ada transaksi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-10">#</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Customer</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Kontak</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Level</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">Total Belanja</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Transaksi</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Poin</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repeatCustomers.map((c, i) => (
                  <TableRow key={c.id} className="border-slate-50 hover:bg-violet-50/30">
                    <TableCell className="py-3.5 font-bold text-violet-500 tabular-nums">{i + 1}</TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        <CustomerAvatar name={c.name} />
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                          {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 text-slate-500 text-sm">{c.phone || "-"}</TableCell>
                    <TableCell className="py-3.5 text-center">
                      <MemberLevelBadge level={c.memberLevel} />
                    </TableCell>
                    <TableCell className="py-3.5 text-right font-semibold text-slate-800 tabular-nums text-sm">{formatCurrency(c.totalSpending)}</TableCell>
                    <TableCell className="py-3.5 text-center tabular-nums font-medium text-slate-600">{c.transactionCount}</TableCell>
                    <TableCell className="py-3.5 text-center tabular-nums font-medium text-purple-600">{c.points.toLocaleString()}</TableCell>
                    <TableCell className="py-3.5 text-center">
                      <Badge className={
                        c.isRepeat
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold"
                          : "bg-slate-50 text-slate-500 border border-slate-200 text-[11px] font-semibold"
                      }>
                        {c.isRepeat ? "Repeat" : "New"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
