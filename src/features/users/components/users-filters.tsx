"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Check, Loader2, Search, SlidersHorizontal } from "lucide-react";

export function UsersFilters(props: {
  search: string;
  loading: boolean;
  effectiveRole: string;
  roleOptions: Array<{ value: string; label: string }>;
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (roleKey: string) => void;
}) {
  const { search, loading, effectiveRole, roleOptions, onSearchChange, onRoleFilterChange } = props;
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftRole, setDraftRole] = useState("ALL");

  const allRoleOptions = [{ value: "ALL", label: "Semua" }, ...roleOptions];

  const pillClass = (active: boolean) =>
    `shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
      active
        ? "bg-sky-500 text-white border-sky-500 shadow-sm"
        : "bg-white text-muted-foreground border-border hover:bg-slate-50"
    }`;

  return (
    <>
      {/* Mobile: search + filter button + bottom sheet */}
      <div className="sm:hidden flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari user..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 rounded-xl h-9 text-sm"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
        </div>
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
              {allRoleOptions.map((opt) => {
                const isActive = draftRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setDraftRole(opt.value)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}
                  >
                    <span>{opt.label}</span>
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
          {allRoleOptions.map((role) => (
            <button key={role.value} type="button" onClick={() => onRoleFilterChange(role.value)} className={pillClass(effectiveRole === role.value)}>
              {role.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

