"use client";

import { useEffect, useState, useTransition } from "react";
import { useBranch } from "@/components/providers/branch-provider";
import {
  getSalesReport,
  getTopProductsReport,
  getProfitLossReport,
  getPaymentMethodReport,
  getHourlySalesReport,
  getReportOverview,
  getCategorySalesReport,
  getSupplierSalesReport,
  getCashierSalesReport,
} from "@/features/reports/services";
import type {
  SalesData,
  TopProduct,
  ProfitLoss,
  PaymentMethodReport,
  HourlySalesReport,
  CategorySalesReport,
  SupplierSalesReport,
  CashierSalesReport,
  ReportOverviewData,
} from "../types";
import { EMPTY_PROFIT_LOSS, EMPTY_OVERVIEW } from "../utils";

export interface ReportsData {
  dailySales: SalesData[];
  monthlySales: SalesData[];
  topProducts: TopProduct[];
  profitLoss: ProfitLoss;
  paymentMethods: PaymentMethodReport[];
  hourlySales: HourlySalesReport[];
  overview: ReportOverviewData;
  categorySales: CategorySalesReport[];
  supplierSales: SupplierSalesReport[];
  cashierSales: CashierSalesReport[];
}

export function useReportsData() {
  const { selectedBranchId, branchReady } = useBranch();
  const [dailySales, setDailySales] = useState<SalesData[]>([]);
  const [monthlySales, setMonthlySales] = useState<SalesData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [profitLoss, setProfitLoss] = useState<ProfitLoss>(EMPTY_PROFIT_LOSS);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodReport[]>([]);
  const [hourlySales, setHourlySales] = useState<HourlySalesReport[]>([]);
  const [overview, setOverview] = useState<ReportOverviewData>(EMPTY_OVERVIEW);
  const [categorySales, setCategorySales] = useState<CategorySalesReport[]>([]);
  const [supplierSales, setSupplierSales] = useState<SupplierSalesReport[]>([]);
  const [cashierSales, setCashierSales] = useState<CashierSalesReport[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isFiltering, startTransition] = useTransition();

  const fetchAll = (from?: string, to?: string) => {
    const df = from || undefined;
    const dt = to || undefined;
    const branch = selectedBranchId || undefined;

    startTransition(async () => {
      const [daily, monthly, top, pl, paymentMethodData, hourlyData, overviewData, categoryData, supplierData, cashierData] = await Promise.all([
        getSalesReport("daily", df, dt, branch),
        getSalesReport("monthly", df, dt, branch),
        getTopProductsReport(10, df, dt, branch),
        getProfitLossReport(df, dt, branch),
        getPaymentMethodReport(df, dt, branch),
        getHourlySalesReport(df, dt, branch),
        getReportOverview(df, dt, branch),
        getCategorySalesReport(df, dt, branch),
        getSupplierSalesReport(df, dt, branch),
        getCashierSalesReport(df, dt, branch),
      ]);
      setDailySales(daily);
      setMonthlySales(monthly);
      setTopProducts(top);
      setProfitLoss(pl);
      setPaymentMethods(paymentMethodData);
      setHourlySales(hourlyData);
      setOverview(overviewData);
      setCategorySales(categoryData);
      setSupplierSales(supplierData);
      setCashierSales(cashierData);
    });
  };

  const applyDateFilter = () => {
    fetchAll(dateFrom, dateTo);
  };

  const resetDateFilter = () => {
    setDateFrom("");
    setDateTo("");
    fetchAll("", "");
  };

  useEffect(() => {
    if (!branchReady) return;
    fetchAll(dateFrom, dateTo);
  }, [selectedBranchId, branchReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasData = dailySales.length > 0 || monthlySales.length > 0 || profitLoss.revenue > 0;

  return {
    dailySales,
    monthlySales,
    topProducts,
    profitLoss,
    paymentMethods,
    hourlySales,
    overview,
    categorySales,
    supplierSales,
    cashierSales,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    isFiltering,
    hasData,
    applyDateFilter,
    resetDateFilter,
  };
}
