"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useBranch } from "@/components/providers/branch-provider";
import { useMenuActionAccess } from "@/features/access-control";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
    getReturns,
    getReturnStats,
} from "@/features/returns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartTable, type SmartColumn, type SmartFilter } from "@/components/ui/smart-table";
import {
    RotateCcw,
    ArrowLeftRight,
    Plus,
    Eye,
    Clock,
    CheckCircle2,
    XCircle,
    Banknote,
} from "lucide-react";
import { NewReturnDialog } from "./new-return-dialog";
import { ReturnDetailDialog } from "./return-detail-dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";

type ReturnsData = Awaited<ReturnType<typeof getReturns>>;
type StatsData = Awaited<ReturnType<typeof getReturnStats>>;

const statusConfig: Record<
    string,
    {
        label: string;
        icon: typeof CheckCircle2;
        badge: string;
    }
> = {
    PENDING: {
        label: "Menunggu",
        icon: Clock,
        badge: "border-amber-200 bg-amber-50/50 text-amber-700 ring-1 ring-amber-100",
    },
    APPROVED: {
        label: "Disetujui",
        icon: CheckCircle2,
        badge: "border-blue-200 bg-blue-50/50 text-blue-700 ring-1 ring-blue-100",
    },
    COMPLETED: {
        label: "Selesai",
        icon: CheckCircle2,
        badge: "border-emerald-200 bg-emerald-50/50 text-emerald-700 ring-1 ring-emerald-100",
    },
    REJECTED: {
        label: "Ditolak",
        icon: XCircle,
        badge: "border-red-200 bg-red-50/50 text-red-700 ring-1 ring-red-100",
    },
};

const typeConfig: Record<string, { label: string; icon: typeof RotateCcw; badge: string }> = {
    RETURN: {
        label: "Return",
        icon: RotateCcw,
        badge: "border-violet-200 bg-violet-50/50 text-violet-700 ring-1 ring-violet-100",
    },
    EXCHANGE: {
        label: "Exchange",
        icon: ArrowLeftRight,
        badge: "border-sky-200 bg-sky-50/50 text-sky-700 ring-1 ring-sky-100",
    },
};

export function ReturnsContent() {
    const [data, setData] = useState<ReturnsData>({
        returns: [],
        total: 0,
        totalPages: 0,
        currentPage: 1,
    });
    const [stats, setStats] = useState<StatsData>({
        totalReturns: 0,
        totalExchanges: 0,
        pendingCount: 0,
        totalRefundAmount: 0,
    });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);
    const [loading, startTransition] = useTransition();
    const { canAction, cannotMessage } = useMenuActionAccess("returns");
    const canCreate = canAction("create");
    const canApprove = canAction("approve");

    const [newReturnOpen, setNewReturnOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedReturnId, setSelectedReturnId] = useState<string>("");

    const fetchData = (params?: {
        search?: string;
        page?: number;
        pageSize?: number;
        filters?: Record<string, string>;
    }) => {
        startTransition(async () => {
            const s = params?.search ?? search;
            const p = params?.page ?? page;
            const ps = params?.pageSize ?? pageSize;
            const f = params?.filters ?? activeFilters;

            const [returnsResult, statsResult] = await Promise.all([
                getReturns({
                    search: s,
                    page: p,
                    perPage: ps,
                    ...(f.status ? { status: f.status } : {}),
                    ...(f.type ? { type: f.type } : {}),
                    ...(f.dateFrom ? { dateFrom: f.dateFrom } : {}),
                    ...(f.dateTo ? { dateTo: f.dateTo } : {}),
                    ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
                }),
                getReturnStats(selectedBranchId || undefined),
            ]);

            setData(returnsResult);
            setStats(statsResult);
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

    const handleSearch = (value: string) => {
        setSearch(value);
        setPage(1);
        fetchData({ search: value, page: 1 });
    };

    const handlePageChange = (p: number) => {
        setPage(p);
        fetchData({ page: p });
    };

    const handlePageSizeChange = (ps: number) => {
        setPageSize(ps);
        setPage(1);
        fetchData({ pageSize: ps, page: 1 });
    };

    const handleFilterChange = (filters: Record<string, string>) => {
        setActiveFilters(filters);
        setPage(1);
        fetchData({ filters, page: 1 });
    };

    const openDetail = (id: string) => {
        setSelectedReturnId(id);
        setDetailOpen(true);
    };

    const handleReturnCreated = () => {
        setNewReturnOpen(false);
        fetchData({ page: 1 });
        toast.success("Return berhasil dibuat");
    };

    const handleReturnUpdated = () => {
        setDetailOpen(false);
        fetchData({});
    };

    const smartFilters: SmartFilter[] = [
        {
            key: "status",
            label: "Status",
            type: "select",
            options: [
                { value: "PENDING", label: "Menunggu" },
                { value: "APPROVED", label: "Disetujui" },
                { value: "COMPLETED", label: "Selesai" },
                { value: "REJECTED", label: "Ditolak" },
            ],
        },
        {
            key: "type",
            label: "Tipe",
            type: "select",
            options: [
                { value: "RETURN", label: "Return" },
                { value: "EXCHANGE", label: "Exchange" },
            ],
        },
        { key: "dateFrom", label: "Dari Tanggal", type: "date" },
        { key: "dateTo", label: "Sampai Tanggal", type: "date" },
    ];

    type ReturnRow = ReturnsData["returns"][number];

    const columns: SmartColumn<ReturnRow>[] = [
        {
            key: "returnNumber",
            header: "No. Return",
            sortable: true,
            render: (row) => (
                <span className="font-mono text-sm font-medium text-gray-900">
                    {row.returnNumber}
                </span>
            ),
            exportValue: (row) => row.returnNumber,
        },
        {
            key: "invoice",
            header: "Invoice",
            render: (row) => (
                <span className="font-mono text-sm text-gray-600">
                    {row.transaction.invoiceNumber}
                </span>
            ),
            exportValue: (row) => row.transaction.invoiceNumber,
        },
        {
            key: "type",
            header: "Tipe",
            render: (row) => {
                const tc = typeConfig[row.type] ?? typeConfig.RETURN!;
                const TypeIcon = tc!.icon;
                return (
                    <Badge variant="outline" className={`gap-1 ${tc!.badge}`}>
                        <TypeIcon className="h-3 w-3" />
                        {tc!.label}
                    </Badge>
                );
            },
            exportValue: (row) => (typeConfig[row.type]?.label ?? row.type),
        },
        {
            key: "customer",
            header: "Customer",
            render: (row) => (
                <span className="text-sm text-gray-700">
                    {row.customer?.name ?? (
                        <span className="text-gray-400 italic">Walk-in</span>
                    )}
                </span>
            ),
            exportValue: (row) => row.customer?.name ?? "Walk-in",
        },
        {
            key: "items",
            header: "Items",
            align: "center",
            render: (row) => (
                <Badge
                    variant="outline"
                    className="border-gray-200 bg-gray-50 text-gray-600"
                >
                    {row.items.length} item
                </Badge>
            ),
            exportValue: (row) => row.items.length,
        },
        {
            key: "totalRefund",
            header: "Refund",
            align: "right",
            sortable: true,
            render: (row) => (
                <span className="font-semibold text-gray-900">
                    {formatCurrency(row.totalRefund)}
                </span>
            ),
            exportValue: (row) => Number(row.totalRefund),
        },
        {
            key: "status",
            header: "Status",
            render: (row) => {
                const sc = statusConfig[row.status] ?? statusConfig.PENDING!;
                const StatusIcon = sc!.icon;
                return (
                    <Badge variant="outline" className={`gap-1 ${sc!.badge}`}>
                        <StatusIcon className="h-3 w-3" />
                        {sc!.label}
                    </Badge>
                );
            },
            exportValue: (row) => (statusConfig[row.status]?.label ?? row.status),
        },
        {
            key: "createdAt",
            header: "Tanggal",
            sortable: true,
            render: (row) => (
                <span className="text-sm text-gray-500">
                    {formatDateTime(row.createdAt)}
                </span>
            ),
            exportValue: (row) => formatDateTime(row.createdAt),
        },
        {
            key: "actions",
            header: "Aksi",
            align: "center",
            sticky: true,
            render: (row) => (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg"
                    onClick={(e) => {
                        e.stopPropagation();
                        openDetail(row.id);
                    }}
                >
                    <Eye className="h-4 w-4 text-gray-500" />
                </Button>
            ),
        },
    ];

    const statsCards = [
        {
            label: "Total Return",
            value: stats.totalReturns,
            icon: RotateCcw,
            gradient: "from-violet-500 to-purple-600",
            bg: "bg-violet-50",
        },
        {
            label: "Total Exchange",
            value: stats.totalExchanges,
            icon: ArrowLeftRight,
            gradient: "from-sky-500 to-blue-600",
            bg: "bg-sky-50",
        },
        {
            label: "Total Refund",
            value: formatCurrency(stats.totalRefundAmount),
            icon: Banknote,
            gradient: "from-emerald-500 to-green-600",
            bg: "bg-emerald-50",
            isAmount: true,
        },
        {
            label: "Menunggu Approval",
            value: stats.pendingCount,
            icon: Clock,
            gradient: "from-amber-500 to-orange-600",
            bg: "bg-amber-50",
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-200">
                        <RotateCcw className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                            Return & Exchange
                        </h1>
                        <p className="text-sm text-gray-500">
                            Kelola pengembalian dan pertukaran barang
                        </p>
                    </div>
                </div>
                <DisabledActionTooltip
                    disabled={!canCreate}
                    message={cannotMessage("create")}
                >
                    <Button
                        onClick={() => setNewReturnOpen(true)}
                        disabled={!canCreate}
                        className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-200 rounded-xl gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Return Baru
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statsCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <Card
                            key={card.label}
                            className="border-border/30 shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden"
                        >
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-sm`}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-gray-500 truncate">
                                            {card.label}
                                        </p>
                                        <p className="text-lg font-bold text-gray-900 truncate">
                                            {loading ? (
                                                <Skeleton className="h-6 w-16" />
                                            ) : (
                                                card.value
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Table */}
            <SmartTable<ReturnRow>
                data={data.returns}
                columns={columns}
                totalItems={data.total}
                totalPages={data.totalPages}
                currentPage={data.currentPage}
                pageSize={pageSize}
                loading={loading}
                searchPlaceholder="Cari nomor return, invoice, customer..."
                onSearch={handleSearch}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                filters={smartFilters}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
                onRowClick={(row) => openDetail(row.id)}
                exportFilename="returns"
                emptyIcon={<RotateCcw className="h-10 w-10 opacity-30" />}
                emptyTitle="Belum ada data return"
                emptyDescription="Return & exchange akan muncul di sini"
                mobileRender={(row) => {
                    const sc = statusConfig[row.status] ?? statusConfig.PENDING!;
                    const tc = typeConfig[row.type] ?? typeConfig.RETURN!;
                    return (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-sm font-medium text-gray-900">{row.returnNumber}</span>
                                <Badge variant="outline" className={`gap-1 text-[11px] ${sc!.badge}`}>
                                    <sc.icon className="h-3 w-3" />
                                    {sc!.label}
                                </Badge>
                            </div>
                            <div className="text-xs text-gray-500">
                                {formatDateTime(row.createdAt)} <span className="mx-1">&bull;</span> {row.transaction.invoiceNumber}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <Badge variant="outline" className={`gap-1 text-[11px] ${tc!.badge}`}>
                                    {tc!.label}
                                </Badge>
                                <span className="font-semibold text-gray-900">{formatCurrency(row.totalRefund)}</span>
                            </div>
                        </div>
                    );
                }}
            />

            {/* New Return Dialog */}
            <NewReturnDialog
                open={newReturnOpen}
                onOpenChange={setNewReturnOpen}
                onSuccess={handleReturnCreated}
                branchId={selectedBranchId}
            />

            {/* Return Detail Dialog */}
            <ReturnDetailDialog
                open={detailOpen}
                onOpenChange={setDetailOpen}
                returnId={selectedReturnId}
                canApprove={canApprove}
                onUpdated={handleReturnUpdated}
            />
        </div>
    );
}
