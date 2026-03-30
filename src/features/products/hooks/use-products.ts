"use client";

import { useState } from "react";

export function useProducts() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
