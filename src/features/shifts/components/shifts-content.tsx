"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { openShift, closeShift, getShifts, getActiveShift } from "@/features/shifts";
import { useMenuActionAccess } from "@/features/access-control";
import { formatCurrency } from "@/lib/utils";
import type { SmartColumn } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, PlayCircle, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useBranch } from "@/components/providers/branch-provider";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";

type ShiftsData = Awaited<ReturnType<typeof getShifts>>;
type ShiftRow = ShiftsData["shifts"][number];
type ActiveShiftData = Awaited<ReturnType<typeof getActiveShift>>;

export function ShiftsContent() {
    const [data, setData] = useState<ShiftsData>({ shifts: [], total: 0, totalPages: 0 });
    const [activeShift, setActiveShift] = useState<ActiveShiftData>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [closeDialog, setCloseDialog] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<string>("");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();
    const { canAction, cannotMessage } = useMenuActionAccess("shifts");
    const canOpenShift = canAction("create");
    const canCloseShift = canAction("close_shift");
    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; sortKey?: string; sortDir?: "asc" | "desc" }) => {
        startTransition(async () => {
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(sk ? { sortBy: sk, sortDir: sd } : {}),
                ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
            };
            const result = await getShifts(query);
            setData(result);
        });
    };

    useEffect(() => {
        if (!branchReady) return;
        if (prevBranchRef.current !== selectedBranchId) { prevBranchRef.current = selectedBranchId; fetchData({ page: 1 }); } else {
            startTransition(async () => {
                const [shiftsData, activeShiftData] = await Promise.all([getShifts(), getActiveShift()]);
                setData(shiftsData);
                setActiveShift(activeShiftData);
            });
        }
    }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleOpenShift = async (formData: FormData) => {
        if (!canOpenShift) { toast.error(cannotMessage("create")); return; }
        const result = await openShift(formData);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Shift berhasil dibuka");
            setOpenDialog(false);
            fetchData({});
            // Reload to get active shift
            window.location.reload();
        }
    };

    const handleCloseShift = async (formData: FormData) => {
        if (!canCloseShift) { toast.error(cannotMessage("close_shift")); return; }
        if (!activeShift) return;
        const result = await closeShift(activeShift.id, formData);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Shift berhasil ditutup");
            setCloseDialog(false);
            setActiveShift(null);
            fetchData({});
        }
    };

    const getCashierName = (row: ShiftRow) => (row as unknown as { user?: { name?: string } }).user?.name ?? row.userId;

    const columns: SmartColumn<ShiftRow>[] = [
        {
            key: "user", header: "Kasir", sortable: true,
            render: (row) => <span className="font-medium text-sm">{getCashierName(row)}</span>,
            exportValue: (row) => getCashierName(row),
        },
        {
            key: "branch", header: "Lokasi",
            render: (row) => <span className="text-xs">{(row as unknown as { branch?: { name: string } | null }).branch?.name ?? "Semua"}</span>,
            exportValue: (row) => (row as unknown as { branch?: { name: string } | null }).branch?.name ?? "Semua",
        },
        {
            key: "openedAt", header: "Dibuka", sortable: true,
            render: (row) => <span className="text-sm">{format(new Date(row.openedAt), "dd/MM/yy HH:mm")}</span>,
            exportValue: (row) => format(new Date(row.openedAt), "dd/MM/yyyy HH:mm"),
        },
        {
            key: "closedAt", header: "Ditutup", sortable: true,
            render: (row) => <span className="text-sm">{row.closedAt ? format(new Date(row.closedAt), "dd/MM/yy HH:mm") : "-"}</span>,
            exportValue: (row) => row.closedAt ? format(new Date(row.closedAt), "dd/MM/yyyy HH:mm") : "-",
        },
        {
            key: "openingCash", header: "Kas Awal", sortable: true, align: "right",
            render: (row) => <span className="text-sm">{formatCurrency(row.openingCash)}</span>,
            exportValue: (row) => row.openingCash,
        },
        {
            key: "closingCash", header: "Kas Akhir", sortable: true, align: "right",
            render: (row) => <span className="text-sm">{row.closingCash != null ? formatCurrency(row.closingCash) : "-"}</span>,
            exportValue: (row) => row.closingCash ?? 0,
        },
        {
            key: "cashDifference", header: "Selisih", sortable: true, align: "right",
            render: (row) => (
                row.cashDifference != null ? (
                    <span className={`text-sm font-medium ${row.cashDifference >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {row.cashDifference >= 0 ? "+" : ""}{formatCurrency(row.cashDifference)}
                    </span>
                ) : <span className="text-sm">-</span>
            ),
            exportValue: (row) => row.cashDifference ?? 0,
        },
        {
            key: "status", header: "Status", align: "center", sticky: true,
            render: (row) => (
                <Badge className={row.isOpen ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}>
                    {row.isOpen ? "Aktif" : "Selesai"}
                </Badge>
            ),
            exportValue: (row) => row.isOpen ? "Aktif" : "Selesai",
        },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Shift Kasir</h1>
                    <p className="text-muted-foreground text-sm">Kelola shift kasir</p>
                </div>
                <div className="flex gap-2">
                    {!activeShift ? (
                        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                            <DialogTrigger asChild>
                                <DisabledActionTooltip disabled={!canOpenShift} message={cannotMessage("create")}>
                                    <Button disabled={!canOpenShift} className="rounded-lg bg-green-600 hover:bg-green-700">
                                        <PlayCircle className="w-4 h-4 mr-2" />
                                        Buka Shift
                                    </Button>
                                </DisabledActionTooltip>
                            </DialogTrigger>
                            <DialogContent className="rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle>Buka Shift Baru</DialogTitle>
                                </DialogHeader>
                                <form action={handleOpenShift} className={`space-y-4 ${!canOpenShift ? "pointer-events-none opacity-70" : ""}`}>
                                    <div className="space-y-2">
                                        <Label htmlFor="openingCash">Kas Awal (Rp)</Label>
                                        <Input id="openingCash" name="openingCash" type="number" required className="rounded-xl" placeholder="0" />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" variant="outline" onClick={() => setOpenDialog(false)} className="rounded-xl">Batal</Button>
                                        <DisabledActionTooltip disabled={!canOpenShift} message={cannotMessage("create")}>
                                            <Button disabled={!canOpenShift} type="submit" className="rounded-xl bg-green-600 hover:bg-green-700">Buka Shift</Button>
                                        </DisabledActionTooltip>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>
                    ) : (
                        <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
                            <DialogTrigger asChild>
                                <DisabledActionTooltip disabled={!canCloseShift} message={cannotMessage("close_shift")}>
                                    <Button disabled={!canCloseShift} className="rounded-lg bg-red-600 hover:bg-red-700">
                                        <StopCircle className="w-4 h-4 mr-2" />
                                        Tutup Shift
                                    </Button>
                                </DisabledActionTooltip>
                            </DialogTrigger>
                            <DialogContent className="rounded-2xl">
                                <DialogHeader>
                                    <DialogTitle>Tutup Shift</DialogTitle>
                                </DialogHeader>
                                <div className="mb-4 p-3 bg-slate-50 rounded-xl text-sm">
                                    <p>Kas Awal: <strong>{formatCurrency(activeShift.openingCash)}</strong></p>
                                    <p>Dibuka: <strong>{format(new Date(activeShift.openedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}</strong></p>
                                </div>
                                <form action={handleCloseShift} className={`space-y-4 ${!canCloseShift ? "pointer-events-none opacity-70" : ""}`}>
                                    <div className="space-y-2">
                                        <Label htmlFor="closingCash">Kas Akhir (Rp)</Label>
                                        <Input id="closingCash" name="closingCash" type="number" required className="rounded-xl" placeholder="0" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="notes">Catatan</Label>
                                        <Input id="notes" name="notes" className="rounded-xl" />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" variant="outline" onClick={() => setCloseDialog(false)} className="rounded-xl">Batal</Button>
                                        <DisabledActionTooltip disabled={!canCloseShift} message={cannotMessage("close_shift")}>
                                            <Button disabled={!canCloseShift} type="submit" className="rounded-xl bg-red-600 hover:bg-red-700">Tutup Shift</Button>
                                        </DisabledActionTooltip>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {activeShift && (
                <Card className="rounded-2xl shadow-sm border-0 border-l-4 border-l-green-500">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <Badge className="bg-green-100 text-green-700">Shift Aktif</Badge>
                            <span className="text-sm text-slate-500">
                                Dibuka sejak {format(new Date(activeShift.openedAt), "dd MMM yyyy HH:mm", { locale: idLocale })}
                            </span>
                            <span className="text-sm font-medium">Kas Awal: {formatCurrency(activeShift.openingCash)}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            <SmartTable<ShiftRow>
                data={data.shifts}
                columns={columns}
                totalItems={data.total}
                mobileRender={(row) => (
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm truncate text-foreground">{getCashierName(row)}</p>
                            <Badge className={`${row.isOpen ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"} text-[10px] shrink-0`}>
                                {row.isOpen ? "Open" : "Closed"}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(row.openedAt), "HH:mm")} &mdash; {row.closedAt ? format(new Date(row.closedAt), "HH:mm") : "..."} &middot; {format(new Date(row.openedAt), "dd MMM yyyy", { locale: idLocale })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Kas: {formatCurrency(row.openingCash)} &rarr; {row.closingCash != null ? formatCurrency(row.closingCash) : "-"}
                        </p>
                    </div>
                )}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Riwayat Shift"
                titleIcon={<Clock className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari shift..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1); fetchData({ page: 1, sortKey: key, sortDir: dir }); }}
                rowKey={(row) => row.id}
                planMenuKey="shifts" exportFilename="shifts"
                emptyIcon={<Clock className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Belum ada riwayat shift"
            />
        </div>
    );
}
