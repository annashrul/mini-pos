"use client";

import type { ReactNode } from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { cn } from "@/lib/utils";
import { exportToCSV } from "@/lib/export";
import {
  Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  SlidersHorizontal, Columns3, Download, X, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import Link from "next/link";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { getPlanUi } from "@/lib/plan-ui";

// ===========================
// Types
// ===========================

export interface SmartColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  visible?: boolean;
  sticky?: boolean; // sticky right for action column
  stickyLeft?: boolean; // sticky left for pinned column
  width?: string;
  align?: "left" | "center" | "right";
  render: (row: T, index: number) => ReactNode;
  exportValue?: (row: T) => string | number;
}

export interface SmartFilter {
  key: string;
  label: string;
  type: "select" | "date" | "daterange" | "text";
  options?: { value: string; label: string }[];
}

export interface SmartTableProps<T> {
  data: T[];
  columns: SmartColumn<T>[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  loading?: boolean;

  // Search
  searchPlaceholder?: string;
  onSearch: (query: string) => void;

  // Pagination
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;

  // Sort
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string, dir: "asc" | "desc") => void;

  // Filters
  filters?: SmartFilter[];
  activeFilters?: Record<string, string>;
  onFilterChange?: (filters: Record<string, string>) => void;

  // Row select
  selectable?: boolean;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  rowKey?: (row: T) => string;

  // Bulk actions
  bulkActions?: { label: string; icon?: ReactNode; onClick: (selectedIds: string[]) => void; variant?: "default" | "destructive" }[];

  // Export
  exportFilename?: string;
  /** Module name for ExportMenu (replaces built-in CSV export) */
  exportModule?: string | undefined;
  /** Branch ID filter for ExportMenu */
  exportBranchId?: string | undefined;

  // Empty state
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyAction?: ReactNode;

  // Title
  title?: string;
  titleIcon?: ReactNode;
  titleExtra?: ReactNode;
  headerActions?: ReactNode;
  emptyDescription?: string;

  // Mobile card render — custom card layout per page
  // If provided, this replaces the default auto-generated card layout on mobile
  mobileRender?: (row: T, index: number) => ReactNode;

  // Row click
  onRowClick?: (row: T) => void;

  // Number of columns in the filter modal grid (default: 1)
  filterColumns?: 1 | 2;

  // Slot rendered between search/filters and the table content
  afterFilters?: ReactNode;

  // Menu key for plan access check (auto-checks export action)
  planMenuKey?: string | undefined;
}

// ===========================
// Component
// ===========================

export function SmartTable<T>({
  data,
  columns: allColumns,
  totalItems,
  totalPages,
  currentPage,
  pageSize,
  loading,
  searchPlaceholder = "Cari...",
  onSearch,
  onPageChange,
  onPageSizeChange,
  sortKey,
  sortDir,
  onSort,
  filters,
  activeFilters = {},
  onFilterChange,
  selectable,
  selectedRows = new Set(),
  onSelectionChange,
  rowKey,
  bulkActions,
  exportFilename,
  exportModule,
  exportBranchId,
  emptyIcon,
  emptyTitle = "Tidak ada data",
  emptyAction,
  title,
  titleIcon,
  titleExtra,
  headerActions,
  emptyDescription,
  onRowClick,
  mobileRender,
  filterColumns = 1,
  afterFilters,
  planMenuKey,
}: SmartTableProps<T>) {
  const [searchValue, setSearchValue] = useState("");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState<Record<string, string>>(activeFilters);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 640px)").matches : false
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { canAction: canPlanAction, getRequiredPlan } = usePlanAccess();
  const exportLocked = planMenuKey && exportFilename ? !canPlanAction(planMenuKey, "export") : false;
  const exportPlanUi = exportLocked && planMenuKey ? getPlanUi(getRequiredPlan(planMenuKey, "export").badge) : null;

  const columns = allColumns.filter((c) => !hiddenColumns.has(c.key) && c.visible !== false);
  const activeFilterCount = Object.values(activeFilters).filter((v) => v && v !== "ALL").length;
  const hasSelection = selectedRows.size > 0;

  // Load hidden columns from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(`table-cols-${exportFilename || "default"}`);
    if (saved) {
      try { setHiddenColumns(new Set(JSON.parse(saved))); } catch { /* ignore */ }
    }
  }, [exportFilename]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const apply = () => setIsDesktop(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const saveColumnPref = (hidden: Set<string>) => {
    setHiddenColumns(hidden);
    if (typeof window !== "undefined") {
      localStorage.setItem(`table-cols-${exportFilename || "default"}`, JSON.stringify([...hidden]));
    }
  };

  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(value), 300);
  }, [onSearch]);

  const handleSort = (key: string) => {
    if (!onSort) return;
    if (sortKey === key) {
      onSort(key, sortDir === "asc" ? "desc" : "asc");
    } else {
      onSort(key, "asc");
    }
  };

  const currentPageIds = rowKey ? data.map(rowKey) : [];
  const allCurrentSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedRows.has(id));
  const someCurrentSelected = !allCurrentSelected && currentPageIds.some((id) => selectedRows.has(id));

  const toggleSelectAll = () => {
    if (!rowKey || !onSelectionChange) return;
    const next = new Set(selectedRows);
    if (allCurrentSelected) {
      // Deselect only current page
      currentPageIds.forEach((id) => next.delete(id));
    } else {
      // Select all on current page (keep existing from other pages)
      currentPageIds.forEach((id) => next.add(id));
    }
    onSelectionChange(next);
  };

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedRows);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  };

  const handleExport = () => {
    if (!exportFilename) return;
    const exportData = data.map((row) => {
      const obj: Record<string, string | number> = {};
      allColumns.forEach((col) => {
        if (col.exportValue) obj[col.header] = col.exportValue(row);
      });
      return obj;
    });
    exportToCSV(exportData, exportFilename);
  };

  const applyFilters = () => {
    onFilterChange?.(tempFilters);
    setFilterModalOpen(false);
  };

  const resetFilters = () => {
    const empty: Record<string, string> = {};
    filters?.forEach((f) => { empty[f.key] = "ALL"; });
    setTempFilters(empty);
    onFilterChange?.(empty);
    setFilterModalOpen(false);
  };

  const removeFilter = (key: string) => {
    const next = { ...activeFilters, [key]: "ALL" };
    onFilterChange?.(next);
    setTempFilters(next);
  };

  const toggleColWidth = 33; // w-8 + px-1 ~ 33px

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <>
    <div className="bg-white rounded-2xl shadow-sm border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-border/50 space-y-2 sm:space-y-3">
        {/* Row 1: Title + extra */}
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            {titleIcon && <span className="shrink-0">{titleIcon}</span>}
            {title && <h3 className="font-semibold text-xs sm:text-base text-foreground truncate">{title}</h3>}
          </div>
          {titleExtra}
        </div>

        {/* Row 2: Search + actions */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 rounded-xl w-full h-9 sm:h-8 text-sm"
            />
          </div>
          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {filters && filters.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                className="relative rounded-lg h-8 w-auto px-3 gap-1.5"
                onClick={() => { setTempFilters(activeFilters); setFilterModalOpen(true); }}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="text-xs">Filter</span>
                {activeFilterCount > 0 && (
                  <Badge className="h-4 w-4 p-0 text-[10px] rounded-full bg-primary text-primary-foreground">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            )}

            {exportModule && !exportLocked ? (
              <ExportMenu module={exportModule} branchId={exportBranchId} size="default" className="rounded-lg h-8 w-auto px-3 gap-1.5 text-xs" />
            ) : exportFilename && !exportLocked ? (
              <Button variant="outline" size="icon" className="rounded-lg h-8 w-auto px-3 gap-1.5" onClick={handleExport}>
                <Download className="w-3.5 h-3.5" />
                <span className="text-xs">Export</span>
              </Button>
            ) : exportFilename && exportLocked && exportPlanUi ? (() => {
              const PlanIcon = exportPlanUi.icon;
              return (
                <Button variant="outline" size="icon" className="rounded-lg h-8 w-auto px-3 gap-1.5 opacity-60" asChild>
                  <Link href="/plan">
                    <Download className="w-3.5 h-3.5" />
                    <span className="text-xs">Export</span>
                    <PlanIcon className={cn("w-3 h-3", exportPlanUi.color)} />
                  </Link>
                </Button>);
            })() : null}

            {headerActions}
          </div>
          {/* Mobile action buttons — next to search */}
          <div className="flex sm:hidden items-center gap-1 shrink-0">
            {filters && filters.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                className="relative rounded-lg h-9 w-9"
                onClick={() => { setTempFilters(activeFilters); setFilterModalOpen(true); }}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {activeFilterCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </Button>
            )}
            {exportModule && !exportLocked ? (
              <ExportMenu module={exportModule} branchId={exportBranchId} size="icon" className="rounded-lg h-9 w-9" />
            ) : exportFilename && !exportLocked ? (
              <Button variant="outline" size="icon" className="rounded-lg h-9 w-9" onClick={handleExport}>
                <Download className="w-3.5 h-3.5" />
              </Button>
            ) : exportFilename && exportLocked && exportPlanUi ? (() => {
              const PlanIcon = exportPlanUi.icon;
              return (
                <Button variant="outline" size="icon" className="rounded-lg h-9 w-9 opacity-60 relative" asChild>
                  <Link href="/plan">
                    <Download className="w-3.5 h-3.5" />
                    <PlanIcon className={cn("w-2.5 h-2.5 absolute -top-1 -right-1", exportPlanUi.color)} />
                  </Link>
                </Button>);
            })() : null}
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.entries(activeFilters).map(([key, val]) => {
              if (!val || val === "ALL") return null;
              const baseKey = key.replace(/_from$|_to$/, "");
              const suffix = key.endsWith("_from") ? " dari" : key.endsWith("_to") ? " s/d" : "";
              const filterDef = filters?.find((f) => f.key === key || f.key === baseKey);
              const label = filterDef?.options?.find((o) => o.value === val)?.label || val;
              return (
                <Badge key={key} variant="secondary" className="rounded-lg text-[10px] sm:text-xs gap-1 pl-2 pr-1 py-0.5 bg-accent text-accent-foreground">
                  <span className="hidden sm:inline">{filterDef?.label}{suffix}: </span>{label}
                  <button onClick={() => removeFilter(key)} className="ml-0.5 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
            <button onClick={resetFilters} className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground">
              Reset
            </button>
          </div>
        )}
      </div>

      {/* After filters slot */}
      {afterFilters && <div className="pt-2">{afterFilters}</div>}

      {/* Bulk action bar — floating fixed bottom */}

      {/* Mobile: Card view */}
      <div className="sm:hidden">
        {loading && data.length === 0 ? (
          <div className="p-2 space-y-1.5 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border/30 px-2.5 py-2 space-y-1.5">
                <div className="h-3.5 w-2/3 bg-gray-200 rounded" />
                <div className="h-2.5 w-1/2 bg-gray-100 rounded" />
                <div className="h-2.5 w-1/3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="px-3 py-12 text-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              {emptyIcon}
              <p className="text-sm">{emptyTitle}</p>
              {emptyDescription && <p className="text-xs text-muted-foreground">{emptyDescription}</p>}
              {emptyAction}
            </div>
          </div>
        ) : (
          <div className={cn("p-2 space-y-1.5", loading && data.length > 0 && "opacity-50 pointer-events-none")}>
            {data.map((row, i) => {
              const id = rowKey ? rowKey(row) : String(i);
              const isSelected = selectedRows.has(id);

              return (
                <div
                  key={id}
                  className={cn(
                    "rounded-lg border border-border/40 bg-white transition-all active:scale-[0.99]",
                    isSelected && "ring-2 ring-primary/30 bg-primary/5",
                    onRowClick && "cursor-pointer",
                    !mobileRender && "p-2.5",
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {mobileRender ? (
                    /* Custom mobile render — actions handled inside mobileRender */
                    <div className="px-2.5 py-2">
                      <div className="min-w-0">{mobileRender(row, i)}</div>
                    </div>
                  ) : (
                    /* Default fallback: auto-layout from columns */
                    <>
                      <div className="flex items-start gap-2">
                        {selectable && (
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleRow(id)} className="mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()} />
                        )}
                        <div className="flex-1 min-w-0">
                          {columns.find((c) => !c.sticky) && <div className="mb-1">{columns.find((c) => !c.sticky)!.render(row, i)}</div>}
                        </div>
                        {columns.find((c) => c.sticky) && (
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            {columns.find((c) => c.sticky)!.render(row, i)}
                          </div>
                        )}
                      </div>
                      {columns.filter((c) => !c.sticky && c !== columns.find((cc) => !cc.sticky)).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/30 grid grid-cols-2 gap-x-3 gap-y-1.5">
                          {columns.filter((c) => !c.sticky && c !== columns.find((cc) => !cc.sticky)).map((col) => (
                            <div key={col.key} className={cn(col.align === "right" && "text-right")}>
                              <p className="text-[10px] text-muted-foreground/70 mb-0.5">{col.header}</p>
                              <div>{col.render(row, i)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop: Table view */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead className="sticky top-0 bg-muted/50 z-10">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2.5 text-center">
                  <Checkbox
                    checked={allCurrentSelected ? true : someCurrentSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.sortable && "cursor-pointer select-none hover:text-foreground transition-colors",
                    col.sticky && "sticky z-20 bg-muted shadow-[-2px_0_4px_rgba(0,0,0,0.05)]",
                    col.stickyLeft && "sticky left-0 z-20 bg-muted shadow-[2px_0_4px_rgba(0,0,0,0.05)]",
                  )}
                  style={{ ...(col.width ? { width: col.width } : {}), ...(col.sticky ? { right: toggleColWidth } : {}) }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className={cn("flex items-center gap-1", col.align === "right" && "justify-end", col.align === "center" && "justify-center")}>
                    {col.header}
                    {col.sortable && (
                      sortKey === col.key ? (
                        sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>
              ))}
              <th className="w-8 px-1 py-2.5 sticky right-0 z-20 bg-muted">
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="p-1 rounded-md hover:bg-accent transition-colors" title="Atur Kolom">
                      <Columns3 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="rounded-xl w-[200px] p-2 space-y-1">
                    <div className="flex items-center justify-between px-1 pb-1 border-b border-border/40 mb-1">
                      <span className="text-xs font-semibold text-muted-foreground">Kolom</span>
                      <button
                        type="button"
                        className="text-[10px] text-primary hover:underline"
                        onClick={() => {
                          if (hiddenColumns.size === 0) {
                            // Hide all except first
                            const next = new Set(allColumns.slice(1).map((c) => c.key));
                            saveColumnPref(next);
                          } else {
                            saveColumnPref(new Set());
                          }
                        }}
                      >
                        {hiddenColumns.size === 0 ? "Sembunyikan Semua" : "Tampilkan Semua"}
                      </button>
                    </div>
                    {allColumns.map((col) => (
                      <label key={col.key} className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={!hiddenColumns.has(col.key)}
                          onCheckedChange={(checked) => {
                            const next = new Set(hiddenColumns);
                            if (checked) next.delete(col.key); else next.add(col.key);
                            saveColumnPref(next);
                          }}
                        />
                        <span className="text-xs">{col.header}</span>
                      </label>
                    ))}
                  </PopoverContent>
                </Popover>
              </th>
            </tr>
          </thead>
          {loading && data.length === 0 ? (
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/30">
                  {selectable && (
                    <td className="w-10 px-3 py-2.5 text-center">
                      <div className="animate-pulse">
                        <div className="h-4 w-4 bg-gray-200 rounded" />
                      </div>
                    </td>
                  )}
                  {columns.map((col, ci) => {
                    const isFirst = ci === 0;
                    const isLast = ci === columns.length - 1;
                    const widthClass = isFirst
                      ? "w-3/4"
                      : isLast && col.sticky
                        ? "w-8"
                        : isLast
                          ? "w-1/4"
                          : i % 2 === 0
                            ? "w-2/3"
                            : "w-1/2";
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-3 py-2.5",
                          col.sticky && "sticky z-10 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.05)]",
                          col.stickyLeft && "sticky left-0 z-10 bg-white shadow-[2px_0_4px_rgba(0,0,0,0.05)]",
                        )}
                        style={col.sticky ? { right: toggleColWidth } : undefined}
                      >
                        <div className="animate-pulse flex items-center gap-2">
                          {isFirst && (
                            <div className="h-8 w-8 bg-gray-200 rounded-lg shrink-0" />
                          )}
                          <div className={cn("h-4 bg-gray-200 rounded", widthClass)} />
                        </div>
                      </td>
                    );
                  })}
                  <td className="w-8 px-1 py-2.5 sticky right-0 z-10 bg-white" />
                </tr>
              ))}
            </tbody>
          ) : (
            <tbody className={cn(loading && data.length > 0 && "opacity-50 pointer-events-none transition-opacity")}>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0) + 1} className="px-3 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      {emptyIcon}
                      <p className="text-sm">{emptyTitle}</p>
                      {emptyDescription && <p className="text-xs text-muted-foreground">{emptyDescription}</p>}
                      {emptyAction}
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row, i) => {
                  const id = rowKey ? rowKey(row) : String(i);
                  const isSelected = selectedRows.has(id);
                  return (
                    <tr
                      key={id}
                      className={cn(
                        "border-b border-border/30 transition-colors hover:bg-muted/30",
                        isSelected && "bg-accent/40",
                        onRowClick && "cursor-pointer",
                      )}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {selectable && (
                        <td className="w-10 px-3 py-2 text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(id)}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-3 py-2",
                            col.align === "right" && "text-right",
                            col.align === "center" && "text-center",
                            col.sticky && "sticky z-10 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.05)]",
                            col.stickyLeft && "sticky left-0 z-10 bg-white shadow-[2px_0_4px_rgba(0,0,0,0.05)]",
                          )}
                          style={col.sticky ? { right: toggleColWidth } : undefined}
                        >
                          {col.render(row, i)}
                        </td>
                      ))}
                      <td className="w-8 px-1 py-2 sticky right-0 z-10 bg-white" />
                    </tr>
                  );
                })
              )}
            </tbody>
          )}
        </table>
      </div>

      {/* Footer: pagination + page size */}
      <div className="px-3 sm:px-5 py-3 border-t border-border/50 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <span className="text-xs text-muted-foreground">
            {totalItems > 0 ? (
              <>
                <span className="hidden sm:inline">Menampilkan </span>
                {startItem}–{endItem}
                <span className="hidden sm:inline"> dari</span>
                <span className="sm:hidden"> /</span> {totalItems.toLocaleString()}
              </>
            ) : "0 data"}
          </span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="w-[70px] h-7 rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)} className="text-xs">{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center sm:justify-end gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg hidden sm:inline-flex" disabled={currentPage <= 1} onClick={() => onPageChange(1)}>
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="sm:hidden text-xs font-medium text-muted-foreground px-1.5 tabular-nums whitespace-nowrap">
              {currentPage.toLocaleString()} / {totalPages.toLocaleString()}
            </span>
            {(() => {
              const pages: (number | "...")[] = [];
              const maxVisible = 5;
              if (totalPages <= maxVisible) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                let start = Math.max(2, currentPage - 1);
                let end = Math.min(totalPages - 1, currentPage + 1);
                if (currentPage <= 3) { start = 2; end = Math.min(4, totalPages - 1); }
                if (currentPage >= totalPages - 2) { start = Math.max(2, totalPages - 3); end = totalPages - 1; }
                if (start > 2) pages.push("...");
                for (let i = start; i <= end; i++) pages.push(i);
                if (end < totalPages - 1) pages.push("...");
                pages.push(totalPages);
              }
              return (
                <div className="hidden sm:flex items-center gap-1">
                  {pages.map((p, idx) =>
                    p === "..." ? (
                      <span key={`e${idx}`} className="px-1 text-xs text-muted-foreground/50">...</span>
                    ) : (
                      <button key={p} type="button" onClick={() => onPageChange(p)}
                        className={`h-7 px-2 min-w-7 rounded-lg text-xs font-medium tabular-nums transition-all ${p === currentPage ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"}`}>
                        {p}
                      </button>
                    )
                  )}
                </div>
              );
            })()}
            <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg hidden sm:inline-flex" disabled={currentPage >= totalPages} onClick={() => onPageChange(totalPages)}>
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Filter — Desktop: Dialog, Mobile: Bottom Sheet */}
      {filters && (
        <>
          {/* Desktop Dialog */}
          {isDesktop && (
            <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
              <DialogContent className="rounded-2xl max-w-md">
                <DialogHeader>
                  <DialogTitle>Filter Data</DialogTitle>
                </DialogHeader>
                <div className={cn(filterColumns === 2 ? "grid grid-cols-2 gap-x-3 gap-y-4" : "space-y-4")}>
                  {filters.map((filter) => (
                    <div key={filter.key} className={cn("space-y-1.5", filterColumns === 2 && (filter.type === "daterange" || filter.type === "text") && "col-span-2")}>
                      <label className="text-sm font-medium">{filter.label}</label>
                      {filter.type === "select" && filter.options && (
                        <Select
                          value={tempFilters[filter.key] || "ALL"}
                          onValueChange={(v) => setTempFilters({ ...tempFilters, [filter.key]: v })}
                        >
                          <SelectTrigger className="w-full rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="w-[--radix-select-trigger-width]">
                            <SelectItem value="ALL">Semua</SelectItem>
                            {filter.options.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {filter.type === "text" && (
                        <Input
                          value={tempFilters[filter.key] || ""}
                          onChange={(e) => setTempFilters({ ...tempFilters, [filter.key]: e.target.value })}
                          className="w-full rounded-lg"
                        />
                      )}
                      {filter.type === "date" && (
                        <DatePicker
                          value={tempFilters[filter.key] || ""}
                          onChange={(value) => setTempFilters({ ...tempFilters, [filter.key]: value })}
                          className="w-full"
                        />
                      )}
                      {filter.type === "daterange" && (
                        <DateRangePicker
                          from={tempFilters[`${filter.key}_from`] || ""}
                          to={tempFilters[`${filter.key}_to`] || ""}
                          onChange={(f, t) => setTempFilters({ ...tempFilters, [`${filter.key}_from`]: f, [`${filter.key}_to`]: t })}
                          placeholder="Pilih rentang tanggal"
                          className="w-full"
                        />
                      )}
                    </div>
                  ))}
                  <div className={cn("flex justify-between pt-2", filterColumns === 2 && "col-span-2")}>
                    <Button variant="outline" className="rounded-lg" onClick={() => setFilterModalOpen(false)}>Batal</Button>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={resetFilters}>
                        Reset Filter
                      </Button>
                      <Button className="rounded-lg" onClick={applyFilters}>Terapkan</Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Mobile Bottom Sheet */}
          {!isDesktop && (
            <Sheet open={filterModalOpen} onOpenChange={setFilterModalOpen}>
              <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                <div className="shrink-0">
                  <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                  </div>
                  <SheetHeader className="px-4 pb-3 pt-0">
                    <SheetTitle className="text-base font-bold">Filter</SheetTitle>
                  </SheetHeader>
                </div>
                <div className="flex-1 overflow-y-auto px-4">
                  <div className={cn(filterColumns === 2 ? "grid grid-cols-2 gap-x-3 gap-y-3" : "space-y-4")}>
                    {filters.map((filter) => (
                      <div key={filter.key} className={cn("space-y-1.5", filterColumns === 2 && (filter.type === "daterange" || filter.type === "text") && "col-span-2")}>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{filter.label}</label>
                        {filter.type === "select" && filter.options && (
                          <div className="space-y-1">
                            <button
                              onClick={() => setTempFilters({ ...tempFilters, [filter.key]: "ALL" })}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all",
                                (!tempFilters[filter.key] || tempFilters[filter.key] === "ALL") ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"
                              )}
                            >
                              <span>Semua</span>
                              {(!tempFilters[filter.key] || tempFilters[filter.key] === "ALL") && <X className="w-3.5 h-3.5" />}
                            </button>
                            {filter.options.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => setTempFilters({ ...tempFilters, [filter.key]: opt.value })}
                                className={cn(
                                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all",
                                  tempFilters[filter.key] === opt.value ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"
                                )}
                              >
                                <span>{opt.label}</span>
                                {tempFilters[filter.key] === opt.value && <X className="w-3.5 h-3.5" />}
                              </button>
                            ))}
                          </div>
                        )}
                        {filter.type === "text" && (
                          <Input
                            value={tempFilters[filter.key] || ""}
                            onChange={(e) => setTempFilters({ ...tempFilters, [filter.key]: e.target.value })}
                            className="w-full rounded-lg"
                          />
                        )}
                        {filter.type === "date" && (
                          <DatePicker
                            value={tempFilters[filter.key] || ""}
                            onChange={(value) => setTempFilters({ ...tempFilters, [filter.key]: value })}
                            className="w-full"
                          />
                        )}
                        {filter.type === "daterange" && (
                          <DateRangePicker
                            from={tempFilters[`${filter.key}_from`] || ""}
                            to={tempFilters[`${filter.key}_to`] || ""}
                            onChange={(f, t) => setTempFilters({ ...tempFilters, [`${filter.key}_from`]: f, [`${filter.key}_to`]: t })}
                            placeholder="Pilih rentang tanggal"
                            className="w-full"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <SheetFooter className="shrink-0 border-t px-4 py-3 flex-row gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl h-10 text-sm" onClick={resetFilters}>
                    Reset
                  </Button>
                  <Button className="flex-1 rounded-xl h-10 text-sm shadow-md" onClick={applyFilters}>
                    Terapkan Filter
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          )}
        </>
      )}
    </div>

    {/* Floating bulk action bar */}
    {hasSelection && bulkActions && (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg animate-in slide-in-from-bottom-4 fade-in duration-200">
        <div className="flex items-center gap-2 sm:gap-3 px-4 py-3 bg-white text-foreground rounded-2xl shadow-xl border-2 border-primary">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">{selectedRows.size}</span>
            <span className="text-xs font-medium hidden sm:inline">dipilih</span>
          </div>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="flex items-center gap-1.5 flex-1">
            {bulkActions.map((action, i) => (
              <Button
                key={i}
                variant={action.variant === "destructive" ? "destructive" : "secondary"}
                size="sm"
                className="rounded-lg h-8 text-xs gap-1.5"
                onClick={() => action.onClick([...selectedRows])}
              >
                {action.icon} {action.label}
              </Button>
            ))}
          </div>
          <button
            onClick={() => onSelectionChange?.(new Set())}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
            title="Batalkan pilihan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )}
    </>
  );
}
