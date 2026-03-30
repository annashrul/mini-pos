"use client";

import { ErrorMessage } from "@/components/common";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorMessage onRetry={reset} />;
}
