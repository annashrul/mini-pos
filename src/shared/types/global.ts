export type PaymentMethod = "CASH" | "TRANSFER" | "QRIS" | "EWALLET" | "DEBIT" | "CREDIT_CARD";
export type MemberLevel = "REGULAR" | "SILVER" | "GOLD" | "PLATINUM";
export type TransactionStatus = "COMPLETED" | "PENDING" | "HELD" | "VOIDED" | "REFUNDED";
export type StockMovementType = "IN" | "OUT" | "ADJUSTMENT" | "TRANSFER" | "OPNAME";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export interface ActionResult {
  success?: boolean;
  error?: string;
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}
