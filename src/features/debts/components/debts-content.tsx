"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getDebts, getDebtById, createDebt, updateDebt, deleteDebt, addDebtPayment, getDebtSummary } from "@/features/debts";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ArrowDownCircle,
    ArrowUpCircle,
    CalendarDays,
    Eye,
    Loader2,
    Pencil,
    Plus,
    Search,
    Trash2,
    Wallet,
    AlertTriangle,
    CheckCircle2,
    Clock,
    CreditCard,
    Banknote,
    SlidersHorizontal,
    Check,
    ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useBranch } from "@/components/providers/branch-provider";
import { useMenuActionAccess } from "@/features/access-control";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ExportMenu } from "@/components/ui/export-menu";
import { PaginationControl } from "@/components/ui/pagination-control";

// ---- local types ----

interface DebtPaymentItem {
    id: string;
    amount: number;
    method: string;
    notes: string | null;
    paidBy: string;
    payer: { id: string; name: string };
    paidAt: string | Date;
}

interface DebtItem {
    id: string;
    type: "PAYABLE" | "RECEIVABLE";
    referenceType: string | null;
    referenceId: string | null;
    partyType: string;
    partyId: string | null;
    partyName: string;
    description: string | null;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    dueDate: string | Date | null;
    branchId: string | null;
    branch: { id: string; name: string } | null;
    createdBy: string;
    creator: { id: string; name: string };
    createdAt: string | Date;
    updatedAt?: string | Date;
    payments: DebtPaymentItem[] | { paidAt: string | Date; amount: number }[];
}

interface DebtSummary {
    totalPayableRemaining: number;
    totalReceivableRemaining: number;
    overdueCount: number;
    unpaidPayableCount: number;
    unpaidReceivableCount: number;
}

// ---- zod schema ----

const debtFormSchema = z.object({
    type: z.enum(["PAYABLE", "RECEIVABLE"]),
    partyType: z.string().min(1, "Pilih jenis pihak"),
    partyName: z.string().min(1, "Nama pihak wajib diisi"),
    description: z.string().optional(),
    totalAmount: z.number().min(1, "Jumlah harus lebih dari 0"),
    dueDate: z.string().optional(),
});
type DebtFormValues = z.infer<typeof debtFormSchema>;

const paymentFormSchema = z.object({
    amount: z.number().min(1, "Jumlah harus lebih dari 0"),
    method: z.string().min(1, "Pilih metode"),
    notes: z.string().optional(),
});
type PaymentFormValues = z.infer<typeof paymentFormSchema>;

// ---- filter options ----

const typeFilterOptions = [
    { value: "ALL", label: "Semua" },
    { value: "PAYABLE", label: "Hutang" },
    { value: "RECEIVABLE", label: "Piutang" },
];

const statusFilterOptions = [
    { value: "ALL", label: "Semua Status" },
    { value: "UNPAID", label: "Belum Lunas" },
    { value: "PARTIAL", label: "Sebagian" },
    { value: "PAID", label: "Lunas" },
    { value: "OVERDUE", label: "Jatuh Tempo" },
];

const paymentMethodOptions = [
    { value: "CASH", label: "Cash" },
    { value: "TRANSFER", label: "Transfer Bank" },
    { value: "QRIS", label: "QRIS" },
    { value: "EWALLET", label: "E-Wallet" },
];

const partyTypeOptions = [
    { value: "SUPPLIER", label: "Supplier" },
    { value: "CUSTOMER", label: "Customer" },
    { value: "OTHER", label: "Lainnya" },
];

// ---- helpers ----

function isOverdue(debt: DebtItem): boolean {
    if (debt.status === "PAID") return false;
    if (!debt.dueDate) return false;
    return new Date(debt.dueDate) < new Date();
}

function getStatusDisplay(debt: DebtItem) {
    if (isOverdue(debt)) {
        return { label: "Jatuh Tempo", className: "bg-red-100 text-red-700 ring-1 ring-red-200 animate-pulse", icon: AlertTriangle };
    }
    switch (debt.status) {
        case "PAID":
            return { label: "Lunas", className: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200", icon: CheckCircle2 };
        case "PARTIAL":
            return { label: "Sebagian", className: "bg-amber-100 text-amber-700 ring-1 ring-amber-200", icon: Clock };
        default:
            return { label: "Belum Lunas", className: "bg-red-100 text-red-700 ring-1 ring-red-200", icon: AlertTriangle };
    }
}

export function DebtsContent() {
    // ---- state ----
    const [data, setData] = useState<{ debts: DebtItem[]; total: number; totalPages: number }>({ debts: [], total: 0, totalPages: 0 });
    const [summary, setSummary] = useState<DebtSummary>({ totalPayableRemaining: 0, totalReceivableRemaining: 0, overdueCount: 0, unpaidPayableCount: 0, unpaidReceivableCount: 0 });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [draftType, setDraftType] = useState("ALL");
    const [draftStatus, setDraftStatus] = useState("ALL");
    const [typeExpanded, setTypeExpanded] = useState(true);
    const [statusExpanded, setStatusExpanded] = useState(true);
    const [loading, startTransition] = useTransition();

    // dialogs
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<DebtItem | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailDebt, setDetailDebt] = useState<DebtItem | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);

    // form
    const debtForm = useForm<DebtFormValues>({
        resolver: zodResolver(debtFormSchema),
        defaultValues: { type: "PAYABLE", partyType: "SUPPLIER", partyName: "", description: "", totalAmount: 0, dueDate: "" },
    });

    // payment form
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const paymentForm = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentFormSchema),
        defaultValues: { amount: 0, method: "CASH", notes: "" },
    });

    // access control
    const { canAction, cannotMessage } = useMenuActionAccess("debts");
    const { canAction: canPlan } = usePlanAccess();
    const canCreate = canAction("create") && canPlan("debts", "create");
    const canUpdate = canAction("update") && canPlan("debts", "update");
    const canDelete = canAction("delete") && canPlan("debts", "delete");
    const canPayment = canAction("payment") && canPlan("debts", "payment");

    // branch
    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);
    const didFetchRef = useRef(false);

    // ---- data fetching ----

    const fetchData = (params: {
        search?: string;
        page?: number;
        typeFilter?: string;
        statusFilter?: string;
    }) => {
        startTransition(async () => {
            const s = params.search ?? search;
            const p = params.page ?? page;
            const tf = params.typeFilter ?? typeFilter;
            const sf = params.statusFilter ?? statusFilter;

            const [listResult, summaryResult] = await Promise.all([
                getDebts({
                    ...(s ? { search: s } : {}),
                    ...(tf !== "ALL" ? { type: tf as "PAYABLE" | "RECEIVABLE" } : {}),
                    ...(sf !== "ALL" ? { status: sf as "UNPAID" | "PARTIAL" | "PAID" } : {}),
                    page: p,
                    perPage: pageSize,
                    ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
                }),
                getDebtSummary(selectedBranchId || undefined),
            ]);

            setData(listResult as unknown as { debts: DebtItem[]; total: number; totalPages: number });
            setSummary(summaryResult as unknown as DebtSummary);
        });
    };

    useEffect(() => {
        if (!branchReady) return;
        if (prevBranchRef.current !== selectedBranchId) {
            prevBranchRef.current = selectedBranchId;
            setPage(1);
            fetchData({ page: 1 });
        } else if (!didFetchRef.current) {
            didFetchRef.current = true;
            fetchData({});
        }
    }, [selectedBranchId, branchReady]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- handlers ----

    const handleSearch = (value: string) => {
        setSearch(value);
        setPage(1);
        fetchData({ search: value, page: 1 });
    };

    const handleTypeFilter = (value: string) => {
        setTypeFilter(value);
        setPage(1);
        fetchData({ typeFilter: value, page: 1 });
    };

    const handleStatusFilter = (value: string) => {
        setStatusFilter(value);
        setPage(1);
        fetchData({ statusFilter: value, page: 1 });
    };

    const handlePageChange = (p: number) => {
        setPage(p);
        fetchData({ page: p });
    };

    // ---- create / edit ----

    const openCreateDialog = () => {
        if (!canCreate) { toast.error(cannotMessage("create")); return; }
        setEditing(null);
        debtForm.reset({ type: "PAYABLE", partyType: "SUPPLIER", partyName: "", description: "", totalAmount: 0, dueDate: "" });
        setFormOpen(true);
    };

    const openEditDialog = (debt: DebtItem) => {
        if (!canUpdate) { toast.error(cannotMessage("update")); return; }
        setEditing(debt);
        debtForm.reset({
            type: debt.type,
            partyType: debt.partyType,
            partyName: debt.partyName,
            description: debt.description || "",
            totalAmount: debt.totalAmount,
            dueDate: debt.dueDate ? format(new Date(debt.dueDate), "yyyy-MM-dd") : "",
        });
        setFormOpen(true);
    };

    const closeFormDialog = () => {
        setFormOpen(false);
        setEditing(null);
        debtForm.reset();
    };

    const onDebtFormSubmit = async (values: DebtFormValues) => {
        if (editing) {
            const result = await updateDebt(editing.id, {
                partyType: values.partyType,
                partyName: values.partyName,
                ...(values.description ? { description: values.description } : {}),
                totalAmount: values.totalAmount,
                dueDate: values.dueDate || null,
            });
            if (result.error) { toast.error(result.error); return; }
            toast.success("Data berhasil diupdate");
        } else {
            const result = await createDebt({
                type: values.type,
                partyType: values.partyType,
                partyName: values.partyName,
                ...(values.description ? { description: values.description } : {}),
                totalAmount: values.totalAmount,
                ...(values.dueDate ? { dueDate: values.dueDate } : {}),
                ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
            });
            if (result.error) { toast.error(result.error); return; }
            toast.success("Data berhasil ditambahkan");
        }
        closeFormDialog();
        fetchData({});
    };

    // ---- detail ----

    const openDetailDialog = async (debt: DebtItem) => {
        const result = await getDebtById(debt.id);
        if (result.error || !result.debt) {
            toast.error(result.error || "Data tidak ditemukan");
            return;
        }
        setDetailDebt(result.debt as unknown as DebtItem);
        setDetailOpen(true);
    };

    // ---- payment ----

    const openPaymentForm = () => {
        paymentForm.reset({ amount: 0, method: "CASH", notes: "" });
        setPaymentOpen(true);
    };

    const handleAddPayment = async (values: PaymentFormValues) => {
        if (!detailDebt) return;
        setPaymentLoading(true);
        const result = await addDebtPayment({
            debtId: detailDebt.id,
            amount: values.amount,
            method: values.method,
            ...(values.notes ? { notes: values.notes } : {}),
        });
        setPaymentLoading(false);

        if (result.error) {
            toast.error(result.error);
            return;
        }

        toast.success("Pembayaran berhasil ditambahkan");
        setPaymentOpen(false);

        // Refresh detail
        const refreshed = await getDebtById(detailDebt.id);
        if (refreshed.debt) setDetailDebt(refreshed.debt as unknown as DebtItem);

        fetchData({});
    };

    // ---- delete ----

    const handleDelete = (debt: DebtItem) => {
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
        setConfirmText(`Yakin ingin menghapus hutang/piutang "${debt.partyName}"?`);
        setPendingConfirmAction(() => async () => {
            const result = await deleteDebt(debt.id);
            if (result.error) toast.error(result.error);
            else {
                toast.success("Data berhasil dihapus");
                fetchData({});
            }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    // ---- computed ----

    const partialCount = useMemo(() => data.debts.filter((d) => d.status === "PARTIAL").length, [data.debts]);

    // ---- progress % ----

    const progressPercent = (debt: DebtItem) => {
        if (debt.totalAmount <= 0) return 0;
        return Math.min(100, Math.round((debt.paidAmount / debt.totalAmount) * 100));
    };

    // ---- render ----

    return (
        <div className="space-y-4 sm:space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex items-center justify-center w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-200/50 shrink-0">
                        <Wallet className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Hutang Piutang</h1>
                        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Kelola hutang dan piutang usaha Anda</p>
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    <ExportMenu module="debts" branchId={selectedBranchId || undefined} />
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="debts" actionKey="create">
                        <Button disabled={!canCreate} className="rounded-xl shadow-md shadow-amber-200/30 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm" onClick={openCreateDialog}>
                            <Plus className="w-4 h-4 mr-2" /> Tambah
                        </Button>
                    </DisabledActionTooltip>
                </div>
            </div>
            {/* Mobile: Floating button */}
            {canCreate && (
                <div className="sm:hidden fixed bottom-4 right-4 z-50">
                    <Button onClick={openCreateDialog} size="icon" className="h-12 w-12 rounded-full shadow-xl shadow-amber-300/50 bg-gradient-to-br from-amber-500 to-orange-600">
                        <Plus className="w-5 h-5" />
                    </Button>
                </div>
            )}

            {/* Mobile: search + filter + stats */}
            <div className="sm:hidden space-y-2">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
                    <Input placeholder="Cari nama, deskripsi..." value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-9 pr-9 rounded-xl h-9 text-sm" />
                </div>
                <Button variant="outline" size="sm" className="shrink-0 rounded-xl h-9 gap-1.5 relative" onClick={() => { setDraftType(typeFilter); setDraftStatus(statusFilter); setFilterSheetOpen(true); }}>
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="text-xs">Filter</span>
                    {(typeFilter !== "ALL" || statusFilter !== "ALL") && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                            {(typeFilter !== "ALL" ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0)}
                        </span>
                    )}
                </Button>
                <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                    <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                        {/* Header */}
                        <div className="shrink-0">
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                            </div>
                            <SheetHeader className="px-4 pb-3 pt-0">
                                <SheetTitle className="text-base font-bold">Filter</SheetTitle>
                            </SheetHeader>
                        </div>

                        {/* Body - scrollable */}
                        <div className="flex-1 overflow-y-auto px-4 space-y-3">
                            {/* Tipe */}
                            <div>
                                <button
                                    onClick={() => setTypeExpanded(!typeExpanded)}
                                    className="w-full flex items-center justify-between py-2"
                                >
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipe</p>
                                    <div className="flex items-center gap-1.5">
                                        {draftType !== "ALL" && (
                                            <span className="text-[11px] font-medium text-foreground bg-muted rounded-full px-2 py-0.5">
                                                {typeFilterOptions.find((o) => o.value === draftType)?.label}
                                            </span>
                                        )}
                                        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", typeExpanded && "rotate-180")} />
                                    </div>
                                </button>
                                {typeExpanded && (
                                    <div className="space-y-1">
                                        {typeFilterOptions.map((opt) => {
                                            const isActive = draftType === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setDraftType(opt.value)}
                                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}
                                                >
                                                    <span>{opt.label}</span>
                                                    {isActive && <Check className="w-4 h-4" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            {/* Status */}
                            <div>
                                <button
                                    onClick={() => setStatusExpanded(!statusExpanded)}
                                    className="w-full flex items-center justify-between py-2"
                                >
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
                                    <div className="flex items-center gap-1.5">
                                        {draftStatus !== "ALL" && (
                                            <span className="text-[11px] font-medium text-foreground bg-muted rounded-full px-2 py-0.5">
                                                {statusFilterOptions.find((o) => o.value === draftStatus)?.label}
                                            </span>
                                        )}
                                        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", statusExpanded && "rotate-180")} />
                                    </div>
                                </button>
                                {statusExpanded && (
                                    <div className="space-y-1">
                                        {statusFilterOptions.map((opt) => {
                                            const isActive = draftStatus === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setDraftStatus(opt.value)}
                                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}
                                                >
                                                    <span>{opt.label}</span>
                                                    {isActive && <Check className="w-4 h-4" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer - fixed */}
                        <SheetFooter className="shrink-0 border-t px-4 py-3 flex-row gap-2">
                            <Button variant="outline" className="flex-1 rounded-xl h-10 text-sm" onClick={() => { setDraftType("ALL"); setDraftStatus("ALL"); }}>
                                Reset
                            </Button>
                            <Button className="flex-1 rounded-xl h-10 text-sm shadow-md" onClick={() => { handleTypeFilter(draftType); handleStatusFilter(draftStatus); setFilterSheetOpen(false); }}>
                                Terapkan Filter
                            </Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
            </div>
            {/* Mobile: stats below search */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                <div className="inline-flex items-center gap-1 bg-red-50 text-red-600 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-red-100 shrink-0">
                    <ArrowDownCircle className="w-3 h-3" />
                    <span className="font-mono tabular-nums font-bold">{formatCurrency(summary.totalPayableRemaining)}</span>
                </div>
                <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-emerald-100 shrink-0">
                    <ArrowUpCircle className="w-3 h-3" />
                    <span className="font-mono tabular-nums font-bold">{formatCurrency(summary.totalReceivableRemaining)}</span>
                </div>
                {summary.overdueCount > 0 && (
                    <div className="inline-flex items-center gap-1 bg-red-50 text-red-500 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-red-100 shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="font-mono tabular-nums">{summary.overdueCount}</span>
                    </div>
                )}
            </div>
            </div>

            {/* Desktop: search left + pills right, 1 row */}
            <div className="hidden sm:flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
                    <Input placeholder="Cari nama pihak, deskripsi..." value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-9 pr-9 rounded-xl h-10" />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {typeFilterOptions.map((opt) => (
                        <button key={opt.value} onClick={() => handleTypeFilter(opt.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${typeFilter === opt.value ? "bg-foreground text-background shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                            {opt.label}
                        </button>
                    ))}
                    <div className="h-4 w-px bg-border/40" />
                    {statusFilterOptions.map((opt) => (
                        <button key={opt.value} onClick={() => handleStatusFilter(opt.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${statusFilter === opt.value ? "bg-foreground text-background shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Desktop: stats below search */}
            <div className="hidden sm:flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-red-100">
                    <ArrowDownCircle className="w-3.5 h-3.5" />
                    Hutang <span className="font-mono tabular-nums font-bold">{formatCurrency(summary.totalPayableRemaining)}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-emerald-100">
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    Piutang <span className="font-mono tabular-nums font-bold">{formatCurrency(summary.totalReceivableRemaining)}</span>
                </div>
                {summary.overdueCount > 0 && (
                    <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-500 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-red-100">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">{summary.overdueCount}</span> Jatuh Tempo
                    </div>
                )}
                {partialCount > 0 && (
                    <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-amber-100">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">{partialCount}</span> Sebagian
                    </div>
                )}
            </div>

            {/* Card List */}
            <div className="space-y-2 sm:space-y-3">
                {loading && data.debts.length === 0 ? (
                    <>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-xl border bg-white p-3 sm:p-4 border-l-4 border-l-slate-200">
                                <div className="flex items-center gap-2 sm:gap-4">
                                    <Skeleton className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl shrink-0" />
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <Skeleton className="h-4 w-40" />
                                        <Skeleton className="h-3 w-28" />
                                        <Skeleton className="h-3 w-36" />
                                    </div>
                                    <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
                                        <Skeleton className="h-5 w-28" />
                                        <Skeleton className="h-2 w-24 rounded-full" />
                                        <Skeleton className="h-4 w-20" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                ) : data.debts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <Wallet className="w-10 h-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-medium">Belum ada data hutang/piutang</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Tambahkan data pertama Anda</p>
                        <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="debts" actionKey="create">
                            <Button disabled={!canCreate} variant="outline" size="sm" className="rounded-full mt-3" onClick={openCreateDialog}>
                                <Plus className="w-3 h-3 mr-1" /> Tambah
                            </Button>
                        </DisabledActionTooltip>
                    </div>
                ) : (
                    <div className={loading ? "space-y-2 sm:space-y-3 opacity-50 pointer-events-none transition-opacity" : "space-y-2 sm:space-y-3"}>
                        {data.debts.map((debt) => {
                            const isPayable = debt.type === "PAYABLE";
                            const statusInfo = getStatusDisplay(debt);
                            const StatusIcon = statusInfo.icon;
                            const pct = progressPercent(debt);

                            return (
                                <div
                                    key={debt.id}
                                    className={`rounded-xl border bg-white hover:shadow-md transition-all group p-3 sm:p-4 border-l-4 ${isPayable ? "border-l-red-500" : "border-l-emerald-500"
                                        }`}
                                >
                                    <div className="flex items-start sm:items-center gap-2 sm:gap-4">
                                        {/* Left: Type Icon */}
                                        <div
                                            className={`flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl shrink-0 ${isPayable
                                                ? "bg-gradient-to-br from-red-100 to-red-50 text-red-600"
                                                : "bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600"
                                                }`}
                                        >
                                            {isPayable ? (
                                                <ArrowDownCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                            ) : (
                                                <ArrowUpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                            )}
                                        </div>

                                        {/* Middle: Info */}
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold text-foreground truncate">{debt.partyName}</p>
                                                <Badge className={`text-[10px] font-medium px-2 py-0 rounded-full border-0 shrink-0 ${isPayable
                                                    ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm shadow-red-200"
                                                    : "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-sm shadow-emerald-200"
                                                    }`}>
                                                    {isPayable ? "Hutang" : "Piutang"}
                                                </Badge>
                                            </div>
                                            {/* Mobile: amount inline */}
                                            <div className="sm:hidden">
                                                <p className={`text-sm font-bold font-mono tabular-nums ${isPayable ? "text-red-600" : "text-emerald-600"}`}>
                                                    {formatCurrency(debt.totalAmount)}
                                                </p>
                                                {debt.remainingAmount > 0 && (
                                                    <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                                                        Sisa {formatCurrency(debt.remainingAmount)}
                                                    </p>
                                                )}
                                                <div className="w-full mt-1">
                                                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-slate-200"}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            {debt.description && (
                                                <p className="text-xs text-muted-foreground truncate">{debt.description}</p>
                                            )}
                                            {debt.dueDate && (
                                                <div className={`flex items-center gap-1.5 text-xs ${isOverdue(debt) ? "text-red-500" : "text-muted-foreground"
                                                    }`}>
                                                    <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${isOverdue(debt) ? "text-red-400" : "text-muted-foreground/60"
                                                        }`} />
                                                    <span className="font-mono tabular-nums text-[11px] sm:text-xs">
                                                        {format(new Date(debt.dueDate), "dd MMM yyyy", { locale: idLocale })}
                                                    </span>
                                                    {isOverdue(debt) && (
                                                        <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded ml-0.5">Lewat</span>
                                                    )}
                                                </div>
                                            )}
                                            {/* Mobile: status + actions row */}
                                            <div className="flex sm:hidden items-center gap-2 pt-1">
                                                <Badge variant="outline" className={`text-[10px] font-medium rounded-full px-2 ${statusInfo.className}`}>
                                                    <StatusIcon className="w-3 h-3 mr-0.5" />
                                                    {statusInfo.label}
                                                </Badge>
                                                <div className="flex gap-0.5 ml-auto">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-amber-50 hover:text-amber-600" onClick={() => openDetailDialog(debt)}>
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button disabled={!canUpdate} variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-blue-50 hover:text-blue-600" onClick={() => openEditDialog(debt)}>
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button disabled={!canDelete} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(debt)}>
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Amount + Progress + Status + Actions (desktop only) */}
                                        <div className="hidden sm:flex items-center gap-4 shrink-0">
                                            <div className="text-right space-y-1.5">
                                                <p className={`text-lg font-bold font-mono tabular-nums ${isPayable ? "text-red-600" : "text-emerald-600"
                                                    }`}>
                                                    {formatCurrency(debt.totalAmount)}
                                                </p>
                                                {/* Progress bar */}
                                                <div className="w-24">
                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${pct >= 100
                                                                ? "bg-emerald-500"
                                                                : pct > 0
                                                                    ? "bg-amber-500"
                                                                    : "bg-slate-200"
                                                                }`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                {debt.remainingAmount > 0 && (
                                                    <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                                                        Sisa {formatCurrency(debt.remainingAmount)}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <Badge variant="outline" className={`text-[11px] font-medium rounded-full px-2.5 ${statusInfo.className}`}>
                                                    <StatusIcon className="w-3 h-3 mr-1" />
                                                    {statusInfo.label}
                                                </Badge>
                                            </div>
                                            <div className="flex gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-colors"
                                                    onClick={() => openDetailDialog(debt)}
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </Button>
                                                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="debts" actionKey="update">
                                                    <Button
                                                        disabled={!canUpdate}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                        onClick={() => openEditDialog(debt)}
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </Button>
                                                </DisabledActionTooltip>
                                                <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="debts" actionKey="delete">
                                                    <Button
                                                        disabled={!canDelete}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                                                        onClick={() => handleDelete(debt)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </DisabledActionTooltip>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
                <PaginationControl
                    currentPage={page}
                    totalPages={data.totalPages}
                    totalItems={data.total}
                    pageSize={pageSize}
                    onPageChange={(p) => handlePageChange(p)}
                    onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ page: 1 }); }}
                />
            )}

            {/* ============ Create/Edit Dialog ============ */}
            <Dialog open={formOpen} onOpenChange={(v) => { if (!v) closeFormDialog(); else setFormOpen(true); }}>
                <DialogContent className="rounded-xl sm:rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-md p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500 shrink-0" />
                    <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-2 sm:pb-3 shrink-0">
                        <DialogTitle className="text-sm sm:text-lg font-bold text-slate-800">
                            {editing ? "Edit Hutang/Piutang" : "Tambah Hutang/Piutang"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={debtForm.handleSubmit(onDebtFormSubmit)} className="min-h-0 flex flex-col flex-1 overflow-hidden">
                        <DialogBody className="space-y-3 px-4 sm:px-6">
                            {/* Type */}
                            {!editing && (
                                <div className="space-y-1.5">
                                    <Label>Tipe <span className="text-red-400">*</span></Label>
                                    <Controller name="type" control={debtForm.control} render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="PAYABLE">Hutang</SelectItem>
                                                <SelectItem value="RECEIVABLE">Piutang</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )} />
                                </div>
                            )}

                            {/* Party Type */}
                            <div className="space-y-1.5">
                                <Label>Jenis Pihak <span className="text-red-400">*</span></Label>
                                <Controller name="partyType" control={debtForm.control} render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {partyTypeOptions.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )} />
                            </div>

                            {/* Party Name */}
                            <div className="space-y-1.5">
                                <Label>Nama Pihak <span className="text-red-400">*</span></Label>
                                <Input {...debtForm.register("partyName")} className="rounded-xl" placeholder="Nama supplier / customer" />
                                {debtForm.formState.errors.partyName && <p className="text-xs text-red-500">{debtForm.formState.errors.partyName.message}</p>}
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <Label>Deskripsi</Label>
                                <Input {...debtForm.register("description")} className="rounded-xl" placeholder="Keterangan (opsional)" />
                            </div>

                            {/* Amount + Due Date */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                <div className="space-y-1.5">
                                    <Label>Jumlah <span className="text-red-400">*</span></Label>
                                    <Input type="number" {...debtForm.register("totalAmount", { valueAsNumber: true })} className="rounded-xl" placeholder="Rp 0" />
                                    {debtForm.formState.errors.totalAmount && <p className="text-xs text-red-500">{debtForm.formState.errors.totalAmount.message}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Jatuh Tempo</Label>
                                    <DatePicker value={debtForm.watch("dueDate") || ""} onChange={(v) => debtForm.setValue("dueDate", v)} className="rounded-xl" />
                                </div>
                            </div>
                        </DialogBody>

                        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
                            <Button type="button" variant="outline" onClick={closeFormDialog} className="rounded-xl">Batal</Button>
                            <Button disabled={(editing ? !canUpdate : !canCreate) || debtForm.formState.isSubmitting} type="submit" className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                                {debtForm.formState.isSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</> : editing ? "Update" : "Simpan"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ============ Detail Dialog ============ */}
            <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) { setPaymentOpen(false); setDetailDebt(null); } }}>
                <DialogContent className="rounded-xl sm:rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-lg p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
                    <div className={`h-1 shrink-0 ${detailDebt?.type === "PAYABLE" ? "bg-gradient-to-r from-red-400 to-rose-500" : "bg-gradient-to-r from-emerald-400 to-green-500"}`} />
                    <DialogHeader className="px-4 sm:px-6 pt-3 sm:pt-5 pb-2 sm:pb-3 shrink-0">
                        <DialogTitle className="flex items-center justify-between">
                            <span className="text-sm sm:text-lg font-bold">Detail Hutang/Piutang</span>
                            {detailDebt && (
                                <Badge className={`${detailDebt.type === "PAYABLE" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"} rounded-full text-[10px] sm:text-xs border-0 shrink-0`}>
                                    {detailDebt.type === "PAYABLE" ? "Hutang" : "Piutang"}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    <DialogBody className="space-y-3 sm:space-y-4 px-4 sm:px-6">
                        {detailDebt && (
                            <>
                                {/* Summary card */}
                                <div className="rounded-lg sm:rounded-xl bg-slate-50 p-2.5 sm:p-4 space-y-2 sm:space-y-3">
                                    <div className="flex items-center gap-2">
                                        {detailDebt.type === "PAYABLE" ? <ArrowDownCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 shrink-0" /> : <ArrowUpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0" />}
                                        <span className="text-xs sm:text-sm font-bold text-foreground truncate">{detailDebt.partyName}</span>
                                    </div>
                                    {detailDebt.description && <p className="text-[11px] sm:text-sm text-muted-foreground">{detailDebt.description}</p>}

                                    <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                                        <div className="text-center">
                                            <p className="text-[9px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total</p>
                                            <p className="text-[11px] sm:text-sm font-bold font-mono tabular-nums">{formatCurrency(detailDebt.totalAmount)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Bayar</p>
                                            <p className="text-[11px] sm:text-sm font-bold font-mono tabular-nums text-emerald-600">{formatCurrency(detailDebt.paidAmount)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Sisa</p>
                                            <p className="text-[11px] sm:text-sm font-bold font-mono tabular-nums text-red-600">{formatCurrency(detailDebt.remainingAmount)}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="w-full h-1.5 sm:h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${progressPercent(detailDebt) >= 100 ? "bg-emerald-500" : progressPercent(detailDebt) > 0 ? "bg-amber-500" : "bg-slate-300"}`} style={{ width: `${progressPercent(detailDebt)}%` }} />
                                        </div>
                                        <p className="text-[10px] sm:text-[11px] text-muted-foreground text-right mt-0.5 font-mono">{progressPercent(detailDebt)}%</p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
                                        {detailDebt.dueDate && <span className="flex items-center gap-0.5"><CalendarDays className="w-3 h-3" />{format(new Date(detailDebt.dueDate), "dd MMM yy", { locale: idLocale })}</span>}
                                        <span>{detailDebt.creator.name}</span>
                                        {detailDebt.branch && <span>{detailDebt.branch.name}</span>}
                                    </div>
                                </div>

                                {/* Payment history */}
                                <div>
                                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                                        <h3 className="text-xs sm:text-sm font-bold text-slate-700">Riwayat Pembayaran</h3>
                                        {detailDebt.status !== "PAID" && (
                                            <DisabledActionTooltip disabled={!canPayment} message={cannotMessage("payment")} menuKey="debts" actionKey="payment">
                                                <Button disabled={!canPayment} size="sm" className="rounded-xl text-xs bg-gradient-to-r from-amber-500 to-orange-600 text-white" onClick={openPaymentForm}>
                                                    <Plus className="w-3 h-3 mr-1" /> Bayar
                                                </Button>
                                            </DisabledActionTooltip>
                                        )}
                                    </div>

                                    {(detailDebt.payments as DebtPaymentItem[]).length === 0 ? (
                                        <div className="text-center py-4 sm:py-6 text-muted-foreground/60">
                                            <Banknote className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1.5 opacity-30" />
                                            <p className="text-[10px] sm:text-xs">Belum ada pembayaran</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 sm:space-y-2">
                                            {(detailDebt.payments as DebtPaymentItem[]).map((payment) => (
                                                <div key={payment.id} className="rounded-lg border border-border/30 bg-white px-2.5 py-2 sm:p-3 flex items-center gap-2 sm:gap-3">
                                                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                                        <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs sm:text-sm font-semibold font-mono tabular-nums">{formatCurrency(payment.amount)}</p>
                                                        <div className="flex items-center gap-1.5 text-[9px] sm:text-[11px] text-muted-foreground">
                                                            <span>{payment.method}</span>
                                                            <span>·</span>
                                                            <span className="truncate">{payment.payer.name}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-[9px] sm:text-[11px] text-muted-foreground font-mono tabular-nums shrink-0">{format(new Date(payment.paidAt), "dd/MM/yy")}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Payment form (inline) */}
                                {paymentOpen && (
                                    <form onSubmit={paymentForm.handleSubmit(handleAddPayment)} className="rounded-lg sm:rounded-xl border border-amber-200 bg-amber-50/30 p-2.5 sm:p-4 space-y-2 sm:space-y-3">
                                        <h4 className="text-xs sm:text-sm font-bold text-slate-700">Tambah Pembayaran</h4>
                                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                            <div className="space-y-1">
                                                <Label>Jumlah <span className="text-red-400">*</span></Label>
                                                <Input type="number" {...paymentForm.register("amount", { valueAsNumber: true })} className="rounded-xl" placeholder="Rp 0" />
                                                {paymentForm.formState.errors.amount && <p className="text-xs text-red-500">{paymentForm.formState.errors.amount.message}</p>}
                                            </div>
                                            <div className="space-y-1">
                                                <Label>Metode <span className="text-red-400">*</span></Label>
                                                <Controller name="method" control={paymentForm.control} render={({ field }) => (
                                                    <Select value={field.value} onValueChange={field.onChange}>
                                                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {paymentMethodOptions.map((opt) => (
                                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Catatan</Label>
                                            <Input {...paymentForm.register("notes")} className="rounded-xl" placeholder="Catatan pembayaran" />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setPaymentOpen(false)}>Batal</Button>
                                            <Button type="submit" size="sm" className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white" disabled={paymentLoading}>
                                                {paymentLoading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Bayar
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </>
                        )}
                    </DialogBody>

                    <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
                        <Button type="button" variant="outline" onClick={() => { setDetailOpen(false); setPaymentOpen(false); setDetailDebt(null); }} className="rounded-xl">Tutup</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ActionConfirmDialog
                open={confirmOpen}
                onOpenChange={(v) => { setConfirmOpen(v); if (!v) setPendingConfirmAction(null); }}
                kind="delete"
                title="Konfirmasi Hapus"
                description={confirmText}
                confirmLabel="Ya, Hapus"
                onConfirm={async () => { await pendingConfirmAction?.(); }}
                size="sm"
            />
        </div>
    );
}
