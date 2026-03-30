"use client";

import { useState } from "react";

export function useBranchPrices() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
