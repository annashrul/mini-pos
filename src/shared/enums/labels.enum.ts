// Payment method labels
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  TRANSFER: "Transfer Bank",
  QRIS: "QRIS",
  EWALLET: "E-Wallet",
  DEBIT: "Debit",
  CREDIT_CARD: "Kartu Kredit",
  TERMIN: "Termin",
};

// Member level colors
export const MEMBER_LEVEL_COLORS: Record<string, string> = {
  REGULAR: "bg-slate-100 text-slate-700",
  SILVER: "bg-gray-100 text-gray-700",
  GOLD: "bg-yellow-100 text-yellow-700",
  PLATINUM: "bg-purple-100 text-purple-700",
};

// Role colors - loaded from database (AppRole.color)
// Use DEFAULT_ROLE_COLOR from @/constants/roles as fallback

// Transaction status colors
export const TRANSACTION_STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  HELD: "bg-blue-100 text-blue-700",
  VOIDED: "bg-red-100 text-red-700",
  REFUNDED: "bg-orange-100 text-orange-700",
};

// Stock movement type config
export const STOCK_MOVEMENT_TYPES: Record<string, { label: string; color: string }> = {
  IN: { label: "Masuk", color: "bg-green-100 text-green-700" },
  OUT: { label: "Keluar", color: "bg-red-100 text-red-700" },
  ADJUSTMENT: { label: "Penyesuaian", color: "bg-blue-100 text-blue-700" },
  TRANSFER: { label: "Transfer", color: "bg-purple-100 text-purple-700" },
  OPNAME: { label: "Opname", color: "bg-orange-100 text-orange-700" },
};

// Default tax percentage
export const DEFAULT_TAX_PERCENT = 11;

// Page sizes
export const PAGE_SIZES = [10, 25, 50, 100] as const;

// POS draft storage key
export const POS_DRAFT_KEY = "pos-draft-cart";
