"use client";

import { useState } from "react";

export function useProductUnits() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
