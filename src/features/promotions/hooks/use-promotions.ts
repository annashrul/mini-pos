"use client";

import { useState } from "react";

export function usePromotions() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
