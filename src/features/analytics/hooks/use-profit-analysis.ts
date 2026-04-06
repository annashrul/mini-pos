"use client";

import { useState, useCallback } from "react";
import { analyticsService } from "@/features/analytics/services";
import type { DailyProfit, ShiftProfit } from "@/features/analytics/types";

export function useProfitAnalysis() {
  const [dailyProfit, setDailyProfit] = useState<DailyProfit[]>([]);
  const [shiftProfit, setShiftProfit] = useState<ShiftProfit[]>([]);

  const loadDailyProfit = useCallback(async (branchId?: string) => {
    const data = await analyticsService.getDailyProfit(branchId);
    setDailyProfit(data);
  }, []);

  const loadShiftProfit = useCallback(async (branchId?: string) => {
    const data = await analyticsService.getShiftProfit(branchId);
    setShiftProfit(data);
  }, []);

  const reset = useCallback(() => {
    setDailyProfit([]);
    setShiftProfit([]);
  }, []);

  return { dailyProfit, shiftProfit, loadDailyProfit, loadShiftProfit, reset };
}
