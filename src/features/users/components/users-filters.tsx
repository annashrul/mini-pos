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

  return (
    <div className="rounded-xl border border-border/40 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari user..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 rounded-xl h-10"
          />
        </div>
        {loading && <Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onRoleFilterChange("ALL")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
            effectiveRole === "ALL"
              ? "bg-sky-500 text-white border-sky-500 shadow-sm"
              : "bg-white text-muted-foreground border-border hover:bg-slate-50"
          }`}
        >
          Semua
        </button>
        {roleOptions.map((role) => (
          <button
            key={role.value}
            type="button"
            onClick={() => onRoleFilterChange(role.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              effectiveRole === role.value
                ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                : "bg-white text-muted-foreground border-border hover:bg-slate-50"
            }`}
          >
            {role.label}
          </button>
        ))}
      </div>
    </div>
  );
}

