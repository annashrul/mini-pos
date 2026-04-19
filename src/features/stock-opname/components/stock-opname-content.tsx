"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useQueryParams } from "@/hooks/use-query-params";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  getStockOpnames,
  getStockOpnameById,
  getStockOpnameStats,
  createStockOpnameWithItems,
  getProductsForOpname,
  updateOpnameItems,
  completeStockOpname,
  cancelStockOpname,
} from "@/features/stock-opname";
import { createStockOpnameSchema, type CreateStockOpnameInput } from "@/features/stock-opname/schemas/stock-opname.schema";
import { getAllBranches } from "@/features/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { ExportMenu } from "@/components/ui/export-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartSelect } from "@/components/ui/smart-select";
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FilterBottomSheet } from "@/components/ui/filter-bottom-sheet";
import { SearchInput } from "@/components/ui/search-input";
import {
  Plus, Eye, ClipboardCheck,
  CheckCircle2, XCircle, Save,
  FileEdit, Loader2, Copy,
  Package, TrendingUp, TrendingDown,
  Search, CalendarDays, MapPin,
  Upload, MoreVertical, SlidersHorizontal,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { StockOpname, StockOpnameDetail } from "@/types";
import { useBranch } from "@/components/providers/branch-provider";
import { PaginationControl } from "@/components/ui/pagination-control";
import { OpnameImportDialog } from "./opname-import-dialog";

const statusConfig: Record<string, { label: string; classes: string; icon: React.ReactNode; borderColor: string; gradientBg: string }> = {
  DRAFT: {
    label: "Draft",
    classes: "bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border border-slate-200/60",
    icon: <FileEdit className="w-3 h-3" />,
    borderColor: "border-l-blue-400",
    gradientBg: "from-blue-400 to-blue-500",
  },
  IN_PROGRESS: {
    label: "Berlangsung",
    classes: "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200/60",
    icon: <FileEdit className="w-3 h-3" />,
    borderColor: "border-l-amber-400",
    gradientBg: "from-amber-400 to-amber-500",
  },
  COMPLETED: {
    label: "Selesai",
    classes: "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border border-emerald-200/60",
    icon: <CheckCircle2 className="w-3 h-3" />,
    borderColor: "border-l-emerald-400",
    gradientBg: "from-emerald-400 to-emerald-500",
  },
  CANCELLED: {
    label: "Dibatalkan",
    classes: "bg-gradient-to-r from-red-50 to-red-100 text-red-700 border border-red-200/60",
    icon: <XCircle className="w-3 h-3" />,
    borderColor: "border-l-red-400",
    gradientBg: "from-red-400 to-red-500",
  },
};

type StatusFilterValue = "ALL" | "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

const statusPills: { value: StatusFilterValue; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "DRAFT", label: "Draft" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function StockOpnameContent() {
  const [data, setData] = useState<{ opnames: StockOpname[]; total: number; totalPages: number; currentPage: number }>({ opnames: [], total: 0, totalPages: 0, currentPage: 1 });
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedOpname, setSelectedOpname] = useState<StockOpnameDetail | null>(null);
  const qp = useQueryParams({ pageSize: 10, filters: { status: "ALL" } });
  const { page, pageSize, search, filters: activeFilters } = qp;
  const [searchInput, setSearchInput] = useState(search);
  const [sortKey] = useState<string>("");
  const [sortDir] = useState<"asc" | "desc">("asc");
  const [loading, startTransition] = useTransition();
  const { selectedBranchId, branchReady } = useBranch();
  const prevBranchRef = useRef(selectedBranchId);

  // Create form
  const createForm = useForm<CreateStockOpnameInput>({
    resolver: zodResolver(createStockOpnameSchema),
    defaultValues: { branchIds: [], notes: "" },
  });
  const [createProducts, setCreateProducts] = useState<Array<{ id: string; name: string; code: string; systemStock: number; actualStock: number }>>([]);
  const [createProductsLoading, setCreateProductsLoading] = useState(false);
  const [createLoadingMore, setCreateLoadingMore] = useState(false);
  const [createHasMore, setCreateHasMore] = useState(false);
  const [createPage, setCreatePage] = useState(1);
  const [createSearch, setCreateSearch] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const createBranchRef = useRef<string | undefined>(undefined);
  const createSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const createSentinelRef = useRef<HTMLDivElement>(null);

  // Detail edit state
  const [editedItems, setEditedItems] = useState<Record<string, number>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
  const [confirmKind, setConfirmKind] = useState<"approve" | "delete" | "custom">("custom");
  const { canAction, cannotMessage } = useMenuActionAccess("stock-opname");
  const { canAction: canPlan } = usePlanAccess();
  const canCreate = canAction("create") && canPlan("stock-opname", "create");
  const canUpdate = canAction("update") && canPlan("stock-opname", "update");
  const canApprove = canAction("approve") && canPlan("stock-opname", "approve");

  function fetchData(params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) {
    startTransition(async () => {
      const f = params.filters ?? activeFilters;
      const sk = params.sortKey ?? sortKey;
      const sd = params.sortDir ?? sortDir;
      const query = {
        search: params.search ?? search,
        page: params.page ?? page,
        ...(f.status !== "ALL" ? { status: f.status } : {}),
        ...(f.branchId && f.branchId !== "ALL" ? { branchId: f.branchId } : selectedBranchId ? { branchId: selectedBranchId } : {}),
        ...(f.date_from ? { dateFrom: f.date_from } : {}),
        ...(f.date_to ? { dateTo: f.date_to } : {}),
        ...(sk ? { sortBy: sk, sortDir: sd } : {}),
      };
      const [result, statsResult] = await Promise.all([
        getStockOpnames(query),
        getStockOpnameStats(selectedBranchId || undefined),
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
      createForm.setValue("branchIds", activeBranches.map((b) => b.id));
    });
  }, []);

  useEffect(() => {
    if (!branchReady) return;
    prevBranchRef.current = selectedBranchId;
    fetchData({});
  }, [branchReady, selectedBranchId, page, pageSize, search, activeFilters.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewDetail = async (id: string) => {
    const opname: StockOpnameDetail | null = await getStockOpnameById(id);
    setSelectedOpname(opname);
    // Initialize edited items with current actual stock values
    const items: Record<string, number> = {};
    opname?.items.forEach((item) => {
      items[item.productId] = item.actualStock;
    });
    setEditedItems(items);
    setDetailOpen(true);
  };

  const loadCreateProducts = async (branchId?: string, search?: string, pageNum = 1, append = false) => {
    if (append) setCreateLoadingMore(true);
    else setCreateProductsLoading(true);
    try {
      const result = await getProductsForOpname({ branchId: branchId || undefined, search: search || undefined, page: pageNum, limit: 30 });
      const mapped = result.items.map((p) => ({ ...p, actualStock: p.systemStock }));
      if (append) {
        setCreateProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          return [...prev, ...mapped.filter((p) => !existingIds.has(p.id))];
        });
      } else {
        setCreateProducts(mapped);
      }
      setCreateHasMore(result.hasMore);
      setCreatePage(pageNum);
      createBranchRef.current = branchId;
    } finally {
      setCreateProductsLoading(false);
      setCreateLoadingMore(false);
    }
  };

  const handleCreateSearchChange = (value: string) => {
    setCreateSearch(value);
    if (createSearchDebounceRef.current) clearTimeout(createSearchDebounceRef.current);
    createSearchDebounceRef.current = setTimeout(() => {
      loadCreateProducts(createBranchRef.current, value, 1, false);
    }, 400);
  };

  const loadMoreCreateProducts = () => {
    if (createLoadingMore || !createHasMore) return;
    loadCreateProducts(createBranchRef.current, createSearch, createPage + 1, true);
  };

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = createSentinelRef.current;
    if (!sentinel || !createHasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMoreCreateProducts();
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [createHasMore, createPage, createLoadingMore]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateDialog = () => {
    const bid = selectedBranchId || undefined;
    if (bid) {
      createForm.setValue("branchIds", [bid]);
      loadCreateProducts(bid);
    } else {
      createForm.setValue("branchIds", []);
      setCreateProducts([]);
    }
    setCreateOpen(true);
  };

  const [opnameCreateConfirmOpen, setOpnameCreateConfirmOpen] = useState(false);
  const [opnameSaveConfirmOpen, setOpnameSaveConfirmOpen] = useState(false);

  const onCreateSubmit = (_values: CreateStockOpnameInput) => {
    if (!canCreate) { toast.error(cannotMessage("create")); return; }
    setOpnameCreateConfirmOpen(true);
  };

  const executeCreateOpname = async () => {
    const values = createForm.getValues();
    const effectiveIds = selectedBranchId ? [selectedBranchId] : values.branchIds;

    setCreateSubmitting(true);
    try {
      const result = await createStockOpnameWithItems({
        branchIds: effectiveIds,
        notes: values.notes || undefined,
        items: createProducts.map((p) => ({
          productId: p.id,
          systemStock: p.systemStock,
          actualStock: p.actualStock,
        })),
      });
      if (result.error) { toast.error(result.error); return; }

      toast.success("Stock Opname berhasil dibuat");
      setCreateOpen(false);
      createForm.reset();
      setCreateProducts([]);
      setCreateSearch("");
      fetchData({});
    } finally {
      setCreateSubmitting(false);
      setOpnameCreateConfirmOpen(false);
    }
  };

  const handleSaveItems = () => {
    if (!canUpdate) { toast.error(cannotMessage("update")); return; }
    if (!selectedOpname) return;
    setOpnameSaveConfirmOpen(true);
  };

  const executeSaveItems = async () => {
    if (!selectedOpname) return;
    const items = Object.entries(editedItems).map(([productId, actualStock]) => ({
      productId,
      actualStock,
    }));

    const result = await updateOpnameItems(selectedOpname.id, items);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Data opname berhasil disimpan");
      const updated = await getStockOpnameById(selectedOpname.id);
      setSelectedOpname(updated);
      fetchData({});
    }
    setOpnameSaveConfirmOpen(false);
  };

  const handleComplete = async () => {
    if (!canApprove) { toast.error(cannotMessage("approve")); return; }
    if (!selectedOpname) return;
    setConfirmKind("approve");
    setConfirmText("Yakin ingin menyelesaikan stock opname ini? Stok produk akan disesuaikan.");
    setPendingConfirmAction(() => async () => {
      const items = Object.entries(editedItems).map(([productId, actualStock]) => ({
        productId,
        actualStock,
      }));
      await updateOpnameItems(selectedOpname.id, items);
      const result = await completeStockOpname(selectedOpname.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Stock Opname berhasil diselesaikan. Stok telah disesuaikan.");
        setDetailOpen(false);
        fetchData({});
      }
      setConfirmOpen(false);
      setPendingConfirmAction(null);
    });
    setConfirmOpen(true);
  };

  const handleCancel = async (id: string) => {
    if (!canUpdate) { toast.error(cannotMessage("update")); return; }
    setConfirmKind("delete");
    setConfirmText("Yakin ingin membatalkan stock opname ini?");
    setPendingConfirmAction(() => async () => {
      const result = await cancelStockOpname(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Stock Opname dibatalkan");
        setDetailOpen(false);
        fetchData({});
      }
      setConfirmOpen(false);
      setPendingConfirmAction(null);
    });
    setConfirmOpen(true);
  };

  const isEditable = Boolean(selectedOpname && (selectedOpname.status === "DRAFT" || selectedOpname.status === "IN_PROGRESS") && canUpdate);

  const [stats, setStats] = useState({ draft: 0, inProgress: 0, completed: 0, cancelled: 0 });

  // Detail summary
  const detailSummary = useMemo(() => {
    if (!selectedOpname) return { total: 0, withDiff: 0, surplus: 0, deficit: 0, totalDiffValue: 0 };
    const items = selectedOpname.items;
    let surplus = 0;
    let deficit = 0;
    let totalDiffValue = 0;
    items.forEach((item) => {
      const actual = editedItems[item.productId] ?? item.actualStock;
      const diff = actual - item.systemStock;
      if (diff > 0) surplus++;
      if (diff < 0) deficit++;
      totalDiffValue += diff;
    });
    return { total: items.length, withDiff: surplus + deficit, surplus, deficit, totalDiffValue };
  }, [selectedOpname, editedItems]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Nomor opname disalin");
  };

  const handleStatusFilter = (status: StatusFilterValue) => {
    qp.setFilters({ ...activeFilters, status });
  };

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => { qp.setSearch(value); }, 400);
  };


  // Compute discrepancy count per opname (items where actual != system)
  const getDiscrepancyInfo = (opname: StockOpname) => {
    // We only have _count.items from list view, no per-item detail
    // So discrepancy count is not available at list level; show item count only
    return { itemCount: opname._count.items };
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200/50">
            <ClipboardCheck className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Stock Opname</h1>

            <div className="flex items-center gap-2.5">
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Penyesuaian stok berdasarkan penghitungan fisik</p>
              <Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-medium px-2.5">
                {data.total} opname
              </Badge>
            </div>

          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <ExportMenu module="stock-opname" branchId={selectedBranchId || undefined} filters={activeFilters} />
          <Button variant="outline" className="rounded-xl border-dashed" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>
          <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="stock-opname" actionKey="create">
            <Button disabled={!canCreate} className="text-sm rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-200/50" onClick={() => openCreateDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Buat Opname
            </Button>
          </DisabledActionTooltip>
        </div>
        {/* Mobile: Floating button */}
        {canCreate && (
          <div className="sm:hidden fixed bottom-4 right-4 z-50">
            <Button onClick={() => openCreateDialog()} size="icon" className="h-12 w-12 rounded-full shadow-xl shadow-amber-300/50 bg-gradient-to-br from-amber-500 to-orange-500">
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        )}
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { createForm.reset(); setCreateProducts([]); setCreateSearch(""); setCreatePage(1); setCreateHasMore(false); } }}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl rounded-xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden border-0 shadow-2xl p-0 gap-0">
            <div className="h-1 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 shrink-0" />
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="flex flex-col flex-1 min-h-0">
              <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 shrink-0">
                <DialogTitle className="text-base sm:text-lg font-bold">Buat Stock Opname</DialogTitle>
              </DialogHeader>
              <DialogBody className={`px-4 sm:px-6 ${!canCreate ? "pointer-events-none opacity-70" : ""}`}>
                {/* Lokasi + Catatan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm font-medium">Lokasi <span className="text-red-400">*</span></Label>
                    {selectedBranchId ? (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-medium">{branches.find((b) => b.id === selectedBranchId)?.name ?? "—"}</span>
                      </div>
                    ) : (
                      <>
                        <SmartSelect
                          value={createForm.watch("branchIds")?.[0] ?? ""}
                          onChange={(v) => {
                            createForm.setValue("branchIds", v ? [v] : []);
                            if (v) loadCreateProducts(v);
                            else setCreateProducts([]);
                          }}
                          placeholder="Pilih lokasi"
                          onSearch={async (query) =>
                            branches
                              .filter((b) => !query || b.name.toLowerCase().includes(query.toLowerCase()))
                              .map((b) => ({ value: b.id, label: b.name }))
                          }
                        />
                        {createForm.formState.errors.branchIds && <p className="text-xs text-red-500">{createForm.formState.errors.branchIds.message}</p>}
                      </>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm font-medium">Catatan</Label>
                    <Input {...createForm.register("notes")} className="rounded-xl h-9 sm:h-10" placeholder="Opsional..." />
                  </div>
                </div>

                {!createProductsLoading && createProducts.length === 0 && !createSearch && !selectedBranchId && (
                  <div className="text-center py-6 text-muted-foreground">
                    <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs sm:text-sm">Pilih 1 lokasi untuk memuat daftar produk</p>
                  </div>
                )}

                {/* Sticky: search + column header — sticks to top of DialogBody scroll */}
                {(createProducts.length > 0 || createProductsLoading || createSearch) && (
                  <div className="sticky top-[-7px] z-10 bg-background pb-1 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-1 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs sm:text-sm font-semibold">Daftar Produk</Label>
                        <Badge variant="secondary" className="rounded-full text-[10px] px-1.5">{createProducts.length}{createHasMore ? "+" : ""}</Badge>
                      </div>
                      <div className="relative w-40 sm:w-56">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input value={createSearch} onChange={(e) => handleCreateSearchChange(e.target.value)} className="rounded-lg h-7 sm:h-8 pl-8 text-xs" placeholder="Cari produk..." />
                      </div>
                    </div>
                    <div className="hidden sm:grid grid-cols-[1fr_100px_100px_80px] gap-2 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">
                      <span>Produk</span>
                      <span className="text-right">Stok Sistem</span>
                      <span className="text-right">Stok Aktual</span>
                      <span className="text-center">Selisih</span>
                    </div>
                  </div>
                )}

                {/* Product items */}
                {createProductsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500 mr-2" />
                    <span className="text-sm text-muted-foreground">Memuat produk...</span>
                  </div>
                ) : createProducts.length > 0 && (
                  <div className="space-y-1 py-1">
                    {createProducts.map((item) => {
                      const diff = item.actualStock - item.systemStock;
                      return (
                        <div key={item.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_100px_100px_80px] gap-2 items-center px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50/50">
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium truncate">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{item.code}</p>
                          </div>
                          <div className="hidden sm:block text-right text-sm tabular-nums text-slate-500">{item.systemStock}</div>
                          <div className="flex items-center gap-1.5 sm:justify-right">
                            <span className="sm:hidden text-[10px] text-muted-foreground">Aktual:</span>
                            <Input
                              type="number"
                              value={item.actualStock}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setCreateProducts((prev) => prev.map((p) => p.id === item.id ? { ...p, actualStock: val } : p));
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-16 sm:w-30 h-7 sm:h-8 rounded-lg text-right text-xs sm:text-sm font-medium tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              min={0}
                            />
                          </div>
                          <div className="hidden sm:flex justify-center">
                            {diff !== 0 && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${diff > 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                                {diff > 0 ? "+" : ""}{diff}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Infinite scroll sentinel */}
                    {createHasMore && (
                      <div ref={createSentinelRef} className="flex items-center justify-center py-3">
                        {createLoadingMore ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        ) : (
                          <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={loadMoreCreateProducts}>
                            Muat lebih banyak...
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </DialogBody>
              <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
                <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); createForm.reset(); setCreateProducts([]); setCreateSearch(""); setCreatePage(1); setCreateHasMore(false); }} className="rounded-xl">
                  Batal
                </Button>
                <Button type="submit" disabled={!canCreate || createProducts.length === 0 || createSubmitting}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-200/40 px-6">
                  {createSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</> : "Simpan Opname"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + filter pills — sticky */}
      <div className="sticky top-0 z-20 pb-3 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1 space-y-3">
        {/* Mobile */}
        <div className="sm:hidden space-y-2">
          <div className="flex items-center gap-2">
            <SearchInput value={searchInput} onChange={handleSearchChange} placeholder="Cari nomor opname..." loading={loading} className="flex-1 max-w-sm" size="sm" />

            <button
              onClick={() => setFilterSheetOpen(true)}
              className={cn("relative h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center transition-colors",
                activeFilters.status && activeFilters.status !== "ALL" ? "border-amber-300 bg-amber-50 text-amber-600" : "border-slate-200 bg-white text-muted-foreground hover:bg-slate-50")}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilters.status && activeFilters.status !== "ALL" && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">1</span>
              )}
            </button>
          </div>
          {activeFilters.status && activeFilters.status !== "ALL" && (
            <div className="flex items-center gap-1.5">
              <Badge className={cn(statusConfig[activeFilters.status as string]?.classes, "gap-1 text-[10px] px-2 py-0.5")}>
                {statusConfig[activeFilters.status as string]?.icon}
                {statusConfig[activeFilters.status as string]?.label}
              </Badge>
              <button onClick={() => handleStatusFilter("ALL")} className="text-muted-foreground hover:text-foreground">
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
              options: statusPills.map((pill) => ({
                value: pill.value,
                label: pill.label,
                count: pill.value === "ALL" ? undefined : pill.value === "DRAFT" ? stats.draft : pill.value === "IN_PROGRESS" ? stats.inProgress : pill.value === "COMPLETED" ? stats.completed : stats.cancelled,
                borderColor: statusConfig[pill.value]?.borderColor,
              })),
            }]}
            values={{ status: activeFilters.status as string || "ALL" }}
            onApply={(v) => handleStatusFilter((v.status || "ALL") as StatusFilterValue)}
          />
        </div>

        {/* Desktop */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          <SearchInput value={searchInput} onChange={handleSearchChange} placeholder="Cari nomor opname..." loading={loading} className="flex-1 max-w-sm" />

          <div className="flex items-center gap-1.5 flex-wrap">
            {statusPills.map((pill) => {
              const count = pill.value === "ALL" ? null : pill.value === "DRAFT" ? stats.draft : pill.value === "IN_PROGRESS" ? stats.inProgress : pill.value === "COMPLETED" ? stats.completed : pill.value === "CANCELLED" ? stats.cancelled : 0;
              return (
                <button key={pill.value} onClick={() => handleStatusFilter(pill.value)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5 ${activeFilters.status === pill.value
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200/50"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                  {pill.label}
                  {count !== null && <span className={`text-[10px] font-bold min-w-[16px] h-4 rounded-full inline-flex items-center justify-center ${activeFilters.status === pill.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card List */}
      <div className="space-y-3">
        {loading && data.opnames.length === 0 ? (
          /* Loading skeleton */
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200/60 bg-white p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-slate-200 rounded" />
                    <div className="h-3 w-28 bg-slate-100 rounded" />
                  </div>
                  <div className="h-6 w-20 bg-slate-200 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : data.opnames.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-10 sm:py-16 px-4">
            <div className="flex h-10 w-10 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 mb-4">
              <ClipboardCheck className="w-5 h-5 sm:w-8 sm:h-8 text-amber-400" />
            </div>
            <h3 className="text-sm sm:text-lg font-semibold text-slate-700 mb-1">Belum ada stock opname</h3>
            <p className="text-xs sm:text-sm text-slate-400 text-center max-w-sm">Buat stock opname pertama untuk mulai menghitung stok fisik</p>
          </div>
        ) : (
          /* Opname card grid */
          <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
            {data.opnames.map((opname) => {
              const cfg = statusConfig[opname.status];
              const info = getDiscrepancyInfo(opname);
              const date = new Date(opname.startedAt);

              return (
                <div
                  key={opname.id}
                  className={`group relative rounded-xl border border-slate-200/60 bg-white border-l-4 ${cfg?.borderColor || "border-l-slate-300"} shadow-sm hover:shadow-md transition-all duration-200`}
                >
                  {/* ===== Mobile card ===== */}
                  <div className="sm:hidden p-3" onClick={() => handleViewDetail(opname.id)}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cfg?.gradientBg || "from-slate-400 to-slate-500"} flex items-center justify-center shadow-sm shrink-0`}>
                        <ClipboardCheck className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 pr-14">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-800">{opname.opnameNumber}</span>
                          <button onClick={(e) => { e.stopPropagation(); copyToClipboard(opname.opnameNumber); }} className="p-0.5 rounded hover:bg-slate-100">
                            <Copy className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />{opname.branch?.name || "Semua Cabang"}
                        </p>
                      </div>
                      <Badge className={`${cfg?.classes || ""} gap-1 px-2 py-0.5 text-[10px] font-medium shadow-none absolute top-2 right-2`}>
                        {cfg?.icon || null}
                        {cfg?.label || null}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />{format(date, "dd MMM yy", { locale: idLocale })}</span>
                        <span className="inline-flex items-center gap-1"><Package className="w-3 h-3" />{info.itemCount} item</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-44">
                          <DropdownMenuItem onClick={() => handleViewDetail(opname.id)} className="text-xs gap-2">
                            <Eye className="w-3.5 h-3.5" /> Lihat Detail
                          </DropdownMenuItem>
                          {(opname.status === "DRAFT" || opname.status === "IN_PROGRESS") && (
                            <DropdownMenuItem disabled={!canUpdate} onClick={() => handleCancel(opname.id)} className="text-xs gap-2 text-red-600 focus:text-red-600">
                              <XCircle className="w-3.5 h-3.5" /> Batalkan
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* ===== Desktop card ===== */}
                  <div className="hidden sm:flex p-4 items-center gap-4">
                    <Badge className={`${cfg?.classes || ""} gap-1.5 rounded-bl-xl rounded-tr-xl rounded-tl-none rounded-br-none px-3 py-1 text-[11px] font-medium shadow-none absolute top-0 right-0 z-[1]`}>
                      {cfg?.icon || null}
                      {cfg?.label || null}
                    </Badge>
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cfg?.gradientBg || "from-slate-400 to-slate-500"} shadow-md`}>
                      <ClipboardCheck className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-bold text-slate-800">{opname.opnameNumber}</span>
                        <button onClick={(e) => { e.stopPropagation(); copyToClipboard(opname.opnameNumber); }} className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-100">
                          <Copy className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{opname.branch?.name || "Semua Cabang"}</span>
                        <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3 text-slate-400" />{format(date, "dd MMM yyyy", { locale: idLocale })}<span className="text-slate-300 ml-0.5">({formatDistanceToNow(date, { addSuffix: true, locale: idLocale })})</span></span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          <Package className="w-3 h-3 text-slate-400" />{info.itemCount} item
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                      <Button variant="ghost" size="icon-sm" className="rounded-lg hover:bg-amber-50 hover:text-amber-700" onClick={() => handleViewDetail(opname.id)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {(opname.status === "DRAFT" || opname.status === "IN_PROGRESS") && (
                        <Button disabled={!canUpdate} variant="ghost" size="icon-sm" className="rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleCancel(opname.id)}>
                          <XCircle className="w-3.5 h-3.5" />
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

      {/* Detail / Edit Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl rounded-xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden border-0 shadow-2xl p-0 gap-0">
          {/* Gradient accent line */}
          <div className="h-1 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 shrink-0" />

          {/* Header - sticky */}
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 shrink-0">
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-200/40 shrink-0">
                  <ClipboardCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
                <div>
                  <span className="text-base sm:text-lg font-bold">Detail Stock Opname</span>
                  <p className="text-xs font-mono text-slate-400 font-normal mt-0.5">{selectedOpname?.opnameNumber}</p>
                </div>
              </div>
              {selectedOpname && (
                <Badge className={`${statusConfig[selectedOpname.status]?.classes || ""} gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-none`}>
                  {statusConfig[selectedOpname.status]?.icon || null}
                  {statusConfig[selectedOpname.status]?.label || null}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Body - scrollable */}
          <DialogBody className="px-4 sm:px-6">
            {selectedOpname && (
              <div className="space-y-3 sm:space-y-5">
                {/* Summary cards */}
                {selectedOpname.items.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg sm:rounded-xl p-1.5 sm:p-3 text-center">
                      <p className="text-sm sm:text-lg font-bold text-slate-700">{detailSummary.total}</p>
                      <p className="text-[8px] sm:text-[10px] text-slate-400 font-medium uppercase">Item</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-lg sm:rounded-xl p-1.5 sm:p-3 text-center">
                      <p className="text-sm sm:text-lg font-bold text-amber-700">{detailSummary.withDiff}</p>
                      <p className="text-[8px] sm:text-[10px] text-amber-500 font-medium uppercase">Selisih</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg sm:rounded-xl p-1.5 sm:p-3 text-center">
                      <p className="text-sm sm:text-lg font-bold text-emerald-600">{detailSummary.surplus}</p>
                      <p className="text-[8px] sm:text-[10px] text-emerald-500 font-medium uppercase">Lebih</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-lg sm:rounded-xl p-1.5 sm:p-3 text-center">
                      <p className="text-sm sm:text-lg font-bold text-red-600">{detailSummary.deficit}</p>
                      <p className="text-[8px] sm:text-[10px] text-red-400 font-medium uppercase">Kurang</p>
                    </div>
                  </div>
                )}

                {/* Mobile: compact info */}
                <div className="sm:hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Lokasi</p>
                    <p className="text-xs font-medium flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{selectedOpname.branch?.name || "Semua"}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Tanggal</p>
                    <p className="text-xs">{format(new Date(selectedOpname.startedAt), "dd MMM yyyy, HH:mm", { locale: idLocale })}</p>
                  </div>
                  {selectedOpname.notes && (
                    <>
                      <div className="h-px bg-slate-100" />
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Catatan</p>
                        <p className="text-xs text-foreground">{selectedOpname.notes}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Desktop: info pills */}
                <div className="hidden sm:flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 bg-slate-50 rounded-full px-2 py-1 ring-1 ring-slate-100">
                    <MapPin className="w-3 h-3" /> {selectedOpname.branch?.name || "Semua"}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-50 rounded-full px-2 py-1 ring-1 ring-slate-100">
                    <CalendarDays className="w-3 h-3" /> {format(new Date(selectedOpname.startedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}
                  </span>
                  {selectedOpname.notes && (
                    <span className="text-slate-400 truncate max-w-[200px]">{selectedOpname.notes}</span>
                  )}
                </div>

                {/* Product list */}
                {selectedOpname.items.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-bold text-slate-800">Daftar Produk</p>
                        <Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700 border border-amber-200/50 text-[10px] sm:text-xs px-1.5 sm:px-2">
                          {selectedOpname.items.length}
                        </Badge>
                      </div>
                      {isEditable && (
                        <p className="hidden sm:block text-xs text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1 border border-amber-100">
                          Masukkan stok aktual
                        </p>
                      )}
                    </div>

                    {/* Mobile: card-based items */}
                    <div className="sm:hidden space-y-1.5">
                      {selectedOpname.items.map((item) => {
                        const actualStock = editedItems[item.productId] ?? item.actualStock;
                        const diff = actualStock - item.systemStock;
                        return (
                          <div key={item.id} className={cn("rounded-lg border p-2.5",
                            diff > 0 ? "border-emerald-200 bg-emerald-50/30" : diff < 0 ? "border-red-200 bg-red-50/30" : "border-slate-200/60 bg-white")}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-700 truncate">{item.product.name}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{item.product.code}</p>
                              </div>
                              {diff !== 0 && (
                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-2",
                                  diff > 0 ? "text-emerald-600 bg-emerald-100" : "text-red-600 bg-red-100")}>
                                  {diff > 0 ? "+" : ""}{diff}
                                </span>
                              )}
                              {diff === 0 && <span className="text-emerald-500 text-xs font-bold shrink-0 ml-2">✓</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <span className="text-[10px] text-slate-400">Sistem</span>
                                <p className="text-xs font-bold text-slate-600 tabular-nums">{item.systemStock}</p>
                              </div>
                              <div className="flex-1">
                                <span className="text-[10px] text-slate-400">Aktual</span>
                                {isEditable ? (
                                  <Input type="number" min={0} value={actualStock}
                                    onChange={(e) => setEditedItems({ ...editedItems, [item.productId]: Number(e.target.value) })}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full h-7 rounded-lg text-center text-xs font-bold border-slate-200 focus:border-amber-400" />
                                ) : (
                                  <p className="text-xs font-bold tabular-nums">{item.actualStock}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop: table */}
                    <div className="hidden sm:block">
                      <Table noWrapper>
                        <TableHeader className="sticky top-[-10px] z-10 bg-white [box-shadow:0_1px_0_0_#e5e7eb]">
                          <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100/50">
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kode</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Produk</TableHead>
                            <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sistem</TableHead>
                            <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Aktual</TableHead>
                            <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Selisih</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOpname.items.map((item) => {
                            const actualStock = editedItems[item.productId] ?? item.actualStock;
                            const diff = actualStock - item.systemStock;
                            return (
                              <TableRow key={item.id} className="group hover:bg-amber-50/30 transition-colors">
                                <TableCell><span className="font-mono text-xs bg-slate-100 rounded px-1.5 py-0.5 text-slate-600">{item.product.code}</span></TableCell>
                                <TableCell className="text-sm font-medium text-slate-700">{item.product.name}</TableCell>
                                <TableCell className="text-right text-sm text-slate-600 font-medium">{item.systemStock}</TableCell>
                                <TableCell className="text-right">
                                  {isEditable ? (
                                    <Input type="number" min={0} value={actualStock}
                                      onChange={(e) => setEditedItems({ ...editedItems, [item.productId]: Number(e.target.value) })}
                                      onFocus={(e) => e.target.select()}
                                      className="w-20 mx-auto rounded-xl text-right text-sm border-slate-200 focus:border-amber-400 focus:ring-amber-400/30" />
                                  ) : (
                                    <span className="text-sm font-medium">{item.actualStock}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {diff > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-0.5 border border-emerald-100"><TrendingUp className="w-3 h-3" />+{diff}</span>
                                  ) : diff < 0 ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 rounded-full px-2.5 py-0.5 border border-red-100"><TrendingDown className="w-3 h-3" />{diff}</span>
                                  ) : (
                                    <span className="text-xs text-slate-400">0</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogBody>

          {/* Footer - sticky */}
          <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-2">
              <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)} className="rounded-xl text-xs sm:text-sm order-2 sm:order-1">
                Tutup
              </Button>
              {isEditable && (
                <div className="flex items-center gap-1.5 sm:gap-2 order-1 sm:order-2">
                  <Button disabled={!canUpdate} variant="outline" size="sm" onClick={handleSaveItems} className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 text-xs sm:text-sm flex-1 sm:flex-none">
                    <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" /> Simpan
                  </Button>
                  <Button disabled={!canUpdate} variant="outline" size="sm" onClick={() => handleCancel(selectedOpname!.id)} className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-xs sm:text-sm flex-1 sm:flex-none">
                    <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" /> Batal
                  </Button>
                  <Button disabled={!canApprove} size="sm" onClick={handleComplete} className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-md shadow-emerald-200/40 text-xs sm:text-sm flex-1 sm:flex-none">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" /> Selesai
                  </Button>
                </div>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
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
        open={opnameCreateConfirmOpen}
        onOpenChange={setOpnameCreateConfirmOpen}
        kind="submit"
        description="Yakin ingin menyimpan stock opname ini?"
        onConfirm={executeCreateOpname}
      />
      <ActionConfirmDialog
        open={opnameSaveConfirmOpen}
        onOpenChange={setOpnameSaveConfirmOpen}
        kind="submit"
        description="Yakin ingin menyimpan perubahan data opname?"
        onConfirm={executeSaveItems}
      />

      <OpnameImportDialog open={importOpen} onOpenChange={setImportOpen} branchId={selectedBranchId || undefined} onImported={() => fetchData({})} />
    </div>
  );
}
