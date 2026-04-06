"use client";

import { useState, useEffect, useCallback } from "react";
import { useBranch } from "@/components/providers/branch-provider";
import { accountingService } from "../services";
import type { Tab, TrialBalanceData, IncomeStatementData, BalanceSheetData, CashFlowData } from "../types";

export function useAccountingReports() {
  const [tab, setTab] = useState<Tab>("trial-balance");
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]!);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]!);
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
