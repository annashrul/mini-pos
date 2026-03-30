"use client";

import { useState } from "react";

export function useTransactions() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
