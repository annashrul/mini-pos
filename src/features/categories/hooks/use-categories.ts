"use client";

import { useState } from "react";

export function useCategories() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
