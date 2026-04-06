"use client";

import { useState, useCallback } from "react";
import { customerIntelligenceService } from "../services";
import type { RepeatCustomer } from "../types";

export function useRepeatCustomers() {
  const [repeatCustomers, setRepeatCustomers] = useState<RepeatCustomer[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (branchId?: string) => {
    setLoading(true);
    try {
      const data = await customerIntelligenceService.getRepeatCustomers(branchId);
      setRepeatCustomers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const totalCustomers = repeatCustomers.length;
  const repeatCount = repeatCustomers.filter((c) => c.isRepeat).length;

  return { repeatCustomers, totalCustomers, repeatCount, loading, load };
}
