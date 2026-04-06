"use client";

import { useState, useCallback } from "react";
import { analyticsService } from "@/features/analytics/services";
import type { MarginProduct, CategoryMargin } from "@/features/analytics/types";

export function useMarginAnalysis() {
  const [marginData, setMarginData] = useState<MarginProduct[]>([]);
  const [categoryMargins, setCategoryMargins] = useState<CategoryMargin[]>([]);

  const loadMarginData = useCallback(async (branchId?: string) => {
    const data = await analyticsService.getMarginAnalysis(branchId);
    setMarginData(data);
  }, []);

  const loadCategoryMargins = useCallback(async (branchId?: string) => {
    const data = await analyticsService.getCategoryMarginAnalysis(branchId);
    setCategoryMargins(data);
  }, []);

  const reset = useCallback(() => {
    setMarginData([]);
    setCategoryMargins([]);
  }, []);

  return { marginData, categoryMargins, loadMarginData, loadCategoryMargins, reset };
}
