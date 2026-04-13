import { Crown, Lock, Shield, Zap } from "lucide-react";
import type { ComponentType } from "react";
import type { PlanKey } from "@/lib/plan-config";

type PlanUiMeta = {
  key: PlanKey | "SOON";
  name: string;
  icon: ComponentType<{ className?: string }>;
  badgeClassName: string;
  gradient: string;
  color: string;
  dotColor: string;
};

export const PLAN_UI: Record<PlanKey | "SOON", PlanUiMeta> = {
  FREE: {
    key: "FREE",
    name: "Free",
    icon: Zap,
    badgeClassName: "bg-slate-100 text-slate-700",
    gradient: "from-slate-400 to-slate-500",
    color: "text-slate-600",
    dotColor: "bg-slate-400",
  },
  PRO: {
    key: "PRO",
    name: "Pro",
    icon: Crown,
    badgeClassName: "bg-amber-100 text-amber-700",
    gradient: "from-amber-400 to-orange-400",
    color: "text-amber-600",
    dotColor: "bg-amber-400",
  },
  ENTERPRISE: {
    key: "ENTERPRISE",
    name: "Enterprise",
    icon: Shield,
    badgeClassName: "bg-purple-100 text-purple-700",
    gradient: "from-purple-500 to-violet-500",
    color: "text-purple-600",
    dotColor: "bg-purple-500",
  },
  SOON: {
    key: "SOON",
    name: "Segera Hadir",
    icon: Lock,
    badgeClassName: "bg-slate-100 text-slate-500",
    gradient: "from-slate-400 to-slate-500",
    color: "text-slate-500",
    dotColor: "bg-slate-400",
  },
};


export function getPlanUi(key: string): PlanUiMeta {
  return PLAN_UI[key as keyof typeof PLAN_UI] ?? PLAN_UI.SOON;
}
