"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useBranch } from "@/components/providers/branch-provider";
import { useMenuActionAccess } from "@/features/access-control";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { printThermalReceipt } from "@/lib/thermal-receipt";
import { getTransactions, getTransactionById, getTransactionStats, voidTransaction, refundTransaction } from "@/features/transactions";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import {
  History, Eye, Printer, Ban, RotateCcw, Receipt, CheckCircle2,
  Clock, XCircle, ArrowLeftRight, CreditCard, Banknote, Smartphone,
  QrCode, ShoppingBag, AlertTriangle, Calendar, User, MapPin, Hash,
  Wallet, TrendingUp, MoreVertical, Upload,
} from "lucide-react";
import { TransactionImportDialog } from "./transaction-import-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { TransactionDetail } from "@/types";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";

type TransactionsData = Awaited<ReturnType<typeof getTransactions>>;
type TransactionRow = TransactionsData["transactions"][number];
type PaymentEntry = { method: string; amount: number };

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; gradient: string; badge: string }> = {
  COMPLETED: {
    label: "Selesai",
    icon: CheckCircle2,
    gradient: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm shadow-emerald-200",
    badge: "border-emerald-200 bg-emerald-50/50 text-emerald-600 ring-1 ring-emerald-100",
  },
  PENDING: {
    label: "Pending",
    icon: Clock,
    gradient: "bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-sm shadow-amber-200",
    badge: "border-amber-200 bg-amber-50/50 text-amber-600 ring-1 ring-amber-100",
  },
  VOIDED: {
    label: "Void",
    icon: XCircle,
    gradient: "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-sm shadow-red-200",
    badge: "border-red-200 bg-red-50/50 text-red-600 ring-1 ring-red-100",
  },
  REFUNDED: {
    label: "Refund",
    icon: ArrowLeftRight,
    gradient: "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-200",
    badge: "border-blue-200 bg-blue-50/50 text-blue-600 ring-1 ring-blue-100",
  },
};

const paymentConfig: Record<string, { label: string; icon: typeof Banknote; color: string }> = {
  CASH: { label: "Cash", icon: Banknote, color: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" },
  TRANSFER: { label: "Transfer", icon: CreditCard, color: "bg-blue-50 text-blue-700 ring-1 ring-blue-100" },
  QRIS: { label: "QRIS", icon: QrCode, color: "bg-purple-50 text-purple-700 ring-1 ring-purple-100" },
  EWALLET: { label: "E-Wallet", icon: Smartphone, color: "bg-orange-50 text-orange-700 ring-1 ring-orange-100" },
  DEBIT: { label: "Debit", icon: CreditCard, color: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100" },
  CREDIT_CARD: { label: "Kartu Kredit", icon: CreditCard, color: "bg-pink-50 text-pink-700 ring-1 ring-pink-100" },
  TERMIN: { label: "Termin", icon: Clock, color: "bg-amber-50 text-amber-700 ring-1 ring-amber-100" },
};

export function TransactionsContent() {
  const [data, setData] = useState<TransactionsData>({ transactions: [], total: 0, totalPages: 0, currentPage: 1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ status: "ALL" });
  const { selectedBranchId, branchReady } = useBranch();
  const prevBranchRef = useRef(selectedBranchId);
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, startTransition] = useTransition();
  const { canAction, cannotMessage } = useMenuActionAccess("transactions");
  const { canAction: canPlan } = usePlanAccess();
  const canVoid = canAction("void") && canPlan("transactions", "void");
  const canRefund = canAction("refund") && canPlan("transactions", "refund");
  const [importOpen, setImportOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TransactionDetail | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [actionTxId, setActionTxId] = useState<string>("");
  const [reason, setReason] = useState("");

  const [stats, setStats] = useState({ total: 0, completed: 0, voided: 0, refunded: 0, totalRevenue: 0 });

  const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) => {
    startTransition(async () => {
      const f = params.filters ?? activeFilters;
      const sk = params.sortKey ?? sortKey;
      const sd = params.sortDir ?? sortDir;
      const query = {
        search: params.search ?? search,
        page: params.page ?? page,
        limit: params.pageSize ?? pageSize,
        ...(f.status !== "ALL" ? { status: f.status } : {}),
        ...(f.date_from ? { dateFrom: f.date_from } : {}),
        ...(f.date_to ? { dateTo: f.date_to } : {}),
        ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
        ...(sk ? { sortBy: sk, sortDir: sd } : {}),
      };
      const result = await getTransactions(query);
      setData(result);
    });
  };

  const refreshStats = () => { getTransactionStats(selectedBranchId || undefined).then(setStats); };

  useEffect(() => {
    if (!branchReady) return;
    refreshStats();
    if (prevBranchRef.current !== selectedBranchId) {
      prevBranchRef.current = selectedBranchId;
      setPage(1);
      fetchData({ page: 1 });
    } else {
      fetchData({});
    }
  }, [branchReady, selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewDetail = async (id: string) => {
    const tx = await getTransactionById(id);
    setSelectedTx(tx as unknown as TransactionDetail);
    setDetailOpen(true);
  };

  const handleVoid = async () => {
    if (!canVoid) { toast.error(cannotMessage("void")); return; }
    if (!reason.trim()) { toast.error("Alasan wajib diisi"); return; }
    const result = await voidTransaction(actionTxId, reason);
    if (result.error) toast.error(result.error);
    else { toast.success("Transaksi berhasil di-void"); setVoidDialogOpen(false); setReason(""); fetchData({}); refreshStats(); }
  };

  const handleRefund = async () => {
    if (!canRefund) { toast.error(cannotMessage("refund")); return; }
    if (!reason.trim()) { toast.error("Alasan wajib diisi"); return; }
    const result = await refundTransaction(actionTxId, reason);
    if (result.error) toast.error(result.error);
    else { toast.success("Transaksi berhasil di-refund"); setRefundDialogOpen(false); setReason(""); fetchData({}); refreshStats(); }
  };

  const getCashierName = (row: TransactionRow) => (row as unknown as { user?: { name?: string } }).user?.name ?? row.userId;
  const getBranchName = (row: TransactionRow) => (row as unknown as { branch?: { name?: string } }).branch?.name ?? "—";
  const getPayments = (row: TransactionRow): PaymentEntry[] => (row as unknown as { payments?: PaymentEntry[] }).payments ?? [];

  const columns: SmartColumn<TransactionRow>[] = [
    {
      key: "invoiceNumber", header: "Invoice", sortable: true, stickyLeft: true, width: "180px",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500 shrink-0">
            <Receipt className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-foreground truncate">{row.invoiceNumber}</p>
            <p className="text-[10px] text-muted-foreground">{getBranchName(row)}</p>
          </div>
        </div>
      ),
      exportValue: (row) => row.invoiceNumber,
    },
    {
      key: "createdAt", header: "Tanggal", sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3 shrink-0 text-muted-foreground/50" />
          <span className="font-mono tabular-nums">{formatDateTime(row.createdAt)}</span>
        </div>
      ),
      exportValue: (row) => formatDateTime(row.createdAt),
    },
    {
      key: "user", header: "Kasir", sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-white text-[10px] font-bold shrink-0">
            {getCashierName(row).charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-foreground">{getCashierName(row)}</span>
        </div>
      ),
      exportValue: (row) => getCashierName(row),
    },
    {
      key: "paymentMethod", header: "Pembayaran",
      render: (row) => {
        const payments = getPayments(row);
        if (!payments || payments.length <= 1) {
          const pm = paymentConfig[row.paymentMethod];
          const Icon = pm?.icon || Wallet;
          return (
            <Badge variant="outline" className={`rounded-full text-[10px] font-medium px-2 py-0.5 border-0 ${pm?.color || "bg-slate-50 text-slate-600"}`}>
              <Icon className="w-3 h-3 mr-1" />
              {pm?.label || row.paymentMethod}
            </Badge>
          );
        }
        const shown = payments.slice(0, 2);
        const rest = payments.slice(2);
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {shown.map((p, i) => {
              const pm = paymentConfig[p.method];
              const Icon = pm?.icon || Wallet;
              return (
                <Badge key={i} variant="outline" className={`rounded-full text-[10px] font-medium px-2 py-0.5 border-0 ${pm?.color || "bg-slate-50 text-slate-600"}`}>
                  <Icon className="w-3 h-3 mr-1" />
                  {pm?.label || p.method}
                </Badge>
              );
            })}
            {rest.length > 0 && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="rounded-full text-[10px] cursor-default px-2 py-0.5">+{rest.length}</Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs space-y-1 p-3">
                    {rest.map((p, i) => (
                      <div key={i} className="flex justify-between gap-4">
                        <span>{paymentConfig[p.method]?.label || p.method}</span>
                        <span className="font-semibold font-mono tabular-nums">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      },
      exportValue: (row) => {
        const payments = getPayments(row);
        if (payments.length > 1) {
          return payments.map((p) => `${paymentConfig[p.method]?.label || p.method}: ${p.amount}`).join(", ");
        }
        return paymentConfig[row.paymentMethod]?.label || row.paymentMethod;
      },
    },
    {
      key: "customer", header: "Customer",
      render: (row) => {
        const name = (row as unknown as { customer?: { name?: string } }).customer?.name;
        return <span className="text-xs text-foreground">{name ?? "Walk-in"}</span>;
      },
      exportValue: (row) => (row as unknown as { customer?: { name?: string } }).customer?.name ?? "Walk-in",
    },
    {
      key: "subtotal", header: "Subtotal", align: "right",
      render: (row) => <span className="text-xs font-mono tabular-nums text-muted-foreground">{formatCurrency(row.subtotal)}</span>,
      exportValue: (row) => row.subtotal,
    },
    {
      key: "discountAmount", header: "Diskon", align: "right",
      render: (row) => row.discountAmount > 0
        ? <span className="text-xs font-mono tabular-nums text-red-500">-{formatCurrency(row.discountAmount)}</span>
        : <span className="text-xs text-muted-foreground/40">—</span>,
      exportValue: (row) => row.discountAmount,
    },
    {
      key: "taxAmount", header: "Pajak", align: "right",
      render: (row) => row.taxAmount > 0
        ? <span className="text-xs font-mono tabular-nums text-muted-foreground">{formatCurrency(row.taxAmount)}</span>
        : <span className="text-xs text-muted-foreground/40">—</span>,
      exportValue: (row) => row.taxAmount,
    },
    {
      key: "grandTotal", header: "Total", sortable: true, align: "right",
      render: (row) => (
        <span className="text-sm font-semibold text-foreground font-mono tabular-nums">
          {formatCurrency(row.grandTotal)}
        </span>
      ),
      exportValue: (row) => row.grandTotal,
    },
    {
      key: "branch", header: "Cabang",
      render: (row) => <span className="text-xs text-muted-foreground">{getBranchName(row)}</span>,
      exportValue: (row) => getBranchName(row),
    },
    {
      key: "status", header: "Status", align: "center",
      render: (row) => {
        const cfg = statusConfig[row.status];
        const Icon = cfg?.icon || Clock;
        return (
          <Badge variant="outline" className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 border-0 ${cfg?.badge || "bg-slate-50 text-slate-600"}`}>
            <Icon className="w-3 h-3 mr-1" />
            {cfg?.label || row.status}
          </Badge>
        );
      },
      exportValue: (row) => statusConfig[row.status]?.label || row.status,
    },
    {
      key: "actions", header: "Aksi", align: "right", sticky: true, width: "120px",
      render: (row) => (
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors" onClick={() => handleViewDetail(row.id)}>
            <Eye className="w-3.5 h-3.5" />
          </Button>
          {row.status === "COMPLETED" && (
            <>
              <DisabledActionTooltip disabled={!canVoid} message={cannotMessage("void")} menuKey="transactions" actionKey="void">
                <Button disabled={!canVoid} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-orange-500 hover:text-orange-700 hover:bg-orange-50 transition-colors"
                  onClick={() => { setActionTxId(row.id); setReason(""); setVoidDialogOpen(true); }} title="Void">
                  <Ban className="w-3.5 h-3.5" />
                </Button>
              </DisabledActionTooltip>
              <DisabledActionTooltip disabled={!canRefund} message={cannotMessage("refund")} menuKey="transactions" actionKey="refund">
                <Button disabled={!canRefund} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                  onClick={() => { setActionTxId(row.id); setReason(""); setRefundDialogOpen(true); }} title="Refund">
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </DisabledActionTooltip>
            </>
          )}
        </div>
      ),
    },
  ];

  const filters: SmartFilter[] = [
    {
      key: "status", label: "Status", type: "select",
      options: [
        { value: "COMPLETED", label: "Selesai" },
        { value: "PENDING", label: "Pending" },
        { value: "VOIDED", label: "Void" },
        { value: "REFUNDED", label: "Refund" },
      ],
    },
    { key: "date", label: "Tanggal", type: "daterange" },
  ];

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-4">
          <div className="flex items-center justify-center w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200/50">
            <Receipt className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-2xl font-bold tracking-tight text-foreground">Riwayat Transaksi</h1>
            <p className="text-muted-foreground text-[11px] sm:text-sm">Kelola dan pantau semua transaksi</p>
          </div>
        </div>
        <Button variant="outline" className="hidden sm:inline-flex rounded-xl border-dashed" onClick={() => setImportOpen(true)}>
          <Upload className="w-4 h-4 mr-2" /> Import
        </Button>
      </div>

      <SmartTable<TransactionRow>
        data={data.transactions}
        columns={columns}
        totalItems={data.total}
        totalPages={data.totalPages}
        currentPage={page}
        pageSize={pageSize}
        loading={loading}
        title="Daftar Transaksi"
        titleIcon={<History className="w-4 h-4 text-muted-foreground" />}
        titleExtra={
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            <div className="inline-flex items-center gap-1 bg-slate-100/80 text-slate-600 rounded-full px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-medium">
              <ShoppingBag className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="font-mono tabular-nums">{stats.total}</span>
            </div>
            <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 rounded-full px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-medium ring-1 ring-emerald-100">
              <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="font-mono tabular-nums">{stats.completed}</span>
            </div>
            {stats.voided > 0 && (
              <div className="inline-flex items-center gap-1 bg-red-50 text-red-500 rounded-full px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-medium ring-1 ring-red-100">
                <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span className="font-mono tabular-nums">{stats.voided}</span>
              </div>
            )}
            {stats.refunded > 0 && (
              <div className="inline-flex items-center gap-1 bg-blue-50 text-blue-500 rounded-full px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-medium ring-1 ring-blue-100">
                <ArrowLeftRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span className="font-mono tabular-nums">{stats.refunded}</span>
              </div>
            )}
            <div className="inline-flex items-center gap-1 bg-violet-50 text-violet-600 rounded-full px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-medium ring-1 ring-violet-100">
              <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="font-mono tabular-nums">{formatCurrency(stats.totalRevenue)}</span>
            </div>
          </div>
        }
        searchPlaceholder="Cari invoice, kasir..."
        onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
        onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1); fetchData({ page: 1, sortKey: key, sortDir: dir }); }}
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
        rowKey={(r) => r.id}
        planMenuKey="transactions" exportModule="transactions" exportBranchId={selectedBranchId || undefined}
        emptyIcon={<Receipt className="w-10 h-10 text-muted-foreground/30" />}
        emptyTitle="Tidak ada transaksi ditemukan"
        mobileRender={(row) => {
          const cfg = statusConfig[row.status];
          const StatusIcon = cfg?.icon || Clock;
          const payments = getPayments(row);
          return (
            <div className="space-y-1.5">
              {/* Row 1: Invoice + Status + Menu */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <p className="font-mono text-xs font-bold text-foreground truncate">{row.invoiceNumber}</p>
                  <Badge variant="outline" className={`shrink-0 rounded-full text-[9px] font-medium px-1.5 py-px border-0 ${cfg?.badge || "bg-slate-50 text-slate-600"}`}>
                    <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                    {cfg?.label || row.status}
                  </Badge>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="p-0.5 -mr-0.5 rounded-md hover:bg-accent transition-colors" onClick={(e) => e.stopPropagation()}>
                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-36 p-1 rounded-xl" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] rounded-lg hover:bg-accent transition-colors" onClick={() => handleViewDetail(row.id)}>
                      <Eye className="w-3 h-3 text-indigo-500" />
                      Lihat Detail
                    </button>
                    {row.status === "COMPLETED" && (
                      <>
                        <button type="button" disabled={!canVoid} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] rounded-lg hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none" onClick={() => { setActionTxId(row.id); setReason(""); setVoidDialogOpen(true); }}>
                          <Ban className="w-3 h-3 text-orange-500" />
                          Void
                        </button>
                        <button type="button" disabled={!canRefund} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] rounded-lg hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none" onClick={() => { setActionTxId(row.id); setReason(""); setRefundDialogOpen(true); }}>
                          <RotateCcw className="w-3 h-3 text-blue-500" />
                          Refund
                        </button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Row 2: Date + Kasir */}
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="w-2.5 h-2.5 shrink-0" />
                <span className="font-mono tabular-nums">{formatDateTime(row.createdAt)}</span>
                <span className="text-muted-foreground/30">·</span>
                <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-white text-[7px] font-bold flex items-center justify-center shrink-0">
                  {getCashierName(row).charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{getCashierName(row)}</span>
              </div>

              {/* Row 3: Payment + Total */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  {(payments.length > 0 ? payments : [{ method: row.paymentMethod, amount: row.grandTotal }]).slice(0, 2).map((p, i) => {
                    const pm = paymentConfig[p.method];
                    const Icon = pm?.icon || Wallet;
                    return (
                      <Badge key={i} variant="outline" className={`rounded-full text-[9px] font-medium px-1.5 py-px border-0 ${pm?.color || "bg-slate-50 text-slate-600"}`}>
                        <Icon className="w-2.5 h-2.5 mr-0.5" />
                        {pm?.label || p.method}
                      </Badge>
                    );
                  })}
                  {payments.length > 2 && (
                    <Badge variant="outline" className="rounded-full text-[9px] px-1.5 py-px">+{payments.length - 2}</Badge>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {row.discountAmount > 0 && (
                    <p className="text-[9px] font-mono tabular-nums text-red-400 line-through">{formatCurrency(row.subtotal)}</p>
                  )}
                  <p className="text-xs font-bold text-foreground font-mono tabular-nums">{formatCurrency(row.grandTotal)}</p>
                </div>
              </div>
            </div>
          );
        }}
      />

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="rounded-2xl w-[calc(100vw-1rem)] sm:w-[95vw] max-w-[calc(100vw-1rem)] sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-t-2xl" />
          <DialogHeader className="px-3 sm:px-6 pt-3 sm:pt-6 shrink-0">
            <DialogTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-lg font-bold">
              <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200/50">
                <Receipt className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </div>
              Detail Transaksi
            </DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <>
              <DialogBody className="flex-1 overflow-y-auto px-3 sm:px-6 space-y-3 sm:space-y-4">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                  <div className="rounded-lg sm:rounded-xl bg-slate-50/80 border border-slate-100 p-2 sm:p-3 space-y-0.5 sm:space-y-1">
                    <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      <Hash className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Invoice
                    </div>
                    <p className="font-mono text-[11px] sm:text-sm font-bold text-foreground truncate">{selectedTx.invoiceNumber}</p>
                  </div>
                  <div className="rounded-lg sm:rounded-xl bg-slate-50/80 border border-slate-100 p-2 sm:p-3 space-y-0.5 sm:space-y-1">
                    <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Tanggal
                    </div>
                    <p className="text-[11px] sm:text-sm font-medium text-foreground">{formatDateTime(selectedTx.createdAt)}</p>
                  </div>
                  <div className="rounded-lg sm:rounded-xl bg-slate-50/80 border border-slate-100 p-2 sm:p-3 space-y-0.5 sm:space-y-1">
                    <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      <User className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Kasir
                    </div>
                    <p className="text-[11px] sm:text-sm font-medium text-foreground truncate">{selectedTx.user.name}</p>
                  </div>
                  <div className="rounded-lg sm:rounded-xl bg-slate-50/80 border border-slate-100 p-2 sm:p-3 space-y-0.5 sm:space-y-1">
                    <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Status
                    </div>
                    {(() => {
                      const cfg = statusConfig[selectedTx.status];
                      const Icon = cfg?.icon || Clock;
                      return (
                        <Badge variant="outline" className={`rounded-full text-[9px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-px sm:py-0.5 border-0 ${cfg?.badge || ""}`}>
                          <Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                          {cfg?.label || selectedTx.status}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>

                {/* Items - Mobile: compact list / Desktop: table */}
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 flex items-center gap-1 sm:gap-1.5">
                    <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Item Pembelian
                  </p>
                  {/* Mobile: compact item list */}
                  <div className="sm:hidden rounded-lg border border-border/30 overflow-hidden divide-y divide-border/20">
                    {selectedTx.items.map((item) => (
                      <div key={item.id} className="px-2.5 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-foreground truncate">{item.productName}</p>
                          {item.unitName && item.conversionQty && item.conversionQty > 1 && (
                            <p className="text-[9px] text-muted-foreground">
                              {item.quantity} {item.unitName} × {item.conversionQty} = {item.baseQty ?? item.quantity * item.conversionQty} pcs
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground font-mono tabular-nums mt-0.5">
                            {item.quantity}x {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <p className="text-[11px] font-semibold font-mono tabular-nums shrink-0">{formatCurrency(item.subtotal)}</p>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden sm:block rounded-xl border border-border/30 overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100/50">
                          <TableHead className="text-xs font-semibold">Produk</TableHead>
                          <TableHead className="text-center text-xs font-semibold">Qty</TableHead>
                          <TableHead className="text-right text-xs font-semibold">Harga</TableHead>
                          <TableHead className="text-right text-xs font-semibold">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTx.items.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                            <TableCell>
                              <div>
                                <span className="text-sm font-medium">{item.productName}</span>
                                {item.unitName && item.conversionQty && item.conversionQty > 1 && (
                                  <p className="text-[10px] text-muted-foreground">
                                    {item.quantity} {item.unitName} × {item.conversionQty} = {item.baseQty ?? item.quantity * item.conversionQty} pcs
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-md bg-slate-100 text-xs font-semibold font-mono">
                                {item.quantity}
                              </span>
                              {item.unitName && item.unitName !== "PCS" && (
                                <span className="text-[10px] text-muted-foreground ml-1">{item.unitName}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono tabular-nums text-muted-foreground">{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell className="text-right text-sm font-semibold font-mono tabular-nums">{formatCurrency(item.subtotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Summary */}
                <div className="rounded-lg sm:rounded-xl bg-slate-50/80 border border-slate-100 p-2.5 sm:p-4 space-y-1.5 sm:space-y-2">
                  <div className="flex justify-between text-[11px] sm:text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono tabular-nums">{formatCurrency(selectedTx.subtotal)}</span>
                  </div>
                  {selectedTx.discountAmount > 0 && (
                    <div className="flex justify-between text-[11px] sm:text-sm text-red-500">
                      <span>Diskon</span>
                      <span className="font-mono tabular-nums">-{formatCurrency(selectedTx.discountAmount)}</span>
                    </div>
                  )}
                  {selectedTx.taxAmount > 0 && (
                    <div className="flex justify-between text-[11px] sm:text-sm">
                      <span className="text-muted-foreground">Pajak</span>
                      <span className="font-mono tabular-nums">{formatCurrency(selectedTx.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center font-bold text-xs sm:text-base border-t border-slate-200 pt-1.5 sm:pt-2">
                    <span>Grand Total</span>
                    <span className="text-sm sm:text-lg font-mono tabular-nums bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">{formatCurrency(selectedTx.grandTotal)}</span>
                  </div>
                </div>

                {/* Payment breakdown */}
                <div className="rounded-lg sm:rounded-xl bg-slate-50/80 border border-slate-100 p-2.5 sm:p-4 space-y-1.5 sm:space-y-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 sm:gap-1.5">
                    <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Pembayaran
                  </p>
                  {selectedTx.payments && selectedTx.payments.length > 1 ? (
                    <div className="space-y-1 sm:space-y-1.5">
                      {selectedTx.payments.map((p: { id: string; method: string; amount: number }, idx: number) => {
                        const pm = paymentConfig[p.method];
                        const Icon = pm?.icon || Wallet;
                        return (
                          <div key={idx} className="flex items-center justify-between text-[11px] sm:text-sm">
                            <span className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground">
                              <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              {pm?.label || p.method}
                            </span>
                            <span className="font-mono tabular-nums font-medium">{formatCurrency(p.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] sm:text-sm">
                      <span className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground">
                        {(() => { const pm = paymentConfig[selectedTx.paymentMethod]; const Icon = pm?.icon || Wallet; return <><Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />{pm?.label || selectedTx.paymentMethod}</>; })()}
                      </span>
                      <span className="font-mono tabular-nums font-medium">{formatCurrency(selectedTx.paymentAmount)}</span>
                    </div>
                  )}
                  {selectedTx.changeAmount > 0 && (
                    <div className="flex items-center justify-between text-[11px] sm:text-sm border-t border-slate-200 pt-1 sm:pt-1.5">
                      <span className="text-muted-foreground">Kembalian</span>
                      <span className="font-mono tabular-nums font-medium text-emerald-600">{formatCurrency(selectedTx.changeAmount)}</span>
                    </div>
                  )}
                </div>
              </DialogBody>
              <DialogFooter className="px-3 sm:px-6 pb-3 sm:pb-6 pt-2 sm:pt-3 shrink-0">
                <Button
                  variant="outline"
                  className="w-full rounded-xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all text-[11px] sm:text-sm h-9 sm:h-10"
                  onClick={() => {
                    if (!selectedTx) return;
                    printThermalReceipt({
                      invoiceNumber: selectedTx.invoiceNumber,
                      date: formatDateTime(selectedTx.createdAt),
                      cashier: selectedTx.user.name,
                      items: selectedTx.items.map((i) => ({
                        name: i.productName,
                        qty: i.quantity,
                        price: i.unitPrice,
                        subtotal: i.subtotal,
                        ...(i.unitName ? { unitName: i.unitName } : {}),
                        ...(i.conversionQty ? { conversionQty: i.conversionQty } : {}),
                      })),
                      subtotal: selectedTx.subtotal,
                      discount: selectedTx.discountAmount,
                      tax: selectedTx.taxAmount,
                      grandTotal: selectedTx.grandTotal,
                      paymentMethod: selectedTx.paymentMethod,
                      paymentAmount: selectedTx.paymentAmount,
                      change: selectedTx.changeAmount,
                      payments: selectedTx.payments && selectedTx.payments.length > 1
                        ? selectedTx.payments.map((p: { method: string; amount: number }) => ({ method: p.method, amount: p.amount }))
                        : undefined,
                      promos: selectedTx.promoApplied ? [selectedTx.promoApplied] : undefined,
                    });
                  }}
                >
                  <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  Cetak Struk
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent className="rounded-2xl w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-sm p-0 gap-0 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-red-500 to-rose-500" />
          <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
            <DialogHeader className="p-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-lg font-bold">
                <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-md shadow-orange-200/50">
                  <Ban className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                Void Transaksi
              </DialogTitle>
            </DialogHeader>
            <div className="rounded-lg sm:rounded-xl bg-amber-50/60 border border-amber-100 p-2.5 sm:p-3 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] sm:text-xs text-amber-700">Transaksi akan dibatalkan dan stok akan dikembalikan. Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="voidReason" className="text-[11px] sm:text-sm font-medium">Alasan Void <span className="text-red-400">*</span></Label>
              <Input id="voidReason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masukkan alasan void..." className="rounded-lg sm:rounded-xl h-9 sm:h-10 text-xs sm:text-sm" autoFocus />
            </div>
            <div className="flex justify-end gap-1.5 sm:gap-2 pt-1">
              <Button variant="outline" onClick={() => setVoidDialogOpen(false)} className="rounded-lg sm:rounded-xl text-[11px] sm:text-sm h-8 sm:h-10 px-3 sm:px-4">Batal</Button>
              <DisabledActionTooltip disabled={!canVoid} message={cannotMessage("void")} menuKey="transactions" actionKey="void">
                <Button disabled={!canVoid} onClick={handleVoid} className="rounded-lg sm:rounded-xl bg-red-600 hover:bg-red-700 shadow-md shadow-red-200/50 text-[11px] sm:text-sm h-8 sm:h-10 px-3 sm:px-4">
                  <Ban className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5" /> Void
                </Button>
              </DisabledActionTooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="rounded-2xl w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-sm p-0 gap-0 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
          <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
            <DialogHeader className="p-0">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-lg font-bold">
                <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200/50">
                  <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                Refund Transaksi
              </DialogTitle>
            </DialogHeader>
            <div className="rounded-lg sm:rounded-xl bg-blue-50/60 border border-blue-100 p-2.5 sm:p-3 flex items-start gap-2">
              <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] sm:text-xs text-blue-700">Transaksi akan di-refund dan stok akan dikembalikan. Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="refundReason" className="text-[11px] sm:text-sm font-medium">Alasan Refund <span className="text-red-400">*</span></Label>
              <Input id="refundReason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masukkan alasan refund..." className="rounded-lg sm:rounded-xl h-9 sm:h-10 text-xs sm:text-sm" autoFocus />
            </div>
            <div className="flex justify-end gap-1.5 sm:gap-2 pt-1">
              <Button variant="outline" onClick={() => setRefundDialogOpen(false)} className="rounded-lg sm:rounded-xl text-[11px] sm:text-sm h-8 sm:h-10 px-3 sm:px-4">Batal</Button>
              <DisabledActionTooltip disabled={!canRefund} message={cannotMessage("refund")} menuKey="transactions" actionKey="refund">
                <Button disabled={!canRefund} onClick={handleRefund} className="rounded-lg sm:rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200/50 text-[11px] sm:text-sm h-8 sm:h-10 px-3 sm:px-4">
                  <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5" /> Refund
                </Button>
              </DisabledActionTooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <TransactionImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        branchId={selectedBranchId || undefined}
        onImported={() => { setPage(1); fetchData({ page: 1 }); refreshStats(); }}
      />
    </div>
  );
}
