"use client";

import { useState } from "react";

export function useNotifications() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
