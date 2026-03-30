"use client";

import { useState } from "react";

export function useCustomerIntelligence() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
