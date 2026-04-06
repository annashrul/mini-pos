import { Star, Award, Gem, CircleDot } from "lucide-react";
import type { FrequencyIndicator, LoyaltyGradient } from "../types/customer-intelligence.type";

export const memberBadgeStyles: Record<string, string> = {
  REGULAR: "bg-slate-100 text-slate-700 border border-slate-200",
  SILVER: "bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 border border-gray-200",
  GOLD: "bg-gradient-to-r from-amber-100 to-yellow-50 text-amber-800 border border-amber-200",
  PLATINUM: "bg-gradient-to-r from-purple-100 to-violet-50 text-purple-800 border border-purple-200",
};

export const loyaltyGradients: Record<string, LoyaltyGradient> = {
  REGULAR: {
    bg: "from-slate-500 to-slate-600",
    icon: "bg-white/20",
    iconBg: "text-white",
  },
  SILVER: {
    bg: "from-gray-400 to-gray-500",
    icon: "bg-white/20",
    iconBg: "text-white",
  },
  GOLD: {
    bg: "from-amber-400 to-amber-600",
    icon: "bg-white/20",
    iconBg: "text-white",
  },
  PLATINUM: {
    bg: "from-purple-500 to-violet-600",
    icon: "bg-white/20",
    iconBg: "text-white",
  },
};

export const DEFAULT_LOYALTY_GRADIENT: LoyaltyGradient = {
  bg: "from-slate-500 to-slate-600",
  icon: "bg-white/20",
  iconBg: "text-white",
};

export const loyaltyIcons: Record<string, typeof Star> = {
  REGULAR: CircleDot,
  SILVER: Star,
  GOLD: Award,
  PLATINUM: Gem,
};

export function getFrequencyIndicator(visitCount: number, lastVisit: Date | null): FrequencyIndicator {
  const now = new Date();
  const daysSinceLastVisit = lastVisit
    ? Math.floor((now.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (visitCount >= 5 && daysSinceLastVisit <= 7) {
    return { color: "bg-emerald-500", label: "Frequent", textColor: "text-emerald-700", bgLight: "bg-emerald-50" };
  }
  if (visitCount >= 2 && daysSinceLastVisit <= 14) {
    return { color: "bg-amber-500", label: "Moderate", textColor: "text-amber-700", bgLight: "bg-amber-50" };
  }
  return { color: "bg-red-400", label: "Inactive", textColor: "text-red-600", bgLight: "bg-red-50" };
}
