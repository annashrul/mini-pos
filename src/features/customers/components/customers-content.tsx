"use client";

import { useEffect, useState, useMemo, useTransition , useRef } from "react";
import { createCustomer, updateCustomer, deleteCustomer, getCustomers } from "@/features/customers";
import { useMenuActionAccess } from "@/features/access-control";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { SmartSelect } from "@/components/ui/smart-select";
import { Plus, Pencil, Trash2, Users, Phone, Mail, Crown, Star, AlertTriangle, Heart, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { Customer } from "@/types";

const memberColors: Record<string, string> = {
    REGULAR: "bg-slate-100 text-slate-600 border border-slate-200",
    SILVER: "bg-gradient-to-r from-gray-400 to-slate-500 text-white shadow-sm",
    GOLD: "bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-sm",
    PLATINUM: "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-sm",
};

const avatarGradients = [
    "from-rose-400 to-pink-500",
    "from-violet-400 to-purple-500",
    "from-blue-400 to-indigo-500",
    "from-emerald-400 to-teal-500",
    "from-amber-400 to-orange-500",
    "from-cyan-400 to-sky-500",
    "from-fuchsia-400 to-pink-500",
    "from-lime-400 to-green-500",
];

function getAvatarGradient(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarGradients[Math.abs(hash) % avatarGradients.length]!;
}

export function CustomersContent() {
    const [data, setData] = useState<{ customers: Customer[]; total: number; totalPages: number }>({ customers: [], total: 0, totalPages: 0 });
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
    const { canAction, cannotMessage } = useMenuActionAccess("customers");
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canDelete = canAction("delete");

    const stats = useMemo(() => {
        const customers = data.customers;
        const total = data.total;
        const regular = customers.filter((c) => c.memberLevel === "REGULAR").length;
        const silver = customers.filter((c) => c.memberLevel === "SILVER").length;
        const gold = customers.filter((c) => c.memberLevel === "GOLD").length;
        const platinum = customers.filter((c) => c.memberLevel === "PLATINUM").length;
        const totalSpending = customers.reduce((sum, c) => sum + (c.totalSpending ?? 0), 0);
        const totalPoints = customers.reduce((sum, c) => sum + (c.points ?? 0), 0);
        return { total, regular, silver, gold, platinum, totalSpending, totalPoints };
    }, [data]);

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

    const didFetchRef = useRef(false);
    useEffect(() => {
        if (didFetchRef.current) return;
        didFetchRef.current = true;
        fetchData({});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (formData: FormData) => {
        if (editing ? !canUpdate : !canCreate) { toast.error(cannotMessage(editing ? "update" : "create")); return; }
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
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
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
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
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
        if (!canCreate) { toast.error(cannotMessage("create")); return; }
        setEditing(null);
        setFormMemberLevel("REGULAR");
        setOpen(true);
    };

    const openEditDialog = (customer: Customer) => {
        if (!canUpdate) { toast.error(cannotMessage("update")); return; }
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
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarGradient(row.name)} flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0`}>
                        {row.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <span className="font-semibold text-sm text-foreground block truncate">{row.name}</span>
                        {row.phone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />
                                {row.phone}
                            </span>
                        )}
                    </div>
                </div>
            ),
            exportValue: (row) => row.name,
        },
        {
            key: "email", header: "Email", sortable: true,
            render: (row) => (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {row.email ? (
                        <>
                            <Mail className="w-3.5 h-3.5 text-muted-foreground/60" />
                            {row.email}
                        </>
                    ) : (
                        <span className="text-muted-foreground/40">-</span>
                    )}
                </span>
            ),
            exportValue: (row) => row.email || "-",
        },
        {
            key: "memberLevel", header: "Level", sortable: true, align: "center",
            render: (row) => (
                <Badge className={`${memberColors[row.memberLevel] || ""} rounded-full px-2.5 py-0.5 text-[11px] font-medium`}>
                    {row.memberLevel === "PLATINUM" && <Crown className="w-3 h-3 mr-1" />}
                    {row.memberLevel === "GOLD" && <Star className="w-3 h-3 mr-1" />}
                    {row.memberLevel}
                </Badge>
            ),
            exportValue: (row) => row.memberLevel,
        },
        {
            key: "totalSpending", header: "Total Belanja", sortable: true, align: "right",
            render: (row) => (
                <span className="text-sm font-medium font-mono tabular-nums text-foreground">
                    {formatCurrency(row.totalSpending)}
                </span>
            ),
            exportValue: (row) => row.totalSpending,
        },
        {
            key: "points", header: "Poin", sortable: true, align: "center",
            render: (row) => (
                <span className="text-xs font-medium flex items-center justify-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    {row.points}
                </span>
            ),
            exportValue: (row) => row.points,
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "90px",
            render: (row) => (
                <div className="flex justify-end gap-0.5">
                    <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                        <Button disabled={!canUpdate} variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => openEditDialog(row)}>
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                    </DisabledActionTooltip>
                    <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                        <Button disabled={!canDelete} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors" onClick={() => handleDelete(row.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </DisabledActionTooltip>
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
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/25">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Customer</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">Kelola data pelanggan dan membership Anda</p>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                    <Button disabled={!canCreate} className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all" onClick={openCreateDialog}>
                        <Plus className="w-4 h-4 mr-2" /> Tambah Customer
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* Stats Bar */}
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1.5 text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                    <Users className="w-3.5 h-3.5 mr-1.5" />
                    Total: {stats.total}
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                    Regular: {stats.regular}
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-gray-100 to-slate-100 text-slate-700 border border-slate-200">
                    Silver: {stats.silver}
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border border-amber-200">
                    <Star className="w-3 h-3 mr-1 text-amber-500" />
                    Gold: {stats.gold}
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 border border-purple-200">
                    <Crown className="w-3 h-3 mr-1 text-purple-500" />
                    Platinum: {stats.platinum}
                </Badge>
                <div className="h-4 w-px bg-border mx-1" />
                <Badge variant="secondary" className="rounded-full px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Heart className="w-3 h-3 mr-1 text-emerald-500" />
                    Spending: {formatCurrency(stats.totalSpending)}
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <Star className="w-3 h-3 mr-1 text-amber-500 fill-amber-500" />
                    Poin: {stats.totalPoints.toLocaleString()}
                </Badge>
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
                titleIcon={<Users className="w-4 h-4 text-rose-500" />}
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
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                        <Button disabled={!canCreate} variant="outline" size="sm" className="rounded-xl mt-2 shadow-sm" onClick={openCreateDialog}>
                            <Plus className="w-3 h-3 mr-1" /> Tambah Customer
                        </Button>
                    </DisabledActionTooltip>
                }
            />

            {/* Customer Form Dialog */}
            <Dialog open={open} onOpenChange={(v) => { if (v) setOpen(true); else closeDialog(); }}>
                <DialogContent className="rounded-2xl max-w-md overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md shadow-rose-500/25">
                                {editing ? <Pencil className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
                            </div>
                            <span>{editing ? "Edit Customer" : "Tambah Customer"}</span>
                        </DialogTitle>
                    </DialogHeader>
                    <form action={handleSubmit} className={`space-y-4 ${editing ? (!canUpdate ? "pointer-events-none opacity-70" : "") : (!canCreate ? "pointer-events-none opacity-70" : "")}`}>
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium">Nama <span className="text-red-400">*</span></Label>
                            <Input id="name" name="name" defaultValue={editing?.name || ""} required className="rounded-xl" autoFocus />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                    No. HP
                                </Label>
                                <Input id="phone" name="phone" defaultValue={editing?.phone || ""} className="rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                    Email
                                </Label>
                                <Input id="email" name="email" type="email" defaultValue={editing?.email || ""} className="rounded-xl" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address" className="text-sm font-medium flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                Alamat
                            </Label>
                            <Input id="address" name="address" defaultValue={editing?.address || ""} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="memberLevel" className="text-sm font-medium flex items-center gap-1.5">
                                <Crown className="w-3.5 h-3.5 text-muted-foreground" />
                                Level Member
                            </Label>
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
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl shadow-sm">Batal</Button>
                            <DisabledActionTooltip disabled={editing ? !canUpdate : !canCreate} message={cannotMessage(editing ? "update" : "create")}>
                                <Button disabled={editing ? !canUpdate : !canCreate} type="submit" className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">{editing ? "Update" : "Simpan"}</Button>
                            </DisabledActionTooltip>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm Delete Dialog */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-md shadow-red-500/25">
                                <AlertTriangle className="w-4 h-4 text-white" />
                            </div>
                            <span>Konfirmasi Hapus</span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 mt-1">
                        <p className="text-sm text-red-700">{confirmText}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Tindakan ini tidak dapat dibatalkan. Data yang dihapus tidak bisa dikembalikan.</p>
                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-xl shadow-sm">Batal</Button>
                        <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                            <Button disabled={!canDelete} variant="destructive" onClick={async () => { await pendingConfirmAction?.(); }} className="rounded-xl shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30 transition-all">Ya, Hapus</Button>
                        </DisabledActionTooltip>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
