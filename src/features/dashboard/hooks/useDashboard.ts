"use client";

import { useEffect, useState } from "react";
import { dashboardService } from "../services/dashboard.service";

export function useDashboard() {
  const [data, setData] = useState<Awaited<ReturnType<typeof dashboardService.getStats>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const result = await dashboardService.getStats();
      setData(result);
      setLoading(false);
    };
    run();
  }, []);

  return { data, loading };
}
