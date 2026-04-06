"use client";

import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, CircleDot } from "lucide-react";
import { loyaltyGradients, DEFAULT_LOYALTY_GRADIENT, loyaltyIcons } from "../utils";
import type { LoyaltySummary } from "../types";

interface LoyaltySummaryTabProps {
  loyaltySummary: LoyaltySummary[];
}

export function LoyaltySummaryTab({ loyaltySummary }: LoyaltySummaryTabProps) {
  return (
    <Card className="rounded-2xl shadow-sm border-border/30">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
            <Crown className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <span className="text-slate-900">Loyalty Program Summary</span>
            <p className="text-xs text-slate-400 font-normal mt-0.5">Distribusi member berdasarkan level</p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loyaltySummary.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Crown className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">Belum ada data loyalty</p>
            <p className="text-xs text-slate-300 mt-1">Data akan muncul setelah member terdaftar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {loyaltySummary.map((l) => {
              const gradient = loyaltyGradients[l.level] ?? DEFAULT_LOYALTY_GRADIENT;
              const IconComp = loyaltyIcons[l.level] || CircleDot;
              return (
                <div
                  key={l.level}
                  className={`rounded-2xl bg-gradient-to-br ${gradient.bg} p-5 text-white shadow-lg hover:shadow-xl transition-shadow duration-300 relative overflow-hidden`}
                >
                  {/* Decorative circle */}
                  <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
                  <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />

                  <div className="relative space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-xl ${gradient.icon} flex items-center justify-center`}>
                        <IconComp className={`w-5 h-5 ${gradient.iconBg}`} />
                      </div>
                      <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">{l.level}</span>
                    </div>

                    <div>
                      <p className="text-4xl font-bold tabular-nums">{l.count.toLocaleString()}</p>
                      <p className="text-white/70 text-xs mt-0.5">member terdaftar</p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-xs">Total Belanja</span>
                        <span className="font-semibold text-sm tabular-nums">{formatCurrency(l.totalSpending)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-xs">Total Poin</span>
                        <span className="font-semibold text-sm tabular-nums">{l.totalPoints.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-xs">Avg Belanja</span>
                        <span className="font-semibold text-sm tabular-nums">{formatCurrency(l.count > 0 ? l.totalSpending / l.count : 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
