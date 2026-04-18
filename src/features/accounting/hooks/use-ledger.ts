"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useBranch } from "@/components/providers/branch-provider";
import { useQueryParams } from "@/hooks/use-query-params";
import { accountingService } from "../services";
import type { AccountSimple, LedgerData } from "../types";

function getDefaultDateRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().split("T")[0]!;
  return { from: fmt(new Date(y, m, 1)), to: fmt(now) };
}

export function useLedger() {
  const defaultDates = getDefaultDateRange();
  const qp = useQueryParams({ filters: { accountId: "", dateFrom: defaultDates.from, dateTo: defaultDates.to } });
  const [accounts, setAccounts] = useState<AccountSimple[]>([]);
  const selectedAccountId = qp.filters.accountId || "";
  const setSelectedAccountId = (id: string) => qp.setFilter("accountId", id || null);
  const [accountOpen, setAccountOpen] = useState(false);
  const dateFrom = qp.filters.dateFrom || defaultDates.from;
  const dateTo = qp.filters.dateTo || defaultDates.to;
  const setDateFrom = (v: string) => qp.setFilter("dateFrom", v || null);
  const setDateTo = (v: string) => qp.setFilter("dateTo", v || null);
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [loading, startTransition] = useTransition();
  const [initialLoad, setInitialLoad] = useState(true);
  const { selectedBranchId } = useBranch();

  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await accountingService.getAccounts({
          ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAccounts(result.accounts.map((a: any) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          category: a.category?.name ?? a.category ?? "",
        })));
      } catch {
        toast.error("Gagal memuat data akun");
      } finally {
        setInitialLoad(false);
      }
    });
  }, [selectedBranchId]);

  const fetchLedger = () => {
    if (!selectedAccountId) {
      toast.error("Pilih akun terlebih dahulu");
      return;
    }
    startTransition(async () => {
      try {
        const result = await accountingService.getGeneralLedger({
          accountId: selectedAccountId,
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
          ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
        });
        setLedger(result);
      } catch {
        toast.error("Gagal memuat buku besar");
      }
    });
  };

  useEffect(() => {
    if (selectedAccountId) {
      fetchLedger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, dateFrom, dateTo, selectedBranchId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return {
    accounts,
    selectedAccountId,
    setSelectedAccountId,
    accountOpen,
    setAccountOpen,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    ledger,
    loading,
    initialLoad,
    selectedAccount,
    reload: fetchLedger,
  };
}
