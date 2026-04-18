"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { useEffect, useState, useTransition, useRef } from "react";
import { useQueryParams } from "@/hooks/use-query-params";
import {
    getPriceSchedules,
    getPriceScheduleStats,
    deletePriceSchedule,
    applyDuePriceSchedules,
} from "@/features/price-schedules";
import { getAllBranches } from "@/server/actions/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { SmartTable, type SmartColumn } from "@/components/ui/smart-table";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import {
    Plus,
    Trash2,
    Loader2,
    CalendarClock,
    Clock,
    CheckCircle2,
    RotateCcw,
    Zap,
    TrendingDown,
    Package,
    Timer,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { NewScheduleDialog } from "./new-schedule-dialog";

interface PriceScheduleItem {
    id: string;
    productId: string;
    product: { id: string; name: string; code: string; sellingPrice: number };
    branchId: string | null;
    branch: { id: string; name: string } | null;
    newPrice: number;
    originalPrice: number;
    startDate: string;
    endDate: string;
    reason: string | null;
    isActive: boolean;
    appliedAt: string | null;
    revertedAt: string | null;
    createdBy: string;
    createdAt: string;
}

interface Stats {
    active: number;
    upcoming: number;
    expired: number;
    productsAffected: number;
}

interface Branch {
    id: string;
    name: string;
    isActive: boolean;
}

function getScheduleStatus(item: PriceScheduleItem) {
    if (item.revertedAt) return "reverted";
    if (item.appliedAt) {
        const now = new Date();
        if (new Date(item.endDate) <= now) return "expired";
        return "active";
    }
    const now = new Date();
    if (new Date(item.startDate) <= now) return "pending-apply";
    return "upcoming";
}

const statusConfig: Record<
    string,
    { label: string; className: string; icon: typeof Clock }
> = {
    upcoming: {
        label: "Akan Datang",
        className:
            "bg-blue-50 text-blue-700 border-blue-200",
        icon: Clock,
    },
    "pending-apply": {
        label: "Menunggu Apply",
        className:
            "bg-amber-50 text-amber-700 border-amber-200",
        icon: Timer,
    },
    active: {
        label: "Aktif",
        className:
            "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: CheckCircle2,
    },
    expired: {
        label: "Kedaluwarsa",
        className:
            "bg-orange-50 text-orange-700 border-orange-200",
        icon: CalendarClock,
    },
    reverted: {
        label: "Dikembalikan",
        className:
            "bg-gray-50 text-gray-500 border-gray-200",
        icon: RotateCcw,
    },
};

export function PriceSchedulesContent() {
    const [data, setData] = useState<{
        schedules: PriceScheduleItem[];
        total: number;
        totalPages: number;
    }>({ schedules: [], total: 0, totalPages: 0 });
    const [stats, setStats] = useState<Stats>({
        active: 0,
        upcoming: 0,
        expired: 0,
        productsAffected: 0,
    });
    const [branches, setBranches] = useState<Branch[]>([]);
    const qp = useQueryParams({ pageSize: 10, filters: { status: "ALL", branch: "ALL" } });
    const { page, pageSize, search, filters } = qp;
    const statusFilter = filters.status ?? "ALL";
    const branchFilter = filters.branch ?? "ALL";
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [loading, startTransition] = useTransition();
    const [applying, startApplying] = useTransition();
    const { canAction, cannotMessage } = useMenuActionAccess("price-schedules");
    const { canAction: canPlan } = usePlanAccess();
    const canCreate = canAction("create") && canPlan("price-schedules", "create");
    const canDelete = canAction("delete") && canPlan("price-schedules", "delete");
    const canUpdate = canAction("update") && canPlan("price-schedules", "update");

    const fetchData = (params?: {
        search?: string;
        page?: number;
        pageSize?: number;
        status?: string;
        branch?: string;
    }) => {
        startTransition(async () => {
            const s = params?.status ?? statusFilter;
            const b = params?.branch ?? branchFilter;
            const result = await getPriceSchedules({
                search: params?.search ?? search,
                ...(s !== "ALL" ? { status: s } : {}),
                ...(b !== "ALL" ? { branchId: b } : {}),
                page: params?.page ?? page,
                perPage: params?.pageSize ?? pageSize,
            });
            setData(result as never);
        });
    };

    const fetchStats = () => {
        getPriceScheduleStats().then(setStats);
    };

    const didFetchRef = useRef(false);
    useEffect(() => {
        if (!didFetchRef.current) {
            didFetchRef.current = true;
            fetchStats();
            getAllBranches().then((b) => setBranches(b as Branch[]));
        }
        fetchData({});
    }, [page, pageSize, search, statusFilter, branchFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDelete = async (id: string) => {
        if (!canDelete) {
            toast.error(cannotMessage("delete"));
            return;
        }
        setConfirmText("Hapus jadwal harga ini?");
        setPendingConfirmAction(() => async () => {
            const result = await deletePriceSchedule(id);
            if (result.error) toast.error(result.error);
            else {
                toast.success("Jadwal harga dihapus");
                fetchData({});
                fetchStats();
            }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const handleApplyDue = () => {
        if (!canUpdate) {
            toast.error(cannotMessage("update"));
            return;
        }
        startApplying(async () => {
            const result = await applyDuePriceSchedules();
            if (result.error) {
                toast.error(result.error);
            } else {
                const msgs: string[] = [];
                if (result.appliedCount && result.appliedCount > 0) msgs.push(`${result.appliedCount} jadwal diterapkan`);
                if (result.revertedCount && result.revertedCount > 0) msgs.push(`${result.revertedCount} harga dikembalikan`);
                if (msgs.length === 0) msgs.push("Tidak ada jadwal yang perlu diproses");
                toast.success(msgs.join(", "));
                fetchData({});
                fetchStats();
            }
        });
    };

    const handleCreated = () => {
        setDialogOpen(false);
        fetchData({});
        fetchStats();
    };

    const discountPercent = (original: number, newPrice: number) => {
        if (original <= 0) return 0;
        return Math.round(((original - newPrice) / original) * 100);
    };

    const statsCards = [
        {
            label: "Jadwal Aktif",
            value: stats.active,
            icon: CheckCircle2,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            border: "border-emerald-200",
        },
        {
            label: "Akan Datang",
            value: stats.upcoming,
            icon: Clock,
            color: "text-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-200",
        },
        {
            label: "Kedaluwarsa",
            value: stats.expired,
            icon: CalendarClock,
            color: "text-orange-600",
            bg: "bg-orange-50",
            border: "border-orange-200",
        },
        {
            label: "Produk Terpengaruh",
            value: stats.productsAffected,
            icon: Package,
            color: "text-purple-600",
            bg: "bg-purple-50",
            border: "border-purple-200",
        },
    ];

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200/50 shrink-0">
                        <CalendarClock className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold tracking-tight">
                            Jadwal Harga
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                            Atur perubahan harga produk terjadwal
                        </p>
                    </div>
                </div>
                <div className="hidden sm:flex gap-2">
                    <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="price-schedules" actionKey="update">
                        <Button
                            variant="outline"
                            onClick={handleApplyDue}
                            disabled={!canUpdate || applying}
                            className="gap-2 text-sm"
                        >
                            {applying ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Zap className="h-4 w-4" />
                            )}
                            Proses Jadwal
                        </Button>
                    </DisabledActionTooltip>
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="price-schedules" actionKey="create">
                        <Button onClick={() => setDialogOpen(true)} disabled={!canCreate} className="gap-2 text-sm">
                            <Plus className="h-4 w-4" /> Jadwal Baru
                        </Button>
                    </DisabledActionTooltip>
                </div>
            </div>

            {/* Mobile: Floating buttons */}
            <div className="sm:hidden fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
                <Button
                    variant="outline"
                    onClick={handleApplyDue}
                    disabled={applying}
                    size="icon"
                    className="h-10 w-10 rounded-full shadow-lg bg-white"
                >
                    {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                </Button>
                {canCreate && (
                    <Button
                        onClick={() => setDialogOpen(true)}
                        size="icon"
                        className="h-12 w-12 rounded-full shadow-xl shadow-primary/30 bg-gradient-to-br from-primary to-primary/80"
                    >
                        <Plus className="w-5 h-5" />
                    </Button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                {statsCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.label}
                            className={`rounded-xl border ${card.border} ${card.bg} p-2.5 sm:p-4 transition-all`}
                        >
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className={`flex rounded-lg ${card.bg} p-1.5 sm:p-2 shrink-0`}>
                                    <Icon className={`h-3.5 w-3.5 sm:h-5 sm:w-5 ${card.color}`} />
                                </div>
                                <div>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground">{card.label}</p>
                                    <p className={`text-sm sm:text-xl font-bold ${card.color}`}>
                                        {card.value}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filters handled by SmartTable */}

            {/* SmartTable */}
            <SmartTable<PriceScheduleItem>
                data={data.schedules}
                columns={(() => {
                    const cols: SmartColumn<PriceScheduleItem>[] = [
                        {
                            key: "product",
                            header: "Produk",
                            render: (item) => (
                                <div>
                                    <p className="font-medium text-sm truncate">{item.product.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.product.code}
                                        {item.branch && <span className="ml-2 text-blue-600">{item.branch.name}</span>}
                                    </p>
                                </div>
                            ),
                            exportValue: (item) => item.product.name,
                        },
                        {
                            key: "originalPrice",
                            header: "Harga Asli",
                            align: "right",
                            render: (item) => <span className="font-mono text-muted-foreground text-sm">{formatCurrency(item.originalPrice)}</span>,
                            exportValue: (item) => item.originalPrice,
                        },
                        {
                            key: "newPrice",
                            header: "Harga Baru",
                            align: "right",
                            render: (item) => <span className="font-mono font-semibold text-sm">{formatCurrency(item.newPrice)}</span>,
                            exportValue: (item) => item.newPrice,
                        },
                        {
                            key: "discount",
                            header: "Diskon",
                            align: "center",
                            render: (item) => {
                                const disc = discountPercent(item.originalPrice, item.newPrice);
                                const isIncrease = item.newPrice > item.originalPrice;
                                if (isIncrease) return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">+{Math.abs(disc)}%</Badge>;
                                if (disc > 0) return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200"><TrendingDown className="h-3 w-3 mr-1" />{disc}%</Badge>;
                                return <span className="text-muted-foreground">-</span>;
                            },
                            exportValue: (item) => discountPercent(item.originalPrice, item.newPrice),
                        },
                        {
                            key: "startDate",
                            header: "Mulai",
                            render: (item) => <span className="text-sm">{format(new Date(item.startDate), "dd MMM yyyy")}</span>,
                            exportValue: (item) => item.startDate,
                        },
                        {
                            key: "endDate",
                            header: "Selesai",
                            render: (item) => <span className="text-sm">{format(new Date(item.endDate), "dd MMM yyyy")}</span>,
                            exportValue: (item) => item.endDate,
                        },
                        {
                            key: "status",
                            header: "Status",
                            align: "center",
                            render: (item) => {
                                const st = getScheduleStatus(item);
                                const cfg = statusConfig[st];
                                const Icon = cfg?.icon ?? Clock;
                                return <Badge variant="outline" className={`gap-1 text-xs ${cfg?.className ?? ""}`}><Icon className="h-3 w-3" />{cfg?.label ?? st}</Badge>;
                            },
                            exportValue: (item) => getScheduleStatus(item),
                        },
                        {
                            key: "actions",
                            header: "Aksi",
                            align: "center",
                            sticky: true,
                            render: (item) => !item.appliedAt ? (
                                <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="price-schedules" actionKey="delete">
                                    <Button disabled={!canDelete} variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(item.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </DisabledActionTooltip>
                            ) : null,
                        },
                    ];
                    return cols;
                })()}
                totalItems={data.total}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Jadwal Harga"
                titleIcon={<CalendarClock className="w-4 h-4 text-violet-600" />}
                searchPlaceholder="Cari produk..."
                searchValue={search}
                onSearch={(q) => { qp.setSearch(q); }}
                onPageChange={(p) => qp.setPage(p)}
                onPageSizeChange={(ps) => qp.setParams({ pageSize: ps, page: 1 })}
                filters={[
                    {
                        key: "status", label: "Status", type: "select", options: [
                            { value: "ALL", label: "Semua Status" },
                            { value: "upcoming", label: "Akan Datang" },
                            { value: "active", label: "Aktif" },
                            { value: "expired", label: "Kedaluwarsa" },
                            { value: "reverted", label: "Dikembalikan" },
                        ]
                    },
                    ...(branches.length > 0 ? [{
                        key: "branch", label: "Cabang", type: "select" as const, options: [
                            { value: "ALL", label: "Semua Cabang" },
                            ...branches.map((b) => ({ value: b.id, label: b.name })),
                        ]
                    }] : []),
                ]}
                activeFilters={{ status: statusFilter, branch: branchFilter }}
                onFilterChange={(f) => {
                    qp.setFilters({ status: f.status ?? "ALL", branch: f.branch ?? "ALL" });
                }}
                planMenuKey="price-schedules" exportModule="price-schedules"
                emptyIcon={<CalendarClock className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Belum ada jadwal harga"
                emptyDescription="Buat jadwal harga baru untuk mengubah harga produk secara otomatis"
                mobileRender={(item) => {
                    const st = getScheduleStatus(item);
                    const cfg = statusConfig[st];
                    const Icon = cfg?.icon ?? Clock;
                    const disc = discountPercent(item.originalPrice, item.newPrice);
                    return (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">{item.product.name}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">{item.product.code}</p>
                                </div>
                                <Badge variant="outline" className={`shrink-0 gap-1 text-[10px] ${cfg?.className ?? ""}`}>
                                    <Icon className="h-2.5 w-2.5" />{cfg?.label ?? st}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground line-through tabular-nums">{formatCurrency(item.originalPrice)}</span>
                                <span className="font-semibold tabular-nums">{formatCurrency(item.newPrice)}</span>
                                {disc > 0 && <span className="text-emerald-600 font-medium">-{disc}%</span>}
                            </div>
                            <p className="text-[10px] text-muted-foreground">{format(new Date(item.startDate), "dd MMM")} — {format(new Date(item.endDate), "dd MMM yyyy")}</p>
                        </div>
                    );
                }}
            />

            {/* New Schedule Dialog */}
            <NewScheduleDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onCreated={handleCreated}
                branches={branches}
            />
            <ActionConfirmDialog
                open={confirmOpen}
                onOpenChange={(v) => { setConfirmOpen(v); if (!v) setPendingConfirmAction(null); }}
                kind="delete"
                title="Konfirmasi Hapus"
                description={confirmText}
                confirmLabel="Ya, Hapus"
                onConfirm={async () => { await pendingConfirmAction?.(); }}
                confirmDisabled={!canDelete}
                size="sm"
            />
        </div>
    );
}
