"use client";

import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";

export function UsersFilters(props: {
  search: string;
  loading: boolean;
  effectiveRole: string;
  roleOptions: Array<{ value: string; label: string }>;
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (roleKey: string) => void;
}) {
  const { search, loading, effectiveRole, roleOptions, onSearchChange, onRoleFilterChange } = props;

  const pillClass = (active: boolean) =>
    `shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
      active
        ? "bg-sky-500 text-white border-sky-500 shadow-sm"
        : "bg-white text-muted-foreground border-border hover:bg-slate-50"
    }`;

  const pills = (
    <>
      <button type="button" onClick={() => onRoleFilterChange("ALL")} className={pillClass(effectiveRole === "ALL")}>
        Semua
      </button>
      {roleOptions.map((role) => (
        <button key={role.value} type="button" onClick={() => onRoleFilterChange(role.value)} className={pillClass(effectiveRole === role.value)}>
          {role.label}
        </button>
      ))}
    </>
  );

  return (
    <>
      {/* Mobile: stacked search + scroll pills */}
      <div className="sm:hidden space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari user..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 rounded-xl h-9 text-sm"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {pills}
        </div>
      </div>

      {/* Desktop: search left + pills right */}
      <div className="hidden sm:flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari user..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 rounded-xl h-10"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {pills}
        </div>
      </div>
    </>
  );
}

