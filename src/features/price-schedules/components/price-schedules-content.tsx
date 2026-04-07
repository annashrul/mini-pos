"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import {
  getPriceSchedules,
  getPriceScheduleStats,
  deletePriceSchedule,
  applyDuePriceSchedules,
} from "@/features/price-schedules";
import { getAllBranches } from "@/server/actions/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControl } from "@/components/ui/pagination-control";
import { Skeleton } from "@/components/ui/skeleton";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  CalendarClock,
  Clock,
  CheckCircle2,
  RotateCcw,
  Zap,
  TrendingDown,
  Package,
  Timer,
  SlidersHorizontal,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { NewScheduleDialog } from "./new-schedule-dialog";

interface PriceScheduleItem {
  id: string;
  productId: string;
  product: { id: string; name: string; code: string; sellingPrice: number };
  branchId: string | null;
  branch: { id: string; name: string } | null;
  newPrice: number;
  originalPrice: number;
  startDate: string;
  endDate: string;
  reason: string | null;
  isActive: boolean;
  appliedAt: string | null;
  revertedAt: string | null;
  createdBy: string;
  createdAt: string;
}

interface Stats {
  active: number;
  upcoming: number;
  expired: number;
  productsAffected: number;
}

interface Branch {
  id: string;
  name: string;
  isActive: boolean;
}

function getScheduleStatus(item: PriceScheduleItem) {
  if (item.revertedAt) return "reverted";
  if (item.appliedAt) {
    const now = new Date();
    if (new Date(item.endDate) <= now) return "expired";
    return "active";
  }
  const now = new Date();
  if (new Date(item.startDate) <= now) return "pending-apply";
  return "upcoming";
}

const statusConfig: Record<
  string,
  { label: string; className: string; icon: typeof Clock }
> = {
  upcoming: {
    label: "Akan Datang",
    className:
      "bg-blue-50 text-blue-700 border-blue-200",
    icon: Clock,
  },
  "pending-apply": {
    label: "Menunggu Apply",
    className:
      "bg-amber-50 text-amber-700 border-amber-200",
    icon: Timer,
  },
  active: {
    label: "Aktif",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  expired: {
    label: "Kedaluwarsa",
    className:
      "bg-orange-50 text-orange-700 border-orange-200",
    icon: CalendarClock,
  },
  reverted: {
    label: "Dikembalikan",
    className:
      "bg-gray-50 text-gray-500 border-gray-200",
    icon: RotateCcw,
  },
};

export function PriceSchedulesContent() {
  const [data, setData] = useState<{
    schedules: PriceScheduleItem[];
    total: number;
    totalPages: number;
  }>({ schedules: [], total: 0, totalPages: 0 });
  const [stats, setStats] = useState<Stats>({
    active: 0,
    upcoming: 0,
    expired: 0,
    productsAffected: 0,
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, startTransition] = useTransition();
  const [applying, startApplying] = useTransition();
  const { canAction, cannotMessage } = useMenuActionAccess("price-schedules");
  const canCreate = canAction("create");
  const canDelete = canAction("delete");
  const canUpdate = canAction("update");

  const fetchData = (params?: {
    search?: string;
    page?: number;
    pageSize?: number;
    status?: string;
    branch?: string;
  }) => {
    startTransition(async () => {
      const s = params?.status ?? statusFilter;
      const b = params?.branch ?? branchFilter;
      const result = await getPriceSchedules({
        search: params?.search ?? search,
        ...(s !== "ALL" ? { status: s } : {}),
        ...(b !== "ALL" ? { branchId: b } : {}),
        page: params?.page ?? page,
        perPage: params?.pageSize ?? pageSize,
      });
      setData(result as never);
    });
  };

  const fetchStats = () => {
    getPriceScheduleStats().then(setStats);
  };

  const didFetchRef = useRef(false);
  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;
    fetchData({});
    fetchStats();
    getAllBranches().then((b) => setBranches(b as Branch[]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    fetchData({ search: value, page: 1 });
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
    fetchData({ status: value, page: 1 });
  };

  const handleBranchFilter = (value: string) => {
    setBranchFilter(value);
    setPage(1);
    fetchData({ branch: value, page: 1 });
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      toast.error(cannotMessage("delete"));
      return;
    }
    if (!confirm("Hapus jadwal harga ini?")) return;
    const result = await deletePriceSchedule(id);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Jadwal harga dihapus");
      fetchData({});
      fetchStats();
    }
  };

  const handleApplyDue = () => {
    if (!canUpdate) {
      toast.error(cannotMessage("update"));
      return;
    }
    startApplying(async () => {
      const result = await applyDuePriceSchedules();
      if (result.error) {
        toast.error(result.error);
      } else {
        const msgs: string[] = [];
        if (result.appliedCount && result.appliedCount > 0) msgs.push(`${result.appliedCount} jadwal diterapkan`);
        if (result.revertedCount && result.revertedCount > 0) msgs.push(`${result.revertedCount} harga dikembalikan`);
        if (msgs.length === 0) msgs.push("Tidak ada jadwal yang perlu diproses");
        toast.success(msgs.join(", "));
        fetchData({});
        fetchStats();
      }
    });
  };

  const handleCreated = () => {
    setDialogOpen(false);
    fetchData({});
    fetchStats();
  };

  const discountPercent = (original: number, newPrice: number) => {
    if (original <= 0) return 0;
    return Math.round(((original - newPrice) / original) * 100);
  };

  const statsCards = [
    {
      label: "Jadwal Aktif",
      value: stats.active,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    },
    {
      label: "Akan Datang",
      value: stats.upcoming,
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
    },
    {
      label: "Kedaluwarsa",
      value: stats.expired,
      icon: CalendarClock,
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-200",
    },
    {
      label: "Produk Terpengaruh",
      value: stats.productsAffected,
      icon: Package,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-200",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200/50 shrink-0">
            <CalendarClock className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">
              Jadwal Harga
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Atur perubahan harga produk terjadwal
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={handleApplyDue}
            disabled={applying}
            className="gap-2 flex-1 sm:flex-initial text-xs sm:text-sm"
          >
            {applying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Proses Jadwal
          </Button>
          <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
            <Button onClick={() => setDialogOpen(true)} disabled={!canCreate} className="gap-2 flex-1 sm:flex-initial text-xs sm:text-sm">
              <Plus className="h-4 w-4" /> Jadwal Baru
            </Button>
          </DisabledActionTooltip>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`rounded-xl border ${card.border} ${card.bg} p-2.5 sm:p-4 transition-all`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`hidden sm:flex rounded-lg ${card.bg} p-2`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{card.label}</p>
                  <p className={`text-sm sm:text-xl font-bold ${card.color}`}>
                    {card.value}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9 sm:h-10 text-sm rounded-xl"
          />
        </div>
        {/* Mobile: filter button → dialog */}
        <Button variant="outline" size="icon" className="sm:hidden h-9 w-9 rounded-xl shrink-0" onClick={() => setFilterDialogOpen(true)}>
          <SlidersHorizontal className="w-4 h-4" />
          {(statusFilter !== "ALL" || branchFilter !== "ALL") && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
              {(statusFilter !== "ALL" ? 1 : 0) + (branchFilter !== "ALL" ? 1 : 0)}
            </span>
          )}
        </Button>
        {/* Desktop: inline selects */}
        <div className="hidden sm:flex items-center gap-3">
          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              <SelectItem value="upcoming">Akan Datang</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="expired">Kedaluwarsa</SelectItem>
              <SelectItem value="reverted">Dikembalikan</SelectItem>
            </SelectContent>
          </Select>
          {branches.length > 0 && (
            <Select value={branchFilter} onValueChange={handleBranchFilter}>
              <SelectTrigger className="w-[180px] h-10 rounded-xl">
                <SelectValue placeholder="Cabang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Cabang</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Mobile filter dialog */}
      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm rounded-xl p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-3">
            <DialogTitle className="text-base">Filter</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={(v) => { handleStatusFilter(v); setFilterDialogOpen(false); }}>
                <SelectTrigger className="w-full h-10 rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="upcoming">Akan Datang</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="expired">Kedaluwarsa</SelectItem>
                  <SelectItem value="reverted">Dikembalikan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {branches.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cabang</label>
                <Select value={branchFilter} onValueChange={(v) => { handleBranchFilter(v); setFilterDialogOpen(false); }}>
                  <SelectTrigger className="w-full h-10 rounded-xl">
                    <SelectValue placeholder="Cabang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Cabang</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(statusFilter !== "ALL" || branchFilter !== "ALL") && (
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => { handleStatusFilter("ALL"); handleBranchFilter("ALL"); setFilterDialogOpen(false); }}>
                Reset Filter
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/80">
                <th className="px-3 sm:px-4 py-3 text-left font-medium text-muted-foreground">
                  Produk
                </th>
                <th className="hidden sm:table-cell px-4 py-3 text-right font-medium text-muted-foreground">
                  Harga Asli
                </th>
                <th className="px-3 sm:px-4 py-3 text-right font-medium text-muted-foreground">
                  Harga Baru
                </th>
                <th className="hidden md:table-cell px-4 py-3 text-center font-medium text-muted-foreground">
                  Diskon
                </th>
                <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                  Mulai
                </th>
                <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                  Selesai
                </th>
                <th className="px-3 sm:px-4 py-3 text-center font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-3 sm:px-4 py-3 text-center font-medium text-muted-foreground">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.schedules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <CalendarClock className="h-12 w-12 opacity-30" />
                      <div>
                        <p className="font-medium">
                          Belum ada jadwal harga
                        </p>
                        <p className="text-sm">
                          Buat jadwal harga baru untuk mengubah harga produk
                          secara otomatis
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                data.schedules.map((item) => {
                  const status = getScheduleStatus(item);
                  const config = statusConfig[status];
                  const StatusIcon = config?.icon ?? Clock;
                  const disc = discountPercent(item.originalPrice, item.newPrice);
                  const isIncrease = item.newPrice > item.originalPrice;

                  return (
                    <tr
                      key={item.id}
                      className="border-b last:border-0 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-3 sm:px-4 py-3">
                        <div>
                          <p className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.product.code}
                            {item.branch && (
                              <span className="ml-2 text-blue-600">
                                {item.branch.name}
                              </span>
                            )}
                          </p>
                          {item.reason && (
                            <p className="text-xs text-muted-foreground mt-0.5 italic hidden sm:block">
                              {item.reason}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-right font-mono text-muted-foreground">
                        {formatCurrency(item.originalPrice)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono font-semibold text-xs sm:text-sm">
                        {formatCurrency(item.newPrice)}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-center">
                        {isIncrease ? (
                          <Badge
                            variant="outline"
                            className="bg-red-50 text-red-600 border-red-200"
                          >
                            +{Math.abs(disc)}%
                          </Badge>
                        ) : disc > 0 ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-600 border-emerald-200"
                          >
                            <TrendingDown className="h-3 w-3 mr-1" />
                            {disc}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-sm">
                        {format(new Date(item.startDate), "dd MMM yyyy")}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-sm">
                        {format(new Date(item.endDate), "dd MMM yyyy")}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={`gap-1 text-[10px] sm:text-xs ${config?.className ?? ""}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          <span className="hidden sm:inline">{config?.label ?? status}</span>
                        </Badge>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        {!item.appliedAt && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data.totalPages > 1 && (
          <div className="border-t px-4 py-3">
            <PaginationControl
              currentPage={page}
              totalPages={data.totalPages}
              pageSize={pageSize}
              totalItems={data.total}
              onPageChange={(p) => {
                setPage(p);
                fetchData({ page: p });
              }}
              onPageSizeChange={(ps) => {
                setPageSize(ps);
                setPage(1);
                fetchData({ page: 1, pageSize: ps });
              }}
            />
          </div>
        )}
      </div>

      {/* New Schedule Dialog */}
      <NewScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
        branches={branches}
      />
    </div>
  );
}
