"use client";

import { useEffect } from "react";
import NProgress from "nprogress";

export function FetchProgressProvider() {
  useEffect(() => {
    let activeRequests = 0;
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : (args[0] as Request)?.url || "";

      // Only track server action calls and API calls, not static assets
      const isServerAction = typeof args[1]?.body === "string" || args[1]?.method === "POST";
      const isApiCall = url.includes("/api/") || url.startsWith("/");
      const shouldTrack = isServerAction || (isApiCall && !url.includes("_next") && !url.includes("."));

      if (!shouldTrack) {
        return originalFetch(...args);
      }

      activeRequests++;
      if (activeRequests === 1) {
        NProgress.start();
      }

      try {
        const response = await originalFetch(...args);
        return response;
      } finally {
        activeRequests--;
        if (activeRequests === 0) {
          NProgress.done();
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
