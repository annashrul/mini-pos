export * from "@/server/actions/reports";
import * as actions from "@/server/actions/reports";

export const reportsService = {
  getSalesReport: actions.getSalesReport,
  getTopProductsReport: actions.getTopProductsReport,
  getProfitLossReport: actions.getProfitLossReport,
  getPaymentMethodReport: actions.getPaymentMethodReport,
  getHourlySalesReport: actions.getHourlySalesReport,
  getCategorySalesReport: actions.getCategorySalesReport,
  getSupplierSalesReport: actions.getSupplierSalesReport,
  getReportOverview: actions.getReportOverview,
  getCashierSalesReport: actions.getCashierSalesReport,
};
