"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useBranch } from "@/components/providers/branch-provider";
import { useQueryParams } from "@/hooks/use-query-params";
import { accountingService } from "../services";
import type { Journal, JournalsData } from "../types";

export function useJournals() {
  const [data, setData] = useState<JournalsData>({
    journals: [],
    total: 0,
    totalPages: 0,
  });
  const { page, pageSize, search, filters, setPage, setPageSize, setSearch, setFilters } = useQueryParams({
    pageSize: 15,
    filters: { status: "ALL", dateFrom: "", dateTo: "" },
  });
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const { selectedBranchId } = useBranch();

  const status = filters.status || "ALL";
  const dateFrom = filters.dateFrom || "";
  const dateTo = filters.dateTo || "";

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await accountingService.getJournalEntries({
        search,
        page,
        perPage: pageSize,
        ...(status !== "ALL" ? { status } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
      });
      setData({
        journals: result.entries.map((e) => ({
          id: e.id,
          number: e.entryNumber,
          date: typeof e.date === "string" ? e.date : new Date(e.date).toISOString(),
          description: e.description,
          reference: e.reference,
          type: e.referenceType || "MANUAL",
          status: e.status,
          createdBy: e.createdByUser.id,
          createdByName: e.createdByUser.name || e.createdByUser.email || "",
          totalDebit: e.totalDebit,
          totalCredit: e.totalCredit,
          notes: e.notes,
          rejectionNote: ((e as Record<string, unknown>).rejectionNote as string | null) ?? null,
          branchId: e.branchId,
          lines: e.lines.map((l) => ({
            id: l.id,
            accountId: l.accountId,
            accountCode: l.account.code,
            accountName: l.account.name,
            description: l.description || "",
            debit: l.debit,
            credit: l.credit,
          })),
        })),
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch {
      toast.error("Gagal memuat data jurnal");
    } finally {
      setInitialLoad(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, page, pageSize, search, status, dateFrom, dateTo]);

  const handleRowClick = (journal: Journal) => {
    setSelectedJournal(journal);
    setDetailOpen(true);
  };

  const handleFormClose = (saved?: boolean) => {
    setFormOpen(false);
    if (saved) fetchData();
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  const handleFilterChange = (f: Record<string, string>) => {
    setFilters(f);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
  };

  const activeFilters: Record<string, string> = {
    status,
    dateFrom,
    dateTo,
  };

  return {
    data,
    page,
    pageSize,
    search,
    status,
    dateFrom,
    dateTo,
    formOpen,
    detailOpen,
    selectedJournal,
    loading,
    initialLoad,
    activeFilters,
    setPage,
    setSearch,
    setFormOpen,
    setDetailOpen,
    handleRowClick,
    handleFormClose,
    handleSearchChange,
    handleFilterChange,
    handlePageSizeChange,
    fetchData,
  };
}
