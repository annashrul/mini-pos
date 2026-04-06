"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Filter, RefreshCw, Search } from "lucide-react";

export function AuditLogsFilters(props: {
    search: string;
    onSearchChange: (value: string) => void;
    filters: Record<string, string>;
    onFilterChange: (key: string, value: string) => void;
    onRefresh: () => void;
    loading: boolean;
}) {
    const { search, onSearchChange, filters, onFilterChange, onRefresh, loading } = props;

    return (
        <div className="rounded-xl border border-border/40 bg-white p-4 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Filter className="w-3.5 h-3.5" /> Filter
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <Input
                        placeholder="Cari log..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-9 rounded-xl h-9 text-sm"
                    />
                </div>
                <Select value={filters.entity ?? "ALL"} onValueChange={(v) => onFilterChange("entity", v)}>
                    <SelectTrigger className="w-[150px] rounded-xl h-9 text-xs">
                        <SelectValue placeholder="Entity" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Semua Entity</SelectItem>
                        <SelectItem value="Product">Produk</SelectItem>
                        <SelectItem value="Transaction">Transaksi</SelectItem>
                        <SelectItem value="User">Pengguna</SelectItem>
                        <SelectItem value="Category">Kategori</SelectItem>
                        <SelectItem value="Brand">Brand</SelectItem>
                        <SelectItem value="Supplier">Supplier</SelectItem>
                        <SelectItem value="Customer">Customer</SelectItem>
                        <SelectItem value="Branch">Cabang</SelectItem>
                        <SelectItem value="Role">Role</SelectItem>
                        <SelectItem value="Setting">Pengaturan</SelectItem>
                        <SelectItem value="Promotion">Promo</SelectItem>
                        <SelectItem value="Expense">Pengeluaran</SelectItem>
                        <SelectItem value="StockMovement">Stok</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.action ?? "ALL"} onValueChange={(v) => onFilterChange("action", v)}>
                    <SelectTrigger className="w-[130px] rounded-xl h-9 text-xs">
                        <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Semua Aksi</SelectItem>
                        <SelectItem value="CREATE">Create</SelectItem>
                        <SelectItem value="UPDATE">Update</SelectItem>
                        <SelectItem value="DELETE">Delete</SelectItem>
                        <SelectItem value="VOID">Void</SelectItem>
                        <SelectItem value="REFUND">Refund</SelectItem>
                        <SelectItem value="LOGIN">Login</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onRefresh} disabled={loading}>
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </Button>
            </div>
        </div>
    );
}

