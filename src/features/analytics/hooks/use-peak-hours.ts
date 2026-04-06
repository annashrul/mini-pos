"use client";

import { useState, useCallback } from "react";
import { analyticsService } from "@/features/analytics/services";
import type { PeakHourData } from "@/features/analytics/types";

export function usePeakHours() {
  const [peakHours, setPeakHours] = useState<PeakHourData[]>([]);

  const loadPeakHours = useCallback(async (branchId?: string) => {
    const data = await analyticsService.getPeakHours(branchId);
    setPeakHours(data);
  }, []);

  const reset = useCallback(() => {
    setPeakHours([]);
  }, []);

  return { peakHours, loadPeakHours, reset };
}
