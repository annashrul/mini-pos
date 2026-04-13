"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createExpense, deleteExpense, getExpenses, updateExpense } from "@/features/expenses";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { CalendarDays, Loader2, MapPin, Pencil, Plus, ReceiptText, Search, Trash2, TrendingDown, Wallet } from "lucide-react";
import { PaginationControl } from "@/components/ui/pagination-control";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { Expense } from "@/types";
import { useBranch } from "@/components/providers/branch-provider";
import { useMenuActionAccess } from "@/features/access-control";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ExportMenu } from "@/components/ui/export-menu";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORY_COLORS = [
    "from-rose-400 to-pink-500",
    "from-violet-400 to-purple-500",
    "from-blue-400 to-indigo-500",
    "from-emerald-400 to-teal-500",
    "from-amber-400 to-orange-500",
    "from-cyan-400 to-sky-500",
    "from-fuchsia-400 to-pink-500",
    "from-lime-400 to-green-500",
    "from-red-400 to-rose-500",
    "from-indigo-400 to-blue-500",
];

const expenseSchema = z.object({
    category: z.string().min(1, "Kategori wajib diisi"),
    description: z.string().min(1, "Deskripsi wajib diisi"),
    amount: z.number().min(1, "Jumlah harus lebih dari 0"),
    date: z.string().min(1, "Tanggal wajib diisi"),
});
type ExpenseFormValues = z.infer<typeof expenseSchema>;

function hashCategory(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % CATEGORY_COLORS.length;
}

export function ExpensesContent() {
    const [data, setData] = useState<{ expenses: Expense[]; total: number; totalPages: number }>({ expenses: [], total: 0, totalPages: 0 });
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Expense | null>(null);
    const expenseForm = useForm<ExpenseFormValues>({
        resolver: zodResolver(expenseSchema),
        defaultValues: { category: "", description: "", amount: 0, date: format(new Date(), "yyyy-MM-dd") },
    });
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [sortKey] = useState<string>("");
    const [sortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();
    const { canAction, cannotMessage } = useMenuActionAccess("expenses");
    const { canAction: canPlan } = usePlanAccess();
    const canCreate = canAction("create") && canPlan("expenses", "create");
    const canUpdate = canAction("update") && canPlan("expenses", "update");
    const canDelete = canAction("delete") && canPlan("expenses", "delete");
    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; sortKey?: string; sortDir?: "asc" | "desc" }) => {
        startTransition(async () => {
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const result = await getExpenses({
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(sk ? { sortBy: sk, sortDir: sd } : {}),
                ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
            });
            setData(result);
        });
    };

    useEffect(() => {
        if (!branchReady) return;
        if (prevBranchRef.current !== selectedBranchId) {
            prevBranchRef.current = selectedBranchId;
            setPage(1);
            fetchData({ page: 1 });
        } else {
            fetchData({});
        }
    }, [selectedBranchId, branchReady]); // eslint-disable-line react-hooks/exhaustive-deps

    const onFormSubmit = async (values: ExpenseFormValues) => {
        if (editing ? !canUpdate : !canCreate) return;
        const formData = new FormData();
        formData.set("category", values.category);
        formData.set("description", values.description);
        formData.set("amount", String(values.amount));
        formData.set("date", values.date);
        if (selectedBranchId) formData.set("branchId", selectedBranchId);
        const result = editing ? await updateExpense(editing.id, formData) : await createExpense(formData);
        if (result.error) {
            toast.error(result.error);
            return;
        }
        toast.success(editing ? "Pengeluaran berhasil diupdate" : "Pengeluaran berhasil ditambahkan");
        setOpen(false);
        setEditing(null);
        expenseForm.reset();
        fetchData({});
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
        setConfirmText("Yakin ingin menghapus pengeluaran ini?");
        setPendingConfirmAction(() => async () => {
            const result = await deleteExpense(id);
            if (result.error) toast.error(result.error);
            else {
                toast.success("Pengeluaran berhasil dihapus");
                fetchData({});
            }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const handleBulkDelete = async (ids: string[]) => {
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
        setConfirmText(`Yakin ingin menghapus ${ids.length} pengeluaran?`);
        setPendingConfirmAction(() => async () => {
            for (const id of ids) await deleteExpense(id);
            toast.success(`${ids.length} pengeluaran dihapus`);
            setSelectedRows(new Set());
            fetchData({});
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const openCreateDialog = () => {
        setEditing(null);
        expenseForm.reset({ category: "", description: "", amount: 0, date: format(new Date(), "yyyy-MM-dd") });
        setOpen(true);
    };

    const openEditDialog = (expense: Expense) => {
        setEditing(expense);
        expenseForm.reset({
            category: expense.category,
            description: expense.description,
            amount: expense.amount,
            date: format(new Date(expense.date), "yyyy-MM-dd"),
        });
        setOpen(true);
    };

    const closeDialog = () => {
        setOpen(false);
        setEditing(null);
        expenseForm.reset();
    };

    const totalExpense = data.expenses.reduce((sum, item) => sum + item.amount, 0);
    const thisMonthExpense = data.expenses
        .filter((item) => {
            const d = new Date(item.date);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, item) => sum + item.amount, 0);
    const categoriesCount = new Set(data.expenses.map((item) => item.category.toLowerCase())).size;

    const groupedExpenses = useMemo(() => {
        const groups: { date: string; items: Expense[] }[] = [];
        let currentDate = "";
        for (const exp of data.expenses) {
            const d = format(new Date(exp.date), "yyyy-MM-dd");
            if (d !== currentDate) { currentDate = d; groups.push({ date: d, items: [] }); }
            groups[groups.length - 1]!.items.push(exp);
        }
        return groups;
    }, [data.expenses]);

    const handleSearch = (q: string) => {
        setSearch(q);
        setPage(1);
        fetchData({ search: q, page: 1 });
    };


    const toggleRow = (id: string) => {
        setSelectedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="space-y-4 sm:space-y-5">
            <div className="rounded-xl sm:rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200/50 shrink-0">
                            <Wallet className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-2xl font-bold text-slate-800">Pengeluaran</h1>
                            <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Kelola pengeluaran operasional</p>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                        <ExportMenu module="expenses" branchId={selectedBranchId || undefined} />
                        <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="expenses" actionKey="create">
                            <Button disabled={!canCreate} className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-white shadow-md shadow-blue-200 text-sm" onClick={openCreateDialog}>
                                <Plus className="w-4 h-4 mr-2" /> Tambah Pengeluaran
                            </Button>
                        </DisabledActionTooltip>
                    </div>
                </div>
            </div>
            {/* Mobile: Floating button */}
            {canCreate && (
                <div className="sm:hidden fixed bottom-4 right-4 z-50">
                    <Button onClick={openCreateDialog} size="icon" className="h-12 w-12 rounded-full shadow-xl shadow-blue-300/50 bg-gradient-to-br from-blue-600 to-indigo-600">
                        <Plus className="w-5 h-5" />
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                <Card className="rounded-xl sm:rounded-2xl border-border/30 shadow-sm hover:shadow-md transition-shadow py-0 gap-0">
                    <CardContent className="p-2.5 sm:p-5">
                        <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                            <div className="flex w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 items-center justify-center shadow-sm sm:shadow-md shadow-amber-200 shrink-0">
                                <ReceiptText className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                            </div>
                            <span className="text-[9px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">{data.total}</span>
                        </div>
                        <p className="text-xs sm:text-xl font-bold tabular-nums text-slate-800">{categoriesCount}</p>
                        <p className="text-[9px] sm:text-xs uppercase tracking-wider text-slate-500 mt-0.5 sm:mt-1.5 font-medium">Kategori</p>

                    </CardContent>
                </Card>
                <Card className="rounded-xl sm:rounded-2xl border-border/30 shadow-sm hover:shadow-md transition-shadow py-0 gap-0">
                    <CardContent className="p-2.5 sm:p-5">
                        <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                            <div className="flex w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 items-center justify-center shadow-sm sm:shadow-md shadow-violet-200 shrink-0">
                                <CalendarDays className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                            </div>
                            <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-slate-300" />
                        </div>
                        <p className="text-xs sm:text-xl font-bold tabular-nums text-slate-800 font-mono">{formatCurrency(thisMonthExpense)}</p>
                        <p className="text-[9px] sm:text-xs uppercase tracking-wider text-slate-500 mt-0.5 sm:mt-1.5 font-medium">Bulan Ini</p>
                    </CardContent>
                </Card>
                <Card className="col-span-2 lg:col-span-1 rounded-xl sm:rounded-2xl border-border/30 shadow-sm hover:shadow-md transition-shadow py-0 gap-0">
                    <CardContent className="p-2.5 sm:p-5">
                        <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                            <div className="flex w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-rose-500 to-red-500 items-center justify-center shadow-sm sm:shadow-md shadow-rose-200 shrink-0">
                                <Wallet className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                            </div>
                            <span className="text-[9px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">Total</span>
                        </div>
                        <p className="text-xs sm:text-xl font-bold tabular-nums text-slate-800 font-mono">{formatCurrency(totalExpense)}</p>
                        <p className="text-[9px] sm:text-xs uppercase tracking-wider text-slate-500 mt-0.5 sm:mt-1.5 font-medium">Halaman Aktif</p>

                    </CardContent>
                </Card>
            </div>

            {/* Expense List */}
            <div className="rounded-xl sm:rounded-2xl border border-border/30 bg-white shadow-sm">
                {/* Search bar & bulk actions */}
                <div className="flex items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 border-b border-border/20">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
                        <Input
                            placeholder="Cari pengeluaran..."
                            className="pl-9 pr-9 rounded-xl h-10 border-border/40"
                            defaultValue={search}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>
                    {selectedRows.size > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{selectedRows.size} dipilih</span>
                            <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="expenses" actionKey="delete">
                                <Button
                                    disabled={!canDelete}
                                    variant="destructive"
                                    size="sm"
                                    className="rounded-full h-8 px-3 text-xs"
                                    onClick={() => handleBulkDelete(Array.from(selectedRows))}
                                >
                                    <Trash2 className="w-3 h-3 mr-1" /> Hapus
                                </Button>
                            </DisabledActionTooltip>
                        </div>
                    )}
                </div>

                {/* Grouped expense list */}
                <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
                    {loading && data.expenses.length === 0 ? (
                        <div className="space-y-6">
                            {Array.from({ length: 2 }).map((_, gi) => (
                                <div key={gi}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Skeleton className="w-4 h-4 rounded" />
                                        <Skeleton className="h-4 w-48" />
                                        <div className="flex-1 h-px bg-border/40" />
                                    </div>
                                    <div className="space-y-2">
                                        {Array.from({ length: gi === 0 ? 3 : 1 }).map((_, i) => (
                                            <div key={i} className="rounded-xl border border-border/30 bg-white px-4 py-3 flex items-center gap-4">
                                                <Skeleton className="h-4 w-4 rounded" />
                                                <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                                                <div className="flex-1 min-w-0 space-y-1.5">
                                                    <Skeleton className="h-4 w-40" />
                                                    <Skeleton className="h-3 w-24 rounded-full" />
                                                </div>
                                                <Skeleton className="h-4 w-24" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : data.expenses.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center">
                            <Wallet className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground/30 mb-2 sm:mb-3" />
                            <p className="text-xs sm:text-sm font-medium text-slate-500">Tidak ada pengeluaran</p>
                        </div>
                    ) : (
                        <div className={loading ? "opacity-50 pointer-events-none transition-opacity" : ""}>
                            {groupedExpenses.map((group, groupIdx) => (
                                <div key={group.date} className={groupIdx > 0 ? "mt-3 sm:mt-6" : ""}>
                                    {/* Date header */}
                                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-3">
                                        <CalendarDays className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
                                        <span className="text-[11px] sm:text-sm font-semibold text-slate-700">
                                            {format(new Date(group.date), "EEE, dd MMM yyyy", { locale: idLocale })}
                                        </span>
                                        <div className="flex-1 h-px bg-border/40" />
                                    </div>

                                    {/* Expense items */}
                                    <div className="space-y-1.5 sm:space-y-2">
                                        {group.items.map((expense) => {
                                            const colorIdx = hashCategory(expense.category);
                                            const gradient = CATEGORY_COLORS[colorIdx];
                                            const branchName = (expense as unknown as { branch?: { name: string } | null }).branch?.name;

                                            return (
                                                <div key={expense.id} className="rounded-lg sm:rounded-xl border border-border/30 bg-white hover:shadow-sm transition-all group px-2.5 py-2 sm:px-4 sm:py-3 flex items-center gap-2 sm:gap-4">
                                                    {/* Checkbox */}
                                                    <Checkbox checked={selectedRows.has(expense.id)} onCheckedChange={() => toggleRow(expense.id)} className="shrink-0" />

                                                    {/* Category color dot (mobile) / circle (desktop) */}
                                                    <div className={`hidden sm:flex w-9 h-9 rounded-full bg-gradient-to-br ${gradient} items-center justify-center shrink-0 shadow-sm`}>
                                                        <Wallet className="w-4 h-4 text-white" />
                                                    </div>
                                                    <div className={`sm:hidden w-2 h-2 rounded-full bg-gradient-to-br ${gradient} shrink-0`} />

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{expense.description}</p>
                                                            <span className="text-[11px] sm:text-sm font-bold font-mono tabular-nums text-rose-600 shrink-0">
                                                                {formatCurrency(expense.amount)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                                                            <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-600 text-[9px] sm:text-[11px] px-1.5 sm:px-2 py-0 border-0 font-medium">
                                                                {expense.category}
                                                            </Badge>
                                                            {branchName && (
                                                                <span className="flex items-center gap-0.5 text-[9px] sm:text-[11px] text-slate-400">
                                                                    <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                                    {branchName}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-0.5 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                        <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="expenses" actionKey="update">
                                                            <Button disabled={!canUpdate} variant="ghost" size="icon-xs" className="rounded-md hover:bg-blue-50 hover:text-blue-600" onClick={() => openEditDialog(expense)}>
                                                                <Pencil className="w-3 h-3" />
                                                            </Button>
                                                        </DisabledActionTooltip>
                                                        <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="expenses" actionKey="delete">
                                                            <Button disabled={!canDelete} variant="ghost" size="icon-xs" className="rounded-md text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(expense.id)}>
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </DisabledActionTooltip>
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
                        onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                        onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                    />
                </div>
            </div>

            <Dialog open={open} onOpenChange={(v) => { if (v) setOpen(true); else closeDialog(); }}>
                <DialogContent className="rounded-xl sm:rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-md p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-rose-400 to-orange-400 shrink-0" />
                    <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-2 sm:pb-3 shrink-0">
                        <DialogTitle className="text-sm sm:text-lg font-bold text-slate-800">{editing ? "Edit Pengeluaran" : "Tambah Pengeluaran"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={expenseForm.handleSubmit(onFormSubmit)}>
                        <DialogBody className="px-4 sm:px-6 space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm">Kategori <span className="text-red-400">*</span></Label>
                                <Input {...expenseForm.register("category")} className="rounded-xl" placeholder="Listrik, Air, dll" />
                                {expenseForm.formState.errors.category && <p className="text-xs text-red-500">{expenseForm.formState.errors.category.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm">Deskripsi <span className="text-red-400">*</span></Label>
                                <Input {...expenseForm.register("description")} className="rounded-xl" placeholder="Keterangan pengeluaran" />
                                {expenseForm.formState.errors.description && <p className="text-xs text-red-500">{expenseForm.formState.errors.description.message}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs sm:text-sm">Jumlah <span className="text-red-400">*</span></Label>
                                    <Input type="number" {...expenseForm.register("amount", { valueAsNumber: true })} className="rounded-xl" placeholder="Rp 0" />
                                    {expenseForm.formState.errors.amount && <p className="text-xs text-red-500">{expenseForm.formState.errors.amount.message}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs sm:text-sm">Tanggal <span className="text-red-400">*</span></Label>
                                    <DatePicker value={expenseForm.watch("date")} onChange={(v) => expenseForm.setValue("date", v)} className="rounded-xl" />
                                    {expenseForm.formState.errors.date && <p className="text-xs text-red-500">{expenseForm.formState.errors.date.message}</p>}
                                </div>
                            </div>
                        </DialogBody>
                        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl">Batal</Button>
                            <Button disabled={(editing ? !canUpdate : !canCreate) || expenseForm.formState.isSubmitting} type="submit" className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                                {expenseForm.formState.isSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</> : editing ? "Update" : "Simpan"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ActionConfirmDialog
                open={confirmOpen}
                onOpenChange={(v) => { setConfirmOpen(v); if (!v) setPendingConfirmAction(null); }}
                kind="delete"
                title="Konfirmasi"
                description={confirmText}
                confirmLabel="Ya, Lanjutkan"
                onConfirm={async () => { await pendingConfirmAction?.(); }}
                confirmDisabled={!canDelete}
                size="sm"
            />
        </div>
    );
}
