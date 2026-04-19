"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Check, SlidersHorizontal } from "lucide-react";

export function UsersFilters(props: {
  search: string;
  loading: boolean;
  effectiveRole: string;
  roleOptions: Array<{ value: string; label: string }>;
  stats: { total: number; active: number; topRoles: [string, number][] };
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (roleKey: string) => void;
}) {
  const { search, loading, effectiveRole, roleOptions, stats, onSearchChange, onRoleFilterChange } = props;
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftRole, setDraftRole] = useState("ALL");

  const isInitialLoad = stats.total === 0 && roleOptions.length === 0;
  const roleCountMap = new Map(stats.topRoles);
  const seen = new Set<string>();
  const dedupedRoles = roleOptions.filter((r) => { if (seen.has(r.value)) return false; seen.add(r.value); return true; });
  const allRoleOptions = [{ value: "ALL", label: "Semua", count: stats.total }, ...dedupedRoles.map((r) => ({ ...r, count: roleCountMap.get(r.value) ?? 0 }))];

  const pillClass = (active: boolean) =>
    `shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
      active
        ? "bg-sky-500 text-white border-sky-500 shadow-sm"
        : "bg-white text-muted-foreground border-border hover:bg-slate-50"
    }`;

  return (
    <>
      {/* Mobile: search + filter button + bottom sheet */}
      <div className="sm:hidden flex items-center gap-2">
        <SearchInput value={search} onChange={onSearchChange} placeholder="Cari user..." loading={loading} className="flex-1" size="sm" />
        <Button variant="outline" size="sm" className="shrink-0 rounded-xl h-9 gap-1.5 relative" onClick={() => { setDraftRole(effectiveRole); setFilterSheetOpen(true); }}>
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="text-xs">Filter</span>
          {effectiveRole !== "ALL" && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">1</span>
          )}
        </Button>
        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
            <div className="shrink-0">
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
              </div>
              <SheetHeader className="px-4 pb-3 pt-0">
                <SheetTitle className="text-base font-bold">Filter Role</SheetTitle>
              </SheetHeader>
            </div>
            <div className="flex-1 overflow-y-auto px-4 space-y-1">
              {allRoleOptions.map((opt, idx) => {
                const isActive = draftRole === opt.value;
                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    onClick={() => setDraftRole(opt.value)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}
                  >
                    <span className="flex items-center gap-2">
                      {opt.label}
                      <span className={`text-[10px] font-mono tabular-nums ${isActive ? "text-background/60" : "text-muted-foreground/50"}`}>{opt.count}</span>
                    </span>
                    {isActive && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
            <SheetFooter className="shrink-0 border-t px-4 py-3 flex-row gap-2">
              <Button variant="outline" className="flex-1 rounded-xl h-10 text-sm" onClick={() => setDraftRole("ALL")}>
                Reset
              </Button>
              <Button className="flex-1 rounded-xl h-10 text-sm shadow-md" onClick={() => { onRoleFilterChange(draftRole); setFilterSheetOpen(false); }}>
                Terapkan Filter
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: search left + pills right */}
      <div className="hidden sm:flex items-center justify-between gap-4">
        <SearchInput value={search} onChange={onSearchChange} placeholder="Cari user..." loading={loading} className="flex-1 max-w-sm" />
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isInitialLoad ? (
            // Skeleton pills
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 rounded-full bg-gray-100 animate-pulse" style={{ width: `${60 + i * 15}px` }} />
              ))}
            </>
          ) : (
            allRoleOptions.map((role, idx) => (
              <button key={`${role.value}-${idx}`} type="button" onClick={() => onRoleFilterChange(role.value)} className={pillClass(effectiveRole === role.value)}>
                {role.label}
                <span className={`font-mono tabular-nums text-[10px] ${effectiveRole === role.value ? "text-white/70" : "text-muted-foreground/50"}`}>
                  {role.count}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
