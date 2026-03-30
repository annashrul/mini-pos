"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Repeat, Clock, Crown } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const memberColors: Record<string, string> = {
  REGULAR: "bg-slate-100 text-slate-700",
  SILVER: "bg-gray-100 text-gray-700",
  GOLD: "bg-yellow-100 text-yellow-700",
  PLATINUM: "bg-purple-100 text-purple-700",
};

interface Props {
  repeatCustomers: {
    id: string; name: string; phone: string | null; email: string | null;
    memberLevel: string; totalSpending: number; points: number;
    transactionCount: number; isRepeat: boolean;
  }[];
  shoppingFrequency: {
    id: string; name: string; phone: string | null; memberLevel: string;
    visitCount: number; totalSpent: number; avgSpending: number;
    lastVisit: Date | null;
  }[];
  loyaltySummary: {
    level: string; count: number; totalSpending: number; totalPoints: number;
  }[];
}

export function CustomerIntelligenceContent({ repeatCustomers, shoppingFrequency, loyaltySummary }: Props) {
  const totalCustomers = repeatCustomers.length;
  const repeatCount = repeatCustomers.filter((c) => c.isRepeat).length;
  const totalPoints = loyaltySummary.reduce((sum, l) => sum + l.totalPoints, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customer Intelligence</h1>
        <p className="text-slate-500 text-sm">Analisis pelanggan dan loyalitas</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total Customer</p>
            <p className="text-2xl font-bold">{totalCustomers}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Repeat Customer</p>
            <p className="text-2xl font-bold text-green-600">{repeatCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total Poin Beredar</p>
            <p className="text-2xl font-bold text-purple-600">{totalPoints.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Member Level</p>
            <div className="flex gap-1 mt-1">
              {loyaltySummary.map((l) => (
                <Badge key={l.level} className={memberColors[l.level]}>{l.level}: {l.count}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="repeat" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="repeat" className="rounded-lg">Repeat Customer</TabsTrigger>
          <TabsTrigger value="frequency" className="rounded-lg">Shopping Frequency</TabsTrigger>
          <TabsTrigger value="loyalty" className="rounded-lg">Loyalty Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="repeat">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Repeat className="w-5 h-5" /> Top Customer (Berdasar Total Belanja)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>No. HP</TableHead>
                    <TableHead className="text-center">Level</TableHead>
                    <TableHead className="text-right">Total Belanja</TableHead>
                    <TableHead className="text-center">Transaksi</TableHead>
                    <TableHead className="text-center">Poin</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repeatCustomers.map((c, i) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-bold text-primary">{i + 1}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{c.phone || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={memberColors[c.memberLevel]}>{c.memberLevel}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(c.totalSpending)}</TableCell>
                      <TableCell className="text-center">{c.transactionCount}</TableCell>
                      <TableCell className="text-center">{c.points}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={c.isRepeat ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}>
                          {c.isRepeat ? "Repeat" : "New"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {repeatCustomers.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400">Belum ada data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frequency">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5" /> Shopping Frequency (30 Hari)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>No. HP</TableHead>
                    <TableHead className="text-center">Level</TableHead>
                    <TableHead className="text-center">Kunjungan</TableHead>
                    <TableHead className="text-right">Total Belanja</TableHead>
                    <TableHead className="text-right">Avg/Kunjungan</TableHead>
                    <TableHead>Terakhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shoppingFrequency.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{c.phone || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={memberColors[c.memberLevel]}>{c.memberLevel}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-bold">{c.visitCount}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.totalSpent)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.avgSpending)}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {c.lastVisit ? format(new Date(c.lastVisit), "dd MMM", { locale: idLocale }) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {shoppingFrequency.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">Belum ada data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loyalty">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Crown className="w-5 h-5" /> Loyalty Program Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {loyaltySummary.map((l) => (
                  <Card key={l.level} className="rounded-xl border">
                    <CardContent className="pt-4 space-y-2">
                      <Badge className={`${memberColors[l.level]} text-sm px-3 py-1`}>{l.level}</Badge>
                      <div>
                        <p className="text-2xl font-bold">{l.count}</p>
                        <p className="text-xs text-slate-500">member</p>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total Belanja</span>
                          <span className="font-medium">{formatCurrency(l.totalSpending)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total Poin</span>
                          <span className="font-medium">{l.totalPoints.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Avg Belanja</span>
                          <span className="font-medium">{formatCurrency(l.count > 0 ? l.totalSpending / l.count : 0)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
