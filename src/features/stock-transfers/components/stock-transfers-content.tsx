"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { useState, useEffect, useRef, useTransition } from "react";
import { useQueryParams } from "@/hooks/use-query-params";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  getStockTransfers,
  getStockTransferById,
  getStockTransferStats,
  createStockTransfer,
  approveStockTransfer,
  receiveStockTransfer,
  rejectStockTransfer,
} from "@/features/stock-transfers";
import { getAllBranches } from "@/features/branches";
import { createStockTransferSchema, type CreateStockTransferInput } from "@/features/stock-transfers/schemas/stock-transfers.schema";
import { useMenuActionAccess } from "@/features/access-control";
import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { ProductPicker } from "@/components/ui/product-picker";
import { ExportMenu } from "@/components/ui/export-menu";
import { Label } from "@/components/ui/label";
import { SmartSelect } from "@/components/ui/smart-select";
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FilterBottomSheet } from "@/components/ui/filter-bottom-sheet";
import { SearchInput } from "@/components/ui/search-input";
import {
  Plus, Eye, ArrowRightLeft, ArrowRight,
  CheckCircle2, XCircle, PackageCheck,
  Clock, ShieldCheck, Truck, PackageOpen, Ban, Package,
  Loader2, CalendarDays, MapPin, SlidersHorizontal, Upload, Copy, MoreVertical,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { StockTransfer, Branch, StockTransferDetail } from "@/types";
import { useBranch } from "@/components/providers/branch-provider";
import { PaginationControl } from "@/components/ui/pagination-control";
import { TransferImportDialog } from "./transfer-import-dialog";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType; borderColor: string; gradientBg: string }> = {
  PENDING: { label: "Menunggu", color: "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border border-amber-200", icon: Clock, borderColor: "border-l-amber-400", gradientBg: "from-amber-400 to-yellow-500" },
  APPROVED: { label: "Disetujui", color: "bg-gradient-to-r from-blue-100 to-sky-100 text-blue-700 border border-blue-200", icon: ShieldCheck, borderColor: "border-l-blue-400", gradientBg: "from-blue-400 to-sky-500" },
  IN_TRANSIT: { label: "Dalam Perjalanan", color: "bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 border border-purple-200", icon: Truck, borderColor: "border-l-purple-400", gradientBg: "from-purple-400 to-violet-500" },
  RECEIVED: { label: "Diterima", color: "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200", icon: PackageOpen, borderColor: "border-l-green-400", gradientBg: "from-emerald-400 to-green-500" },
  REJECTED: { label: "Ditolak", color: "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200", icon: Ban, borderColor: "border-l-red-400", gradientBg: "from-red-400 to-rose-500" },
};

const STATUS_PILLS = [
  { value: "ALL", label: "Semua" },
  { value: "PENDING", label: "Menunggu" },
  { value: "APPROVED", label: "Disetujui" },
  { value: "RECEIVED", label: "Diterima" },
  { value: "REJECTED", label: "Ditolak" },
];

export function StockTransfersContent() {
  const [data, setData] = useState<{ transfers: StockTransfer[]; total: number; totalPages: number; currentPage: number }>({ transfers: [], total: 0, totalPages: 0, currentPage: 1 });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransferDetail | null>(null);
  const qp = useQueryParams({ pageSize: 10, filters: { status: "ALL" } });
  const { page, pageSize, search, filters: activeFilters } = qp;
  const [searchInput, setSearchInput] = useState(search);
  const [sortKey] = useState<string>("");
  const [sortDir] = useState<"asc" | "desc">("asc");
  const [loading, startTransition] = useTransition();
  const { selectedBranchId, branchReady } = useBranch();
  const prevBranchRef = useRef(selectedBranchId);

  // Create form (React Hook Form + Zod)
  const form = useForm<CreateStockTransferInput>({
    resolver: zodResolver(createStockTransferSchema),
    defaultValues: { fromBranchId: "", toBranchId: "", notes: "", items: [] },
  });
  const cartItems = form.watch("items");

  // Reject state
  const [rejectReason, setRejectReason] = useState("");
  const [rejectId, setRejectId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
  const [confirmKind, setConfirmKind] = useState<"approve" | "custom">("custom");
  const { canAction, cannotMessage } = useMenuActionAccess("stock-transfers");
  const { canAction: canPlan } = usePlanAccess();
  const canCreate = canAction("create") && canPlan("stock-transfers", "create");
  const canApprove = canAction("approve") && canPlan("stock-transfers", "approve");
  const canReceive = canAction("receive");

  const activeBranches = branches.filter((b) => b.isActive);

  const [stats, setStats] = useState({ pending: 0, approved: 0, inTransit: 0, received: 0, rejected: 0 });

  function fetchData(params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) {
    startTransition(async () => {
      const f = params.filters ?? activeFilters;
      const sk = params.sortKey ?? sortKey;
      const sd = params.sortDir ?? sortDir;
      const query = {
        search: params.search ?? search,
        page: params.page ?? page,
        perPage: params.pageSize ?? pageSize,
        ...(f.status !== "ALL" ? { status: f.status } : {}),
        ...(f.date_from ? { dateFrom: f.date_from } : {}),
        ...(f.date_to ? { dateTo: f.date_to } : {}),
        ...(sk ? { sortBy: sk, sortDir: sd } : {}),
        ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
      };
      const [result, statsResult] = await Promise.all([
        getStockTransfers(query),
        getStockTransferStats(selectedBranchId || undefined),
      ]);
      setData(result);
      setStats(statsResult);
    });
  }

  useEffect(() => {
    startTransition(async () => {
      const allBranches = await getAllBranches();
      setBranches(allBranches);
    });
  }, []);

  useEffect(() => {
    if (!branchReady) return;
    prevBranchRef.current = selectedBranchId;
    fetchData({});
  }, [branchReady, selectedBranchId, page, pageSize, search, activeFilters.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewDetail = async (id: string) => {
    const transfer = await getStockTransferById(id);
    setSelectedTransfer(transfer);
    setDetailOpen(true);
  };


  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);

  const handleCreate = form.handleSubmit(() => {
    if (!canCreate) { toast.error(cannotMessage("create")); return; }
    setTransferConfirmOpen(true);
  });

  const executeCreateTransfer = async () => {
    const data = form.getValues();
    const payload = {
      fromBranchId: data.fromBranchId,
      toBranchId: data.toBranchId,
      items: data.items,
      ...(data.notes ? { notes: data.notes } : {}),
    };

    const result = await createStockTransfer(payload);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Transfer stok berhasil dibuat");
      setCreateOpen(false);
      form.reset();
      fetchData({});
    }
    setTransferConfirmOpen(false);
  };

  const handleApprove = async (id: string) => {
    if (!canApprove) { toast.error(cannotMessage("approve")); return; }
    setConfirmKind("approve");
    setConfirmText("Yakin ingin menyetujui transfer ini?");
    setPendingConfirmAction(() => async () => {
      const result = await approveStockTransfer(id);
      if (result.error) toast.error(result.error);
      else { toast.success("Transfer disetujui"); setDetailOpen(false); fetchData({}); }
      setConfirmOpen(false);
      setPendingConfirmAction(null);
    });
    setConfirmOpen(true);
  };

  const handleReceive = async (id: string) => {
    if (!canReceive) { toast.error(cannotMessage("receive")); return; }
    setConfirmKind("approve");
    setConfirmText("Yakin ingin menerima transfer ini? Stok akan diperbarui.");
    setPendingConfirmAction(() => async () => {
      const result = await receiveStockTransfer(id);
      if (result.error) toast.error(result.error);
      else { toast.success("Transfer diterima. Stok telah diperbarui."); setDetailOpen(false); fetchData({}); }
      setConfirmOpen(false);
      setPendingConfirmAction(null);
    });
    setConfirmOpen(true);
  };

  const openRejectDialog = (id: string) => {
    if (!canApprove) { toast.error(cannotMessage("approve")); return; }
    setRejectId(id);
    setRejectReason("");
    setRejectOpen(true);
  };

  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);

  const handleReject = () => {
    if (!canApprove) { toast.error(cannotMessage("approve")); return; }
    setRejectConfirmOpen(true);
  };

  const executeReject = async () => {
    setRejectLoading(true);
    const result = await rejectStockTransfer(rejectId, rejectReason || undefined);
    setRejectLoading(false);
    if (result.error) { toast.error(result.error); }
    else { toast.success("Transfer ditolak"); setRejectOpen(false); setDetailOpen(false); fetchData({}); }
    setRejectConfirmOpen(false);
  };

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => { qp.setSearch(value); }, 400);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Nomor transfer disalin");
  };

  const handleStatusPill = (status: string) => {
    qp.setFilters({ ...activeFilters, status });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-200">
            <ArrowRightLeft className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Transfer Stok</h1>
            <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-2">
              Kelola transfer stok antar cabang
              <Badge variant="secondary" className="text-xs font-normal">{data.total} transfer</Badge>
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <ExportMenu module="stock-transfers" branchId={selectedBranchId || undefined} filters={activeFilters} />
          <Button variant="outline" className="rounded-xl border-dashed" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>
          <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="stock-transfers" actionKey="create">
            <Button disabled={!canCreate} className="text-sm rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 shadow-lg shadow-purple-200/50 text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Buat Transfer
            </Button>
          </DisabledActionTooltip>
        </div>
        {canCreate && (
          <div className="sm:hidden fixed bottom-4 right-4 z-50">
            <Button onClick={() => setCreateOpen(true)} size="icon" className="h-12 w-12 rounded-full shadow-xl shadow-purple-300/50 bg-gradient-to-br from-purple-500 to-violet-600">
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        )}
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) form.reset(); }}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl rounded-xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
            <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 rounded-t-xl sm:rounded-t-2xl shrink-0" />
            <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 shrink-0">
              <DialogTitle className="text-base sm:text-lg font-bold">Buat Transfer Stok</DialogTitle>
            </DialogHeader>

            <DialogBody className={`space-y-3 sm:space-y-5 overflow-x-hidden px-4 sm:px-6 ${!canCreate ? "pointer-events-none opacity-70" : ""}`}>
              {/* From / To branch selectors — inline on sm, stacked on mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs sm:text-sm font-medium">Cabang Asal <span className="text-red-400">*</span></Label>
                  <Controller name="fromBranchId" control={form.control} render={({ field }) => (
                    <SmartSelect value={field.value} onChange={(v) => { field.onChange(v); form.setValue("items", []); }} placeholder="Pilih cabang asal"
                      onSearch={async (query) => activeBranches.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())).map((b) => ({ value: b.id, label: b.name }))} />
                  )} />
                  {form.formState.errors.fromBranchId && <p className="text-xs text-red-500">{form.formState.errors.fromBranchId.message}</p>}
                </div>
                <ArrowRight className="w-5 h-5 text-purple-400 shrink-0 hidden sm:block mt-6" />
                <div className="flex-1 space-y-2">
                  <Label className="text-xs sm:text-sm font-medium">Cabang Tujuan <span className="text-red-400">*</span></Label>
                  <Controller name="toBranchId" control={form.control} render={({ field }) => (
                    <SmartSelect value={field.value} onChange={field.onChange} placeholder="Pilih cabang tujuan"
                      onSearch={async (query) => activeBranches.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())).map((b) => ({ value: b.id, label: b.name }))} />
                  )} />
                  {form.formState.errors.toBranchId && <p className="text-xs text-red-500">{form.formState.errors.toBranchId.message}</p>}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">Catatan (opsional)</Label>
                <Textarea {...form.register("notes")} className="rounded-xl resize-none min-h-[60px]" placeholder="Catatan transfer..." />
              </div>

              {/* Product items */}
              {form.formState.errors.items && <p className="text-xs text-red-500">{form.formState.errors.items.message || form.formState.errors.items.root?.message}</p>}
              <ProductPicker
                stickySearch
                items={cartItems.map((item) => ({
                  productId: item.productId,
                  productName: item.productName,
                  productCode: "",
                  productPrice: 0,
                  quantity: item.quantity,
                }))}
                onChange={(pickerItems) => {
                  form.setValue("items", pickerItems.map((pi) => ({
                    productId: pi.productId,
                    productName: pi.productName,
                    quantity: pi.quantity,
                  })), { shouldValidate: true });
                }}
                branchId={form.watch("fromBranchId") || undefined}
                label="Item Transfer"
                required
                showPrice={false}
                showSubtotal={false}
                emptyText="Pilih cabang asal lalu tambahkan produk"
              />
            </DialogBody>

            <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6 shrink-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-2">
                {cartItems.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-medium text-purple-700">Total:</span>
                    <Badge className="bg-gradient-to-r from-purple-500 to-violet-600 text-white px-3">
                      {cartItems.length} produk, {cartItems.reduce((sum, item) => sum + item.quantity, 0)} unit
                    </Badge>
                  </div>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Batal</Button>
                  <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="stock-transfers" actionKey="create">
                    <Button disabled={!canCreate || form.formState.isSubmitting} onClick={handleCreate} className="rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white shadow-lg shadow-purple-200/50">
                      {form.formState.isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                      {form.formState.isSubmitting ? "Menyimpan..." : "Buat Transfer"}
                    </Button>
                  </DisabledActionTooltip>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + filter pills — sticky */}
      <div className="sticky top-0 z-20  -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1 space-y-3">
        {/* Mobile */}
        <div className="sm:hidden space-y-2">
          <div className="flex items-center gap-2">
            <SearchInput value={searchInput} onChange={handleSearchChange} placeholder="Cari nomor opname..." loading={loading} className="flex-1 max-w-sm" size="sm" />

            <button
              onClick={() => setFilterSheetOpen(true)}
              className={cn("relative h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center transition-colors",
                activeFilters.status && activeFilters.status !== "ALL" ? "border-purple-300 bg-purple-50 text-purple-600" : "border-slate-200 bg-white text-muted-foreground hover:bg-slate-50")}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilters.status && activeFilters.status !== "ALL" && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-500 text-white text-[9px] font-bold flex items-center justify-center">1</span>
              )}
            </button>
          </div>
          {activeFilters.status && activeFilters.status !== "ALL" && (
            <div className="flex items-center gap-1.5">
              <Badge className={cn(statusConfig[activeFilters.status as string]?.color, "gap-1 text-[10px] px-2 py-0.5")}>
                {(() => { const I = statusConfig[activeFilters.status as string]?.icon; return I ? <I className="w-2.5 h-2.5" /> : null; })()}
                {statusConfig[activeFilters.status as string]?.label}
              </Badge>
              <button onClick={() => handleStatusPill("ALL")} className="text-muted-foreground hover:text-foreground">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <FilterBottomSheet
            open={filterSheetOpen}
            onOpenChange={setFilterSheetOpen}
            title="Filter Status"
            immediate
            sections={[{
              key: "status",
              label: "Status",
              options: STATUS_PILLS.map((pill) => ({
                value: pill.value,
                label: pill.label,
                count: pill.value === "ALL" ? undefined : pill.value === "PENDING" ? stats.pending : pill.value === "APPROVED" ? stats.approved : pill.value === "RECEIVED" ? stats.received : stats.rejected,
                borderColor: statusConfig[pill.value]?.borderColor,
              })),
            }]}
            values={{ status: activeFilters.status as string || "ALL" }}
            onApply={(v) => handleStatusPill(v.status || "ALL")}
          />
        </div>

        {/* Desktop: search + filter pills with count */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          <SearchInput value={searchInput} onChange={handleSearchChange} placeholder="Cari no transfer..." loading={loading} className="flex-1 max-w-sm" />

          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_PILLS.map((pill) => {
              const count = pill.value === "ALL" ? null : pill.value === "PENDING" ? stats.pending : pill.value === "APPROVED" ? stats.approved : pill.value === "RECEIVED" ? stats.received : pill.value === "REJECTED" ? stats.rejected : 0;
              return (
                <button key={pill.value} onClick={() => handleStatusPill(pill.value)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5 ${activeFilters.status === pill.value
                    ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-md shadow-purple-200/50"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  {pill.label}
                  {count !== null && <span className={`text-[10px] font-bold min-w-[16px] h-4 rounded-full inline-flex items-center justify-center ${activeFilters.status === pill.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transfer Card List */}
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Memuat data...</span>
          </div>
        )}

        {!loading && data.transfers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center">
            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center mb-4">
              <ArrowRightLeft className="w-5 h-5 sm:w-8 sm:h-8 text-purple-400" />
            </div>
            <h3 className="text-sm sm:text-lg font-semibold text-foreground mb-1">Belum ada transfer stok</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
              Tidak ada data transfer yang ditemukan. Buat transfer baru untuk memulai.
            </p>
          </div>
        )}

        {!loading && (
          <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
            {data.transfers.map((row) => {
              const cfg = statusConfig[row.status] || { label: row.status, color: "bg-slate-100 text-slate-700", icon: Clock, borderColor: "border-l-slate-400", gradientBg: "from-slate-400 to-gray-500" };
              const IconComp = cfg.icon;

              return (
                <div key={row.id} className={`group relative bg-white rounded-xl border border-slate-200/60 border-l-4 ${cfg.borderColor} shadow-sm hover:shadow-md transition-all duration-200`}>
                  {/* ===== Mobile card ===== */}
                  <div className="sm:hidden p-3" onClick={() => handleViewDetail(row.id)}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cfg.gradientBg} flex items-center justify-center shadow-sm shrink-0`}>
                        <ArrowRightLeft className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 pr-14">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-foreground">{row.transferNumber}</span>
                          <button onClick={(e) => { e.stopPropagation(); copyToClipboard(row.transferNumber); }} className="p-0.5 rounded hover:bg-slate-100">
                            <Copy className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          <span className="font-medium text-foreground truncate">{row.fromBranch.name}</span>
                          <ArrowRight className="w-3 h-3 shrink-0 text-purple-400" />
                          <span className="font-medium text-foreground truncate">{row.toBranch.name}</span>
                        </div>
                      </div>
                      <Badge className={`${cfg.color} gap-1 px-2 py-0.5 text-[10px] font-medium shadow-none absolute top-2 right-2`}>
                        <IconComp className="w-2.5 h-2.5" />{cfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />{format(new Date(row.requestedAt), "dd MMM yy", { locale: idLocale })}</span>
                        <span className="inline-flex items-center gap-1"><Package className="w-3 h-3" />{row._count.items} item</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-44">
                          <DropdownMenuItem onClick={() => handleViewDetail(row.id)} className="text-xs gap-2">
                            <Eye className="w-3.5 h-3.5" /> Detail
                          </DropdownMenuItem>
                          {row.status === "PENDING" && (
                            <>
                              <DropdownMenuItem disabled={!canApprove} onClick={() => handleApprove(row.id)} className="text-xs gap-2 text-emerald-600">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={!canApprove} onClick={() => openRejectDialog(row.id)} className="text-xs gap-2 text-red-600 focus:text-red-600">
                                <XCircle className="w-3.5 h-3.5" /> Tolak
                              </DropdownMenuItem>
                            </>
                          )}
                          {row.status === "APPROVED" && (
                            <DropdownMenuItem disabled={!canReceive} onClick={() => handleReceive(row.id)} className="text-xs gap-2 text-blue-600">
                              <PackageCheck className="w-3.5 h-3.5" /> Terima
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* ===== Desktop card ===== */}
                  <div className="hidden sm:flex p-4 items-center gap-3">
                    <Badge className={`${cfg.color} gap-1.5 rounded-bl-xl rounded-tr-xl rounded-tl-none rounded-br-none px-3 py-1 text-[11px] font-medium shadow-none absolute top-0 right-0 z-[1]`}>
                      <IconComp className="w-3 h-3" />{cfg.label}
                    </Badge>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.gradientBg} flex items-center justify-center shadow-sm shrink-0`}>
                      <ArrowRightLeft className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm font-bold text-foreground">{row.transferNumber}</span>
                        <button onClick={(e) => { e.stopPropagation(); copyToClipboard(row.transferNumber); }} className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-100">
                          <Copy className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0 text-violet-500" />
                        <span className="font-medium text-foreground truncate">{row.fromBranch.name}</span>
                        <ArrowRight className="w-3 h-3 shrink-0 text-purple-400" />
                        <span className="font-medium text-foreground truncate">{row.toBranch.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="w-3 h-3" />{format(new Date(row.requestedAt), "dd MMM yy", { locale: idLocale })}</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"><Package className="w-3 h-3 text-slate-400" />{row._count.items} item</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                      <Button variant="ghost" size="icon-sm" className="rounded-lg hover:bg-purple-50 hover:text-purple-600" onClick={() => handleViewDetail(row.id)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {row.status === "PENDING" && (
                        <>
                          <Button disabled={!canApprove} variant="ghost" size="icon-sm" className="rounded-lg text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleApprove(row.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button disabled={!canApprove} variant="ghost" size="icon-sm" className="rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => openRejectDialog(row.id)}>
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {row.status === "APPROVED" && (
                        <Button disabled={!canReceive} variant="ghost" size="icon-sm" className="rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleReceive(row.id)}>
                          <PackageCheck className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      <PaginationControl
        currentPage={page}
        totalPages={data.totalPages}
        totalItems={data.total}
        pageSize={pageSize}
        onPageChange={(p) => qp.setPage(p)}
        onPageSizeChange={(s) => qp.setParams({ pageSize: s, page: 1 })}
      />

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl rounded-xl sm:rounded-2xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 shrink-0" />
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 shrink-0">
            <DialogTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm sm:text-lg font-bold">Detail Transfer</span>
                {selectedTransfer && (
                  <span className="font-mono text-[10px] sm:text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg truncate">
                    {selectedTransfer.transferNumber}
                  </span>
                )}
              </div>
              {selectedTransfer && (() => {
                const cfg = statusConfig[selectedTransfer.status] || { label: selectedTransfer.status, color: "bg-slate-100 text-slate-700", icon: Clock, borderColor: "", gradientBg: "" };
                const SIcon = cfg.icon;
                return <Badge className={`${cfg.color} gap-1 px-2 py-0.5 text-[10px] sm:text-xs shrink-0`}><SIcon className="w-3 h-3" />{cfg.label}</Badge>;
              })()}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="px-4 sm:px-6">
            {selectedTransfer && (
              <div className="space-y-3 sm:space-y-5">
                {/* Route card */}
                <div className="rounded-xl bg-gradient-to-r from-purple-50/50 via-violet-50/30 to-indigo-50/50 border border-purple-100 p-3 sm:p-4">
                  <div className="flex items-center justify-center gap-3 sm:gap-4">
                    <div className="text-center">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center text-violet-600 font-bold text-xs sm:text-sm mx-auto border border-violet-200/50 mb-1">
                        {selectedTransfer.fromBranch.name.charAt(0)}
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Dari</p>
                      <p className="text-xs sm:text-sm font-semibold">{selectedTransfer.fromBranch.name}</p>
                    </div>
                    <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-md shrink-0">
                      <ArrowRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div className="text-center">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-indigo-600 font-bold text-xs sm:text-sm mx-auto border border-indigo-200/50 mb-1">
                        {selectedTransfer.toBranch.name.charAt(0)}
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Ke</p>
                      <p className="text-xs sm:text-sm font-semibold">{selectedTransfer.toBranch.name}</p>
                    </div>
                  </div>
                </div>

                {/* Mobile: compact info */}
                <div className="sm:hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Diminta</p>
                    <p className="text-xs">{format(new Date(selectedTransfer.requestedAt), "dd MMM yyyy, HH:mm", { locale: idLocale })}</p>
                  </div>
                  {selectedTransfer.approvedAt && (
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Disetujui</p>
                      <p className="text-xs text-blue-600 font-medium">{format(new Date(selectedTransfer.approvedAt), "dd MMM yyyy", { locale: idLocale })}</p>
                    </div>
                  )}
                  {selectedTransfer.receivedAt && (
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Diterima</p>
                      <p className="text-xs text-emerald-600 font-medium">{format(new Date(selectedTransfer.receivedAt), "dd MMM yyyy", { locale: idLocale })}</p>
                    </div>
                  )}
                  {selectedTransfer.notes && (
                    <>
                      <div className="h-px bg-slate-100" />
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Catatan</p>
                        <p className="text-xs text-foreground">{selectedTransfer.notes}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Desktop: info pills */}
                <div className="hidden sm:flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 bg-slate-50 rounded-full px-2 py-1 ring-1 ring-slate-100">
                    <CalendarDays className="w-3 h-3" /> {format(new Date(selectedTransfer.requestedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}
                  </span>
                  {selectedTransfer.approvedAt && (
                    <span className="inline-flex items-center gap-1 bg-blue-50 rounded-full px-2 py-1 ring-1 ring-blue-100 text-blue-600">
                      <ShieldCheck className="w-3 h-3" /> {format(new Date(selectedTransfer.approvedAt), "dd MMM yy", { locale: idLocale })}
                    </span>
                  )}
                  {selectedTransfer.receivedAt && (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 rounded-full px-2 py-1 ring-1 ring-emerald-100 text-emerald-600">
                      <PackageOpen className="w-3 h-3" /> {format(new Date(selectedTransfer.receivedAt), "dd MMM yy", { locale: idLocale })}
                    </span>
                  )}
                  {selectedTransfer.notes && <span className="text-slate-400 truncate max-w-[200px]">{selectedTransfer.notes}</span>}
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-xs sm:text-sm font-semibold text-purple-700">Item ({selectedTransfer.items.length})</span>
                  </div>
                  {/* Mobile: card list */}
                  <div className="sm:hidden space-y-1.5">
                    {selectedTransfer.items.map((item) => {
                      const isFull = item.receivedQty >= item.quantity;
                      return (
                        <div key={item.id} className={cn("rounded-lg border p-2.5 flex items-center gap-3",
                          item.receivedQty > 0 ? (isFull ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30") : "border-slate-200/60 bg-white")}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{item.productName}</p>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                              <span>Qty: <strong className="text-foreground">{item.quantity}</strong></span>
                              {item.receivedQty > 0 && (
                                <span>Terima: <strong className={isFull ? "text-emerald-600" : "text-amber-600"}>{item.receivedQty}</strong></span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {item.receivedQty > 0 ? (
                              isFull ? <span className="text-emerald-500 text-sm font-bold">✓</span> : <Badge className="rounded-md bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5">{item.receivedQty}/{item.quantity}</Badge>
                            ) : (
                              <Badge variant="secondary" className="rounded-md text-[10px] font-semibold">{item.quantity}</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden sm:block">
                    <Table noWrapper>
                      <TableHeader className="sticky top-[-10px] z-10 bg-white [box-shadow:0_1px_0_0_#e5e7eb]">
                        <TableRow>
                          <TableHead>Produk</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-center">Diterima</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTransfer.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center text-purple-600 font-bold text-[10px]">
                                  {item.productName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium">{item.productName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center"><Badge variant="secondary" className="rounded-lg font-semibold">{item.quantity}</Badge></TableCell>
                            <TableCell className="text-center">
                              <Badge className={`rounded-lg font-semibold ${item.receivedQty >= item.quantity ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>{item.receivedQty}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-2">
              <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)} className="rounded-xl text-xs sm:text-sm order-2 sm:order-1">Tutup</Button>
              {selectedTransfer && (
                <div className="flex items-center gap-1.5 order-1 sm:order-2">
                  {selectedTransfer.status === "PENDING" && (
                    <>
                      <Button disabled={!canApprove} variant="destructive" size="sm" onClick={() => { setDetailOpen(false); openRejectDialog(selectedTransfer.id); }} className="rounded-xl text-xs sm:text-sm flex-1 sm:flex-none">
                        <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" /> Tolak
                      </Button>
                      <Button disabled={!canApprove} size="sm" onClick={() => handleApprove(selectedTransfer.id)} className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs sm:text-sm flex-1 sm:flex-none">
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" /> Setujui
                      </Button>
                    </>
                  )}
                  {selectedTransfer.status === "APPROVED" && (
                    <Button disabled={!canReceive} size="sm" onClick={() => handleReceive(selectedTransfer.id)} className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs sm:text-sm flex-1 sm:flex-none">
                      <PackageCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" /> Terima
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-xl sm:rounded-2xl p-0 gap-0 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 shrink-0" />
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <DialogHeader className="pt-4 sm:pt-6 pb-3">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center shrink-0">
                  <XCircle className="w-4 h-4 text-red-600" />
                </div>
                Tolak Transfer
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4 mt-2 sm:mt-4">
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">Alasan Penolakan (opsional)</Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="rounded-xl resize-none min-h-[80px]"
                  placeholder="Masukkan alasan penolakan..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRejectOpen(false)} className="rounded-xl">Batal</Button>
                <DisabledActionTooltip disabled={!canApprove} message={cannotMessage("approve")} menuKey="stock-transfers" actionKey="approve">
                  <Button disabled={!canApprove || rejectLoading} variant="destructive" onClick={handleReject} className="rounded-xl">
                    {rejectLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
                    {rejectLoading ? "Memproses..." : "Tolak Transfer"}
                  </Button>
                </DisabledActionTooltip>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={(v) => { setConfirmOpen(v); if (!v) setPendingConfirmAction(null); }}
        kind={confirmKind}
        description={confirmText}
        confirmLabel="Ya, Lanjutkan"
        onConfirm={async () => { await pendingConfirmAction?.(); }}
        size="sm"
      />
      <ActionConfirmDialog
        open={transferConfirmOpen}
        onOpenChange={setTransferConfirmOpen}
        kind="submit"
        description="Yakin ingin membuat transfer stok ini?"
        onConfirm={executeCreateTransfer}
      />
      <ActionConfirmDialog
        open={rejectConfirmOpen}
        onOpenChange={setRejectConfirmOpen}
        kind="delete"
        title="Konfirmasi Penolakan"
        description="Yakin ingin menolak transfer ini?"
        confirmLabel="Ya, Tolak"
        onConfirm={executeReject}
      />

      <TransferImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => fetchData({})} />
    </div>
  );
}
