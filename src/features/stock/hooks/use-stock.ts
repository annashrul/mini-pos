"use client";

import { useState } from "react";

export function useStock() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
