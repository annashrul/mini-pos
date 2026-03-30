"use client";

import { useState } from "react";

export function useSuppliers() {
  const [loading, setLoading] = useState(false);

  return { loading, setLoading };
}
