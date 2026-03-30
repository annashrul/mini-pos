"use client";

import { useState } from "react";

export function useAuditLogs() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
