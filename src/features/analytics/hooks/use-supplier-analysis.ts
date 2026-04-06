"use client";

import { useState, useCallback } from "react";
import { analyticsService } from "@/features/analytics/services";
import type { SupplierRankingItem, SupplierDebtItem } from "@/features/analytics/types";

export function useSupplierAnalysis() {
  const [supplierRanking, setSupplierRanking] = useState<SupplierRankingItem[]>([]);
  const [supplierDebt, setSupplierDebt] = useState<SupplierDebtItem[]>([]);

  const loadSupplierData = useCallback(async (branchId?: string) => {
    const [sr, sd] = await Promise.all([
      analyticsService.getSupplierRanking(branchId),
      analyticsService.getSupplierDebt(branchId),
    ]);
    setSupplierRanking(sr);
    setSupplierDebt(sd);
  }, []);

  const reset = useCallback(() => {
    setSupplierRanking([]);
    setSupplierDebt([]);
  }, []);

  return { supplierRanking, supplierDebt, loadSupplierData, reset };
}
