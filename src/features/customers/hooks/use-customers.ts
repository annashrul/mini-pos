"use client";

import { useState } from "react";

export function useCustomers() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
