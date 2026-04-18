"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * Hook to sync state with URL query parameters.
 * Provides get/set for search, page, pageSize, and arbitrary filters.
 */
export function useQueryParams(defaults?: {
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = Number(searchParams.get("page") || defaults?.page || 1);
  const pageSize = Number(searchParams.get("pageSize") || defaults?.pageSize || 10);
  const search = searchParams.get("q") || defaults?.search || "";

  const filters = useMemo(() => {
    const f: Record<string, string> = { ...(defaults?.filters || {}) };
    searchParams.forEach((value, key) => {
      if (!["page", "pageSize", "q"].includes(key)) {
        f[key] = value;
      }
    });
    return f;
  }, [searchParams, defaults?.filters]);

  const setParams = useCallback((updates: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === undefined) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }
    // Remove defaults to keep URL clean
    if (params.get("page") === "1") params.delete("page");
    if (params.get("pageSize") === String(defaults?.pageSize || 10)) params.delete("pageSize");
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [searchParams, router, pathname, defaults?.pageSize]);

  const setPage = useCallback((p: number) => setParams({ page: p }), [setParams]);
  const setPageSize = useCallback((s: number) => setParams({ pageSize: s, page: 1 }), [setParams]);
  const setSearch = useCallback((q: string) => setParams({ q: q || null, page: 1 }), [setParams]);
  const setFilter = useCallback((key: string, value: string | null) => setParams({ [key]: value, page: 1 }), [setParams]);
  const setFilters = useCallback((f: Record<string, string>) => {
    const updates: Record<string, string | null> = { page: null };
    // Clear old filter keys
    searchParams.forEach((_, key) => {
      if (!["page", "pageSize", "q"].includes(key)) updates[key] = null;
    });
    // Set new ones
    for (const [key, value] of Object.entries(f)) {
      if (value && value !== "ALL") updates[key] = value;
    }
    setParams(updates);
  }, [setParams, searchParams]);

  return { page, pageSize, search, filters, setPage, setPageSize, setSearch, setFilter, setFilters, setParams };
}
