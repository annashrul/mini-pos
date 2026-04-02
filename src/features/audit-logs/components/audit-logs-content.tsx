"use client";

import { useState, useRef, useEffect, useTransition, useMemo, useCallback } from "react";
import { getAuditLogs } from "@/features/audit-logs";
import { useBranch } from "@/components/providers/branch-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    ScrollText, Plus, Pencil, Trash2, LogIn, Ban, RotateCcw, Activity,
    Search, ChevronDown, ChevronUp, ArrowRight, Filter, Calendar,
    Copy, RefreshCw,
    Package, CreditCard, Shield, Settings, MapPin, Users, Tag,
    ShoppingCart, Truck, Award, Wallet,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PaginationControl } from "@/components/ui/pagination-control";

type AuditLogsResult = Awaited<ReturnType<typeof getAuditLogs>>;
type AuditLogRow = AuditLogsResult["logs"][number];

// === Config ===

const actionConfig: Record<string, { label: string; icon: typeof Plus; bg: string; iconBg: string; text: string }> = {
    CREATE: { label: "Dibuat", icon: Plus, bg: "bg-emerald-50", iconBg: "bg-gradient-to-br from-emerald-500 to-green-600", text: "text-emerald-700" },
    UPDATE: { label: "Diupdate", icon: Pencil, bg: "bg-blue-50", iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600", text: "text-blue-700" },
    DELETE: { label: "Dihapus", icon: Trash2, bg: "bg-red-50", iconBg: "bg-gradient-to-br from-red-500 to-rose-600", text: "text-red-700" },
    LOGIN: { label: "Login", icon: LogIn, bg: "bg-purple-50", iconBg: "bg-gradient-to-br from-purple-500 to-violet-600", text: "text-purple-700" },
    VOID: { label: "Void", icon: Ban, bg: "bg-orange-50", iconBg: "bg-gradient-to-br from-orange-500 to-amber-600", text: "text-orange-700" },
    REFUND: { label: "Refund", icon: RotateCcw, bg: "bg-amber-50", iconBg: "bg-gradient-to-br from-amber-500 to-yellow-600", text: "text-amber-700" },
    RECEIVE: { label: "Diterima", icon: Package, bg: "bg-cyan-50", iconBg: "bg-gradient-to-br from-cyan-500 to-teal-600", text: "text-cyan-700" },
    COPY: { label: "Disalin", icon: Copy, bg: "bg-indigo-50", iconBg: "bg-gradient-to-br from-indigo-500 to-violet-600", text: "text-indigo-700" },
    REDEEM: { label: "Ditukar", icon: Award, bg: "bg-pink-50", iconBg: "bg-gradient-to-br from-pink-500 to-rose-600", text: "text-pink-700" },
};

const defaultAction = { label: "Lainnya", icon: Activity, bg: "bg-slate-50", iconBg: "bg-gradient-to-br from-slate-400 to-slate-500", text: "text-slate-700" };

const entityIcons: Record<string, typeof Package> = {
    Product: Package, Brand: Tag, Category: Tag, Supplier: Truck, Customer: Users,
    Transaction: ShoppingCart, User: Users, Branch: MapPin, Role: Shield,
    Permission: Shield, RolePermission: Shield, Setting: Settings,
    Shift: CreditCard, CashierShift: CreditCard, Expense: Wallet,
    Promotion: Award, PurchaseOrder: Truck, StockMovement: Package,
    StockOpname: Package, StockTransfer: Package, BranchPrice: CreditCard,
    Points: Award, ProductUnit: Package,
};

const avatarColors = [
    "bg-gradient-to-br from-teal-400 to-cyan-500",
    "bg-gradient-to-br from-blue-400 to-indigo-500",
    "bg-gradient-to-br from-purple-400 to-violet-500",
    "bg-gradient-to-br from-emerald-400 to-green-500",
    "bg-gradient-to-br from-orange-400 to-amber-500",
    "bg-gradient-to-br from-pink-400 to-rose-500",
];

function getAvatarColor(name: string) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return avatarColors[Math.abs(h) % avatarColors.length]!;
}

function entityLabel(entity: string) {
    const map: Record<string, string> = {
        Product: "Produk", Brand: "Brand", Category: "Kategori", Supplier: "Supplier",
        Customer: "Customer", Transaction: "Transaksi", User: "Pengguna", Branch: "Cabang",
        Role: "Role", Permission: "Hak Akses", RolePermission: "Hak Akses Role",
        Setting: "Pengaturan", Shift: "Shift", CashierShift: "Shift Kasir",
        Expense: "Pengeluaran", Promotion: "Promo", PurchaseOrder: "Purchase Order",
        StockMovement: "Pergerakan Stok", StockOpname: "Stock Opname",
        StockTransfer: "Transfer Stok", BranchPrice: "Harga Cabang",
        Points: "Poin", ProductUnit: "Satuan Produk",
    };
    return map[entity] || entity;
}

// === Detail renderer ===

function tryParseJSON(str: string | null): Record<string, unknown> | null {
    if (!str) return null;
    try {
        const parsed = JSON.parse(str);
        return typeof parsed === "object" && parsed !== null ? parsed : null;
    } catch {
        return null;
    }
}

function DetailCard({ details }: { details: string | null }) {
    const json = tryParseJSON(details);
    if (!json && details) {
        return <p className="text-xs text-muted-foreground">{details}</p>;
    }
    if (!json) return null;

    // UPDATE with before/after
    if (json.before && json.after) {
        const before = json.before as Record<string, unknown>;
        const after = json.after as Record<string, unknown>;
        const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
        const changedKeys = allKeys.filter((k) => String(before[k] ?? "") !== String(after[k] ?? ""));

        if (changedKeys.length === 0) {
            return <p className="text-xs text-muted-foreground italic">Tidak ada perubahan data</p>;
        }

        return (
            <div className="space-y-1.5">
                {changedKeys.map((key) => (
                    <div key={key} className="flex items-start gap-2 text-xs">
                        <span className="font-medium text-muted-foreground min-w-[80px] capitalize">{key}</span>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-mono text-[11px] line-through truncate max-w-[140px]">
                                {String(before[key] ?? "—")}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                            <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-mono text-[11px] font-medium truncate max-w-[140px]">
                                {String(after[key] ?? "—")}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // DELETE with deleted data
    if (json.deleted) {
        const deleted = json.deleted as Record<string, unknown>;
        return (
            <div className="space-y-1">
                {Object.entries(deleted).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-muted-foreground min-w-[80px] capitalize">{key}</span>
                        <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-mono text-[11px] line-through">
                            {String(val ?? "—")}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    // CREATE with data
    if (json.data) {
        const data = json.data as Record<string, unknown>;
        return (
            <div className="space-y-1">
                {Object.entries(data).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-muted-foreground min-w-[80px] capitalize">{key}</span>
                        <span className="bg-slate-50 text-foreground px-1.5 py-0.5 rounded font-mono text-[11px]">
                            {val === true ? "Ya" : val === false ? "Tidak" : String(val ?? "—")}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    // Generic object
    return (
        <div className="space-y-1">
            {Object.entries(json).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-muted-foreground min-w-[80px] capitalize">{key}</span>
                    <span className="bg-slate-50 text-foreground px-1.5 py-0.5 rounded font-mono text-[11px]">
                        {typeof val === "object" ? JSON.stringify(val) : String(val ?? "—")}
                    </span>
                </div>
            ))}
        </div>
    );
}

// === Main component ===

export function AuditLogsContent() {
    const [data, setData] = useState<AuditLogsResult>({ logs: [], total: 0, totalPages: 0 });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ entity: "ALL", action: "ALL" });
    const [loading, startTransition] = useTransition();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);

    const fetchData = useCallback((params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string> }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const result = await getAuditLogs({
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(f.entity !== "ALL" ? { entity: f.entity } : {}),
                ...(f.action && f.action !== "ALL" ? { action: f.action } : {}),
                ...(f.date_from ? { dateFrom: f.date_from } : {}),
                ...(f.date_to ? { dateTo: f.date_to } : {}),
                ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
            });
            setData(result);
        });
    }, [activeFilters, search, page, pageSize, selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!branchReady) return;
        if (prevBranchRef.current !== selectedBranchId) {
            prevBranchRef.current = selectedBranchId;
            setPage(1);
            fetchData({ page: 1 });
        } else {
            fetchData({});
        }
    }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const stats = useMemo(() => {
        const logs = data.logs;
        return {
            total: data.total,
            create: logs.filter((l) => l.action === "CREATE").length,
            update: logs.filter((l) => l.action === "UPDATE").length,
            delete: logs.filter((l) => l.action === "DELETE").length,
        };
    }, [data]);

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const expandAll = () => setExpandedIds(new Set(data.logs.map((l) => l.id)));
    const collapseAll = () => setExpandedIds(new Set());

    const handleFilterChange = (key: string, value: string) => {
        const f = { ...activeFilters, [key]: value };
        setActiveFilters(f);
        setPage(1);
        fetchData({ filters: f, page: 1 });
    };


    // Group logs by date
    const groupedLogs = useMemo(() => {
        const groups: { date: string; logs: AuditLogRow[] }[] = [];
        let currentDate = "";
        for (const log of data.logs) {
            const d = format(new Date(log.createdAt), "yyyy-MM-dd");
            if (d !== currentDate) {
                currentDate = d;
                groups.push({ date: d, logs: [] });
            }
            groups[groups.length - 1]!.logs.push(log);
        }
        return groups;
    }, [data.logs]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg shadow-teal-200/50">
                        <ScrollText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Audit Log</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">Riwayat semua aktivitas sistem</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={expandAll}>
                        <ChevronDown className="w-3.5 h-3.5 mr-1" /> Buka Semua
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={collapseAll}>
                        <ChevronUp className="w-3.5 h-3.5 mr-1" /> Tutup Semua
                    </Button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 bg-slate-100/80 text-slate-600 rounded-full px-3 py-1.5 text-xs font-medium">
                    <ScrollText className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{stats.total}</span> Total Log
                </div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-emerald-100">
                    <Plus className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{stats.create}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-blue-100">
                    <Pencil className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{stats.update}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-500 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-red-100">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{stats.delete}</span>
                </div>
            </div>

            {/* Filters & Search */}
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
                            onChange={(e) => { setSearch(e.target.value); setPage(1); fetchData({ search: e.target.value, page: 1 }); }}
                            className="pl-9 rounded-xl h-9 text-sm"
                        />
                    </div>
                    <Select value={activeFilters.entity ?? "ALL"} onValueChange={(v) => handleFilterChange("entity", v)}>
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
                    <Select value={activeFilters.action ?? "ALL"} onValueChange={(v) => handleFilterChange("action", v)}>
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
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => fetchData({})} disabled={loading}>
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Timeline Feed */}
            {loading && data.logs.length === 0 ? (
                <div className="space-y-6">
                    {Array.from({ length: 2 }).map((_, gi) => (
                        <div key={gi}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex items-center gap-1.5 bg-white border border-border/50 rounded-full px-3 py-1 animate-pulse">
                                    <div className="w-3.5 h-3.5 bg-gray-200 rounded" />
                                    <div className="h-3 w-36 bg-gray-200 rounded" />
                                </div>
                                <div className="flex-1 h-px bg-border/30" />
                            </div>
                            <div className="space-y-2 ml-1">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="rounded-xl border border-border/30 bg-white p-4 flex items-center gap-3 animate-pulse">
                                        <div className="w-8 h-8 rounded-lg bg-gray-200 shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-16 bg-gray-200 rounded" />
                                                <div className="h-4 w-20 bg-gray-200 rounded-md" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gray-200" />
                                            <div className="h-3 w-16 bg-gray-200 rounded" />
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="h-3 w-12 bg-gray-200 rounded" />
                                            <div className="h-2 w-16 bg-gray-200 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : data.logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center">
                        <ScrollText className="w-8 h-8 text-teal-400" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Tidak ada log ditemukan</p>
                    <p className="text-xs text-muted-foreground">Belum ada aktivitas yang tercatat atau filter tidak menampilkan hasil.</p>
                </div>
            ) : (
                <div className={cn("space-y-6", loading && "opacity-50 pointer-events-none transition-opacity")}>
                    {groupedLogs.map((group) => (
                        <div key={group.date}>
                            {/* Date Header */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex items-center gap-1.5 bg-white border border-border/50 rounded-full px-3 py-1 shadow-sm">
                                    <Calendar className="w-3.5 h-3.5 text-teal-500" />
                                    <span className="text-xs font-semibold text-foreground">
                                        {format(new Date(group.date), "EEEE, dd MMMM yyyy", { locale: idLocale })}
                                    </span>
                                </div>
                                <div className="flex-1 h-px bg-border/30" />
                                <span className="text-[10px] text-muted-foreground font-mono">{group.logs.length} log</span>
                            </div>

                            {/* Log Items */}
                            <div className="space-y-2 ml-1">
                                {group.logs.map((log) => {
                                    const cfg = actionConfig[log.action] || defaultAction;
                                    const Icon = cfg.icon;
                                    const EntityIcon = entityIcons[log.entity] || Activity;
                                    const isExpanded = expandedIds.has(log.id);
                                    const hasDetails = !!log.details;
                                    const d = new Date(log.createdAt);
                                    const relative = formatDistanceToNow(d, { addSuffix: true, locale: idLocale });

                                    return (
                                        <div
                                            key={log.id}
                                            className={cn(
                                                "group rounded-xl border transition-all duration-200 cursor-pointer",
                                                isExpanded
                                                    ? "border-border/60 bg-white shadow-sm"
                                                    : "border-border/30 bg-white hover:border-border/50 hover:shadow-sm"
                                            )}
                                            onClick={() => hasDetails && toggleExpand(log.id)}
                                        >
                                            {/* Main row */}
                                            <div className="flex items-center gap-3 px-4 py-3">
                                                {/* Action icon */}
                                                <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg text-white shadow-sm shrink-0", cfg.iconBg)}>
                                                    <Icon className="w-4 h-4" />
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={cn("text-xs font-bold", cfg.text)}>{cfg.label}</span>
                                                        <div className="flex items-center gap-1 bg-slate-50 rounded-md px-1.5 py-0.5 ring-1 ring-slate-200/60">
                                                            <EntityIcon className="w-3 h-3 text-slate-400" />
                                                            <span className="text-[11px] font-medium text-slate-600">{entityLabel(log.entity)}</span>
                                                        </div>
                                                        {log.entityId && (
                                                            <span className="text-[10px] font-mono text-muted-foreground/50 truncate max-w-[120px]">
                                                                #{log.entityId.slice(0, 8)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Preview text for non-expanded */}
                                                    {!isExpanded && log.details && !tryParseJSON(log.details) && (
                                                        <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[400px]">{log.details}</p>
                                                    )}
                                                </div>

                                                {/* Right side */}
                                                <div className="flex items-center gap-3 shrink-0">
                                                    {/* User */}
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold", getAvatarColor(log.user.name))}>
                                                            {log.user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-xs font-medium text-foreground hidden sm:block">{log.user.name}</span>
                                                    </div>

                                                    {/* Time */}
                                                    <div className="text-right hidden md:block">
                                                        <p className="text-[11px] font-mono tabular-nums text-muted-foreground">{format(d, "HH:mm:ss")}</p>
                                                        <p className="text-[10px] text-muted-foreground/50">{relative}</p>
                                                    </div>

                                                    {/* Expand indicator */}
                                                    {hasDetails && (
                                                        <div className={cn(
                                                            "w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                                                            isExpanded ? "bg-teal-50 text-teal-600" : "text-muted-foreground/30 group-hover:text-muted-foreground/60"
                                                        )}>
                                                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded detail */}
                                            {isExpanded && hasDetails && (
                                                <div className="px-4 pb-4 pt-0">
                                                    <div className="ml-11 rounded-lg bg-slate-50/80 border border-slate-100 p-3">
                                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detail Perubahan</p>
                                                        <DetailCard details={log.details} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            <PaginationControl
                currentPage={page}
                totalPages={data.totalPages}
                totalItems={data.total}
                pageSize={pageSize}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
            />
        </div>
    );
}
