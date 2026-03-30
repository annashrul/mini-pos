"use client";

import { useState } from "react";

export function useUsers() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
