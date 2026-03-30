"use client";

import { useState } from "react";

export function useBranches() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
