"use client";

import { useState } from "react";

export function useShifts() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
