"use client";

import { useEffect, useState, useTransition } from "react";
import { useQueryParams } from "@/hooks/use-query-params";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createCustomer, updateCustomer, deleteCustomer, getCustomers, getCustomerStats, bulkDeleteCustomers } from "@/features/customers";
import { useMenuActionAccess } from "@/features/access-control";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { SmartSelect } from "@/components/ui/smart-select";
import { Plus, Pencil, Trash2, Users, Phone, Mail, Crown, Star, Heart, MapPin, Cake, Loader2, Upload } from "lucide-react";
import { CustomerImportDialog } from "./customer-import-dialog";
import { toast } from "sonner";
import type { Customer } from "@/types";

const customerFormSchema = z.object({
    name: z.string().min(1, "Nama customer wajib diisi"),
    phone: z.string().optional(),
    email: z.string().email("Format email tidak valid").or(z.literal("")).optional(),
    address: z.string().optional(),
    memberLevel: z.enum(["REGULAR", "SILVER", "GOLD", "PLATINUM"]),
    dateOfBirth: z.string().optional(),
});
type CustomerFormValues = z.infer<typeof customerFormSchema>;

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
    const [importOpen, setImportOpen] = useState(false);
    const [editing, setEditing] = useState<Customer | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
    const [pendingSubmitValues, setPendingSubmitValues] = useState<CustomerFormValues | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const qp = useQueryParams({ pageSize: 10, filters: { memberLevel: "ALL" } });
    const { page, pageSize, search, filters: activeFilters } = qp;
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [sortKey, setSortKey] = useState<string>("");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();
    const { canAction, cannotMessage } = useMenuActionAccess("customers");
    const { canAction: canPlan } = usePlanAccess();
    const canCreate = canAction("create") && canPlan("customers", "create");
    const canUpdate = canAction("update") && canPlan("customers", "update");
    const canDelete = canAction("delete") && canPlan("customers", "delete");

    const [stats, setStats] = useState({ total: 0, regular: 0, silver: 0, gold: 0, platinum: 0, totalSpending: 0, totalPoints: 0 });

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
            const [result, statsResult] = await Promise.all([
                getCustomers(query),
                getCustomerStats(),
            ]);
            setData(result as typeof data);
            setStats(statsResult);
        });
    };

    useEffect(() => {
        fetchData({});
    }, [page, pageSize, search, activeFilters.memberLevel]); // eslint-disable-line react-hooks/exhaustive-deps

    const form = useForm<CustomerFormValues>({
        resolver: zodResolver(customerFormSchema),
        defaultValues: { name: "", phone: "", email: "", address: "", memberLevel: "REGULAR", dateOfBirth: "" },
    });

    const executeSubmit = async (values: CustomerFormValues) => {
        if (editing ? !canUpdate : !canCreate) { toast.error(cannotMessage(editing ? "update" : "create")); return; }
        const fd = new FormData();
        fd.set("name", values.name);
        if (values.phone) fd.set("phone", values.phone);
        if (values.email) fd.set("email", values.email);
        if (values.address) fd.set("address", values.address);
        fd.set("memberLevel", values.memberLevel);
        if (values.dateOfBirth) fd.set("dateOfBirth", values.dateOfBirth);
        const result = editing ? await updateCustomer(editing.id, fd) : await createCustomer(fd);
        if (result.error) { toast.error(result.error); }
        else { toast.success(editing ? "Customer berhasil diupdate" : "Customer berhasil ditambahkan"); setOpen(false); setEditing(null); fetchData({}); }
    };

    const onSubmit = async (values: CustomerFormValues) => {
        setPendingSubmitValues(values);
        setSubmitConfirmOpen(true);
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
            const { count } = await bulkDeleteCustomers(ids);
            toast.success(`${count} customer dihapus`);
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
        form.reset({ name: "", phone: "", email: "", address: "", memberLevel: "REGULAR", dateOfBirth: "" });
        setOpen(true);
    };

    const openEditDialog = (customer: Customer) => {
        if (!canUpdate) { toast.error(cannotMessage("update")); return; }
        setEditing(customer);
        form.reset({
            name: customer.name,
            phone: customer.phone || "",
            email: customer.email || "",
            address: customer.address || "",
            memberLevel: customer.memberLevel as CustomerFormValues["memberLevel"],
            dateOfBirth: customer.dateOfBirth ? new Date(customer.dateOfBirth).toISOString().split("T")[0] : "",
        });
        setOpen(true);
    };

    const closeDialog = () => {
        setOpen(false);
        setEditing(null);
        form.reset();
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
                    <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="customers" actionKey="update">
                        <Button disabled={!canUpdate} variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => openEditDialog(row)}>
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                    </DisabledActionTooltip>
                    <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="customers" actionKey="delete">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/25 shrink-0">
                        <Users className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Customer</h1>
                        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Kelola data pelanggan dan membership</p>
                    </div>
                </div>
                <div className="hidden sm:flex gap-2">
                    <Button variant="outline" className="rounded-xl border-dashed" onClick={() => setImportOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" /> Import
                    </Button>
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="customers" actionKey="create">
                        <Button disabled={!canCreate} className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all text-xs sm:text-sm" onClick={openCreateDialog}>
                            <Plus className="w-4 h-4 mr-1.5 sm:mr-2" /> Tambah Customer
                        </Button>
                    </DisabledActionTooltip>
                </div>
            </div>

            <SmartTable<Customer>
                data={data.customers}
                columns={columns}
                totalItems={data.total}
                mobileRender={(row) => (
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm truncate text-foreground">{row.name}</p>
                            <Badge className={`${memberColors[row.memberLevel] || ""} rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0`}>
                                {row.memberLevel === "PLATINUM" && <Crown className="w-3 h-3 mr-0.5" />}
                                {row.memberLevel === "GOLD" && <Star className="w-3 h-3 mr-0.5" />}
                                {row.memberLevel}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {row.phone || "-"} &middot; {row.email || "-"}
                        </p>
                        <p className="text-xs mt-1">
                            <span className="text-muted-foreground">Total: </span>
                            <span className="font-semibold text-foreground">{formatCurrency(row.totalSpending)}</span>
                            <span className="text-muted-foreground"> &middot; </span>
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400 inline" />
                            <span className="font-medium"> {row.points} poin</span>
                        </p>
                    </div>
                )}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Daftar Customer"
                titleIcon={<Users className="w-4 h-4 text-rose-500" />}
                searchPlaceholder="Cari customer..."
                searchValue={search}
                onSearch={(q) => { qp.setSearch(q); }}
                onPageChange={(p) => qp.setPage(p)}
                onPageSizeChange={(s) => qp.setParams({ pageSize: s, page: 1 })}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key, dir) => { setSortKey(key); setSortDir(dir); qp.setPage(1); }}
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={(f) => { qp.setFilters(f); }}
                afterFilters={
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 sm:px-5 pb-2">
                        <Badge variant="secondary" className="rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <Users className="w-3 h-3 mr-1" />
                            Total: {stats.total}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                            Regular: {stats.regular}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-medium bg-gradient-to-r from-gray-100 to-slate-100 text-slate-700 border border-slate-200">
                            Silver: {stats.silver}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-medium bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border border-amber-200">
                            <Star className="w-3 h-3 mr-1 text-amber-500" />
                            Gold: {stats.gold}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-medium bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 border border-purple-200">
                            <Crown className="w-3 h-3 mr-1 text-purple-500" />
                            Platinum: {stats.platinum}
                        </Badge>
                        <div className="h-4 w-px bg-border mx-0.5" />
                        <Badge variant="secondary" className="rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Heart className="w-3 h-3 mr-1 text-emerald-500" />
                            {formatCurrency(stats.totalSpending)}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Star className="w-3 h-3 mr-1 text-amber-500 fill-amber-500" />
                            {stats.totalPoints.toLocaleString()} poin
                        </Badge>
                    </div>
                }
                selectable
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                rowKey={(row) => row.id}
                bulkActions={[
                    { label: "Hapus", variant: "destructive", icon: <Trash2 className="w-3 h-3" />, onClick: handleBulkDelete },
                ]}
                planMenuKey="customers" exportModule="customers"
                emptyIcon={<Users className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Tidak ada customer ditemukan"
                emptyAction={
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="customers" actionKey="create">
                        <Button disabled={!canCreate} variant="outline" size="sm" className="rounded-xl mt-2 shadow-sm" onClick={openCreateDialog}>
                            <Plus className="w-3 h-3 mr-1" /> Tambah Customer
                        </Button>
                    </DisabledActionTooltip>
                }
            />

            {/* Floating button mobile */}
            {canCreate && (
                <button onClick={openCreateDialog} className="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/30 flex items-center justify-center active:scale-95 transition-transform">
                    <Plus className="w-6 h-6" />
                </button>
            )}

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
                    <form onSubmit={form.handleSubmit(onSubmit)} className={`space-y-4 ${editing ? (!canUpdate ? "pointer-events-none opacity-70" : "") : (!canCreate ? "pointer-events-none opacity-70" : "")}`}>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Nama <span className="text-red-400">*</span></Label>
                            <Input {...form.register("name")} className="rounded-xl" autoFocus />
                            {form.formState.errors.name && <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5 text-muted-foreground" /> No. HP
                                </Label>
                                <Input {...form.register("phone")} className="rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email
                                </Label>
                                <Input {...form.register("email")} type="email" className="rounded-xl" />
                                {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Alamat
                            </Label>
                            <Input {...form.register("address")} className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                                <Crown className="w-3.5 h-3.5 text-muted-foreground" /> Level Member
                            </Label>
                            <Controller control={form.control} name="memberLevel" render={({ field }) => (
                                <SmartSelect
                                    value={field.value}
                                    onChange={field.onChange}
                                    onSearch={async (query) =>
                                        [
                                            { value: "REGULAR", label: "Regular" },
                                            { value: "SILVER", label: "Silver" },
                                            { value: "GOLD", label: "Gold" },
                                            { value: "PLATINUM", label: "Platinum" },
                                        ].filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))
                                    }
                                />
                            )} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                                <Cake className="w-3.5 h-3.5 text-muted-foreground" /> Tanggal Lahir
                            </Label>
                            <Input {...form.register("dateOfBirth")} type="date" className="rounded-xl" />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl shadow-sm">Batal</Button>
                            <DisabledActionTooltip disabled={editing ? !canUpdate : !canCreate} message={cannotMessage(editing ? "update" : "create")}>
                                <Button disabled={(editing ? !canUpdate : !canCreate) || form.formState.isSubmitting} type="submit" className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">{form.formState.isSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</> : editing ? "Update" : "Simpan"}</Button>
                            </DisabledActionTooltip>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <ActionConfirmDialog
                open={confirmOpen}
                onOpenChange={(v) => { setConfirmOpen(v); if (!v) setPendingConfirmAction(null); }}
                kind="delete"
                title="Konfirmasi Hapus"
                description={confirmText || "Tindakan ini tidak dapat dibatalkan. Data yang dihapus tidak bisa dikembalikan."}
                confirmLabel="Ya, Hapus"
                onConfirm={async () => { await pendingConfirmAction?.(); }}
                confirmDisabled={!canDelete}
            />
            <ActionConfirmDialog
                open={submitConfirmOpen}
                onOpenChange={(v) => { setSubmitConfirmOpen(v); if (!v) setPendingSubmitValues(null); }}
                kind="submit"
                title={editing ? "Update Customer?" : "Simpan Customer?"}
                description={editing ? "Perubahan customer akan disimpan." : "Customer baru akan ditambahkan."}
                confirmLabel={editing ? "Update" : "Simpan"}
                loading={confirmLoading}
                onConfirm={async () => {
                    if (!pendingSubmitValues) return;
                    setConfirmLoading(true);
                    await executeSubmit(pendingSubmitValues);
                    setConfirmLoading(false);
                    setSubmitConfirmOpen(false);
                    setPendingSubmitValues(null);
                }}
            />
            <CustomerImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => fetchData({})} />
        </div>
    );
}
