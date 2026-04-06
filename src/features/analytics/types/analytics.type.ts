export interface MarginProduct {
  id: string;
  name: string;
  code: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  category: { name: string };
  margin: number;
  marginPercent: number;
}

export interface CategoryMargin {
  name: string;
  productCount: number;
  avgCost: number;
  avgSell: number;
  avgMargin: number;
  avgMarginPercent: number;
  totalStock: number;
}

export interface DeadStockItem {
  id: string;
  name: string;
  code: string;
  stock: number;
  sellingPrice: number;
  category: { name: string };
  stockValue: number;
}

export interface SlowMovingItem {
  id: string;
  name: string;
  code: string;
  stock: number;
  category: { name: string };
  soldQty: number;
}

export interface PeakHourData {
  hour: string;
  transactions: number;
  revenue: number;
}

export interface VoidAbuseEntry {
  userName: string;
  role: string;
  voidCount: number;
  suspicious: boolean;
}

export interface UnusualDiscount {
  invoiceNumber: string;
  cashier: string;
  role: string;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  grandTotal: number;
  createdAt: string;
}

export interface DailyProfit {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface ShiftProfit {
  shiftId: string;
  cashier: string;
  openedAt: string;
  closedAt: string;
  revenue: number;
  transactions: number;
}

export interface SupplierRankingItem {
  name: string;
  productCount: number;
  totalPOValue: number;
  poCount: number;
}

export interface SupplierDebtItem {
  supplierName: string;
  totalPO: number;
  totalPaid: number;
  debt: number;
}

export interface PromoEffectivenessItem {
  promoName: string;
  type: string;
  usageCount: number;
  totalDiscount: number;
  isActive: boolean;
}

export interface ReorderRecommendation {
  product: string;
  code: string;
  currentStock: number;
  minStock: number;
  avgDailySales: number;
  daysUntilOut: number;
  recommendedQty: number;
  supplier: string;
}

export interface CashierPerformanceItem {
  name: string;
  transactions: number;
  revenue: number;
  avgTransaction: number;
}

export interface AnalyticsState {
  loading: boolean;
}
