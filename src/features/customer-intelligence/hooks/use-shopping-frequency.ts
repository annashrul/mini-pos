"use client";

import { useState, useCallback } from "react";
import { customerIntelligenceService } from "../services";
import type { ShoppingFrequencyCustomer } from "../types";

export function useShoppingFrequency() {
  const [shoppingFrequency, setShoppingFrequency] = useState<ShoppingFrequencyCustomer[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (branchId?: string) => {
    setLoading(true);
    try {
      const data = await customerIntelligenceService.getShoppingFrequency(branchId);
      setShoppingFrequency(data);
    } finally {
      setLoading(false);
    }
  }, []);

  return { shoppingFrequency, loading, load };
}
