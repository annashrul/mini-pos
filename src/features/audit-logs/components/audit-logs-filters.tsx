"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SmartSelect } from "@/components/ui/smart-select";
import { SearchInput } from "@/components/ui/search-input";
import { FilterBottomSheet } from "@/components/ui/filter-bottom-sheet";
import { cn } from "@/lib/utils";
import { RefreshCw, SlidersHorizontal, X } from "lucide-react";

const entityOptions = [
  { value: "ALL", label: "Semua Entity" },
  { value: "Product", label: "Produk" },
  { value: "Transaction", label: "Transaksi" },
  { value: "User", label: "Pengguna" },
  { value: "Category", label: "Kategori" },
  { value: "Brand", label: "Brand" },
  { value: "Supplier", label: "Supplier" },
  { value: "Customer", label: "Customer" },
  { value: "Branch", label: "Cabang" },
  { value: "Role", label: "Role" },
  { value: "Setting", label: "Pengaturan" },
  { value: "Promotion", label: "Promo" },
  { value: "Expense", label: "Pengeluaran" },
  { value: "StockMovement", label: "Stok" },
  { value: "Session", label: "Login/Logout" },
];

const actionOptions = [
  { value: "ALL", label: "Semua Aksi" },
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
  { value: "VOID", label: "Void" },
  { value: "REFUND", label: "Refund" },
  { value: "LOGIN", label: "Login" },
  { value: "LOGOUT", label: "Logout" },
  { value: "HOLD", label: "Hold Transaksi" },
  { value: "RESUME", label: "Resume Transaksi" },
  { value: "REPRINT", label: "Cetak Ulang" },
  { value: "CLEAR_CART", label: "Hapus Keranjang" },
  { value: "APPLY_VOUCHER", label: "Pakai Voucher" },
  { value: "REDEEM_POINTS", label: "Tukar Poin" },
  { value: "QUICK_REGISTER", label: "Registrasi Cepat" },
];

const searchEntity = async (query: string) =>
  entityOptions.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

const searchAction = async (query: string) =>
  actionOptions.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

export function AuditLogsFilters(props: {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onFilterBatch: (updates: Record<string, string>) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const { search, onSearchChange, filters, onFilterChange, onFilterBatch, onRefresh, loading } = props;
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const activeEntity = filters.entity ?? "ALL";
  const activeAction = filters.action ?? "ALL";
  const activeFilterCount = (activeEntity !== "ALL" ? 1 : 0) + (activeAction !== "ALL" ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Desktop */}
      <div className="hidden sm:block space-y-3">
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Cari log berdasarkan user, entity, detail..."
            loading={loading}
            className="flex-1 min-w-0"
          />
          <div className="w-[160px] shrink-0">
            <SmartSelect
              value={activeEntity}
              onChange={(v) => onFilterChange("entity", v)}
              onSearch={searchEntity}
              initialOptions={entityOptions}
              placeholder="Entity"
              className="rounded-xl"
            />
          </div>
          <div className="w-[160px] shrink-0">
            <SmartSelect
              value={activeAction}
              onChange={(v) => onFilterChange("action", v)}
              onSearch={searchAction}
              initialOptions={actionOptions}
              placeholder="Aksi"
              className="rounded-xl"
            />
          </div>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="rounded-xl h-9 text-xs text-muted-foreground hover:text-foreground gap-1" onClick={() => onFilterBatch({ entity: "ALL", action: "ALL" })}>
              <X className="w-3.5 h-3.5" /> Reset
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5">
            {activeEntity !== "ALL" && (
              <Badge variant="secondary" className="rounded-lg text-xs gap-1 pl-2 pr-1 py-0.5">
                Entity: {entityOptions.find((o) => o.value === activeEntity)?.label}
                <button onClick={() => onFilterChange("entity", "ALL")} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
              </Badge>
            )}
            {activeAction !== "ALL" && (
              <Badge variant="secondary" className="rounded-lg text-xs gap-1 pl-2 pr-1 py-0.5">
                Aksi: {actionOptions.find((o) => o.value === activeAction)?.label}
                <button onClick={() => onFilterChange("action", "ALL")} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Mobile */}
      <div className="sm:hidden rounded-xl   space-y-2">
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Cari log..."
            className="flex-1 min-w-0"
            size="sm"
          />
          <button
            className={cn("relative h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center transition-colors",
              activeFilterCount > 0 ? "border-primary/30 bg-primary/5 text-primary" : "border-border/40 bg-white text-muted-foreground hover:bg-slate-50")}
            onClick={() => setFilterSheetOpen(true)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5">
            {activeEntity !== "ALL" && (
              <Badge variant="secondary" className="rounded-lg text-[10px] gap-1 pl-2 pr-1 py-0.5">
                {entityOptions.find((o) => o.value === activeEntity)?.label}
                <button onClick={() => onFilterChange("entity", "ALL")} className="hover:text-destructive"><X className="w-3 h-3" /></button>
              </Badge>
            )}
            {activeAction !== "ALL" && (
              <Badge variant="secondary" className="rounded-lg text-[10px] gap-1 pl-2 pr-1 py-0.5">
                {actionOptions.find((o) => o.value === activeAction)?.label}
                <button onClick={() => onFilterChange("action", "ALL")} className="hover:text-destructive"><X className="w-3 h-3" /></button>
              </Badge>
            )}
          </div>
        )}
        <FilterBottomSheet
          open={filterSheetOpen}
          onOpenChange={setFilterSheetOpen}
          sections={[
            { key: "entity", label: "Entity", options: entityOptions.slice(1).map((o) => ({ value: o.value, label: o.label })) },
            { key: "action", label: "Aksi", options: actionOptions.slice(1).map((o) => ({ value: o.value, label: o.label })) },
          ]}
          values={{ entity: activeEntity, action: activeAction }}
          onApply={(v) => onFilterBatch({ entity: v.entity || "ALL", action: v.action || "ALL" })}
        />
      </div>
    </div>
  );
}
