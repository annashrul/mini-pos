"use client";

import { useState } from "react";

export function useBrands() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
