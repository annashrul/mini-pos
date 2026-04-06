"use client";

import { useState, useCallback } from "react";
import { customerIntelligenceService } from "../services";
import type { LoyaltySummary } from "../types";

export function useLoyaltySummary() {
  const [loyaltySummary, setLoyaltySummary] = useState<LoyaltySummary[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (branchId?: string) => {
    setLoading(true);
    try {
      const data = await customerIntelligenceService.getLoyaltySummary(branchId);
      setLoyaltySummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const totalPoints = loyaltySummary.reduce((sum, l) => sum + l.totalPoints, 0);
  const totalSpendingAll = loyaltySummary.reduce((sum, l) => sum + l.totalSpending, 0);

  return { loyaltySummary, totalPoints, totalSpendingAll, loading, load };
}
