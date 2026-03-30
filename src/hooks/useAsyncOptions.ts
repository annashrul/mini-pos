"use client";

import { useCallback, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";

export interface AsyncOption {
  value: string;
  label: string;
  description?: string;
}

interface UseAsyncOptionsParams<T> {
  loader: (query: string) => Promise<T[]>;
  mapOption: (item: T) => AsyncOption;
  debounceMs?: number;
}

export function useAsyncOptions<T>({
  loader,
  mapOption,
  debounceMs = 300,
}: UseAsyncOptionsParams<T>) {
  const [rawOptions, setRawOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, debounceMs);

  const load = useCallback(async (nextQuery: string) => {
    setLoading(true);
    setQuery(nextQuery);
    const loaded = await loader(nextQuery);
    setRawOptions(loaded);
    setLoading(false);
    return loaded.map(mapOption);
  }, [loader, mapOption]);

  const options = useMemo(
    () => rawOptions.map(mapOption),
    [mapOption, rawOptions]
  );

  return {
    options,
    rawOptions,
    loading,
    query,
    debouncedQuery,
    load,
  };
}
