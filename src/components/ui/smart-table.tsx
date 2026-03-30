"use client";

import type { ReactNode } from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { exportToCSV } from "@/lib/export";
import {
  Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  SlidersHorizontal, Columns3, Download, X, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";

// ===========================
// Types
// ===========================

export interface SmartColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  visible?: boolean;
  sticky?: boolean; // sticky right for action column
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

  // Empty state
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyAction?: ReactNode;

  // Title
  title?: string;
  titleIcon?: ReactNode;
  headerActions?: ReactNode;
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
  emptyIcon,
  emptyTitle = "Tidak ada data",
  emptyAction,
  title,
  titleIcon,
  headerActions,
}: SmartTableProps<T>) {
  const [searchValue, setSearchValue] = useState("");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState<Record<string, string>>(activeFilters);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  const toggleSelectAll = () => {
    if (!rowKey || !onSelectionChange) return;
    if (selectedRows.size === data.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map(rowKey)));
    }
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

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {titleIcon}
            {title && <h3 className="font-semibold text-base text-foreground">{title}</h3>}
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 rounded-lg w-[220px] h-8 text-sm"
              />
            </div>

            {/* Filter button */}
            {filters && filters.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 text-xs gap-1.5"
                onClick={() => { setTempFilters(activeFilters); setFilterModalOpen(true); }}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter
                {activeFilterCount > 0 && (
                  <Badge className="h-4 w-4 p-0 text-[10px] rounded-full bg-primary text-primary-foreground">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            )}

            {/* Column visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs gap-1.5">
                  <Columns3 className="w-3.5 h-3.5" /> Kolom
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl w-[180px]">
                <DropdownMenuLabel className="text-xs">Tampilkan Kolom</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allColumns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={!hiddenColumns.has(col.key)}
                    onCheckedChange={(checked) => {
                      const next = new Set(hiddenColumns);
                      if (checked) next.delete(col.key); else next.add(col.key);
                      saveColumnPref(next);
                    }}
                    className="text-xs"
                  >
                    {col.header}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export */}
            {exportFilename && (
              <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs gap-1.5" onClick={handleExport}>
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            )}

            {headerActions}
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            {Object.entries(activeFilters).map(([key, val]) => {
              if (!val || val === "ALL") return null;
              // Find filter definition - handle _from/_to suffixes for daterange
              const baseKey = key.replace(/_from$|_to$/, "");
              const suffix = key.endsWith("_from") ? " dari" : key.endsWith("_to") ? " s/d" : "";
              const filterDef = filters?.find((f) => f.key === key || f.key === baseKey);
              const label = filterDef?.options?.find((o) => o.value === val)?.label || val;
              return (
                <Badge key={key} variant="secondary" className="rounded-lg text-xs gap-1 pl-2 pr-1 py-0.5 bg-accent text-accent-foreground">
                  {filterDef?.label}{suffix}: {label}
                  <button onClick={() => removeFilter(key)} className="ml-0.5 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
            <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground ml-1">
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {hasSelection && bulkActions && (
        <div className="px-5 py-2 bg-accent/60 border-b border-border/50 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{selectedRows.size} dipilih</span>
          {bulkActions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant === "destructive" ? "destructive" : "outline"}
              size="sm"
              className="rounded-lg h-7 text-xs gap-1"
              onClick={() => action.onClick([...selectedRows])}
            >
              {action.icon} {action.label}
            </Button>
          ))}
          <button onClick={() => onSelectionChange?.(new Set())} className="text-xs text-muted-foreground hover:text-foreground ml-auto">
            Batalkan pilihan
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/50 z-10">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2.5 text-center">
                  <Checkbox
                    checked={data.length > 0 && selectedRows.size === data.length}
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
                    col.sticky && "sticky right-0 bg-muted/50 shadow-[-2px_0_4px_rgba(0,0,0,0.05)]",
                  )}
                  style={col.width ? { width: col.width } : undefined}
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, i) => (
                <tr key={i} className="border-b border-border/30">
                  {selectable && <td className="px-3 py-2.5"><Skeleton className="h-4 w-4 rounded" /></td>}
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2.5">
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-3 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {emptyIcon}
                    <p className="text-sm">{emptyTitle}</p>
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
                      isSelected && "bg-accent/40"
                    )}
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
                          col.sticky && "sticky right-0 bg-white shadow-[-2px_0_4px_rgba(0,0,0,0.05)]",
                        )}
                      >
                        {col.render(row, i)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: pagination + page size */}
      <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {totalItems > 0 ? `Menampilkan ${startItem}–${endItem} dari ${totalItems.toLocaleString()} data` : "0 data"}
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
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage <= 1} onClick={() => onPageChange(1)}>
            <ChevronsLeft className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground px-2">{currentPage} / {totalPages || 1}</span>
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage >= totalPages} onClick={() => onPageChange(totalPages)}>
            <ChevronsRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Filter Modal */}
      {filters && (
        <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
          <DialogContent className="rounded-2xl max-w-md">
            <DialogHeader>
              <DialogTitle>Filter Data</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {filters.map((filter) => (
                <div key={filter.key} className="space-y-1.5">
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
                    <div className="flex gap-2 items-center">
                      <DatePicker
                        value={tempFilters[`${filter.key}_from`] || ""}
                        onChange={(value) => setTempFilters({ ...tempFilters, [`${filter.key}_from`]: value })}
                        placeholder="Dari"
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">s/d</span>
                      <DatePicker
                        value={tempFilters[`${filter.key}_to`] || ""}
                        onChange={(value) => setTempFilters({ ...tempFilters, [`${filter.key}_to`]: value })}
                        placeholder="Sampai"
                        className="flex-1"
                      />
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-between pt-2">
                <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={resetFilters}>
                  Reset Filter
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-lg" onClick={() => setFilterModalOpen(false)}>Batal</Button>
                  <Button className="rounded-lg" onClick={applyFilters}>Terapkan</Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
