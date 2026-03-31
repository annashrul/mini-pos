"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { createExpense, updateExpense, deleteExpense, getExpenses } from "@/features/expenses";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { SmartColumn } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { Expense } from "@/types";
import { useBranch } from "@/components/providers/branch-provider";

interface Props {
    initialData: {
        expenses: Expense[];
        total: number;
        totalPages: number;
    };
}

export function ExpensesContent({ initialData }: Props) {
    const [data, setData] = useState(initialData);
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
    const [sortKey, setSortKey] = useState<string>("");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();
    const { selectedBranchId } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);
    useEffect(() => {
        if (prevBranchRef.current !== selectedBranchId) { prevBranchRef.current = selectedBranchId; setPage(1); fetchData({ page: 1 }); } else if (selectedBranchId) { fetchData({}); }
    }, [selectedBranchId]);

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

    const handleSubmit = async (formData: FormData) => {
        const result = editing
            ? await updateExpense(editing.id, formData)
            : await createExpense(formData);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success(editing ? "Pengeluaran berhasil diupdate" : "Pengeluaran berhasil ditambahkan");
            setOpen(false);
            setEditing(null);
            fetchData({});
        }
    };

    const handleDelete = async (id: string) => {
        setConfirmText("Yakin ingin menghapus pengeluaran ini?");
        setPendingConfirmAction(() => async () => {
            const result = await deleteExpense(id);
            if (result.error) toast.error(result.error);
            else { toast.success("Pengeluaran berhasil dihapus"); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const handleBulkDelete = async (ids: string[]) => {
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

    const columns: SmartColumn<Expense>[] = [
        {
            key: "date", header: "Tanggal", sortable: true, width: "130px",
            render: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(row.date), "dd MMM yyyy", { locale: idLocale })}</span>,
            exportValue: (row) => format(new Date(row.date), "dd/MM/yyyy"),
        },
        {
            key: "branch", header: "Lokasi",
            render: (row) => <span className="text-xs">{(row as unknown as { branch?: { name: string } | null }).branch?.name ?? "Semua"}</span>,
            exportValue: (row) => (row as unknown as { branch?: { name: string } | null }).branch?.name ?? "Semua",
        },
        {
            key: "category", header: "Kategori", sortable: true,
            render: (row) => <Badge variant="secondary" className="rounded-lg text-xs">{row.category}</Badge>,
            exportValue: (row) => row.category,
        },
        {
            key: "description", header: "Deskripsi", sortable: true,
            render: (row) => <span className="text-sm text-muted-foreground">{row.description}</span>,
            exportValue: (row) => row.description,
        },
        {
            key: "amount", header: "Jumlah", sortable: true, align: "right",
            render: (row) => <span className="text-xs font-medium text-red-600">{formatCurrency(row.amount)}</span>,
            exportValue: (row) => row.amount,
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "90px",
            render: (row) => (
                <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEditDialog(row)}>
                        <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(row.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Pengeluaran</h1>
                    <p className="text-muted-foreground text-sm">Kelola pengeluaran operasional</p>
                </div>
                <Button className="rounded-lg" onClick={openCreateDialog}>
                    <Plus className="w-4 h-4 mr-2" /> Tambah Pengeluaran
                </Button>
            </div>

            <SmartTable<Expense>
                data={data.expenses}
                columns={columns}
                totalItems={data.total}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Daftar Pengeluaran"
                titleIcon={<Wallet className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari pengeluaran..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1); fetchData({ page: 1, sortKey: key, sortDir: dir }); }}
                selectable
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                rowKey={(row) => row.id}
                bulkActions={[
                    { label: "Hapus", variant: "destructive", icon: <Trash2 className="w-3 h-3" />, onClick: handleBulkDelete },
                ]}
                exportFilename="pengeluaran"
                emptyIcon={<Wallet className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Tidak ada pengeluaran ditemukan"
                emptyAction={
                    <Button variant="outline" size="sm" className="rounded-lg mt-2" onClick={openCreateDialog}>
                        <Plus className="w-3 h-3 mr-1" /> Tambah Pengeluaran
                    </Button>
                }
            />

            {/* Expense Form Dialog */}
            <Dialog open={open} onOpenChange={(v) => { if (v) setOpen(true); else closeDialog(); }}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit Pengeluaran" : "Tambah Pengeluaran"}</DialogTitle>
                    </DialogHeader>
                    <form action={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="category">Kategori</Label>
                            <Input id="category" name="category" defaultValue={editing?.category || ""} required className="rounded-lg" placeholder="Listrik, Air, dll" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Deskripsi</Label>
                            <Input id="description" name="description" defaultValue={editing?.description || ""} required className="rounded-lg" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Jumlah (Rp)</Label>
                                <Input id="amount" name="amount" type="number" defaultValue={editing?.amount || ""} required className="rounded-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date">Tanggal</Label>
                                <DatePicker value={formDate} onChange={setFormDate} className="rounded-lg" />
                                <input id="date" name="date" value={formDate} readOnly className="hidden" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-lg">Batal</Button>
                            <Button type="submit" className="rounded-lg">{editing ? "Update" : "Simpan"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Konfirmasi</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">{confirmText}</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-lg">Batal</Button>
                        <Button variant="destructive" onClick={async () => { await pendingConfirmAction?.(); }} className="rounded-lg">Ya, Lanjutkan</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
