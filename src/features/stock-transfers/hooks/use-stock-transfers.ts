"use client";

import { useState } from "react";

export function useStockTransfers() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
