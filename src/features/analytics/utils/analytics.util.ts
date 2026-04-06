import {
  TrendingUp, PackageX, Snail, Clock, Shield, Users,
  DollarSign, Timer, Truck, Megaphone, ShoppingCart, AlertTriangle,
  Layers,
} from "lucide-react";

/* ─── Tab configuration ─── */
export const TAB_CONFIG = [
  { value: "margin", label: "Margin Produk", icon: TrendingUp },
  { value: "category", label: "Margin Kategori", icon: Layers },
  { value: "deadstock", label: "Dead Stock", icon: PackageX },
  { value: "slowmoving", label: "Slow Moving", icon: Snail },
  { value: "peakhours", label: "Jam Ramai", icon: Clock },
  { value: "fraud", label: "Fraud", icon: Shield },
  { value: "cashier", label: "Kasir", icon: Users },
  { value: "dailyprofit", label: "Laba Harian", icon: DollarSign },
  { value: "shiftprofit", label: "Laba per Shift", icon: Timer },
  { value: "supplierintel", label: "Supplier Intel", icon: Truck },
  { value: "promo", label: "Promo Report", icon: Megaphone },
  { value: "reorder", label: "Smart Reorder", icon: ShoppingCart },
  { value: "unusualdiscount", label: "Diskon Unusual", icon: AlertTriangle },
] as const;

/* ─── Section header accent color map ─── */
export const ACCENT_COLORS: Record<string, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
};

/* ─── Margin badge color helper ─── */
export function getMarginBadgeClass(percent: number): string {
  if (percent > 20) return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (percent > 0) return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-red-50 text-red-700 border border-red-200";
}

/* ─── Debt status helpers ─── */
export function getDebtStatusClass(debt: number, totalPO: number): string {
  if (debt <= 0) return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (debt > totalPO * 0.5) return "bg-red-50 text-red-700 border border-red-200";
  return "bg-amber-50 text-amber-700 border border-amber-200";
}

export function getDebtStatusLabel(debt: number): string {
  return debt <= 0 ? "Lunas" : "Hutang";
}

/* ─── Reorder urgency helpers ─── */
export function getDaysUntilOutBadgeClass(daysUntilOut: number): string {
  if (daysUntilOut <= 3) return "bg-red-50 text-red-700 border border-red-200 animate-pulse";
  if (daysUntilOut <= 7) return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-emerald-50 text-emerald-700 border border-emerald-200";
}

export function getDaysUntilOutLabel(daysUntilOut: number): string {
  return daysUntilOut >= 999 ? "Aman" : `${daysUntilOut} hari`;
}

/* ─── Stock badge class ─── */
export function getStockBadgeClass(currentStock: number): string {
  if (currentStock === 0) return "bg-red-50 text-red-700 border border-red-200";
  return "bg-amber-50 text-amber-700 border border-amber-200";
}

export function getAnalyticsLabel(value: string) {
  return value;
}
