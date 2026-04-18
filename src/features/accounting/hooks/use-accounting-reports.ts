"use client";

import { useState, useEffect, useCallback } from "react";
import { useBranch } from "@/components/providers/branch-provider";
import { useQueryParams } from "@/hooks/use-query-params";
import { accountingService } from "../services";
import type { Tab, TrialBalanceData, IncomeStatementData, BalanceSheetData, CashFlowData } from "../types";

export function useAccountingReports() {
  const defaultDateFrom = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; })();
  const defaultDateTo = new Date().toISOString().split("T")[0]!;
  const qp = useQueryParams({ filters: { tab: "trial-balance", dateFrom: defaultDateFrom, dateTo: defaultDateTo, asOfDate: defaultDateTo } });

  const tab = (qp.filters.tab || "trial-balance") as Tab;
  const setTab = (t: Tab) => qp.setFilter("tab", t);
  const dateFrom = qp.filters.dateFrom || defaultDateFrom;
  const setDateFrom = (v: string) => qp.setFilter("dateFrom", v || null);
  const dateTo = qp.filters.dateTo || defaultDateTo;
  const setDateTo = (v: string) => qp.setFilter("dateTo", v || null);
  const asOfDate = qp.filters.asOfDate || defaultDateTo;
  const setAsOfDate = (v: string) => qp.setFilter("asOfDate", v || null);
  const { selectedBranchId } = useBranch();

  return {
    tab, setTab,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    asOfDate, setAsOfDate,
    selectedBranchId,
  };
}

export function useTrialBalance(date: string, branchId?: string) {
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [isPending, setIsPending] = useState(false);

  const load = useCallback(async () => {
    setIsPending(true);
    try {
      const r = await accountingService.getTrialBalance({ ...(date ? { date } : {}), ...(branchId ? { branchId } : {}) });
      setData(r);
    } catch { /* */ } finally { setIsPending(false); }
  }, [date, branchId]);

  useEffect(() => { load(); }, [load]);

  return { data, isPending, load };
}

export function useIncomeStatement(dateFrom: string, dateTo: string, branchId?: string) {
  const [data, setData] = useState<IncomeStatementData | null>(null);
  const [isPending, setIsPending] = useState(false);

  const load = useCallback(async () => {
    setIsPending(true);
    try {
      const r = await accountingService.getIncomeStatement({ dateFrom, dateTo, ...(branchId ? { branchId } : {}) });
      setData(r);
    } catch { /* */ } finally { setIsPending(false); }
  }, [dateFrom, dateTo, branchId]);

  useEffect(() => { load(); }, [load]);

  const netIncome = data ? data.totalRevenue - data.totalExpense : 0;
  const isProfit = netIncome >= 0;

  return { data, isPending, load, netIncome, isProfit };
}

export function useBalanceSheet(date: string, branchId?: string) {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [isPending, setIsPending] = useState(false);

  const load = useCallback(async () => {
    setIsPending(true);
    try {
      const r = await accountingService.getBalanceSheet({ date, ...(branchId ? { branchId } : {}) });
      setData(r);
    } catch { /* */ } finally { setIsPending(false); }
  }, [date, branchId]);

  useEffect(() => { load(); }, [load]);

  return { data, isPending, load };
}

export function useCashFlow(dateFrom: string, dateTo: string, branchId?: string) {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [isPending, setIsPending] = useState(false);

  const load = useCallback(async () => {
    setIsPending(true);
    try {
      const r = await accountingService.getCashFlow({ dateFrom, dateTo, ...(branchId ? { branchId } : {}) });
      setData(r);
    } catch { /* */ } finally { setIsPending(false); }
  }, [dateFrom, dateTo, branchId]);

  useEffect(() => { load(); }, [load]);

  return { data, isPending, load };
}
