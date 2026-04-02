"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getDebts, getDebtById, createDebt, updateDebt, deleteDebt, addDebtPayment, getDebtSummary } from "@/features/debts";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useBranch } from "@/components/providers/branch-provider";
import { useMenuActionAccess } from "@/features/access-control";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
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
    const [loading, startTransition] = useTransition();

    // dialogs
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<DebtItem | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailDebt, setDetailDebt] = useState<DebtItem | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);

    // form state
    const [formType, setFormType] = useState("PAYABLE");
    const [formPartyType, setFormPartyType] = useState("SUPPLIER");
    const [formDueDate, setFormDueDate] = useState("");

    // payment form state
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("CASH");
    const [paymentNotes, setPaymentNotes] = useState("");
    const [paymentLoading, setPaymentLoading] = useState(false);

    // access control
    const { canAction, cannotMessage } = useMenuActionAccess("debts");
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canDelete = canAction("delete");

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
        setFormType("PAYABLE");
        setFormPartyType("SUPPLIER");
        setFormDueDate("");
        setFormOpen(true);
    };

    const openEditDialog = (debt: DebtItem) => {
        if (!canUpdate) { toast.error(cannotMessage("update")); return; }
        setEditing(debt);
        setFormType(debt.type);
        setFormPartyType(debt.partyType);
        setFormDueDate(debt.dueDate ? format(new Date(debt.dueDate), "yyyy-MM-dd") : "");
        setFormOpen(true);
    };

    const closeFormDialog = () => {
        setFormOpen(false);
        setEditing(null);
    };

    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const partyName = (form.elements.namedItem("partyName") as HTMLInputElement).value;
        const description = (form.elements.namedItem("description") as HTMLInputElement).value;
        const totalAmount = parseFloat((form.elements.namedItem("totalAmount") as HTMLInputElement).value);

        if (!partyName || !totalAmount) {
            toast.error("Nama pihak dan jumlah wajib diisi");
            return;
        }

        if (editing) {
            const result = await updateDebt(editing.id, {
                partyType: formPartyType,
                partyName,
                ...(description ? { description } : {}),
                totalAmount,
                dueDate: formDueDate || null,
            });
            if (result.error) { toast.error(result.error); return; }
            toast.success("Data hutang/piutang berhasil diupdate");
        } else {
            const result = await createDebt({
                type: formType as "PAYABLE" | "RECEIVABLE",
                partyType: formPartyType,
                partyName,
                ...(description ? { description } : {}),
                totalAmount,
                ...(formDueDate ? { dueDate: formDueDate } : {}),
                ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
            });
            if (result.error) { toast.error(result.error); return; }
            toast.success("Data hutang/piutang berhasil ditambahkan");
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
        setPaymentAmount("");
        setPaymentMethod("CASH");
        setPaymentNotes("");
        setPaymentOpen(true);
    };

    const handleAddPayment = async () => {
        if (!detailDebt) return;
        const amount = parseFloat(paymentAmount);
        if (!amount || amount <= 0) {
            toast.error("Jumlah pembayaran harus lebih dari 0");
            return;
        }

        setPaymentLoading(true);
        const result = await addDebtPayment({
            debtId: detailDebt.id,
            amount,
            method: paymentMethod,
            ...(paymentNotes ? { notes: paymentNotes } : {}),
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
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-200/50">
                        <Wallet className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Hutang Piutang</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">Kelola hutang dan piutang usaha Anda</p>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                    <Button
                        disabled={!canCreate}
                        className="rounded-xl shadow-md shadow-amber-200/30 hover:shadow-lg hover:shadow-amber-300/40 transition-all bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                        onClick={openCreateDialog}
                    >
                        <Plus className="w-4 h-4 mr-2" /> Tambah
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-red-100">
                    <ArrowDownCircle className="w-3.5 h-3.5" />
                    Hutang <span className="font-mono tabular-nums font-bold">{formatCurrency(summary.totalPayableRemaining)}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-emerald-100">
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    Piutang <span className="font-mono tabular-nums font-bold">{formatCurrency(summary.totalReceivableRemaining)}</span>
                </div>
                {summary.overdueCount > 0 && (
                    <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-500 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-red-100 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">{summary.overdueCount}</span> Jatuh Tempo
                    </div>
                )}
                {partialCount > 0 && (
                    <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-amber-100">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">{partialCount}</span> Sebagian Dibayar
                    </div>
                )}
            </div>

            {/* Filter Tabs */}
            <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        {typeFilterOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => handleTypeFilter(opt.value)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${typeFilter === opt.value
                                    ? "bg-foreground text-background shadow-sm"
                                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <div className="h-4 w-px bg-border/40" />
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {statusFilterOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => handleStatusFilter(opt.value)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === opt.value
                                    ? "bg-foreground text-background shadow-sm"
                                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Search Bar */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
                        <Input
                            placeholder="Cari nama pihak, deskripsi..."
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9 pr-9 rounded-xl h-10"
                        />
                    </div>
                </div>
            </div>

            {/* Card List */}
            <div className="space-y-3">
                {loading && data.debts.length === 0 ? (
                    <>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-xl border bg-white p-4 border-l-4 border-l-slate-200">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <Skeleton className="h-4 w-40" />
                                        <Skeleton className="h-3 w-28" />
                                        <Skeleton className="h-3 w-36" />
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0">
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
                        <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                            <Button disabled={!canCreate} variant="outline" size="sm" className="rounded-full mt-3" onClick={openCreateDialog}>
                                <Plus className="w-3 h-3 mr-1" /> Tambah
                            </Button>
                        </DisabledActionTooltip>
                    </div>
                ) : (
                    <div className={loading ? "space-y-3 opacity-50 pointer-events-none transition-opacity" : "space-y-3"}>
                        {data.debts.map((debt) => {
                            const isPayable = debt.type === "PAYABLE";
                            const statusInfo = getStatusDisplay(debt);
                            const StatusIcon = statusInfo.icon;
                            const pct = progressPercent(debt);

                            return (
                                <div
                                    key={debt.id}
                                    className={`rounded-xl border bg-white hover:shadow-md transition-all group p-4 border-l-4 ${isPayable ? "border-l-red-500" : "border-l-emerald-500"
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Left: Type Icon */}
                                        <div
                                            className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${isPayable
                                                ? "bg-gradient-to-br from-red-100 to-red-50 text-red-600"
                                                : "bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600"
                                                }`}
                                        >
                                            {isPayable ? (
                                                <ArrowDownCircle className="w-5 h-5" />
                                            ) : (
                                                <ArrowUpCircle className="w-5 h-5" />
                                            )}
                                        </div>

                                        {/* Middle: Info */}
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-foreground truncate">{debt.partyName}</p>
                                                <Badge className={`text-[10px] font-medium px-2 py-0 rounded-full border-0 shrink-0 ${isPayable
                                                    ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm shadow-red-200"
                                                    : "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-sm shadow-emerald-200"
                                                    }`}>
                                                    {isPayable ? "Hutang" : "Piutang"}
                                                </Badge>
                                            </div>
                                            {debt.description && (
                                                <p className="text-xs text-muted-foreground truncate">{debt.description}</p>
                                            )}
                                            {debt.referenceType && debt.referenceId && (
                                                <p className="text-xs text-muted-foreground/60 truncate">
                                                    Ref: {debt.referenceType} #{debt.referenceId.slice(0, 8)}
                                                </p>
                                            )}
                                            {debt.dueDate && (
                                                <div className={`flex items-center gap-1.5 text-xs ${isOverdue(debt) ? "text-red-500" : "text-muted-foreground"
                                                    }`}>
                                                    <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${isOverdue(debt) ? "text-red-400" : "text-muted-foreground/60"
                                                        }`} />
                                                    <span className="font-mono tabular-nums">
                                                        Jatuh tempo: {format(new Date(debt.dueDate), "dd MMM yyyy", { locale: idLocale })}
                                                    </span>
                                                    {isOverdue(debt) && (
                                                        <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded ml-0.5">Lewat</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Right: Amount + Progress + Status + Actions */}
                                        <div className="flex items-center gap-4 shrink-0">
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
                                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-colors"
                                                    onClick={() => openDetailDialog(debt)}
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </Button>
                                                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
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
                                                <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
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
                <DialogContent className="rounded-2xl max-w-md">
                    <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500 -mt-6 mb-2 rounded-t-2xl" />
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">
                            {editing ? "Edit Hutang/Piutang" : "Tambah Hutang/Piutang"}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleFormSubmit} className="min-h-0 flex flex-col">
                        <DialogBody className="space-y-4">
                            {/* Type */}
                            {!editing && (
                                <div className="space-y-2">
                                    <Label>Tipe</Label>
                                    <Select value={formType} onValueChange={setFormType}>
                                        <SelectTrigger className="rounded-xl h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PAYABLE">Hutang (Kita Berhutang)</SelectItem>
                                            <SelectItem value="RECEIVABLE">Piutang (Orang Berhutang ke Kita)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Party Type */}
                            <div className="space-y-2">
                                <Label>Jenis Pihak</Label>
                                <Select value={formPartyType} onValueChange={setFormPartyType}>
                                    <SelectTrigger className="rounded-xl h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {partyTypeOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Party Name */}
                            <div className="space-y-2">
                                <Label htmlFor="partyName">Nama Pihak</Label>
                                <Input
                                    id="partyName"
                                    name="partyName"
                                    defaultValue={editing?.partyName || ""}
                                    required
                                    className="rounded-xl h-10"
                                    placeholder="Nama supplier / customer / lainnya"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="description">Deskripsi</Label>
                                <Input
                                    id="description"
                                    name="description"
                                    defaultValue={editing?.description || ""}
                                    className="rounded-xl h-10"
                                    placeholder="Keterangan (opsional)"
                                />
                            </div>

                            {/* Amount + Due Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="totalAmount">Jumlah (Rp)</Label>
                                    <Input
                                        id="totalAmount"
                                        name="totalAmount"
                                        type="number"
                                        step="any"
                                        defaultValue={editing?.totalAmount || ""}
                                        required
                                        className="rounded-xl h-10"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Jatuh Tempo</Label>
                                    <DatePicker value={formDueDate} onChange={setFormDueDate} className="rounded-xl h-10" />
                                </div>
                            </div>
                        </DialogBody>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeFormDialog} className="rounded-full">Batal</Button>
                            <DisabledActionTooltip disabled={editing ? !canUpdate : !canCreate} message={cannotMessage(editing ? "update" : "create")}>
                                <Button
                                    disabled={editing ? !canUpdate : !canCreate}
                                    type="submit"
                                    className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                                >
                                    {editing ? "Update" : "Simpan"}
                                </Button>
                            </DisabledActionTooltip>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ============ Detail Dialog ============ */}
            <Dialog
                open={detailOpen}
                onOpenChange={(v) => {
                    setDetailOpen(v);
                    if (!v) {
                        setPaymentOpen(false);
                        setDetailDebt(null);
                    }
                }}
            >
                <DialogContent className="rounded-2xl max-w-lg max-h-[85vh]">
                    <div className={`h-1 -mt-6 mb-2 rounded-t-2xl ${detailDebt?.type === "PAYABLE"
                        ? "bg-gradient-to-r from-red-400 to-rose-500"
                        : "bg-gradient-to-r from-emerald-400 to-green-500"
                        }`} />
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">Detail Hutang/Piutang</DialogTitle>
                    </DialogHeader>

                    <DialogBody className="space-y-5">
                        {detailDebt && (
                            <>
                                <div className="rounded-xl bg-slate-50 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {detailDebt.type === "PAYABLE" ? (
                                                <ArrowDownCircle className="w-5 h-5 text-red-500" />
                                            ) : (
                                                <ArrowUpCircle className="w-5 h-5 text-emerald-500" />
                                            )}
                                            <span className="font-bold text-foreground">{detailDebt.partyName}</span>
                                        </div>
                                        <Badge className={`${detailDebt.type === "PAYABLE"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-emerald-100 text-emerald-700"
                                            } rounded-full text-xs border-0`}>
                                            {detailDebt.type === "PAYABLE" ? "Hutang" : "Piutang"}
                                        </Badge>
                                    </div>

                                    {detailDebt.description && (
                                        <p className="text-sm text-muted-foreground">{detailDebt.description}</p>
                                    )}

                                    <div className="grid grid-cols-3 gap-3 pt-2">
                                        <div className="text-center">
                                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total</p>
                                            <p className="text-sm font-bold font-mono tabular-nums">{formatCurrency(detailDebt.totalAmount)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Terbayar</p>
                                            <p className="text-sm font-bold font-mono tabular-nums text-emerald-600">{formatCurrency(detailDebt.paidAmount)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Sisa</p>
                                            <p className="text-sm font-bold font-mono tabular-nums text-red-600">{formatCurrency(detailDebt.remainingAmount)}</p>
                                        </div>
                                    </div>

                                    <div className="pt-1">
                                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${progressPercent(detailDebt) >= 100
                                                    ? "bg-emerald-500"
                                                    : progressPercent(detailDebt) > 0
                                                        ? "bg-amber-500"
                                                        : "bg-slate-300"
                                                    }`}
                                                style={{ width: `${progressPercent(detailDebt)}%` }}
                                            />
                                        </div>
                                        <p className="text-[11px] text-muted-foreground text-right mt-1 font-mono">{progressPercent(detailDebt)}% terbayar</p>
                                    </div>

                                    <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                                        {detailDebt.dueDate && (
                                            <span className="flex items-center gap-1">
                                                <CalendarDays className="w-3 h-3" />
                                                {format(new Date(detailDebt.dueDate), "dd MMM yyyy", { locale: idLocale })}
                                            </span>
                                        )}
                                        <span>Oleh: {detailDebt.creator.name}</span>
                                        {detailDebt.branch && <span>{detailDebt.branch.name}</span>}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-bold text-slate-700">Riwayat Pembayaran</h3>
                                        {detailDebt.status !== "PAID" && (
                                            <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                                                <Button
                                                    disabled={!canCreate}
                                                    size="sm"
                                                    className="rounded-full h-7 text-xs bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                                                    onClick={openPaymentForm}
                                                >
                                                    <Plus className="w-3 h-3 mr-1" /> Tambah Pembayaran
                                                </Button>
                                            </DisabledActionTooltip>
                                        )}
                                    </div>

                                    {(detailDebt.payments as DebtPaymentItem[]).length === 0 ? (
                                        <div className="text-center py-6 text-muted-foreground/60">
                                            <Banknote className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p className="text-xs">Belum ada pembayaran</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {(detailDebt.payments as DebtPaymentItem[]).map((payment) => (
                                                <div key={payment.id} className="rounded-lg border border-border/30 bg-white p-3 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                                        <CreditCard className="w-4 h-4 text-emerald-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-foreground font-mono tabular-nums">
                                                            {formatCurrency(payment.amount)}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                            <span>{payment.method}</span>
                                                            <span>&middot;</span>
                                                            <span>{payment.payer.name}</span>
                                                            {payment.notes && (
                                                                <>
                                                                    <span>&middot;</span>
                                                                    <span className="truncate">{payment.notes}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="text-[11px] text-muted-foreground font-mono tabular-nums shrink-0">
                                                        {format(new Date(payment.paidAt), "dd/MM/yy HH:mm")}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {paymentOpen && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 space-y-3">
                                        <h4 className="text-sm font-bold text-slate-700">Tambah Pembayaran</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Jumlah (Rp)</Label>
                                                <Input
                                                    type="number"
                                                    step="any"
                                                    value={paymentAmount}
                                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                                    className="rounded-xl h-9 text-sm"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Metode</Label>
                                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                                    <SelectTrigger className="rounded-xl h-9 text-sm">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {paymentMethodOptions.map((opt) => (
                                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Catatan (opsional)</Label>
                                            <Input
                                                value={paymentNotes}
                                                onChange={(e) => setPaymentNotes(e.target.value)}
                                                className="rounded-xl h-9 text-sm"
                                                placeholder="Catatan pembayaran"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="rounded-full h-8 text-xs"
                                                onClick={() => setPaymentOpen(false)}
                                            >
                                                Batal
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="rounded-full h-8 text-xs bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                                                onClick={handleAddPayment}
                                                disabled={paymentLoading}
                                            >
                                                {paymentLoading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                                Bayar
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </DialogBody>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setDetailOpen(false);
                                setPaymentOpen(false);
                                setDetailDebt(null);
                            }}
                            className="rounded-full"
                        >
                            Tutup
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ============ Delete Confirmation Dialog ============ */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <div className="h-1 bg-gradient-to-r from-red-400 to-orange-400 -mt-6 mb-2 rounded-t-2xl" />
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">Konfirmasi Hapus</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-500 mt-2">{confirmText}</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-full">
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={async () => { await pendingConfirmAction?.(); }}
                            className="rounded-full"
                        >
                            Ya, Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
