"use client";

import { useState } from "react";

export function useSettings() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
