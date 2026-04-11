"use client";

import { useEffect, useState } from "react";
import { getCompanyPlanWithLimits } from "@/server/actions/plan";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Crown, Loader2, Sparkles, Zap } from "lucide-react";
import type { PlanDefinition } from "@/lib/plan-config";

type PlanData = Awaited<ReturnType<typeof getCompanyPlanWithLimits>>;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(value);
}

export default function PlanPage() {
  const [data, setData] = useState<PlanData | null>(null);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCompanyPlanWithLimits().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const currentPlan = data.plan;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          Plan saat ini: <strong>{data.planDetails.name}</strong>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pilih Plan yang Tepat untuk Bisnis Anda</h1>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Mulai gratis, upgrade kapan saja. Semua plan termasuk POS kasir, manajemen produk, dan laporan dasar.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center bg-muted rounded-xl p-1 gap-1">
          <button
            onClick={() => setBilling("monthly")}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", billing === "monthly" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
          >
            Bulanan
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5", billing === "yearly" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
          >
            Tahunan
            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 border-0">Hemat 17%</Badge>
          </button>
        </div>
      </div>

      {/* Usage */}
      <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
        <div className="text-center rounded-xl border border-border/50 p-3">
          <p className="text-lg font-bold">{data.usage.products}</p>
          <p className="text-[11px] text-muted-foreground">/ {data.limits.maxProducts === Infinity ? "∞" : data.limits.maxProducts} Produk</p>
        </div>
        <div className="text-center rounded-xl border border-border/50 p-3">
          <p className="text-lg font-bold">{data.usage.users}</p>
          <p className="text-[11px] text-muted-foreground">/ {data.limits.maxUsers === Infinity ? "∞" : data.limits.maxUsers} Pengguna</p>
        </div>
        <div className="text-center rounded-xl border border-border/50 p-3">
          <p className="text-lg font-bold">{data.usage.branches}</p>
          <p className="text-[11px] text-muted-foreground">/ {data.limits.maxBranches === Infinity ? "∞" : data.limits.maxBranches} Cabang</p>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
        {data.allPlans.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            billing={billing}
            isCurrent={currentPlan === plan.key}
            isPopular={plan.key === "PRO"}
          />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan, billing, isCurrent, isPopular }: { plan: PlanDefinition; billing: "monthly" | "yearly"; isCurrent: boolean; isPopular: boolean }) {
  const price = billing === "monthly" ? plan.price : Math.round(plan.yearlyPrice / 12);
  const totalPrice = billing === "monthly" ? plan.price : plan.yearlyPrice;
  const isFree = plan.price === 0;
  const planIcons: Record<string, typeof Zap> = { FREE: Zap, PRO: Crown, ENTERPRISE: Sparkles };
  const PlanIcon = planIcons[plan.key] || Zap;

  return (
    <div className={cn(
      "relative rounded-2xl border p-5 sm:p-6 flex flex-col",
      isPopular ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20" : "border-border/60",
      isCurrent && "bg-primary/5",
    )}>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-white text-[10px] px-3 py-0.5 rounded-full shadow-md">Populer</Badge>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center",
          plan.key === "FREE" ? "bg-slate-100" : plan.key === "PRO" ? "bg-primary/10" : "bg-purple-100"
        )}>
          <PlanIcon className={cn("w-5 h-5",
            plan.key === "FREE" ? "text-slate-600" : plan.key === "PRO" ? "text-primary" : "text-purple-600"
          )} />
        </div>
        <div>
          <h3 className="font-bold text-lg">{plan.name}</h3>
          <p className="text-[11px] text-muted-foreground">{plan.description}</p>
        </div>
      </div>

      <div className="mb-4">
        {isFree ? (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">Gratis</span>
            <span className="text-sm text-muted-foreground">selamanya</span>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{formatCurrency(price)}</span>
              <span className="text-sm text-muted-foreground">/bulan</span>
            </div>
            {billing === "yearly" && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatCurrency(totalPrice)} / tahun
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2 mb-5">
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-start gap-2 text-sm">
            <Check className={cn("w-4 h-4 shrink-0 mt-0.5",
              plan.key === "FREE" ? "text-slate-400" : plan.key === "PRO" ? "text-primary" : "text-purple-500"
            )} />
            <span className="text-slate-600">{feature}</span>
          </div>
        ))}
      </div>

      {isCurrent ? (
        <Button variant="outline" className="rounded-xl w-full" disabled>
          Plan Saat Ini
        </Button>
      ) : isFree ? (
        <Button variant="outline" className="rounded-xl w-full" disabled>
          Plan Dasar
        </Button>
      ) : (
        <Button
          className={cn("rounded-xl w-full",
            isPopular ? "bg-gradient-to-r from-primary to-primary/90 shadow-md shadow-primary/25" : ""
          )}
          onClick={() => {
            // TODO: Integrate with payment gateway (Midtrans/Xendit)
            window.open(`https://wa.me/6281234567890?text=Halo, saya ingin upgrade ke plan ${plan.name} (${billing})`, "_blank");
          }}
        >
          Upgrade ke {plan.name}
        </Button>
      )}
    </div>
  );
}
