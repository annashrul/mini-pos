"use client";

import { useState } from "react";

export function useStockOpname() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
