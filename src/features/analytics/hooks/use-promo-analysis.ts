"use client";

import { useState, useCallback } from "react";
import { analyticsService } from "@/features/analytics/services";
import type { PromoEffectivenessItem, CashierPerformanceItem } from "@/features/analytics/types";

export function usePromoAnalysis() {
  const [promoEffectiveness, setPromoEffectiveness] = useState<PromoEffectivenessItem[]>([]);
  const [cashierPerf, setCashierPerf] = useState<CashierPerformanceItem[]>([]);

  const loadPromoEffectiveness = useCallback(async (branchId?: string) => {
    const data = await analyticsService.getPromoEffectiveness(branchId);
    setPromoEffectiveness(data);
  }, []);

  const loadCashierPerformance = useCallback(async (branchId?: string) => {
    const data = await analyticsService.getCashierPerformance(branchId);
    setCashierPerf(data);
  }, []);

  const reset = useCallback(() => {
    setPromoEffectiveness([]);
    setCashierPerf([]);
  }, []);

  return {
    promoEffectiveness, cashierPerf,
    loadPromoEffectiveness, loadCashierPerformance, reset,
  };
}
