"use client";

import { useState } from "react";

export function useExpenses() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
