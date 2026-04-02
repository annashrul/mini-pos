"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createExpense, deleteExpense, getExpenses, updateExpense } from "@/features/expenses";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
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
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canDelete = canAction("delete");
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
    }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (formData: FormData) => {
        if (editing ? !canUpdate : !canCreate) { toast.error(cannotMessage(editing ? "update" : "create")); return; }
        const result = editing ? await updateExpense(editing.id, formData) : await createExpense(formData);
        if (result.error) {
            toast.error(result.error);
            return;
        }
        toast.success(editing ? "Pengeluaran berhasil diupdate" : "Pengeluaran berhasil ditambahkan");
        setOpen(false);
        setEditing(null);
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
        setFormDate(format(new Date(), "yyyy-MM-dd"));
        setOpen(true);
    };

    const openEditDialog = (expense: Expense) => {
        setEditing(expense);
        setFormDate(format(new Date(expense.date), "yyyy-MM-dd"));
        setOpen(true);
    };

    const closeDialog = () => {
        setOpen(false);
        setEditing(null);
        setFormDate(format(new Date(), "yyyy-MM-dd"));
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
        <div className="space-y-5">
            <div className="rounded-2xl border border-border/30 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Pengeluaran</h1>
                        <p className="text-slate-500 text-sm mt-1">Kelola pengeluaran operasional dengan gaya visual dashboard</p>
                    </div>
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                        <Button disabled={!canCreate} className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-white shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300" onClick={openCreateDialog}>
                            <Plus className="w-4 h-4 mr-2" /> Tambah Pengeluaran
                        </Button>
                    </DisabledActionTooltip>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-2xl border-border/30 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center shadow-md shadow-rose-200">
                                <Wallet className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">Total</span>
                        </div>
                        <p className="text-2xl font-bold tabular-nums text-slate-800">{formatCurrency(totalExpense)}</p>
                        <p className="text-xs uppercase tracking-wider text-slate-500 mt-1.5 font-medium">Halaman Aktif</p>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/30 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-md shadow-violet-200">
                                <CalendarDays className="w-5 h-5 text-white" />
                            </div>
                            <TrendingDown className="w-4 h-4 text-slate-300" />
                        </div>
                        <p className="text-2xl font-bold tabular-nums text-slate-800">{formatCurrency(thisMonthExpense)}</p>
                        <p className="text-xs uppercase tracking-wider text-slate-500 mt-1.5 font-medium">Bulan Ini</p>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/30 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200">
                                <ReceiptText className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">{data.total} data</span>
                        </div>
                        <p className="text-2xl font-bold tabular-nums text-slate-800">{categoriesCount}</p>
                        <p className="text-xs uppercase tracking-wider text-slate-500 mt-1.5 font-medium">Kategori Tercatat</p>
                    </CardContent>
                </Card>
            </div>

            {/* Expense List */}
            <div className="rounded-2xl border border-border/30 bg-white shadow-sm">
                {/* Search bar & bulk actions */}
                <div className="flex items-center justify-between gap-3 p-4 border-b border-border/20">
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
                            <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
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
                <div className="p-4 space-y-6">
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
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Wallet className="w-10 h-10 text-muted-foreground/30 mb-3" />
                            <p className="text-sm font-medium text-slate-500">Tidak ada pengeluaran ditemukan</p>
                            <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                                <Button disabled={!canCreate} variant="outline" size="sm" className="rounded-full mt-3" onClick={openCreateDialog}>
                                    <Plus className="w-3 h-3 mr-1" /> Tambah Pengeluaran
                                </Button>
                            </DisabledActionTooltip>
                        </div>
                    ) : (
                        <div className={loading ? "opacity-50 pointer-events-none transition-opacity" : ""}>
                        {groupedExpenses.map((group) => (
                            <div key={group.date}>
                                {/* Date header */}
                                <div className="flex items-center gap-2 mb-3">
                                    <CalendarDays className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm font-semibold text-slate-700">
                                        {format(new Date(group.date), "EEEE, dd MMMM yyyy", { locale: idLocale })}
                                    </span>
                                    <div className="flex-1 h-px bg-border/40" />
                                </div>

                                {/* Expense items */}
                                <div className="space-y-2">
                                    {group.items.map((expense) => {
                                        const colorIdx = hashCategory(expense.category);
                                        const gradient = CATEGORY_COLORS[colorIdx];
                                        const branchName = (expense as unknown as { branch?: { name: string } | null }).branch?.name;

                                        return (
                                            <div
                                                key={expense.id}
                                                className="rounded-xl border border-border/30 bg-white hover:shadow-sm transition-all group px-4 py-3 flex items-center gap-4"
                                            >
                                                {/* Checkbox */}
                                                <Checkbox
                                                    checked={selectedRows.has(expense.id)}
                                                    onCheckedChange={() => toggleRow(expense.id)}
                                                    className="shrink-0"
                                                />

                                                {/* Category color circle */}
                                                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                                                    <Wallet className="w-4 h-4 text-white" />
                                                </div>

                                                {/* Middle: description, category, branch */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 truncate">{expense.description}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-600 text-[11px] px-2 py-0 border-0 font-medium">
                                                            {expense.category}
                                                        </Badge>
                                                        {branchName && (
                                                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                                                <MapPin className="w-3 h-3" />
                                                                {branchName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right: amount & actions */}
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className="text-sm font-bold font-mono tabular-nums text-rose-600">
                                                        {formatCurrency(expense.amount)}
                                                    </span>
                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                                                            <Button
                                                                disabled={!canUpdate}
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                                                                onClick={() => openEditDialog(expense)}
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </DisabledActionTooltip>
                                                        <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                                                            <Button
                                                                disabled={!canDelete}
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => handleDelete(expense.id)}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </DisabledActionTooltip>
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
                        onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                    />
                </div>
            </div>

            <Dialog open={open} onOpenChange={(v) => { if (v) setOpen(true); else closeDialog(); }}>
                <DialogContent className="rounded-2xl max-w-md">
                    <div className="h-1 bg-gradient-to-r from-rose-400 to-orange-400 -mt-6 mb-2 rounded-t-2xl" />
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">{editing ? "Edit Pengeluaran" : "Tambah Pengeluaran"}</DialogTitle>
                    </DialogHeader>
                    <form action={handleSubmit} className={`space-y-4 mt-4 ${editing ? (!canUpdate ? "pointer-events-none opacity-70" : "") : (!canCreate ? "pointer-events-none opacity-70" : "")}`}>
                        <div className="space-y-2">
                            <Label htmlFor="category">Kategori</Label>
                            <Input id="category" name="category" defaultValue={editing?.category || ""} required className="rounded-xl h-10" placeholder="Listrik, Air, dll" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Deskripsi</Label>
                            <Input id="description" name="description" defaultValue={editing?.description || ""} required className="rounded-xl h-10" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Jumlah (Rp)</Label>
                                <Input id="amount" name="amount" type="number" defaultValue={editing?.amount || ""} required className="rounded-xl h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date">Tanggal</Label>
                                <DatePicker value={formDate} onChange={setFormDate} className="rounded-xl h-10" />
                                <input id="date" name="date" value={formDate} readOnly className="hidden" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-full">Batal</Button>
                            <DisabledActionTooltip disabled={editing ? !canUpdate : !canCreate} message={cannotMessage(editing ? "update" : "create")}>
                                <Button disabled={editing ? !canUpdate : !canCreate} type="submit" className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white">{editing ? "Update" : "Simpan"}</Button>
                            </DisabledActionTooltip>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <div className="h-1 bg-gradient-to-r from-red-400 to-orange-400 -mt-6 mb-2 rounded-t-2xl" />
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">Konfirmasi</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-500 mt-2">{confirmText}</p>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-full">Batal</Button>
                        <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                            <Button disabled={!canDelete} variant="destructive" onClick={async () => { await pendingConfirmAction?.(); }} className="rounded-full">Ya, Lanjutkan</Button>
                        </DisabledActionTooltip>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
