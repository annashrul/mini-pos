"use client";

import { useState, useCallback } from "react";
import { analyticsService } from "@/features/analytics/services";
import type { VoidAbuseEntry, UnusualDiscount } from "@/features/analytics/types";

export function useFraudDetection() {
  const [voidAbuse, setVoidAbuse] = useState<VoidAbuseEntry[]>([]);
  const [unusualDiscounts, setUnusualDiscounts] = useState<UnusualDiscount[]>([]);

  const loadVoidAbuse = useCallback(async (branchId?: string) => {
    const data = await analyticsService.getVoidAbuseDetection(branchId);
    setVoidAbuse(data);
  }, []);

  const loadUnusualDiscounts = useCallback(async (branchId?: string) => {
    const data = await analyticsService.getUnusualDiscounts(branchId);
    setUnusualDiscounts(data);
  }, []);

  const reset = useCallback(() => {
    setVoidAbuse([]);
    setUnusualDiscounts([]);
  }, []);

  const suspiciousCount = voidAbuse.filter((v) => v.suspicious).length;

  return {
    voidAbuse, unusualDiscounts, suspiciousCount,
    loadVoidAbuse, loadUnusualDiscounts, reset,
  };
}
