"use client";

import { useMemo, useState } from "react";

interface UsePaginationParams {
  initialPage?: number;
  initialPageSize?: number;
  totalItems?: number;
}

export function usePagination({
  initialPage = 1,
  initialPageSize = 10,
  totalItems = 0,
}: UsePaginationParams = {}) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [pageSize, totalItems],
  );

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const prev = () => setPage((current) => Math.max(1, current - 1));
  const next = () => setPage((current) => Math.min(totalPages, current + 1));
  const reset = () => setPage(1);

  return {
    page,
    pageSize,
    totalPages,
    canPrev,
    canNext,
    setPage,
    setPageSize,
    prev,
    next,
    reset,
  };
}
