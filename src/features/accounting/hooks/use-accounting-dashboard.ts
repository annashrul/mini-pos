"use client";

import { useState, useEffect } from "react";
import { useBranch } from "@/components/providers/branch-provider";
import { accountingService } from "../services";
import type { DashboardData } from "../types";

export function useAccountingDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { selectedBranchId } = useBranch();

  useEffect(() => {
    let active = true;
    setLoading(true);
    accountingService
      .getAccountingDashboard(selectedBranchId || undefined)
      .then((result) => {
        if (!active) return;
        if (result && typeof result === "object" && !("error" in result)) {
          setData(result as DashboardData);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedBranchId]);

  return {
    data,
    isPending: loading,
  };
}
