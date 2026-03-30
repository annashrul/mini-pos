"use client";

import { useState } from "react";

export function usePos() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
