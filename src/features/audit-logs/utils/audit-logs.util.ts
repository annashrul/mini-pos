import {
  Activity,
  Award,
  Ban,
  Copy,
  CreditCard,
  LogIn,
  MapPin,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  Trash2,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

export const auditLogActionConfig: Record<
  string,
  { label: string; icon: typeof Plus; bg: string; iconBg: string; text: string }
> = {
  CREATE: {
    label: "Dibuat",
    icon: Plus,
    bg: "bg-emerald-50",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    text: "text-emerald-700",
  },
  UPDATE: {
    label: "Diupdate",
    icon: Pencil,
    bg: "bg-blue-50",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    text: "text-blue-700",
  },
  DELETE: {
    label: "Dihapus",
    icon: Trash2,
    bg: "bg-red-50",
    iconBg: "bg-gradient-to-br from-red-500 to-rose-600",
    text: "text-red-700",
  },
  LOGIN: {
    label: "Login",
    icon: LogIn,
    bg: "bg-purple-50",
    iconBg: "bg-gradient-to-br from-purple-500 to-violet-600",
    text: "text-purple-700",
  },
  VOID: {
    label: "Void",
    icon: Ban,
    bg: "bg-orange-50",
    iconBg: "bg-gradient-to-br from-orange-500 to-amber-600",
    text: "text-orange-700",
  },
  REFUND: {
    label: "Refund",
    icon: RotateCcw,
    bg: "bg-amber-50",
    iconBg: "bg-gradient-to-br from-amber-500 to-yellow-600",
    text: "text-amber-700",
  },
  RECEIVE: {
    label: "Diterima",
    icon: Package,
    bg: "bg-cyan-50",
    iconBg: "bg-gradient-to-br from-cyan-500 to-teal-600",
    text: "text-cyan-700",
  },
  COPY: {
    label: "Disalin",
    icon: Copy,
    bg: "bg-indigo-50",
    iconBg: "bg-gradient-to-br from-indigo-500 to-violet-600",
    text: "text-indigo-700",
  },
  REDEEM: {
    label: "Ditukar",
    icon: Award,
    bg: "bg-pink-50",
    iconBg: "bg-gradient-to-br from-pink-500 to-rose-600",
    text: "text-pink-700",
  },
};

export const defaultAuditLogAction = {
  label: "Lainnya",
  icon: Activity,
  bg: "bg-slate-50",
  iconBg: "bg-gradient-to-br from-slate-400 to-slate-500",
  text: "text-slate-700",
};

export const auditLogEntityIcons: Record<string, typeof Package> = {
  Product: Package,
  Brand: Tag,
  Category: Tag,
  Supplier: Truck,
  Customer: Users,
  Transaction: ShoppingCart,
  User: Users,
  Branch: MapPin,
  Role: Shield,
  Permission: Shield,
  RolePermission: Shield,
  Setting: Settings,
  Shift: CreditCard,
  CashierShift: CreditCard,
  Expense: Wallet,
  Promotion: Award,
  PurchaseOrder: Truck,
  StockMovement: Package,
  StockOpname: Package,
  StockTransfer: Package,
  BranchPrice: CreditCard,
  Points: Award,
  ProductUnit: Package,
};

const avatarColors = [
  "bg-gradient-to-br from-teal-400 to-cyan-500",
  "bg-gradient-to-br from-blue-400 to-indigo-500",
  "bg-gradient-to-br from-purple-400 to-violet-500",
  "bg-gradient-to-br from-emerald-400 to-green-500",
  "bg-gradient-to-br from-orange-400 to-amber-500",
  "bg-gradient-to-br from-pink-400 to-rose-500",
];

export function getAuditLogAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return avatarColors[Math.abs(h) % avatarColors.length]!;
}

export function getAuditLogEntityLabel(entity: string) {
  const map: Record<string, string> = {
    Product: "Produk",
    Brand: "Brand",
    Category: "Kategori",
    Supplier: "Supplier",
    Customer: "Customer",
    Transaction: "Transaksi",
    User: "Pengguna",
    Branch: "Cabang",
    Role: "Role",
    Permission: "Hak Akses",
    RolePermission: "Hak Akses Role",
    Setting: "Pengaturan",
    Shift: "Shift",
    CashierShift: "Shift Kasir",
    Expense: "Pengeluaran",
    Promotion: "Promo",
    PurchaseOrder: "Purchase Order",
    StockMovement: "Pergerakan Stok",
    StockOpname: "Stock Opname",
    StockTransfer: "Transfer Stok",
    BranchPrice: "Harga Cabang",
    Points: "Poin",
    ProductUnit: "Satuan Produk",
  };
  return map[entity] || entity;
}

export function tryParseAuditLogDetailsJson(
  str: string | null,
): Record<string, unknown> | null {
  if (!str) return null;
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
