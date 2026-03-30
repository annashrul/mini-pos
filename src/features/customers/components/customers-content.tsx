"use client";

import { useState, useTransition } from "react";
import { createCustomer, updateCustomer, deleteCustomer, getCustomers } from "@/features/customers";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { SmartSelect } from "@/components/ui/smart-select";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import type { Customer } from "@/types";

interface Props {
    initialData: {
        customers: Customer[];
        total: number;
        totalPages: number;
    };
}

const memberColors: Record<string, string> = {
    REGULAR: "bg-slate-100 text-slate-700",
    SILVER: "bg-gray-100 text-gray-700",
    GOLD: "bg-yellow-100 text-yellow-700",
    PLATINUM: "bg-purple-100 text-purple-700",
};

export function CustomersContent({ initialData }: Props) {
    const [data, setData] = useState(initialData);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Customer | null>(null);
    const [formMemberLevel, setFormMemberLevel] = useState("REGULAR");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        memberLevel: "ALL",
    });
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [sortKey, setSortKey] = useState<string>("");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(f.memberLevel !== "ALL" ? { memberLevel: f.memberLevel } : {}),
                ...(sk ? { sortBy: sk, sortDir: sd } : {}),
            };
            const result = await getCustomers(query);
            setData(result);
        });
    };

    const handleSubmit = async (formData: FormData) => {
        const result = editing
            ? await updateCustomer(editing.id, formData)
            : await createCustomer(formData);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success(editing ? "Customer berhasil diupdate" : "Customer berhasil ditambahkan");
            setOpen(false);
            setEditing(null);
            fetchData({});
        }
    };

    const handleDelete = async (id: string) => {
        setConfirmText("Yakin ingin menghapus customer ini?");
        setPendingConfirmAction(() => async () => {
            const result = await deleteCustomer(id);
            if (result.error) toast.error(result.error);
            else { toast.success("Customer berhasil dihapus"); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const handleBulkDelete = async (ids: string[]) => {
        setConfirmText(`Yakin ingin menghapus ${ids.length} customer?`);
        setPendingConfirmAction(() => async () => {
            for (const id of ids) await deleteCustomer(id);
            toast.success(`${ids.length} customer dihapus`);
            setSelectedRows(new Set());
            fetchData({});
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const openCreateDialog = () => {
        setEditing(null);
        setFormMemberLevel("REGULAR");
        setOpen(true);
    };

    const openEditDialog = (customer: Customer) => {
        setEditing(customer);
        setFormMemberLevel(customer.memberLevel);
        setOpen(true);
    };

    const closeDialog = () => {
        setOpen(false);
        setEditing(null);
        setFormMemberLevel("REGULAR");
    };

    const columns: SmartColumn<Customer>[] = [
        {
            key: "name", header: "Nama", sortable: true,
            render: (row) => <span className="font-medium text-sm">{row.name}</span>,
            exportValue: (row) => row.name,
        },
        {
            key: "phone", header: "No. HP", sortable: true,
            render: (row) => <span className="text-xs text-muted-foreground">{row.phone || "-"}</span>,
            exportValue: (row) => row.phone || "-",
        },
        {
            key: "email", header: "Email", sortable: true,
            render: (row) => <span className="text-xs text-muted-foreground">{row.email || "-"}</span>,
            exportValue: (row) => row.email || "-",
        },
        {
            key: "memberLevel", header: "Level", sortable: true, align: "center",
            render: (row) => <Badge className={memberColors[row.memberLevel] || ""}>{row.memberLevel}</Badge>,
            exportValue: (row) => row.memberLevel,
        },
        {
            key: "totalSpending", header: "Total Belanja", sortable: true, align: "right",
            render: (row) => <span className="text-xs font-medium">{formatCurrency(row.totalSpending)}</span>,
            exportValue: (row) => row.totalSpending,
        },
        {
            key: "points", header: "Poin", sortable: true, align: "center",
            render: (row) => <span className="text-xs">{row.points}</span>,
            exportValue: (row) => row.points,
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

    const filters: SmartFilter[] = [
        {
            key: "memberLevel", label: "Level Member", type: "select",
            options: [
                { value: "REGULAR", label: "Regular" },
                { value: "SILVER", label: "Silver" },
                { value: "GOLD", label: "Gold" },
                { value: "PLATINUM", label: "Platinum" },
            ],
        },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Customer</h1>
                    <p className="text-muted-foreground text-sm">Kelola data pelanggan Anda</p>
                </div>
                <Button className="rounded-lg" onClick={openCreateDialog}>
                    <Plus className="w-4 h-4 mr-2" /> Tambah Customer
                </Button>
            </div>

            <SmartTable<Customer>
                data={data.customers}
                columns={columns}
                totalItems={data.total}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Daftar Customer"
                titleIcon={<Users className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari customer..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1); fetchData({ page: 1, sortKey: key, sortDir: dir }); }}
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
                selectable
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                rowKey={(row) => row.id}
                bulkActions={[
                    { label: "Hapus", variant: "destructive", icon: <Trash2 className="w-3 h-3" />, onClick: handleBulkDelete },
                ]}
                exportFilename="customer"
                emptyIcon={<Users className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Tidak ada customer ditemukan"
                emptyAction={
                    <Button variant="outline" size="sm" className="rounded-lg mt-2" onClick={openCreateDialog}>
                        <Plus className="w-3 h-3 mr-1" /> Tambah Customer
                    </Button>
                }
            />

            {/* Customer Form Dialog */}
            <Dialog open={open} onOpenChange={(v) => { if (v) setOpen(true); else closeDialog(); }}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit Customer" : "Tambah Customer"}</DialogTitle>
                    </DialogHeader>
                    <form action={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama</Label>
                            <Input id="name" name="name" defaultValue={editing?.name || ""} required className="rounded-lg" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">No. HP</Label>
                                <Input id="phone" name="phone" defaultValue={editing?.phone || ""} className="rounded-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" defaultValue={editing?.email || ""} className="rounded-lg" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Alamat</Label>
                            <Input id="address" name="address" defaultValue={editing?.address || ""} className="rounded-lg" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="memberLevel">Level Member</Label>
                            <SmartSelect
                                value={formMemberLevel}
                                onChange={setFormMemberLevel}
                                onSearch={async (query) =>
                                    [
                                        { value: "REGULAR", label: "Regular" },
                                        { value: "SILVER", label: "Silver" },
                                        { value: "GOLD", label: "Gold" },
                                        { value: "PLATINUM", label: "Platinum" },
                                    ].filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))
                                }
                            />
                            <input type="hidden" name="memberLevel" value={formMemberLevel} />
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
