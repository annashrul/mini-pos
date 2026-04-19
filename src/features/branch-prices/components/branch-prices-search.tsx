"use client";

import { SearchInput } from "@/components/ui/search-input";

export function BranchPricesSearch(props: {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
}) {
  const { value, loading, onChange } = props;

  return (
    <SearchInput
      value={value}
      onChange={onChange}
      placeholder="Cari nama produk atau kode..."
      loading={loading}
      className="flex-1 max-w-sm"
    />
  );
}
