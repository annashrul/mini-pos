"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { Clock } from "lucide-react";
import { SectionHeader, ChartTooltipContent } from "./analytics-shared";
import type { PeakHourData } from "@/features/analytics/types";

interface AnalyticsPeakHoursSectionProps {
  peakHours: PeakHourData[];
}

export function AnalyticsPeakHoursSection({ peakHours }: AnalyticsPeakHoursSectionProps) {
  return (
    <TabsContent value="peakhours">
      <Card className="rounded-xl sm:rounded-2xl shadow-sm border-border/30">
        <CardHeader className="pb-4 p-3 sm:p-5">
          <SectionHeader icon={Clock} title="Jam Ramai Penjualan (30 Hari)" description="Distribusi transaksi berdasarkan jam operasional" accentColor="blue" />
        </CardHeader>
        <CardContent className="px-3 sm:px-5">
          <div className="rounded-xl bg-slate-50/50 p-2 sm:p-4">
            <ResponsiveContainer width="100%" height={180} className="sm:!h-[280px]">
              <AreaChart data={peakHours}>
                <defs>
                  <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltipContent
                      active={active}
                      payload={payload}
                      label={label}
                      formatValue={(value, name) => [
                        name === "transactions" ? `${value} transaksi` : formatCurrency(Number(value)),
                        name === "transactions" ? "Transaksi" : "Revenue",
                      ]}
                    />
                  )}
                />
                <Area type="monotone" dataKey="transactions" stroke="#3b82f6" strokeWidth={2.5} fill="url(#peakGradient)" dot={{ r: 3, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
