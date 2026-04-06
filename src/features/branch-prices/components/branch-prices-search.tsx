"use client";

import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";

export function BranchPricesSearch(props: {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
}) {
  const { value, loading, onChange } = props;

  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
      <Input
        placeholder="Cari nama produk atau kode..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 rounded-xl h-10 border-slate-200/60 bg-white shadow-sm focus-visible:ring-violet-500/20"
      />
      {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-violet-500" />}
    </div>
  );
}

