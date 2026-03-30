"use client";

import { useEffect } from "react";

/**
 * Warns user before leaving page if form has unsaved changes
 */
export function useDirtyFormGuard(isDirty: boolean, enabled = true) {
  useEffect(() => {
    if (!isDirty || !enabled) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, enabled]);
}
