import type { getReportOverview } from "@/server/actions/reports";

// Re-export shared types for convenience
export type {
  SalesData,
  TopProduct,
  ProfitLoss,
  PaymentMethodReport,
  HourlySalesReport,
  CategorySalesReport,
  SupplierSalesReport,
  CashierSalesReport,
} from "@/types";

/** The shape returned by the getReportOverview server action */
export type ReportOverviewData = Awaited<ReturnType<typeof getReportOverview>>;

/** Valid tab keys for the reports page */
export const VALID_REPORT_TABS = ["daily", "monthly", "category", "supplier", "cashier"] as const;
export type ReportTab = (typeof VALID_REPORT_TABS)[number];

/** Common date-range filter state used by all report hooks */
export interface DateRangeFilter {
  dateFrom: string;
  dateTo: string;
}
