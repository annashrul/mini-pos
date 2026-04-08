"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Filter, RefreshCw, Search, SlidersHorizontal } from "lucide-react";

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
];

const actionOptions = [
    { value: "ALL", label: "Semua Aksi" },
    { value: "CREATE", label: "Create" },
    { value: "UPDATE", label: "Update" },
    { value: "DELETE", label: "Delete" },
    { value: "VOID", label: "Void" },
    { value: "REFUND", label: "Refund" },
    { value: "LOGIN", label: "Login" },
];

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
    const [draftEntity, setDraftEntity] = useState("ALL");
    const [draftAction, setDraftAction] = useState("ALL");
    const [entityExpanded, setEntityExpanded] = useState(true);
    const [actionExpanded, setActionExpanded] = useState(true);

    const activeEntity = filters.entity ?? "ALL";
    const activeAction = filters.action ?? "ALL";
    const activeFilterCount = (activeEntity !== "ALL" ? 1 : 0) + (activeAction !== "ALL" ? 1 : 0);

    const openFilterSheet = () => {
        setDraftEntity(activeEntity);
        setDraftAction(activeAction);
        setFilterSheetOpen(true);
    };

    const applyFilters = () => {
        onFilterBatch({ entity: draftEntity, action: draftAction });
        setFilterSheetOpen(false);
    };

    const resetFilters = () => {
        setDraftEntity("ALL");
        setDraftAction("ALL");
    };

    return (
        <div className="rounded-xl border border-border/40 bg-white p-4 space-y-3 shadow-sm">
            {/* Desktop */}
            <div className="hidden sm:block space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Filter className="w-3.5 h-3.5" /> Filter
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                        <Input
                            placeholder="Cari log..."
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-9 rounded-xl h-9 text-sm"
                        />
                    </div>
                    <Select value={activeEntity} onValueChange={(v) => onFilterChange("entity", v)}>
                        <SelectTrigger className="w-[150px] rounded-xl h-9 text-xs">
                            <SelectValue placeholder="Entity" />
                        </SelectTrigger>
                        <SelectContent>
                            {entityOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={activeAction} onValueChange={(v) => onFilterChange("action", v)}>
                        <SelectTrigger className="w-[130px] rounded-xl h-9 text-xs">
                            <SelectValue placeholder="Action" />
                        </SelectTrigger>
                        <SelectContent>
                            {actionOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onRefresh} disabled={loading}>
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Mobile */}
            <div className="sm:hidden space-y-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                        <Input
                            placeholder="Cari log..."
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-9 rounded-xl h-9 text-sm"
                        />
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 rounded-xl h-9 gap-1.5 relative" onClick={openFilterSheet}>
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span className="text-xs">Filter</span>
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={onRefresh} disabled={loading}>
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </Button>
                </div>
                <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                    <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                        {/* Header */}
                        <div className="shrink-0">
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                            </div>
                            <SheetHeader className="px-4 pb-3 pt-0">
                                <SheetTitle className="text-base font-bold">Filter</SheetTitle>
                            </SheetHeader>
                        </div>

                        {/* Body - scrollable */}
                        <div className="flex-1 overflow-y-auto px-4 space-y-3">
                            {/* Entity */}
                            <div>
                                <button
                                    onClick={() => setEntityExpanded(!entityExpanded)}
                                    className="w-full flex items-center justify-between py-2"
                                >
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entity</p>
                                    <div className="flex items-center gap-1.5">
                                        {draftEntity !== "ALL" && (
                                            <span className="text-[11px] font-medium text-foreground bg-muted rounded-full px-2 py-0.5">
                                                {entityOptions.find((o) => o.value === draftEntity)?.label}
                                            </span>
                                        )}
                                        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", entityExpanded && "rotate-180")} />
                                    </div>
                                </button>
                                {entityExpanded && (
                                    <div className="space-y-1">
                                        {entityOptions.map((opt) => {
                                            const isActive = draftEntity === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setDraftEntity(opt.value)}
                                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}
                                                >
                                                    <span>{opt.label}</span>
                                                    {isActive && <Check className="w-4 h-4" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            {/* Aksi */}
                            <div>
                                <button
                                    onClick={() => setActionExpanded(!actionExpanded)}
                                    className="w-full flex items-center justify-between py-2"
                                >
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</p>
                                    <div className="flex items-center gap-1.5">
                                        {draftAction !== "ALL" && (
                                            <span className="text-[11px] font-medium text-foreground bg-muted rounded-full px-2 py-0.5">
                                                {actionOptions.find((o) => o.value === draftAction)?.label}
                                            </span>
                                        )}
                                        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", actionExpanded && "rotate-180")} />
                                    </div>
                                </button>
                                {actionExpanded && (
                                    <div className="space-y-1">
                                        {actionOptions.map((opt) => {
                                            const isActive = draftAction === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setDraftAction(opt.value)}
                                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}
                                                >
                                                    <span>{opt.label}</span>
                                                    {isActive && <Check className="w-4 h-4" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer - fixed */}
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
            </div>
        </div>
    );
}

