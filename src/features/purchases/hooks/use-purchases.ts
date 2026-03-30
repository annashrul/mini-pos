"use client";

import { useState } from "react";

export function usePurchases() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
