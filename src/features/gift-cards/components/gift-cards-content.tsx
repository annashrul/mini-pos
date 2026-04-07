"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import {
  getGiftCards,
  getGiftCardStats,
  getGiftCardById,
  topUpGiftCard,
  disableGiftCard,
} from "@/server/actions/gift-cards";
import { getBranches } from "@/server/actions/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import {
  Plus,
  CreditCard,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Search,
  Ban,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { IssueGiftCardDialog } from "./issue-gift-card-dialog";
import { GiftCardDetailDialog } from "./gift-card-detail-dialog";
import { CheckBalanceDialog } from "./check-balance-dialog";

interface GiftCardRow {
  id: string;
  code: string;
  initialBalance: number;
  currentBalance: number;
  status: string;
  purchasedBy: string | null;
  customerId: string | null;
  customer: { id: string; name: string; phone: string | null } | null;
  branch: { id: string; name: string } | null;
  createdByUser: { id: string; name: string } | null;
  expiresAt: string | Date | null;
  createdAt: string | Date;
  _count: { transactions: number };
}

interface GiftCardDetailData {
  id: string;
  code: string;
  initialBalance: number;
  currentBalance: number;
  status: string;
  purchasedBy: string | null;
  customer: { id: string; name: string; phone: string | null } | null;
  branch: { id: string; name: string } | null;
  createdByUser: { id: string; name: string } | null;
  expiresAt: string | Date | null;
  createdAt: string | Date;
  transactions: {
    id: string;
    type: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    reference: string | null;
    createdAt: string | Date;
  }[];
}

interface Stats {
  totalActiveCards: number;
  totalBalanceOutstanding: number;
  totalRedeemed: number;
  expiringSoon: number;
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  USED: "bg-slate-100 text-slate-600 border border-slate-200",
  EXPIRED: "bg-amber-50 text-amber-700 border border-amber-200",
  DISABLED: "bg-red-50 text-red-600 border border-red-200",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Aktif",
  USED: "Habis",
  EXPIRED: "Expired",
  DISABLED: "Nonaktif",
};

export function GiftCardsContent() {
  const [data, setData] = useState<{
    giftCards: GiftCardRow[];
    total: number;
    totalPages: number;
  }>({ giftCards: [], total: 0, totalPages: 0 });
  const [stats, setStats] = useState<Stats>({
    totalActiveCards: 0,
    totalBalanceOutstanding: 0,
    totalRedeemed: 0,
    expiringSoon: 0,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
    status: "ALL",
    branchId: "ALL",
  });
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, startTransition] = useTransition();

  // Dialogs
  const [issueOpen, setIssueOpen] = useState(false);
  const [checkBalanceOpen, setCheckBalanceOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<GiftCardDetailData | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pendingConfirmAction, setPendingConfirmAction] = useState<
    null | (() => Promise<void>)
  >(null);

  // Branch filter options
  const [branchOptions, setBranchOptions] = useState<
    { value: string; label: string }[]
  >([]);

  const { canAction, cannotMessage } = useMenuActionAccess("gift-cards");
  const canCreate = canAction("create");
  const canUpdate = canAction("update");

  const didFetchRef = useRef(false);

  const fetchData = (params: {
    search?: string;
    page?: number;
    pageSize?: number;
    filters?: Record<string, string>;
    sortKey?: string;
    sortDir?: "asc" | "desc";
  }) => {
    startTransition(async () => {
      const f = params.filters ?? activeFilters;
      const sk = params.sortKey ?? sortKey;
      const sd = params.sortDir ?? sortDir;
      const query = {
        search: params.search ?? search,
        page: params.page ?? page,
        perPage: params.pageSize ?? pageSize,
        ...(f.status !== "ALL" ? { status: f.status } : {}),
        ...(f.branchId !== "ALL" ? { branchId: f.branchId } : {}),
        ...(sk ? { sortBy: sk, sortDir: sd } : {}),
      };
      const [result, statsResult] = await Promise.all([
        getGiftCards(query),
        getGiftCardStats(f.branchId !== "ALL" ? f.branchId : undefined),
      ]);
      setData(
        result as unknown as {
          giftCards: GiftCardRow[];
          total: number;
          totalPages: number;
        }
      );
      setStats(statsResult);
    });
  };

  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;
    fetchData({});
    // Load branches for filter
    getBranches({ perPage: 100 }).then((res) => {
      if (res.branches) {
        setBranchOptions(
          res.branches.map((b: { id: string; name: string }) => ({
            value: b.id,
            label: b.name,
          }))
        );
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (row: GiftCardRow) => {
    const result = await getGiftCardById(row.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setDetailData(result.giftCard as unknown as GiftCardDetailData);
    setDetailOpen(true);
  };

  const handleTopUp = async (id: string, amount: number) => {
    if (!canUpdate) {
      toast.error(cannotMessage("update"));
      return;
    }
    const result = await topUpGiftCard(id, amount);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Top up berhasil. Saldo baru: ${formatCurrency(result.balanceAfter!)}`);
      fetchData({});
      // Refresh detail if open
      if (detailData && detailData.id === id) {
        const refreshed = await getGiftCardById(id);
        if (refreshed.giftCard) setDetailData(refreshed.giftCard as unknown as GiftCardDetailData);
      }
    }
  };

  const handleDisable = (id: string, code: string) => {
    if (!canUpdate) {
      toast.error(cannotMessage("update"));
      return;
    }
    setConfirmText(`Yakin ingin menonaktifkan gift card ${code}?`);
    setPendingConfirmAction(() => async () => {
      const result = await disableGiftCard(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Gift card berhasil dinonaktifkan");
        fetchData({});
        if (detailOpen) setDetailOpen(false);
      }
      setConfirmOpen(false);
      setPendingConfirmAction(null);
    });
    setConfirmOpen(true);
  };

  const columns: SmartColumn<GiftCardRow>[] = [
    {
      key: "code",
      header: "Kode",
      sortable: true,
      render: (row) => (
        <button
          onClick={() => openDetail(row)}
          className="font-mono text-sm font-semibold text-primary hover:underline tracking-wide"
        >
          {row.code}
        </button>
      ),
      exportValue: (row) => row.code,
    },
    {
      key: "currentBalance",
      header: "Saldo",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="text-sm font-bold font-mono tabular-nums text-foreground">
          {formatCurrency(row.currentBalance)}
        </span>
      ),
      exportValue: (row) => row.currentBalance,
    },
    {
      key: "initialBalance",
      header: "Nominal Awal",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="text-sm font-mono tabular-nums text-muted-foreground">
          {formatCurrency(row.initialBalance)}
        </span>
      ),
      exportValue: (row) => row.initialBalance,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      align: "center",
      render: (row) => (
        <Badge
          className={`${statusColors[row.status] || ""} rounded-full px-2.5 py-0.5 text-[11px] font-medium`}
        >
          {statusLabels[row.status] || row.status}
        </Badge>
      ),
      exportValue: (row) => statusLabels[row.status] || row.status,
    },
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.customer?.name || row.purchasedBy || (
            <span className="text-muted-foreground/40">-</span>
          )}
        </span>
      ),
      exportValue: (row) => row.customer?.name || row.purchasedBy || "-",
    },
    {
      key: "expiresAt",
      header: "Kedaluwarsa",
      sortable: true,
      render: (row) => {
        if (!row.expiresAt)
          return <span className="text-muted-foreground/40 text-xs">-</span>;
        const d = new Date(row.expiresAt);
        const isExpiringSoon =
          d.getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 &&
          d.getTime() > Date.now();
        return (
          <span
            className={`text-xs ${isExpiringSoon ? "text-amber-600 font-medium" : "text-muted-foreground"}`}
          >
            {new Intl.DateTimeFormat("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(d)}
          </span>
        );
      },
      exportValue: (row) =>
        row.expiresAt
          ? new Intl.DateTimeFormat("id-ID").format(new Date(row.expiresAt))
          : "-",
    },
    {
      key: "createdAt",
      header: "Dibuat",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Intl.DateTimeFormat("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }).format(new Date(row.createdAt))}
        </span>
      ),
      exportValue: (row) =>
        new Intl.DateTimeFormat("id-ID").format(new Date(row.createdAt)),
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      sticky: true,
      width: "80px",
      render: (row) => (
        <div className="flex justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
            onClick={() => openDetail(row)}
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
          {row.status === "ACTIVE" && (
            <DisabledActionTooltip
              disabled={!canUpdate}
              message={cannotMessage("update")}
            >
              <Button
                disabled={!canUpdate}
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                onClick={() => handleDisable(row.id, row.code)}
              >
                <Ban className="w-3.5 h-3.5" />
              </Button>
            </DisabledActionTooltip>
          )}
        </div>
      ),
    },
  ];

  const filters: SmartFilter[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "ACTIVE", label: "Aktif" },
        { value: "USED", label: "Habis" },
        { value: "EXPIRED", label: "Expired" },
        { value: "DISABLED", label: "Nonaktif" },
      ],
    },
    ...(branchOptions.length > 0
      ? [
          {
            key: "branchId",
            label: "Cabang",
            type: "select" as const,
            options: branchOptions,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25 shrink-0">
            <CreditCard className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
              Gift Card
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Kelola voucher digital dan gift card
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="rounded-xl shadow-sm flex-1 sm:flex-initial text-xs sm:text-sm"
            onClick={() => setCheckBalanceOpen(true)}
          >
            <Search className="w-4 h-4 mr-2" /> Cek Saldo
          </Button>
          <DisabledActionTooltip
            disabled={!canCreate}
            message={cannotMessage("create")}
          >
            <Button
              disabled={!canCreate}
              className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all flex-1 sm:flex-initial text-xs sm:text-sm"
              onClick={() => setIssueOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" /> Terbitkan
            </Button>
          </DisabledActionTooltip>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-emerald-100 p-2.5 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                Kartu Aktif
              </p>
              <p className="text-sm sm:text-xl font-bold text-foreground">
                {stats.totalActiveCards}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-violet-100 p-2.5 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-violet-50 items-center justify-center">
              <Wallet className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                Total Saldo
              </p>
              <p className="text-sm sm:text-xl font-bold text-foreground">
                {formatCurrency(stats.totalBalanceOutstanding)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-blue-100 p-2.5 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-blue-50 items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                Total Redeem
              </p>
              <p className="text-sm sm:text-xl font-bold text-foreground">
                {formatCurrency(stats.totalRedeemed)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-amber-100 p-2.5 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-amber-50 items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                Segera Expired
              </p>
              <p className="text-sm sm:text-xl font-bold text-foreground">
                {stats.expiringSoon}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <SmartTable<GiftCardRow>
        data={data.giftCards}
        columns={columns}
        totalItems={data.total}
        mobileRender={(row) => (
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <button onClick={() => openDetail(row)} className="font-mono text-sm font-semibold text-primary hover:underline tracking-wide truncate">{row.code}</button>
                    <Badge className={`${statusColors[row.status] || ""} rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0`}>
                        {statusLabels[row.status] || row.status}
                    </Badge>
                </div>
                <p className="text-xs mt-0.5">
                    <span className="font-semibold text-foreground">{formatCurrency(row.initialBalance)}</span>
                    <span className="text-muted-foreground"> (sisa: </span>
                    <span className="font-semibold text-foreground">{formatCurrency(row.currentBalance)}</span>
                    <span className="text-muted-foreground">)</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {row.customer?.name || row.purchasedBy || "-"}
                    {row.expiresAt && (
                        <> &middot; Exp: {new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(row.expiresAt))}</>
                    )}
                </p>
            </div>
        )}
        totalPages={data.totalPages}
        currentPage={page}
        pageSize={pageSize}
        loading={loading}
        title="Daftar Gift Card"
        titleIcon={<CreditCard className="w-4 h-4 text-violet-500" />}
        searchPlaceholder="Cari kode gift card..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
          fetchData({ search: q, page: 1 });
        }}
        onPageChange={(p) => {
          setPage(p);
          fetchData({ page: p });
        }}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
          fetchData({ pageSize: s, page: 1 });
        }}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key, dir) => {
          setSortKey(key);
          setSortDir(dir);
          setPage(1);
          fetchData({ page: 1, sortKey: key, sortDir: dir });
        }}
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={(f) => {
          setActiveFilters(f);
          setPage(1);
          fetchData({ filters: f, page: 1 });
        }}
        rowKey={(row) => row.id}
        exportFilename="gift-cards"
        emptyIcon={
          <CreditCard className="w-10 h-10 text-muted-foreground/30" />
        }
        emptyTitle="Tidak ada gift card ditemukan"
        emptyAction={
          <DisabledActionTooltip
            disabled={!canCreate}
            message={cannotMessage("create")}
          >
            <Button
              disabled={!canCreate}
              variant="outline"
              size="sm"
              className="rounded-xl mt-2 shadow-sm"
              onClick={() => setIssueOpen(true)}
            >
              <Plus className="w-3 h-3 mr-1" /> Terbitkan Gift Card
            </Button>
          </DisabledActionTooltip>
        }
      />

      {/* Issue Gift Card Dialog */}
      <IssueGiftCardDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        onSuccess={() => fetchData({})}
      />

      {/* Check Balance Dialog */}
      <CheckBalanceDialog
        open={checkBalanceOpen}
        onOpenChange={setCheckBalanceOpen}
      />

      {/* Gift Card Detail Dialog */}
      <GiftCardDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={detailData}
        onTopUp={handleTopUp}
        onDisable={handleDisable}
        canUpdate={canUpdate}
        cannotMessage={cannotMessage}
      />

      {/* Confirm Disable Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-sm overflow-hidden p-0 gap-0">
          <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 rounded-t-2xl" />
          <div className="px-4 sm:px-6 pt-4 sm:pt-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-base sm:text-lg">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-md shadow-red-500/25">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                <span>Konfirmasi</span>
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">{confirmText}</p>
          </div>
          <div className="flex justify-end gap-2 px-4 sm:px-6 pb-4 sm:pb-6 pt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="rounded-xl"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => pendingConfirmAction?.()}
            >
              Ya, Nonaktifkan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
