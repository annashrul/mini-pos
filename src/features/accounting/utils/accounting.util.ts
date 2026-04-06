// ── Currency Formatters ────────────────────────────────────────────────

export const formatAccountingCurrency = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1e9) return `Rp ${(n / 1e9).toFixed(1)}M`;
  if (Math.abs(n) >= 1e6) return `Rp ${(n / 1e6).toFixed(1)}Jt`;
  if (Math.abs(n) >= 1e3) return `Rp ${(n / 1e3).toFixed(0)}Rb`;
  return formatAccountingCurrency(n);
};

// ── Status Config ──────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-600" },
  POSTED: { label: "Posted", className: "bg-green-100 text-green-700" },
  VOID: { label: "Void", className: "bg-red-100 text-red-700" },
};

// ── Journal Type Config ────────────────────────────────────────────────

export const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  GENERAL: { label: "Umum", className: "bg-blue-100 text-blue-700" },
  ADJUSTMENT: { label: "Penyesuaian", className: "bg-amber-100 text-amber-700" },
  CLOSING: { label: "Penutup", className: "bg-purple-100 text-purple-700" },
  OPENING: { label: "Pembuka", className: "bg-cyan-100 text-cyan-700" },
};

// ── Category Config ────────────────────────────────────────────────────

export const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string; bgColor: string; badgeColor: string }> = {
  ASET: { label: "Aset", icon: "Building2", color: "text-blue-600", bgColor: "bg-blue-50", badgeColor: "bg-blue-100 text-blue-700" },
  KEWAJIBAN: { label: "Kewajiban", icon: "CreditCard", color: "text-red-600", bgColor: "bg-red-50", badgeColor: "bg-red-100 text-red-700" },
  MODAL: { label: "Modal", icon: "Landmark", color: "text-purple-600", bgColor: "bg-purple-50", badgeColor: "bg-purple-100 text-purple-700" },
  PENDAPATAN: { label: "Pendapatan", icon: "TrendingUp", color: "text-green-600", bgColor: "bg-green-50", badgeColor: "bg-green-100 text-green-700" },
  BEBAN: { label: "Beban", icon: "Receipt", color: "text-orange-600", bgColor: "bg-orange-50", badgeColor: "bg-orange-100 text-orange-700" },
};

export const CATEGORY_ORDER = ["ASET", "KEWAJIBAN", "MODAL", "PENDAPATAN", "BEBAN"];

// ── Account Types per Category ─────────────────────────────────────────

export const ACCOUNT_TYPES: Record<string, string[]> = {
  ASET: ["Kas", "Bank", "Piutang", "Persediaan", "Aset Tetap", "Aset Lainnya"],
  KEWAJIBAN: ["Hutang Usaha", "Hutang Bank", "Hutang Pajak", "Kewajiban Lainnya"],
  MODAL: ["Modal Disetor", "Laba Ditahan", "Modal Lainnya"],
  PENDAPATAN: ["Penjualan", "Pendapatan Lainnya"],
  BEBAN: ["Beban Operasional", "Beban Gaji", "Beban Sewa", "Beban Utilitas", "Beban Penyusutan", "Beban Lainnya"],
};

export const CATEGORY_OPTIONS = [
  { value: "ASET", label: "Aset" },
  { value: "KEWAJIBAN", label: "Kewajiban" },
  { value: "MODAL", label: "Modal" },
  { value: "PENDAPATAN", label: "Pendapatan" },
  { value: "BEBAN", label: "Beban" },
];

// ── Period Status Styles ───────────────────────────────────────────────

export const PERIOD_STATUS_STYLES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  OPEN: { label: "Terbuka", variant: "default" },
  CLOSED: { label: "Ditutup", variant: "secondary" },
  LOCKED: { label: "Terkunci", variant: "destructive" },
};
