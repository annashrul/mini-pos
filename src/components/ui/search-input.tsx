"use client";

import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  size?: "sm" | "default";
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Cari...",
  loading = false,
  className,
  size = "default",
}: SearchInputProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search className={cn(
        "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
        size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4",
      )} />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "rounded-xl bg-white",
          size === "sm" ? "pl-9 h-9 text-sm" : "pl-10 h-10 text-sm",
        )}
      />
      {loading && (
        <Loader2 className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin",
          size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4",
        )} />
      )}
    </div>
  );
}
