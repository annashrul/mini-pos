"use client";

import { useEffect, useState, useCallback } from "react";
import { getPlatformActivityLogs } from "@/server/actions/platform-notifications";
import { useRealtimeEvents } from "@/hooks/use-socket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PaginationControl } from "@/components/ui/pagination-control";
import { cn } from "@/lib/utils";
import {
    Activity, Building2, Crown, Loader2, LogIn, LogOut, Pencil, Plus,
    RefreshCw, RotateCcw, ScrollText, Search, Trash2, Ban, ListFilter,
} from "lucide-react";

type LogEntry = Awaited<ReturnType<typeof getPlatformActivityLogs>>["logs"][number];

const actionIcons: Record<string, { icon: typeof Activity; color: string }> = {
    CREATE: { icon: Plus, color: "bg-emerald-100 text-emerald-600" },
    UPDATE: { icon: Pencil, color: "bg-blue-100 text-blue-600" },
    DELETE: { icon: Trash2, color: "bg-red-100 text-red-600" },
    LOGIN: { icon: LogIn, color: "bg-purple-100 text-purple-600" },
    LOGOUT: { icon: LogOut, color: "bg-slate-100 text-slate-600" },
    UPDATE_PLAN: { icon: Crown, color: "bg-amber-100 text-amber-600" },
    EXTEND_PLAN: { icon: Crown, color: "bg-amber-100 text-amber-600" },
    REVOKE_PLAN: { icon: RotateCcw, color: "bg-red-100 text-red-600" },
    VOID: { icon: Ban, color: "bg-orange-100 text-orange-600" },
    REFUND: { icon: RotateCcw, color: "bg-amber-100 text-amber-600" },
};

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    return `${days} hari lalu`;
}

export default function PlatformActivityPage() {
    const [data, setData] = useState<{ logs: LogEntry[]; total: number; totalPages: number }>({ logs: [], total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("ALL");
    const [entityFilter, setEntityFilter] = useState("ALL");
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
    const { on } = useRealtimeEvents();

    const fetchData = useCallback((params: { page?: number; search?: string; action?: string; entity?: string } = {}) => {
        setLoading(true);
        getPlatformActivityLogs({
            page: params.page ?? page,
            search: params.search ?? search,
            action: params.action ?? actionFilter,
            entity: params.entity ?? entityFilter,
            perPage: 25,
        }).then(setData).finally(() => setLoading(false));
    }, [page, search, actionFilter, entityFilter]);

    useEffect(() => { fetchData(); }, []); // eslint-disable-line

    // Realtime refresh on new events
    useEffect(() => {
        const unsub1 = on("subscription:updated", () => fetchData());
        const unsub2 = on("company:registered", () => fetchData());
        return () => { unsub1(); unsub2(); };
    }, [on, fetchData]);

    return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <ScrollText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold">Activity Log</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground">Aktivitas seluruh tenant · {data.total} log</p>
                    </div>
                </div>
        <Button variant="outline" size="sm" className="rounded-xl w-full sm:w-auto h-9" onClick={() => fetchData()}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2 flex-1 sm:max-w-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); fetchData({ page: 1, search }); } }} placeholder="Cari aktivitas..." className="pl-9 rounded-xl h-9 sm:h-10 text-sm" />
                    </div>
                    <Button variant="outline" size="icon" className="sm:hidden rounded-xl shrink-0" onClick={() => setMobileFilterOpen(true)}>
                        <ListFilter className="w-4 h-4" />
                    </Button>
                </div>
                <div className="hidden sm:block">
                    <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); fetchData({ page: 1, action: v }); }}>
                        <SelectTrigger className="w-full sm:w-[150px] rounded-xl"><SelectValue placeholder="Aksi" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Semua Aksi</SelectItem>
                            <SelectItem value="CREATE">Create</SelectItem>
                            <SelectItem value="UPDATE">Update</SelectItem>
                            <SelectItem value="DELETE">Delete</SelectItem>
                            <SelectItem value="LOGIN">Login</SelectItem>
                            <SelectItem value="LOGOUT">Logout</SelectItem>
                            <SelectItem value="UPDATE_PLAN">Upgrade Plan</SelectItem>
                            <SelectItem value="EXTEND_PLAN">Perpanjang</SelectItem>
                            <SelectItem value="VOID">Void</SelectItem>
                            <SelectItem value="REFUND">Refund</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="hidden sm:block">
                    <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); fetchData({ page: 1, entity: v }); }}>
                        <SelectTrigger className="w-full sm:w-[150px] rounded-xl"><SelectValue placeholder="Entity" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Semua Entity</SelectItem>
                            <SelectItem value="Session">Login/Logout</SelectItem>
                            <SelectItem value="Transaction">Transaksi</SelectItem>
                            <SelectItem value="Subscription">Subscription</SelectItem>
                            <SelectItem value="Company">Perusahaan</SelectItem>
                            <SelectItem value="Product">Produk</SelectItem>
                            <SelectItem value="User">Pengguna</SelectItem>
                            <SelectItem value="Setting">Pengaturan</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Log list */}
            {loading && data.logs.length === 0 ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : data.logs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-12">Tidak ada aktivitas ditemukan</p>
            ) : (
                <div className="space-y-1.5">
                    {data.logs.map((log) => {
                        const config = actionIcons[log.action] || { icon: Activity, color: "bg-slate-100 text-slate-600" };
                        const Icon = config.icon;
                        return (
              <div key={log.id} className="flex items-start gap-2.5 sm:gap-3 rounded-xl border border-border/40 bg-white p-2.5 sm:p-3 hover:bg-muted/20 transition-colors">
                <div className={cn("w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", config.color)}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-medium">{log.userName}</span>
                    <Badge variant="secondary" className="text-[8px] sm:text-[9px] px-1.5 py-0 rounded-full">{log.action}</Badge>
                    <Badge variant="outline" className="text-[8px] sm:text-[9px] px-1.5 py-0 rounded-full">{log.entity}</Badge>
                                    </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                        <Building2 className="w-3 h-3" /> {log.companyName}
                                        <span className="mx-0.5">·</span>
                                        {timeAgo(log.createdAt)}
                                    </p>
                                </div>
                                <p className="text-[10px] text-muted-foreground shrink-0 self-start sm:self-auto">
                                    {new Date(log.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}

            <PaginationControl
                currentPage={page}
                totalPages={data.totalPages}
                totalItems={data.total}
                pageSize={25}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={() => { }}
            />
            <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                <SheetContent side="bottom" className="rounded-t-2xl p-0" showCloseButton={false}>
                    <SheetHeader className="pb-2">
                        <SheetTitle>Filter Activity Log</SheetTitle>
                    </SheetHeader>
                    <div className="px-4 pb-4 space-y-3">
                        <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">Aksi</p>
                            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); fetchData({ page: 1, action: v }); }}>
                                <SelectTrigger className="w-full rounded-xl"><SelectValue placeholder="Aksi" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Semua Aksi</SelectItem>
                                    <SelectItem value="CREATE">Create</SelectItem>
                                    <SelectItem value="UPDATE">Update</SelectItem>
                                    <SelectItem value="DELETE">Delete</SelectItem>
                                    <SelectItem value="LOGIN">Login</SelectItem>
                                    <SelectItem value="LOGOUT">Logout</SelectItem>
                                    <SelectItem value="UPDATE_PLAN">Upgrade Plan</SelectItem>
                                    <SelectItem value="EXTEND_PLAN">Perpanjang</SelectItem>
                                    <SelectItem value="VOID">Void</SelectItem>
                                    <SelectItem value="REFUND">Refund</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">Entity</p>
                            <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); fetchData({ page: 1, entity: v }); }}>
                                <SelectTrigger className="w-full rounded-xl"><SelectValue placeholder="Entity" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Semua Entity</SelectItem>
                                    <SelectItem value="Session">Login/Logout</SelectItem>
                                    <SelectItem value="Transaction">Transaksi</SelectItem>
                                    <SelectItem value="Subscription">Subscription</SelectItem>
                                    <SelectItem value="Company">Perusahaan</SelectItem>
                                    <SelectItem value="Product">Produk</SelectItem>
                                    <SelectItem value="User">Pengguna</SelectItem>
                                    <SelectItem value="Setting">Pengaturan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button className="w-full rounded-xl" onClick={() => setMobileFilterOpen(false)}>
                            Terapkan
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
