import type { ProfitLoss, ReportOverviewData } from "../types";

/** Human-readable labels for payment method enum values */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  TRANSFER: "Transfer",
  QRIS: "QRIS",
  EWALLET: "E-Wallet",
  DEBIT: "Debit",
  CREDIT_CARD: "Kartu Kredit",
  TERMIN: "Termin",
};

/** Shared tooltip styling used across all recharts charts */
export const chartTooltipStyle = {
  borderRadius: "16px",
  border: "none",
  boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
  padding: "12px 16px",
  fontSize: "13px",
  background: "white",
};

/** Shared axis tick styling used across all recharts charts */
export const chartAxisStyle = {
  fontSize: 11,
  fontFamily: "inherit",
  fill: "#94a3b8",
};

/** Empty/default ProfitLoss object for initial state */
export const EMPTY_PROFIT_LOSS: ProfitLoss = {
  period: "-",
  revenue: 0,
  cost: 0,
  grossProfit: 0,
  discount: 0,
  tax: 0,
  netProfit: 0,
  transactionCount: 0,
};

/** Empty/default ReportOverview object for initial state */
export const EMPTY_OVERVIEW: ReportOverviewData = {
  revenue: 0,
  transactions: 0,
  totalItemsSold: 0,
  averageTicket: 0,
  totalDiscount: 0,
  totalTax: 0,
  topCashiers: [],
  categorySales: [],
};
