"use client";

import { useState, useCallback } from "react";
import { analyticsService } from "@/features/analytics/services";
import type { DeadStockItem, SlowMovingItem, ReorderRecommendation } from "@/features/analytics/types";

export function useDeadStock() {
  const [deadStock, setDeadStock] = useState<DeadStockItem[]>([]);
  const [slowMoving, setSlowMoving] = useState<SlowMovingItem[]>([]);
  const [reorderRecommendations, setReorderRecommendations] = useState<ReorderRecommendation[]>([]);

  const loadDeadStock = useCallback(async (branchId?: string) => {
    const data = await analyticsService.getDeadStock(branchId);
    setDeadStock(data);
  }, []);

  const loadSlowMoving = useCallback(async (branchId?: string) => {
    const data = await analyticsService.getSlowMoving(branchId);
    setSlowMoving(data);
  }, []);

  const loadReorderRecommendations = useCallback(async (branchId?: string) => {
    const data = await analyticsService.getReorderRecommendations(branchId);
    setReorderRecommendations(data);
  }, []);

  const reset = useCallback(() => {
    setDeadStock([]);
    setSlowMoving([]);
    setReorderRecommendations([]);
  }, []);

  const deadStockValue = deadStock.reduce((sum, p) => sum + p.stockValue, 0);

  return {
    deadStock, slowMoving, reorderRecommendations,
    deadStockValue,
    loadDeadStock, loadSlowMoving, loadReorderRecommendations, reset,
  };
}
