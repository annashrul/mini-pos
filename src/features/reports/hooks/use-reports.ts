"use client";

import { useState } from "react";

export function useReports() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
