"use client";

import { ProButton } from "@/components/ui/pro-gate";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useQueryParams } from "@/hooks/use-query-params";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createStockMovement, getStockMovements, getStockMovementStats } from "@/features/stock";
import { ProductPicker } from "@/components/ui/product-picker";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { getAllBranches } from "@/features/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { BranchMultiSelect } from "@/components/ui/branch-multi-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, BoxesIcon, ArrowDownLeft, ArrowUpRight, RefreshCw, ArrowLeftRight, ClipboardCheck,
  Search, Loader2, CalendarDays, MapPin, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { ProductBasic } from "@/types";
import { PaginationControl } from "@/components/ui/pagination-control";
import { useBranch } from "@/components/providers/branch-provider";
import { StockImportDialog } from "./stock-import-dialog";

type StockMovementsData = Awaited<ReturnType<typeof getStockMovements>>;
type StockMovementRow = StockMovementsData["movements"][number];

const stockFormSchema = z.object({
  branchIds: z.array(z.string()).min(1, "Pilih minimal 1 lokasi"),
  items: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().min(1),
    unitPrice: z.number(),
    type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  })).min(1, "Tambahkan minimal 1 produk"),
  note: z.string().optional(),
});

type StockFormValues = z.infer<typeof stockFormSchema>;
type StockItemType = "IN" | "OUT" | "ADJUSTMENT";

const typeConfig: Record<string, { label: string; color: string; icon: React.ElementType; borderColor: string; bgColor: string }> = {
  IN: { label: "Masuk", color: "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200", icon: ArrowDownLeft, borderColor: "border-l-emerald-500", bgColor: "from-emerald-50 to-green-50" },
  OUT: { label: "Keluar", color: "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200", icon: ArrowUpRight, borderColor: "border-l-red-500", bgColor: "from-red-50 to-rose-50" },
  ADJUSTMENT: { label: "Penyesuaian", color: "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200", icon: RefreshCw, borderColor: "border-l-amber-500", bgColor: "from-amber-50 to-orange-50" },
  TRANSFER: { label: "Transfer", color: "bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 border border-purple-200", icon: ArrowLeftRight, borderColor: "border-l-purple-500", bgColor: "from-purple-50 to-violet-50" },
  OPNAME: { label: "Opname", color: "bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-200", icon: ClipboardCheck, borderColor: "border-l-orange-500", bgColor: "from-orange-50 to-amber-50" },
};

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffSec < 60) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return formatDateTime(d);
}

export function StockContent() {

  const [data, setData] = useState<StockMovementsData>({ movements: [], total: 0, totalPages: 0, currentPage: 1 });
  const [products] = useState<ProductBasic[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const qp = useQueryParams({ pageSize: 10, filters: { type: "ALL" } });
  const { page, pageSize, search, filters: activeFilters } = qp;
  const [searchInput, setSearchInput] = useState(search);
  const stockForm = useForm<StockFormValues>({
    resolver: zodResolver(stockFormSchema),
    defaultValues: { branchIds: [], items: [], note: "" },
  });
  const [sortKey] = useState<string>("");
  const [sortDir] = useState<"asc" | "desc">("desc");
  const [loading, startTransition] = useTransition();
  const { canAction, cannotMessage } = useMenuActionAccess("stock");
  const { canAction: canPlan } = usePlanAccess();
  const canCreate = canAction("create") && canPlan("stock", "create");
  const { selectedBranchId, branchReady } = useBranch();
  const prevBranchRef = useRef(selectedBranchId);

  function fetchData(params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) {
    startTransition(async () => {
      const f = params.filters ?? activeFilters;
      const sk = params.sortKey ?? sortKey;
      const sd = params.sortDir ?? sortDir;
      const query = {
        page: params.page ?? page,
        perPage: params.pageSize ?? pageSize,
        search: params.search ?? search,
        ...(f.type !== "ALL" ? { type: f.type } : {}),
        ...(f.branchId && f.branchId !== "ALL" ? { branchId: f.branchId } : selectedBranchId ? { branchId: selectedBranchId } : {}),
        ...(f.date_from ? { dateFrom: f.date_from } : {}),
        ...(f.date_to ? { dateTo: f.date_to } : {}),
        ...(sk ? { sortBy: sk, sortDir: sd } : {}),
      };
      const branchForStats = f.branchId && f.branchId !== "ALL" ? f.branchId : selectedBranchId || undefined;
      const [result, statsResult] = await Promise.all([
        getStockMovements(query),
        getStockMovementStats(branchForStats),
      ]);
      setData(result);
      setStats(statsResult);
    });
  }

  useEffect(() => {
    startTransition(async () => {
      const allBranches = await getAllBranches();
      const activeBranches = allBranches.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name }));
      setBranches(activeBranches);
    });
  }, []);

  useEffect(() => {
    if (!branchReady) return;
    prevBranchRef.current = selectedBranchId;
    fetchData({});
  }, [branchReady, selectedBranchId, page, pageSize, search, activeFilters.type]); // eslint-disable-line react-hooks/exhaustive-deps


  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [pendingFormValues, setPendingFormValues] = useState<StockFormValues | null>(null);

  const onFormSubmit = (values: StockFormValues) => {
    if (!canCreate) return;
    setPendingFormValues(values);
    setSubmitConfirmOpen(true);
  };

  const executeSubmit = async () => {
    if (!pendingFormValues) return;
    const values = pendingFormValues;
    const formData = new FormData();
    formData.set("branchIds", JSON.stringify(values.branchIds));
    formData.set("type", "IN"); // default, overridden per-item
    formData.set("items", JSON.stringify(values.items.map((i) => ({ productId: i.productId, quantity: i.quantity, type: i.type }))));
    if (values.note) formData.set("note", values.note);
    const result = await createStockMovement(formData);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Pergerakan stok berhasil disimpan");
      setOpen(false);
      stockForm.reset();
      fetchData({});
    }
    setSubmitConfirmOpen(false);
    setPendingFormValues(null);
  };

  // Effective branchIds for ProductPicker
  const watchedBranchIds = stockForm.watch("branchIds");
  const watchedItems = stockForm.watch("items");
  const effectiveBranchIds: string[] = selectedBranchId
    ? [selectedBranchId]
    : (watchedBranchIds ?? []).filter(Boolean);

  const openCreateDialog = () => {
    // Pre-fill branchIds based on active filter
    const defaultBranchIds = selectedBranchId
      ? [selectedBranchId]
      : branches.map((b) => b.id);
    stockForm.setValue("branchIds", defaultBranchIds);
    setOpen(true);
  };

  const [stats, setStats] = useState({ inCount: 0, outCount: 0, adjCount: 0, transferCount: 0, opnameCount: 0 });

  const getProductMeta = (row: StockMovementRow) => {
    const fallback = products.find((p) => p.id === row.productId);
    return {
      name: (row as unknown as { product?: { name?: string } }).product?.name ?? fallback?.name ?? "-",
      code: (row as unknown as { product?: { code?: string } }).product?.code ?? fallback?.code ?? "-",
      stock: (row as unknown as { product?: { stock?: number } }).product?.stock ?? fallback?.stock ?? 0,
    };
  };

  const grouped = useMemo(() => {
    const groups: { date: string; items: StockMovementRow[] }[] = [];
    let cur = "";
    for (const m of data.movements) {
      const d = format(new Date(m.createdAt), "yyyy-MM-dd");
      if (d !== cur) { cur = d; groups.push({ date: d, items: [] }); }
      groups[groups.length - 1]!.items.push(m);
    }
    return groups;
  }, [data.movements]);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearch = (q: string) => {
    setSearchInput(q);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => { qp.setSearch(q); }, 400);
  };

  const handleTypeFilter = (type: string) => {
    qp.setFilters({ ...activeFilters, type });
  };

  const TYPE_PILLS = [
    { value: "ALL", label: "Semua" },
    { value: "IN", label: "Masuk" },
    { value: "OUT", label: "Keluar" },
    { value: "ADJUSTMENT", label: "Penyesuaian" },
    { value: "TRANSFER", label: "Transfer" },
    { value: "OPNAME", label: "Opname" },
  ];


  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <BoxesIcon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Manajemen Stok</h1>
            <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-2">
              Kelola pergerakan stok produk
              <Badge variant="secondary" className="text-xs font-normal">{data.total} pergerakan</Badge>
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <ExportMenu module="stock" branchId={selectedBranchId || undefined} filters={activeFilters} />
          <Button variant="outline" className="rounded-xl border-dashed" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>
          <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="stock" actionKey="create">
            <Button
              disabled={!canCreate}
              className="text-sm rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 shadow-lg shadow-indigo-200/50 text-white"
              onClick={openCreateDialog}
            >
              <Plus className="w-4 h-4 mr-2" /> Tambah Pergerakan
            </Button>
          </DisabledActionTooltip>
        </div>
      </div>

      {/* Mobile: Floating button */}
      <div className="sm:hidden fixed bottom-4 right-4 z-50">
        <ProButton menuKey="stock" actionKey="create" onClick={openCreateDialog} className="h-12 w-12 rounded-full shadow-xl shadow-indigo-300/50 bg-gradient-to-br from-indigo-500 to-blue-600 inline-flex items-center justify-center text-white">
          <Plus className="w-5 h-5" />
        </ProButton>
      </div>

      {/* Movement List */}
      <div className="rounded-xl sm:rounded-2xl border border-border/30 bg-white shadow-sm">
        {/* Search bar + Stats — sticky */}
        <div className="p-3 sm:p-4 border-b border-border/20 space-y-2 sm:space-y-0 sticky top-0 z-10 bg-white rounded-t-xl sm:rounded-t-2xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
              <Input
                placeholder="Cari produk..."
                className="pl-9 pr-9 rounded-xl h-9 text-sm border-border/40"
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            {/* Desktop: filter pills with count */}
            <div className="hidden sm:flex items-center gap-1.5 ml-auto">
              {TYPE_PILLS.map((pill) => {
                const count = pill.value === "ALL" ? stats.inCount + stats.outCount + stats.adjCount + stats.transferCount + stats.opnameCount : pill.value === "IN" ? stats.inCount : pill.value === "OUT" ? stats.outCount : pill.value === "ADJUSTMENT" ? stats.adjCount : pill.value === "TRANSFER" ? stats.transferCount : pill.value === "OPNAME" ? stats.opnameCount : 0;
                return (
                  <button key={pill.value} onClick={() => handleTypeFilter(pill.value)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5 ${activeFilters.type === pill.value
                      ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-200/50"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                    {pill.label}
                    {count !== null && <span className={`text-[10px] font-bold min-w-[16px] h-4 rounded-full inline-flex items-center justify-center ${activeFilters.type === pill.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Mobile: filter pills below search */}
          <div className="sm:hidden flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {TYPE_PILLS.map((pill) => {
              const count = pill.value === "ALL" ? stats.inCount + stats.outCount + stats.adjCount + stats.transferCount + stats.opnameCount : pill.value === "IN" ? stats.inCount : pill.value === "OUT" ? stats.outCount : pill.value === "ADJUSTMENT" ? stats.adjCount : pill.value === "TRANSFER" ? stats.transferCount : pill.value === "OPNAME" ? stats.opnameCount : 0;
              return (
                <button key={pill.value} onClick={() => handleTypeFilter(pill.value)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all inline-flex items-center gap-1 ${activeFilters.type === pill.value
                    ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-200/50"
                    : "bg-white border border-slate-200 text-slate-600"}`}>
                  {pill.label}
                  {count !== null && <span className={`text-[10px] font-bold ${activeFilters.type === pill.value ? "text-white/80" : "text-muted-foreground"}`}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grouped movement list */}
        <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
          {loading && data.movements.length === 0 ? (
            <div className="space-y-6">
              {Array.from({ length: 2 }).map((_, gi) => (
                <div key={gi}>
                  <div className="flex items-center gap-2 mb-3">
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="h-4 w-48" />
                    <div className="flex-1 h-px bg-border/40" />
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: gi === 0 ? 3 : 2 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-border/30 bg-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-4">
                        <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-24 rounded-full" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : data.movements.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center">
              <BoxesIcon className="w-10 h-10 sm:w-16 sm:h-16 text-muted-foreground/30 mb-3" />
              <p className="text-sm sm:text-lg font-medium text-slate-500">Belum ada pergerakan stok</p>
              <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="stock" actionKey="create">
                <Button disabled={!canCreate} variant="outline" size="sm" className="rounded-full mt-3" onClick={openCreateDialog}>
                  <Plus className="w-3 h-3 mr-1" /> Tambah Pergerakan
                </Button>
              </DisabledActionTooltip>
            </div>
          ) : (
            <div className={loading ? "opacity-50 pointer-events-none transition-opacity" : ""}>
              {grouped.map((group) => (
                <div key={group.date} className="mb-6 last:mb-0">
                  {/* Date header */}
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">
                      {format(new Date(group.date), "EEEE, dd MMMM yyyy", { locale: idLocale })}
                    </span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>

                  {/* Movement items */}
                  <div className="space-y-2">
                    {group.items.map((movement) => {
                      const cfg = typeConfig[movement.type] || { label: movement.type, color: "bg-slate-100 text-slate-700", icon: RefreshCw, borderColor: "border-l-slate-400", bgColor: "from-slate-50 to-gray-50" };
                      const IconComp = cfg.icon;
                      const productMeta = getProductMeta(movement);
                      const branchName = (movement as unknown as { branch?: { name: string } | null }).branch?.name;
                      const isIn = movement.type === "IN";
                      const isOut = movement.type === "OUT";
                      const qtySign = isOut ? "-" : "+";
                      const qtyColor = isIn
                        ? "text-emerald-700"
                        : isOut
                          ? "text-red-700"
                          : "text-amber-700";

                      return (
                        <div
                          key={movement.id}
                          className={`rounded-xl border border-border/30 border-l-4 ${cfg.borderColor} bg-white hover:shadow-sm transition-all group px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-4`}
                        >
                          {/* Left: type icon */}
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${cfg.bgColor} flex items-center justify-center shrink-0 shadow-sm`}>
                            <IconComp className="w-4 h-4" />
                          </div>

                          {/* Middle: product info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{productMeta.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge className={`${cfg.color} gap-1 px-2 py-0 text-[11px]`}>
                                {cfg.label}
                              </Badge>
                              {movement.note && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-[11px] text-muted-foreground truncate max-w-[100px] sm:max-w-[150px] cursor-help">
                                        {movement.note.length > 30 ? `${movement.note.slice(0, 30)}...` : movement.note}
                                      </span>
                                    </TooltipTrigger>
                                    {movement.note.length > 30 && (
                                      <TooltipContent><p className="max-w-xs">{movement.note}</p></TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {branchName && (
                                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                  <MapPin className="w-3 h-3" />
                                  {branchName}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: quantity & time */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className={`text-base font-bold font-mono tabular-nums ${qtyColor}`}>
                                {qtySign}{movement.quantity}
                              </span>
                              <p className="text-[11px] text-muted-foreground">{formatRelativeTime(movement.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-border/20">
          <PaginationControl
            currentPage={page}
            totalPages={data.totalPages}
            totalItems={data.total}
            pageSize={pageSize}
            onPageChange={(p) => qp.setPage(p)}
            onPageSizeChange={(s) => qp.setParams({ pageSize: s, page: 1 })}
          />
        </div>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) stockForm.reset(); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl rounded-xl sm:rounded-2xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500 shrink-0" />
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-bold">Tambah Pergerakan Stok</DialogTitle>
          </DialogHeader>
          <form onSubmit={stockForm.handleSubmit(onFormSubmit)} className={!canCreate ? "pointer-events-none opacity-70" : "flex flex-col flex-1 overflow-hidden"}>
            <DialogBody className="px-4 sm:px-6 space-y-3 sm:space-y-4">
              {/* Lokasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedBranchId ? (
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm font-medium">Lokasi</Label>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700 h-9 sm:h-10">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-medium">{branches.find((b) => b.id === selectedBranchId)?.name ?? "—"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm font-medium">Lokasi <span className="text-red-400">*</span></Label>
                    <BranchMultiSelect
                      branches={branches}
                      value={stockForm.watch("branchIds")}
                      onChange={(v) => { stockForm.setValue("branchIds", v); stockForm.clearErrors("branchIds"); stockForm.setValue("items", []); }}
                      placeholder="Pilih lokasi"
                    />
                    {stockForm.formState.errors.branchIds && <p className="text-xs text-red-500">{stockForm.formState.errors.branchIds.message}</p>}
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs sm:text-sm font-medium">Catatan</Label>
                  <Input {...stockForm.register("note")} placeholder="Tambahkan catatan..." className="rounded-xl h-9 sm:h-10" />
                </div>
              </div>

              {/* Produk (multiple) + per-item type */}
              {stockForm.formState.errors.items?.message && <p className="text-xs text-red-500">{stockForm.formState.errors.items.message}</p>}
              <ProductPicker
                stickySearch
                items={watchedItems.map((item) => ({
                  productId: item.productId,
                  productName: item.productName || "",
                  productCode: "",
                  productPrice: item.unitPrice,
                  quantity: item.quantity,
                }))}
                onChange={(pickerItems) => {
                  const existingTypes = new Map(watchedItems.map((i) => [i.productId, i.type]));
                  stockForm.setValue("items", pickerItems.map((pi) => ({
                    productId: pi.productId,
                    productName: pi.productName,
                    quantity: pi.quantity,
                    unitPrice: pi.productPrice,
                    type: existingTypes.get(pi.productId) ?? "IN" as StockItemType,
                  })), { shouldValidate: true });
                }}
                branchId={selectedBranchId || undefined}
                branchIds={effectiveBranchIds.length > 0 ? effectiveBranchIds : undefined}
                skipBranchStockFilter
                label="Produk"
                required
                showPrice={false}
                showSubtotal={false}
                searchPlaceholder="Cari produk..."
                emptyText="Tambahkan produk untuk penyesuaian stok"
                renderItemExtra={(productId) => {
                  const item = watchedItems.find((i) => i.productId === productId);
                  if (!item) return null;
                  const currentType = item.type || "IN";
                  return (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {([
                        { value: "IN", label: "Masuk", icon: ArrowDownLeft, active: "ring-2 ring-emerald-500 bg-emerald-50 text-emerald-700", inactive: "text-emerald-600" },
                        { value: "OUT", label: "Keluar", icon: ArrowUpRight, active: "ring-2 ring-red-500 bg-red-50 text-red-700", inactive: "text-red-600" },
                        { value: "ADJUSTMENT", label: "Adj", icon: RefreshCw, active: "ring-2 ring-blue-500 bg-blue-50 text-blue-700", inactive: "text-blue-600" },
                      ] as const).map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = currentType === opt.value;
                        return (
                          <button key={opt.value} type="button" tabIndex={-1}
                            onClick={() => stockForm.setValue("items", watchedItems.map((i) => i.productId === productId ? { ...i, type: opt.value as StockItemType } : i))}
                            className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all ${isSelected ? opt.active : `opacity-30 hover:opacity-60 ${opt.inactive}`}`}
                            title={opt.label}>
                            <Icon className="w-3 h-3" />
                            <span className="hidden sm:inline">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                }}
              />

            </DialogBody>
            <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Batal</Button>
              <Button disabled={!canCreate || stockForm.formState.isSubmitting} type="submit" className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white">
                {stockForm.formState.isSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</> : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ActionConfirmDialog
        open={submitConfirmOpen}
        onOpenChange={(v) => { setSubmitConfirmOpen(v); if (!v) setPendingFormValues(null); }}
        kind="submit"
        description="Yakin ingin menyimpan pergerakan stok ini?"
        onConfirm={executeSubmit}
      />

      <StockImportDialog open={importOpen} onOpenChange={setImportOpen} branchId={selectedBranchId || undefined} onImported={() => fetchData({})} />
    </div>
  );
}
