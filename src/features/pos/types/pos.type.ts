import type { CartItem, ProductSearchResult } from "@/types";
import type { posSessionSetupSchema } from "../schemas";
import type { z } from "zod";

export type RawPosProduct = {
  id: string;
  code: string;
  name: string;
  categoryId?: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  minStock: number;
  unit: string;
  imageUrl?: string | null;
  category?: { name: string } | null;
  units?: {
    id: string;
    name: string;
    conversionQty: number;
    sellingPrice: number;
    purchasePrice: number | null;
    barcode: string | null;
  }[];
  matchedUnit?: {
    name: string;
    conversionQty: number;
    sellingPrice: number;
  } | null;
};

export type PaymentMethodType =
  | "CASH"
  | "TRANSFER"
  | "QRIS"
  | "EWALLET"
  | "DEBIT"
  | "CREDIT_CARD"
  | "TERMIN";

export type PaymentEntry = {
  method: PaymentMethodType;
  amount: number;
};

export type HeldTransaction = {
  id: number;
  cart: CartItem[];
  time: string;
};

export type PosHistoryItem = {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  paymentAmount: number;
  changeAmount: number;
  status: string;
  paymentMethod: string;
  createdAt: string | Date;
  user: { name: string };
  payments?: { method: string; amount: number }[];
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    unitName?: string | undefined;
    conversionQty?: number | undefined;
  }[];
};

export type ShiftSummary = {
  openingCash: number;
  totalTransactions: number;
  totalSales: number;
  cashIn: number;
  cashOut: number;
  netCash: number;
  nonCashIn: number;
  expenseAmount: number;
  expectedCash: number;
  voidedCount: number;
};

export type PosConfig = {
  validateStock: boolean;
  allowNegativeStock: boolean;
  defaultTaxPercent: number;
  requireCustomer: boolean;
  autoOpenCashDrawer: boolean;
  businessMode: string;
  showTableNumber: boolean;
  autoSendKitchen: boolean;
};

export type DetectedCustomer = {
  id: string;
  name: string;
  phone: string | null;
  memberLevel: string;
  points: number;
  totalSpending: number;
};

export type TebusMurahOption = {
  promoId: string;
  promoName: string;
  tebusPrice: number;
  maxQty: number;
  usedQty: number;
  remainingQty: number;
  triggerLabel: string;
  product: {
    id: string;
    name: string;
    code: string;
    sellingPrice: number;
    stock: number;
    minStock: number;
    imageUrl?: string | null;
  };
};

export type PosProductCacheEntry = {
  items: ProductSearchResult[];
  page: number;
  hasMore: boolean;
  scrollTop: number;
};

export type PosSessionSetupValues = z.infer<typeof posSessionSetupSchema>;
