"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { useState, useEffect, useRef, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  getPurchaseOrderStats,
  receivePurchaseOrder,
  updatePurchaseOrderStatus,
  closePurchaseOrder,
} from "@/features/purchases";
import { createPurchaseOrderSchema, type CreatePurchaseOrderInput } from "@/features/purchases/schemas/purchases.schema";
import { getSuppliers } from "@/features/suppliers";
import { getBranches } from "@/features/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { ProductPicker } from "@/components/ui/product-picker";
import { ExportMenu } from "@/components/ui/export-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SmartSelect } from "@/components/ui/smart-select";
import { BranchMultiSelect } from "@/components/ui/branch-multi-select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Eye, ShoppingBasket,
  Send, XCircle, PackageCheck,
  FileText, Truck,
  MapPin, Package,
  Search, Loader2,
  CalendarDays,
  ClipboardList,
  Check, Upload, Printer, FileDown, Copy,
  Lock, AlertTriangle, FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { printPO, exportPOtoPDF, exportPOtoCSV, exportPOtoExcel } from "@/lib/print-po";
import type { Supplier, PurchaseOrderDetail, Branch } from "@/types";
import { useBranch } from "@/components/providers/branch-provider";
import { PaginationControl } from "@/components/ui/pagination-control";
import { PurchaseImportDialog } from "./purchase-import-dialog";



type PurchaseOrdersData = Awaited<ReturnType<typeof getPurchaseOrders>>;

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 border border-slate-200 ring-1 ring-slate-100",
  },
  ORDERED: {
    label: "Dipesan",
    className: "bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 border border-blue-200 ring-1 ring-blue-100",
  },
  PARTIAL: {
    label: "Sebagian",
    className: "bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border border-amber-200 ring-1 ring-amber-100",
  },
  RECEIVED: {
    label: "Diterima",
    className: "bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-100",
  },
  CLOSED: {
    label: "Ditutup",
    className: "bg-gradient-to-r from-purple-100 to-purple-50 text-purple-700 border border-purple-200 ring-1 ring-purple-100",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className: "bg-gradient-to-r from-red-100 to-red-50 text-red-700 border border-red-200 ring-1 ring-red-100",
  },
};

const statusBorderColor: Record<string, string> = {
  DRAFT: "border-l-slate-400",
  ORDERED: "border-l-blue-500",
  PARTIAL: "border-l-amber-500",
  RECEIVED: "border-l-emerald-500",
  CLOSED: "border-l-purple-500",
  CANCELLED: "border-l-red-500",
};

const statusIconBg: Record<string, string> = {
  DRAFT: "from-slate-100 to-slate-200 text-slate-600",
  ORDERED: "from-blue-100 to-blue-200 text-blue-600",
  PARTIAL: "from-amber-100 to-amber-200 text-amber-600",
  RECEIVED: "from-emerald-100 to-green-200 text-emerald-600",
  CLOSED: "from-purple-100 to-purple-200 text-purple-600",
  CANCELLED: "from-red-100 to-red-200 text-red-600",
};

const statusFilterPills = [
  { value: "ALL", label: "Semua" },
  { value: "DRAFT", label: "Draft" },
  { value: "ORDERED", label: "Ordered" },
  { value: "PARTIAL", label: "Partial" },
  { value: "RECEIVED", label: "Received" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
];


export function PurchasesContent() {
  const [data, setData] = useState<PurchaseOrdersData>({ orders: [], total: 0, totalPages: 0 });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
  const [confirmKind, setConfirmKind] = useState<"approve" | "delete" | "custom">("custom");
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderDetail | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ status: "ALL" });
  const [sortKey] = useState<string>("");
  const [sortDir] = useState<"asc" | "desc">("asc");
  const [loading, startTransition] = useTransition();
  const { canAction, cannotMessage } = useMenuActionAccess("purchases");
  const { canAction: canPlan } = usePlanAccess();
  const canCreate = canAction("create") && canPlan("purchases", "create");
  const canUpdate = canAction("update") && canPlan("purchases", "update");
  const canApprove = canAction("approve") && canPlan("purchases", "approve");
  const canReceive = canAction("receive");
  const { selectedBranchId, branchReady } = useBranch();
  const prevBranchRef = useRef(selectedBranchId);

  // Create PO form (React Hook Form + Zod)
  const poForm = useForm<CreatePurchaseOrderInput>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: { supplierId: "", branchIds: [], expectedDate: new Date().toISOString().slice(0, 10), notes: "", items: [] },
  });
  const watchedItems = poForm.watch("items");
  const cartTotal = watchedItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const watchedBranchIds = poForm.watch("branchIds");
  // Effective branchIds for ProductPicker: sidebar filter > form selection > null
  const effectiveBranchIds: string[] = selectedBranchId
    ? [selectedBranchId]
    : (watchedBranchIds ?? []).filter(Boolean);

  // Receive state
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});
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
      const branchForStats = f.branchId && f.branchId !== "ALL" ? f.branchId : selectedBranchId || undefined;
      const [result, statsResult] = await Promise.all([
        getPurchaseOrders(query),
        getPurchaseOrderStats(branchForStats),
      ]);
      setData(result);
      setStats(statsResult);
    });
  }

  useEffect(() => {
    if (!createOpen) return;
    startTransition(async () => {
      const [suppliersData, branchesData] = await Promise.all([
        getSuppliers({ page: 1, perPage: 500 }),
        getBranches({ page: 1, perPage: 500 }),
      ]);
      setSuppliers(suppliersData.suppliers);
      setBranches(branchesData.branches);
    });
  }, [createOpen]);

  useEffect(() => {
    if (!branchReady) return;
    if (prevBranchRef.current !== selectedBranchId) {
      prevBranchRef.current = selectedBranchId;
      setPage(1);
      fetchData({ page: 1 });
    } else {
      fetchData({});
    }
  }, [branchReady, selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewDetail = async (id: string) => {
    const po = await getPurchaseOrderById(id);
    setSelectedPO(po);
    setDetailOpen(true);
  };

  const buildPrintData = (po: PurchaseOrderDetail) => ({
    orderNumber: po.orderNumber,
    orderDate: String(po.orderDate),
    expectedDate: po.expectedDate ? String(po.expectedDate) : null,
    status: po.status,
    supplier: { name: po.supplier?.name ?? "", contact: (po.supplier as Record<string, unknown>)?.contact as string ?? null, address: (po.supplier as Record<string, unknown>)?.address as string ?? null },
    branch: (po as unknown as { branch?: { name: string } }).branch ?? null,
    items: po.items.map((item) => ({ productName: item.product?.name ?? "", productCode: item.product?.code ?? "", quantity: item.quantity, receivedQty: item.receivedQty, unitPrice: item.unitPrice, subtotal: item.subtotal, unit: (item.product as Record<string, unknown>)?.unit as string ?? "PCS" })),
    totalAmount: po.totalAmount,
    notes: po.notes,
  });

  const handlePrintPO = async (id: string) => {
    const po = await getPurchaseOrderById(id);
    if (!po) { toast.error("PO tidak ditemukan"); return; }
    printPO(buildPrintData(po));
  };

  const handleExportPOPDF = async (id: string) => {
    const po = await getPurchaseOrderById(id);
    if (!po) { toast.error("PO tidak ditemukan"); return; }
    exportPOtoPDF(buildPrintData(po));
  };

  const handleExportPOCSV = async (id: string) => {
    const po = await getPurchaseOrderById(id);
    if (!po) { toast.error("PO tidak ditemukan"); return; }
    exportPOtoCSV(buildPrintData(po));
  };

  const handleExportPOExcel = async (id: string) => {
    const po = await getPurchaseOrderById(id);
    if (!po) { toast.error("PO tidak ditemukan"); return; }
    exportPOtoExcel(buildPrintData(po));
  };

  const handleOpenReceive = async (id: string) => {
    const po: PurchaseOrderDetail | null = await getPurchaseOrderById(id);
    setSelectedPO(po);
    const qtys: Record<string, number> = {};
    po?.items.forEach((item) => {
      const remaining = item.quantity - item.receivedQty;
      qtys[item.id] = remaining > 0 ? remaining : 0;
    });
    setReceiveQtys(qtys);
    setReceiveOpen(true);
  };


  const [poConfirmOpen, setPOConfirmOpen] = useState(false);

  const handleCreatePO = (_formData: CreatePurchaseOrderInput) => {
    if (!canCreate) { toast.error(cannotMessage("create")); return; }
    setPOConfirmOpen(true);
  };

  const executeCreatePO = async () => {
    const formData = poForm.getValues();
    const payload = {
      supplierId: formData.supplierId,
      ...(selectedBranchId ? { branchId: selectedBranchId } : formData.branchIds.length > 0 ? { branchIds: formData.branchIds } : {}),
      items: formData.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      ...(formData.expectedDate ? { expectedDate: formData.expectedDate } : {}),
      ...(formData.notes ? { notes: formData.notes } : {}),
    };

    const result = await createPurchaseOrder(payload);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Purchase Order berhasil dibuat");
      setCreateOpen(false);
      poForm.reset();
      fetchData({});
    }
    setPOConfirmOpen(false);
  };

  const [receiveConfirmOpen, setReceiveConfirmOpen] = useState(false);

  const handleReceive = () => {
    if (!canReceive) { toast.error(cannotMessage("receive")); return; }
    if (!selectedPO) return;
    const items = Object.entries(receiveQtys)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ itemId, receivedQty: qty }));
    if (items.length === 0) { toast.error("Masukkan qty yang diterima"); return; }
    setReceiveConfirmOpen(true);
  };

  const executeReceive = async () => {
    if (!selectedPO) return;
    const items = Object.entries(receiveQtys)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ itemId, receivedQty: qty }));

    const result = await receivePurchaseOrder(selectedPO.id, items);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Barang berhasil diterima");
      setReceiveOpen(false);
      fetchData({});
    }
    setReceiveConfirmOpen(false);
  };

  // Close PO (finalize partial)
  const [closeOpen, setCloseOpen] = useState(false);
  const [closePOTarget, setClosePOTarget] = useState<PurchaseOrderDetail | null>(null);
  const [closeDiscrepancies, setCloseDiscrepancies] = useState<Record<string, { reason: string; note: string }>>({});
  const [closeNotes, setCloseNotes] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const DISCREPANCY_REASONS = [
    { value: "KURANG_KIRIM", label: "Kurang Kirim" },
    { value: "RUSAK", label: "Barang Rusak" },
    { value: "RETUR", label: "Retur ke Supplier" },
    { value: "LAINNYA", label: "Lainnya" },
  ];

  const handleOpenClose = async (id: string) => {
    const po = await getPurchaseOrderById(id);
    if (!po) { toast.error("PO tidak ditemukan"); return; }
    setClosePOTarget(po);
    const disc: Record<string, { reason: string; note: string }> = {};
    po.items.forEach((item) => {
      if (item.quantity > item.receivedQty) {
        disc[item.id] = { reason: "KURANG_KIRIM", note: "" };
      }
    });
    setCloseDiscrepancies(disc);
    setCloseNotes("");
    setCloseOpen(true);
  };

  const handleClosePO = () => {
    if (!closePOTarget) return;
    setCloseConfirmOpen(true);
  };

  const executeClosePO = async () => {
    if (!closePOTarget) return;
    const discItems = Object.entries(closeDiscrepancies).map(([itemId, d]) => ({
      itemId,
      reason: d.reason,
      note: d.note || undefined,
    }));
    const result = await closePurchaseOrder(closePOTarget.id, discItems, closeNotes || undefined);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("PO berhasil ditutup");
      setCloseOpen(false);
      fetchData({});
    }
    setCloseConfirmOpen(false);
  };

  const handleStatusChange = async (id: string, status: "ORDERED" | "CANCELLED") => {
    if (status === "ORDERED" && !canApprove) { toast.error(cannotMessage("approve")); return; }
    if (status === "CANCELLED" && !canUpdate) { toast.error(cannotMessage("update")); return; }
    const label = status === "ORDERED" ? "mengirim" : "membatalkan";
    setConfirmKind(status === "ORDERED" ? "approve" : "delete");
    setConfirmText(`Yakin ingin ${label} PO ini?`);
    setPendingConfirmAction(() => async () => {
      const result = await updatePurchaseOrderStatus(id, status);
      if (result.error) toast.error(result.error);
      else { toast.success(`PO berhasil di-${label}`); fetchData({}); }
      setConfirmOpen(false);
      setPendingConfirmAction(null);
    });
    setConfirmOpen(true);
  };

  const [stats, setStats] = useState({ draft: 0, ordered: 0, partial: 0, received: 0, closed: 0, cancelled: 0, totalAmount: 0 });

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setPage(1);
      fetchData({ search: value, page: 1 });
    }, 400);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Nomor PO disalin");
  };

  const handleStatusFilter = (status: string) => {
    const newFilters = { ...activeFilters, status };
    setActiveFilters(newFilters);
    setPage(1);
    fetchData({ filters: newFilters, page: 1 });
  };


  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
            <ShoppingBasket className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Purchase Order</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-muted-foreground text-xs sm:text-sm">Kelola pemesanan barang ke supplier</p>
              <Badge variant="secondary" className="rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                {data.total} PO
              </Badge>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <ExportMenu module="purchases" branchId={selectedBranchId || undefined} filters={activeFilters} />
          <Button variant="outline" className="rounded-xl border-dashed" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>
          <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="purchases" actionKey="create">
            <Button disabled={!canCreate} className="text-sm rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-200/50 text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Buat PO
            </Button>
          </DisabledActionTooltip>
        </div>
        {/* Mobile: Floating button */}
        {canCreate && (
          <div className="sm:hidden fixed bottom-4 right-4 z-50">
            <Button onClick={() => setCreateOpen(true)} size="icon" className="h-12 w-12 rounded-full shadow-xl shadow-emerald-300/50 bg-gradient-to-br from-emerald-500 to-teal-600">
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        )}

      </div>

      {/* Search + filter pills — sticky */}
      <div className="sticky top-0 z-20 bg-background pb-3 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1 space-y-3">
      {/* Mobile */}
      <div className="sm:hidden space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Cari PO..." className="pl-9 rounded-xl border-slate-200 bg-white h-9 text-sm" />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {statusFilterPills.map((pill) => {
            const count = pill.value === "ALL" ? null : pill.value === "DRAFT" ? stats.draft : pill.value === "ORDERED" ? stats.ordered : pill.value === "PARTIAL" ? stats.partial : pill.value === "RECEIVED" ? stats.received : pill.value === "CLOSED" ? stats.closed : pill.value === "CANCELLED" ? stats.cancelled : 0;
            return (
              <button key={pill.value} onClick={() => handleStatusFilter(pill.value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all inline-flex items-center gap-1 ${activeFilters.status === pill.value
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-200/50"
                  : "bg-white border border-slate-200 text-slate-600"}`}>
                {pill.label}
                {count !== null && <span className={`text-[10px] font-bold ${activeFilters.status === pill.value ? "text-white/80" : "text-muted-foreground"}`}>{count}</span>}
              </button>
            );
          })}
        </div>
        {/* Filter bottom sheet */}
        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
            <div className="shrink-0">
              <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-muted-foreground/20" /></div>
              <SheetHeader className="px-4 pb-3 pt-0"><SheetTitle className="text-base font-bold">Filter Status</SheetTitle></SheetHeader>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
              {statusFilterPills.map((pill) => {
                const isActive = activeFilters.status === pill.value;
                const count = pill.value === "ALL" ? null : pill.value === "DRAFT" ? stats.draft : pill.value === "ORDERED" ? stats.ordered : pill.value === "PARTIAL" ? stats.partial : pill.value === "RECEIVED" ? stats.received : pill.value === "CLOSED" ? stats.closed : pill.value === "CANCELLED" ? stats.cancelled : 0;
                return (
                  <button key={pill.value} onClick={() => { handleStatusFilter(pill.value); setFilterSheetOpen(false); }}
                    className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all",
                      isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted")}>
                    <span>{pill.label}{count !== null ? ` (${count})` : ""}</span>
                    {isActive && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: search + filter pills with count */}
      <div className="hidden sm:flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Cari PO berdasarkan nomor, supplier..." className="pl-10 rounded-xl border-slate-200 bg-white h-10 text-sm" />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusFilterPills.map((pill) => {
            const count = pill.value === "ALL" ? null : pill.value === "DRAFT" ? stats.draft : pill.value === "ORDERED" ? stats.ordered : pill.value === "PARTIAL" ? stats.partial : pill.value === "RECEIVED" ? stats.received : pill.value === "CLOSED" ? stats.closed : pill.value === "CANCELLED" ? stats.cancelled : 0;
            return (
              <button key={pill.value} onClick={() => handleStatusFilter(pill.value)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5 ${activeFilters.status === pill.value
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-200/50"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                {pill.label}
                {count !== null && <span className={`text-[10px] font-bold min-w-[16px] h-4 rounded-full inline-flex items-center justify-center ${activeFilters.status === pill.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
      </div>

      {/* PO Card List */}
      <div className="space-y-3">
        {loading && data.orders.length === 0 ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                  </div>
                  <div className="h-5 bg-slate-200 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : data.orders.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-10 sm:py-16 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white to-slate-50/50">
            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-4">
              <ShoppingBasket className="w-5 h-5 sm:w-8 sm:h-8 text-emerald-300" />
            </div>
            <p className="text-sm sm:text-base font-semibold text-foreground mb-1">Belum ada purchase order</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {search || activeFilters.status !== "ALL"
                ? "Tidak ada PO yang cocok dengan filter"
                : "Buat PO pertama untuk mulai mengelola pembelian"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
            {data.orders.map((row) => {
              const cfg = statusConfig[row.status] || { label: row.status, className: "" };
              const borderColor = statusBorderColor[row.status] || "border-l-slate-300";
              const iconBg = statusIconBg[row.status] || "from-slate-100 to-slate-200 text-slate-600";
              const d = new Date(row.orderDate);
              const supplierName = (row as unknown as { supplier?: { name?: string } }).supplier?.name ?? suppliers.find((s) => s.id === row.supplierId)?.name ?? "-";
              const branchName = (row as unknown as { branch?: { name: string } | null }).branch?.name ?? "Semua Cabang";
              const itemCount = (row as unknown as { _count?: { items?: number } })._count?.items ?? 0;

              return (
                <div
                  key={row.id}
                  className={`group relative rounded-xl border border-slate-200/60 border-l-4 ${borderColor} bg-white hover:shadow-md transition-all duration-200`}
                >
                  {/* Status badge — absolute top right */}
                  <Badge className={`${cfg.className} gap-1 rounded-bl-xl rounded-tr-xl rounded-tl-none rounded-br-none px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-medium shadow-none absolute top-0 right-0 z-[1]`}>
                    {cfg.label}
                  </Badge>

                  <div className="p-3 sm:p-4 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
                    {/* Icon — hidden on mobile */}
                    <div className={`flex w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br ${iconBg} items-center justify-center shadow-sm shrink-0`}>
                      <ClipboardList className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                    </div>

                    {/* PO info */}
                    <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5">
                      {/* Row 1: PO number + supplier */}
                      <div className="flex items-baseline gap-1.5 sm:gap-2 pr-16 sm:pr-0">
                        <span className="font-mono text-xs sm:text-sm font-bold text-foreground">{row.orderNumber}</span>
                        <button onClick={(e) => { e.stopPropagation(); copyToClipboard(row.orderNumber); }} className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-100">
                          <Copy className="w-3 h-3 text-slate-400" />
                        </button>
                        <span className="text-xs sm:text-sm font-medium text-foreground truncate">{supplierName}</span>
                      </div>
                      {/* Row 2: Meta info */}
                      <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-0.5 text-[11px] sm:text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {format(d, "dd MMM yy", { locale: idLocale })}
                        </span>
                        <span className="hidden sm:inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {branchName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {itemCount} item
                        </span>
                      </div>
                      {/* Row 3: Total */}
                      <p className="font-mono text-sm font-bold text-foreground tabular-nums">{formatCurrency(row.totalAmount)}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 sm:gap-1 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 sm:shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-slate-100" onClick={() => handleViewDetail(row.id)} title="Detail">
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-blue-50" title="Print / Export">
                            <FileDown className="w-3.5 h-3.5 text-blue-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handlePrintPO(row.id)}>
                            <Printer className="w-3.5 h-3.5 mr-2" /> Print 3-Ply
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportPOPDF(row.id)}>
                            <FileDown className="w-3.5 h-3.5 mr-2" /> Export PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportPOCSV(row.id)}>
                            <FileText className="w-3.5 h-3.5 mr-2" /> Export CSV
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportPOExcel(row.id)}>
                            <FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Export Excel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {(row.status === "ORDERED" || row.status === "PARTIAL") && (
                        <DisabledActionTooltip disabled={!canReceive} message={cannotMessage("receive")}>
                          <Button disabled={!canReceive} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-emerald-500 hover:bg-emerald-50" onClick={() => handleOpenReceive(row.id)}>
                            <PackageCheck className="w-3.5 h-3.5" />
                          </Button>
                        </DisabledActionTooltip>
                      )}
                      {row.status === "PARTIAL" && (
                        <DisabledActionTooltip disabled={!canReceive} message={cannotMessage("receive")}>
                          <Button disabled={!canReceive} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-purple-500 hover:bg-purple-50" onClick={() => handleOpenClose(row.id)} title="Tutup PO">
                            <Lock className="w-3.5 h-3.5" />
                          </Button>
                        </DisabledActionTooltip>
                      )}
                      {row.status === "DRAFT" && (
                        <DisabledActionTooltip disabled={!canApprove} message={cannotMessage("approve")} menuKey="purchases" actionKey="approve">
                          <Button disabled={!canApprove} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-blue-500 hover:bg-blue-50" onClick={() => handleStatusChange(row.id, "ORDERED")}>
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        </DisabledActionTooltip>
                      )}
                      {(row.status === "DRAFT" || row.status === "ORDERED") && (
                        <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="purchases" actionKey="update">
                          <Button disabled={!canUpdate} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleStatusChange(row.id, "CANCELLED")}>
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </DisabledActionTooltip>
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
        onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
      />
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { poForm.reset(); } }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl rounded-xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-t-xl sm:rounded-t-2xl shrink-0" />
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-bold">Buat Purchase Order</DialogTitle>
          </DialogHeader>

          <DialogBody className={`space-y-3 sm:space-y-5 overflow-x-hidden px-4 sm:px-6 ${!canCreate ? "pointer-events-none opacity-70" : ""}`}>
            {/* Supplier, Location, Date — inline */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">Supplier <span className="text-red-400">*</span></Label>
                <Controller name="supplierId" control={poForm.control} render={({ field }) => (
                  <SmartSelect value={field.value} onChange={field.onChange} placeholder="Pilih supplier"
                    onSearch={async (query) => suppliers.filter((s) => s.isActive && s.name.toLowerCase().includes(query.toLowerCase())).map((s) => ({ value: s.id, label: s.name }))} />
                )} />
                {poForm.formState.errors.supplierId && <p className="text-xs text-red-500">{poForm.formState.errors.supplierId.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">Lokasi <span className="text-red-400">*</span></Label>
                {selectedBranchId ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium">{branches.find((b) => b.id === selectedBranchId)?.name ?? "—"}</span>
                  </div>
                ) : (
                  <>
                    <Controller name="branchIds" control={poForm.control} render={({ field }) => (
                      <BranchMultiSelect branches={branches.filter((b) => b.isActive)} value={field.value} onChange={(v) => { field.onChange(v); poForm.setValue("items", []); }} placeholder="Pilih lokasi" />
                    )} />
                    {poForm.formState.errors.branchIds && <p className="text-xs text-red-500">{poForm.formState.errors.branchIds.message}</p>}
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">Tanggal Diharapkan</Label>
                <Controller name="expectedDate" control={poForm.control} render={({ field }) => (
                  <DatePicker value={field.value ?? ""} onChange={field.onChange} className="rounded-xl" />
                )} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm font-medium">Catatan (opsional)</Label>
              <Input {...poForm.register("notes")} className="rounded-xl h-9 sm:h-10" placeholder="Catatan tambahan..." />
            </div>

            {/* Product items */}
            {poForm.formState.errors.items?.root && <p className="text-xs text-red-500">{poForm.formState.errors.items.root.message}</p>}
            {poForm.formState.errors.items?.message && <p className="text-xs text-red-500">{poForm.formState.errors.items.message}</p>}
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
                poForm.setValue("items", pickerItems.map((pi) => ({
                  productId: pi.productId,
                  productName: pi.productName,
                  quantity: pi.quantity,
                  unitPrice: pi.productPrice,
                })), { shouldValidate: true });
              }}
              branchId={selectedBranchId || undefined}
              branchIds={effectiveBranchIds.length > 0 ? effectiveBranchIds : undefined}
              label="Item PO"
              required
              usePurchasePrice
              editablePrice
              skipBranchStockFilter
              emptyText="Pilih produk untuk ditambahkan ke PO"
            />
          </DialogBody>

          <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6 shrink-0 border-t">
            <div className="flex items-center justify-between w-full gap-2">
              {/* Left: total */}
              {watchedItems.length > 0 ? (
                <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
                  <span className="text-[10px] sm:text-sm font-medium text-emerald-700 shrink-0">Total:</span>
                  <span className="font-mono text-sm sm:text-lg font-bold text-emerald-700 tabular-nums truncate">{formatCurrency(cartTotal)}</span>
                  <Badge className="hidden sm:inline-flex bg-emerald-50 text-emerald-700 border border-emerald-200 px-2">
                    {watchedItems.length} produk
                  </Badge>
                </div>
              ) : <div />}
              {/* Right: buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Batal</Button>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="purchases" actionKey="create">
                  <Button disabled={!canCreate || poForm.formState.isSubmitting} onClick={poForm.handleSubmit(handleCreatePO)} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-200/50">
                    {poForm.formState.isSubmitting ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <ShoppingBasket className="w-4 h-4 sm:mr-2" />}
                    <span>{poForm.formState.isSubmitting ? "Menyimpan..." : "Buat PO"}</span>
                  </Button>
                </DisabledActionTooltip>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl rounded-xl sm:rounded-2xl p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 shrink-0" />
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-bold">Detail Purchase Order</DialogTitle>
          </DialogHeader>
          {selectedPO && (<>
            <DialogBody className="px-4 sm:px-6 space-y-3 sm:space-y-4">
              {/* Info cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">No. PO</p>
                  <p className="font-mono font-bold text-sm text-foreground">{selectedPO.orderNumber}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Supplier</p>
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-emerald-500" />
                    <p className="text-sm font-medium">{selectedPO.supplier.name}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Tanggal Order</p>
                  <p className="text-sm">{format(new Date(selectedPO.orderDate), "dd MMM yyyy", { locale: idLocale })}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Status</p>
                  <Badge className={`${statusConfig[selectedPO.status]?.className} rounded-full text-xs font-medium px-2.5 py-0.5`}>
                    {statusConfig[selectedPO.status]?.label}
                  </Badge>
                </div>
              </div>

              {/* Items table */}
              <Table noWrapper>
                <TableHeader className="sticky top-[-10px] z-10 bg-white [box-shadow:0_1px_0_0_#e5e7eb]">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Produk</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Order</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Diterima</TableHead>
                    <TableHead className="text-center text-xs font-semibold hidden sm:table-cell">Selisih</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPO.items.map((item) => {
                    const gap = item.quantity - item.receivedQty;
                    const discReason = (item as unknown as { discrepancyReason?: string }).discrepancyReason;
                    const discNote = (item as unknown as { discrepancyNote?: string }).discrepancyNote;
                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <p className="text-sm font-medium">{item.product.name}</p>
                          {discReason && (
                            <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {discReason === "KURANG_KIRIM" ? "Kurang Kirim" : discReason === "RUSAK" ? "Rusak" : discReason === "RETUR" ? "Retur" : discReason}
                              {discNote && <span className="text-muted-foreground">— {discNote}</span>}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm tabular-nums">{item.quantity}</TableCell>
                        <TableCell className="text-center text-sm">
                          <Badge
                            variant={item.receivedQty >= item.quantity ? "default" : "secondary"}
                            className={`rounded-lg font-semibold ${item.receivedQty >= item.quantity
                              ? "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200"
                              : "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200"
                              }`}
                          >
                            {item.receivedQty}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm hidden sm:table-cell">
                          {gap > 0 ? (
                            <Badge className="rounded-lg bg-red-50 text-red-600 border border-red-200 font-semibold">-{gap}</Badge>
                          ) : (
                            <span className="text-emerald-500 text-xs">✓</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">{formatCurrency(item.subtotal)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {selectedPO.status === "CLOSED" && (selectedPO as unknown as { closingNotes?: string }).closingNotes && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-3">
                  <p className="text-[11px] text-purple-500 font-medium mb-1">Catatan Penutupan</p>
                  <p className="text-xs text-purple-700">{(selectedPO as unknown as { closingNotes: string }).closingNotes}</p>
                </div>
              )}

            </DialogBody>

            <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6 justify-between items-center">
              {/* Total - left */}
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium">Total Order</p>
                <p className="font-mono text-base font-bold tabular-nums text-foreground">{formatCurrency(selectedPO.totalAmount)}</p>
                {(selectedPO.status === "PARTIAL" || selectedPO.status === "CLOSED" || selectedPO.status === "RECEIVED") && (() => {
                  const receivedAmt = selectedPO.items.reduce((s, i) => s + i.receivedQty * i.unitPrice, 0);
                  const diff = selectedPO.totalAmount - receivedAmt;
                  return diff > 0 ? (
                    <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3" /> Selisih: -{formatCurrency(diff)}
                    </p>
                  ) : null;
                })()}
              </div>
              {/* Actions - right */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-xl">
                      <FileDown className="w-4 h-4 mr-2" /> Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => printPO(buildPrintData(selectedPO))}>
                      <Printer className="w-3.5 h-3.5 mr-2" /> Print 3-Ply
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportPOtoPDF(buildPrintData(selectedPO))}>
                      <FileDown className="w-3.5 h-3.5 mr-2" /> Export PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportPOtoCSV(buildPrintData(selectedPO))}>
                      <FileText className="w-3.5 h-3.5 mr-2" /> Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportPOtoExcel(buildPrintData(selectedPO))}>
                      <FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Export Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {(selectedPO.status === "ORDERED" || selectedPO.status === "PARTIAL") && (
                  <DisabledActionTooltip disabled={!canReceive} message={cannotMessage("receive")}>
                    <Button
                      disabled={!canReceive}
                      className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                      onClick={() => { setDetailOpen(false); handleOpenReceive(selectedPO.id); }}
                    >
                      <PackageCheck className="w-4 h-4 mr-2" />
                      Terima Barang
                    </Button>
                  </DisabledActionTooltip>
                )}
                {selectedPO.status === "PARTIAL" && (
                  <DisabledActionTooltip disabled={!canReceive} message={cannotMessage("receive")}>
                    <Button
                      disabled={!canReceive}
                      variant="outline"
                      className="rounded-xl text-purple-600 border-purple-200 hover:bg-purple-50"
                      onClick={() => { setDetailOpen(false); handleOpenClose(selectedPO.id); }}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Tutup PO
                    </Button>
                  </DisabledActionTooltip>
                )}
                {(selectedPO.status === "DRAFT" || selectedPO.status === "ORDERED") && (
                  <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="purchases" actionKey="update">
                    <Button
                      disabled={!canUpdate}
                      variant="outline"
                      className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => { setDetailOpen(false); handleStatusChange(selectedPO.id, "CANCELLED"); }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Batalkan
                    </Button>
                  </DisabledActionTooltip>
                )}
              </div>
            </DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl rounded-xl sm:rounded-2xl p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-green-500 to-lime-500 shrink-0" />
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-500" />
              Terima Barang
            </DialogTitle>
            {selectedPO && (
              <p className="text-xs font-mono text-muted-foreground mt-1">{selectedPO.orderNumber}</p>
            )}
          </DialogHeader>
          {selectedPO && (<>
            <DialogBody className="px-4 sm:px-6 space-y-3">
              <p className="text-xs sm:text-sm text-muted-foreground">Masukkan jumlah barang yang diterima untuk setiap item.</p>
              <Table noWrapper>
                <TableHeader className="sticky top-[-10px] z-10 bg-white [box-shadow:0_1px_0_0_#e5e7eb]">
                  <TableRow className="bg-gradient-to-r from-slate-50 to-white">
                    <TableHead className="text-xs font-semibold">Produk</TableHead>
                    <TableHead className="text-center text-xs font-semibold hidden sm:table-cell">Order</TableHead>
                    <TableHead className="text-center text-xs font-semibold hidden sm:table-cell">Sudah</TableHead>
                    <TableHead className="text-center text-xs font-semibold">Terima</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPO.items.map((item) => {
                    const remaining = item.quantity - item.receivedQty;
                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-sm font-medium">{item.product.name}</TableCell>
                        <TableCell className="text-center text-sm tabular-nums hidden sm:table-cell">{item.quantity}</TableCell>
                        <TableCell className="text-center text-sm hidden sm:table-cell">
                          <Badge variant="secondary" className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 font-semibold">
                            {item.receivedQty}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            value={receiveQtys[item.id] || 0}
                            onChange={(e) => setReceiveQtys({ ...receiveQtys, [item.id]: Number(e.target.value) })}
                            onFocus={(e) => e.target.select()}
                            className="w-30 mx-auto rounded-xl text-right text-sm border-slate-200 focus:border-emerald-300"
                            disabled={remaining <= 0}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DialogBody>
            <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6">
              <Button variant="outline" onClick={() => setReceiveOpen(false)} className="rounded-xl">Batal</Button>
              <DisabledActionTooltip disabled={!canReceive} message={cannotMessage("receive")}>
                <Button disabled={!canReceive} onClick={handleReceive} className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-200/50">
                  <PackageCheck className="w-4 h-4 mr-2" />
                  Terima Barang
                </Button>
              </DisabledActionTooltip>
            </DialogFooter>
          </>)}
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
        open={poConfirmOpen}
        onOpenChange={setPOConfirmOpen}
        kind="submit"
        description="Yakin ingin membuat Purchase Order ini?"
        onConfirm={executeCreatePO}
      />
      <ActionConfirmDialog
        open={receiveConfirmOpen}
        onOpenChange={setReceiveConfirmOpen}
        kind="approve"
        title="Konfirmasi Penerimaan"
        description="Yakin ingin menerima barang? Stok produk akan diperbarui."
        confirmLabel="Ya, Terima"
        onConfirm={executeReceive}
      />

      {/* Close PO Dialog */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-xl sm:rounded-2xl p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="h-1.5 bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-500 shrink-0" />
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-purple-500" />
              Tutup Purchase Order
            </DialogTitle>
            {closePOTarget && (
              <p className="text-xs font-mono text-muted-foreground mt-1">{closePOTarget.orderNumber}</p>
            )}
          </DialogHeader>
          {closePOTarget && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  PO ini akan ditutup. Selisih qty yang tidak diterima akan dicatat sebagai discrepancy dan hutang akan disesuaikan.
                </p>
              </div>

              {/* Discrepancy items */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Item dengan Selisih</p>
                {closePOTarget.items.filter((i) => i.quantity > i.receivedQty).map((item) => {
                  const gap = item.quantity - item.receivedQty;
                  const disc = closeDiscrepancies[item.id];
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{item.product.name}</p>
                          <p className="text-[11px] text-muted-foreground">Order: {item.quantity} · Diterima: {item.receivedQty} · <span className="text-red-500 font-semibold">Selisih: {gap}</span></p>
                        </div>
                        <Badge className="rounded-lg bg-red-50 text-red-600 border border-red-200 font-bold">-{gap}</Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Alasan</Label>
                          <Select
                            value={disc?.reason || "KURANG_KIRIM"}
                            onValueChange={(v) => setCloseDiscrepancies((prev) => ({ ...prev, [item.id]: { ...prev[item.id]!, reason: v } }))}
                          >
                            <SelectTrigger className="mt-1 rounded-xl text-xs h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DISCREPANCY_REASONS.map((r) => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Catatan (opsional)</Label>
                          <Input
                            value={disc?.note || ""}
                            onChange={(e) => setCloseDiscrepancies((prev) => ({ ...prev, [item.id]: { ...prev[item.id]!, note: e.target.value } }))}
                            className="mt-1 rounded-xl text-xs h-8"
                            placeholder="Keterangan tambahan..."
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {closePOTarget.items.filter((i) => i.quantity > i.receivedQty).length === 0 && (
                  <p className="text-xs text-muted-foreground">Semua item sudah diterima lengkap.</p>
                )}
              </div>

              {/* Summary */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Order</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(closePOTarget.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Diterima</span>
                  <span className="font-semibold text-emerald-600 tabular-nums">{formatCurrency(closePOTarget.items.reduce((s, i) => s + i.receivedQty * i.unitPrice, 0))}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-200 pt-1 mt-1">
                  <span className="text-red-600 font-medium">Selisih Tidak Diterima</span>
                  <span className="font-bold text-red-600 tabular-nums">{formatCurrency(closePOTarget.totalAmount - closePOTarget.items.reduce((s, i) => s + i.receivedQty * i.unitPrice, 0))}</span>
                </div>
              </div>

              {/* Closing notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Catatan Penutupan (opsional)</Label>
                <Textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="rounded-xl text-xs min-h-[60px]"
                  placeholder="Alasan menutup PO ini..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCloseOpen(false)} className="rounded-xl">Batal</Button>
                <Button onClick={handleClosePO} className="rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white shadow-lg shadow-purple-200/50">
                  <Lock className="w-4 h-4 mr-2" />
                  Tutup PO
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ActionConfirmDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        kind="custom"
        title="Konfirmasi Tutup PO"
        description="Yakin ingin menutup PO ini? Selisih qty akan dicatat sebagai discrepancy dan hutang akan disesuaikan berdasarkan barang yang benar-benar diterima."
        confirmLabel="Ya, Tutup PO"
        onConfirm={executeClosePO}
      />

      <PurchaseImportDialog open={importOpen} onOpenChange={setImportOpen} branchId={selectedBranchId || undefined} onImported={() => fetchData({})} />
    </div>
  );
}
