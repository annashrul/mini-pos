"use client";

import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ExportMenu } from "@/components/ui/export-menu";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { useQueryParams } from "@/hooks/use-query-params";
import { useMenuActionAccess } from "@/features/access-control";
import { getPeriodClosingChecklist, createClosingEntries } from "@/server/actions/accounting-reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SmartTable, type SmartColumn, type SmartFilter } from "@/components/ui/smart-table";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Loader2,
    Plus,
    Lock,
    Unlock,
    ShieldAlert,
    Calendar,
    BookOpenCheck,
    MoreVertical,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { DatePicker } from "@/components/ui/date-picker";
import { usePeriods, useCreatePeriod } from "../hooks";
import type { AccountingPeriod } from "../types";

export function PeriodsContent() {
    const {
        periods,
        isPending,
        showCreate,
        setShowCreate,
        confirmAction,
        setConfirmAction,
        handleAction,
        load,
    } = usePeriods();

    const { canAction, cannotMessage } = useMenuActionAccess("accounting-periods");
    const { canAction: canPlan } = usePlanAccess();
    const canCreate = canAction("create") && canPlan("accounting-periods", "create");
    const canClose = canAction("update") && canPlan("accounting-periods", "close");
    const canReopen = canAction("update") && canPlan("accounting-periods", "reopen");
    const canLock = canAction("update") && canPlan("accounting-periods", "lock");

    const qp = useQueryParams({ pageSize: 15, filters: { status: "ALL" } });
    const { page, pageSize, search } = qp;
    const setPage = qp.setPage;
    const setPageSize = qp.setPageSize;

    // Closing wizard
    const [closingPeriodId, setClosingPeriodId] = useState<string | null>(null);
    const [closingChecklist, setClosingChecklist] = useState<Awaited<ReturnType<typeof getPeriodClosingChecklist>> | null>(null);
    const [closingLoading, setClosingLoading] = useState(false);

    const openClosingWizard = async (periodId: string) => {
        setClosingPeriodId(periodId);
        setClosingLoading(true);
        const result = await getPeriodClosingChecklist(periodId);
        setClosingChecklist(result);
        setClosingLoading(false);
    };

    const handleClosePeriod = async () => {
        if (!closingPeriodId) return;
        setClosingLoading(true);
        const result = await createClosingEntries(closingPeriodId);
        if ("error" in result) {
            const { toast } = await import("sonner");
            toast.error(result.error);
        } else {
            const { toast } = await import("sonner");
            toast.success(`Periode ditutup. Jurnal penutup: ${result.entryNumber}`);
            setClosingPeriodId(null);
            setClosingChecklist(null);
            load();
        }
        setClosingLoading(false);
    };
    const activeFilters = qp.filters;

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return periods.filter((p) => {
            if (activeFilters.status && activeFilters.status !== "ALL" && p.status !== activeFilters.status) return false;
            if (!q) return true;
            return (
                p.name.toLowerCase().includes(q) ||
                new Date(p.startDate).toLocaleDateString("id-ID").includes(q) ||
                new Date(p.endDate).toLocaleDateString("id-ID").includes(q)
            );
        });
    }, [periods, search, activeFilters]);

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    const filters: SmartFilter[] = [
        {
            key: "status",
            label: "Status",
            type: "select",
            options: [
                { value: "ALL", label: "Semua" },
                { value: "OPEN", label: "Terbuka" },
                { value: "CLOSED", label: "Ditutup" },
                { value: "LOCKED", label: "Terkunci" },
            ],
        },
    ];

    const columns: SmartColumn<AccountingPeriod>[] = [
        {
            key: "name",
            header: "Periode",
            sortable: true,
            render: (p) => (
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                            {new Date(p.startDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} —{" "}
                            {new Date(p.endDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                    </div>
                </div>
            ),
            exportValue: (p) => p.name,
        },
        {
            key: "status",
            header: "Status",
            render: (p) => (
                <>
                    {p.status === "OPEN" && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 rounded-lg px-2.5 py-0.5 text-xs font-medium gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Terbuka
                        </Badge>
                    )}
                    {p.status === "CLOSED" && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 rounded-lg px-2.5 py-0.5 text-xs font-medium gap-1">
                            <Lock className="w-3 h-3" />
                            Ditutup
                        </Badge>
                    )}
                    {p.status === "LOCKED" && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 rounded-lg px-2.5 py-0.5 text-xs font-medium gap-1">
                            <Lock className="w-3 h-3" />
                            Terkunci
                        </Badge>
                    )}
                </>
            ),
            exportValue: (p) => p.status,
        },
        {
            key: "closedAt",
            header: "Ditutup Pada",
            render: (p) =>
                p.closedAt ? (
                    <span className="text-xs text-muted-foreground">
                        {new Date(p.closedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground/40">-</span>
                ),
            exportValue: (p) =>
                p.closedAt ? new Date(p.closedAt).toISOString() : "",
        },
        {
            key: "actions",
            header: "Aksi",
            sticky: true,
            align: "right",
            render: (p) => (
                <div className="flex items-center justify-end gap-2">
                    {p.status === "OPEN" && (
                        <DisabledActionTooltip disabled={!canClose} message={cannotMessage("update")} menuKey="accounting-periods" actionKey="close">
                            <Button size="sm" variant="outline" disabled={!canClose} className="rounded-lg gap-1.5 text-xs h-8 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => openClosingWizard(p.id)}>
                                <Lock className="w-3 h-3" /> Tutup
                            </Button>
                        </DisabledActionTooltip>
                    )}
                    {p.status === "CLOSED" && (
                        <>
                            <DisabledActionTooltip disabled={!canReopen} message={cannotMessage("update")} menuKey="accounting-periods" actionKey="reopen">
                                <Button size="sm" variant="outline" disabled={!canReopen} className="rounded-lg gap-1.5 text-xs h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setConfirmAction({ id: p.id, action: "reopen" })}>
                                    <Unlock className="w-3 h-3" /> Buka
                                </Button>
                            </DisabledActionTooltip>
                            <DisabledActionTooltip disabled={!canLock} message={cannotMessage("update")} menuKey="accounting-periods" actionKey="lock">
                                <Button size="sm" disabled={!canLock} className="rounded-lg gap-1.5 text-xs h-8 bg-red-600 hover:bg-red-700 text-white shadow-sm" onClick={() => setConfirmAction({ id: p.id, action: "lock" })}>
                                    <ShieldAlert className="w-3 h-3" /> Kunci
                                </Button>
                            </DisabledActionTooltip>
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
                        <BookOpenCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tutup Buku</h1>
                        <p className="text-xs sm:text-sm text-gray-500">
                            Kelola periode akuntansi
                        </p>
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    <ExportMenu module="periods" />
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="accounting-periods" actionKey="create">
                        <Button
                            onClick={() => setShowCreate(true)}
                            disabled={!canCreate}
                            className="rounded-xl gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-md shadow-amber-500/20"
                        >
                            <Plus className="w-4 h-4" />
                            Buat Periode
                        </Button>
                    </DisabledActionTooltip>
                </div>
            </div>

            {/* Mobile: Floating button */}
            <div className="sm:hidden fixed bottom-4 right-4 z-50">
                <Button
                    onClick={() => setShowCreate(true)}
                    size="icon"
                    className="h-12 w-12 rounded-full shadow-xl shadow-amber-300/50 bg-gradient-to-br from-amber-500 to-orange-600"
                >
                    <Plus className="w-5 h-5" />
                </Button>
            </div>

            <SmartTable
                data={pageData}
                columns={columns}
                totalItems={totalItems}
                totalPages={totalPages}
                currentPage={currentPage}
                pageSize={pageSize}
                loading={isPending}
                title="Daftar Periode"
                titleIcon={<Calendar className="w-4 h-4 text-amber-600" />}
                searchPlaceholder="Cari periode..."
                searchValue={search}
                onSearch={(q) => qp.setSearch(q)}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={(f) => qp.setFilters(f)}
                planMenuKey="accounting-periods" exportModule="periods"
                emptyIcon={<Calendar className="w-6 h-6 text-muted-foreground/40" />}
                emptyTitle={isPending ? "Memuat periode..." : "Belum Ada Periode"}
                emptyDescription={isPending ? "Mohon tunggu" : "Buat periode baru untuk memulai"}
                mobileRender={(row) => (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-foreground">{row.name}</span>
                            {row.status === "OPEN" && (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 rounded-lg px-2 py-0.5 text-[11px] font-medium gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Terbuka
                                </Badge>
                            )}
                            {row.status === "CLOSED" && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 rounded-lg px-2 py-0.5 text-[11px] font-medium gap-1">
                                    <Lock className="w-3 h-3" />
                                    Ditutup
                                </Badge>
                            )}
                            {row.status === "LOCKED" && (
                                <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 rounded-lg px-2 py-0.5 text-[11px] font-medium gap-1">
                                    <Lock className="w-3 h-3" />
                                    Terkunci
                                </Badge>
                            )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                            {new Date(row.startDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} —{" "}
                            {new Date(row.endDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                        {(row.status === "OPEN" || row.status === "CLOSED") && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted mt-0.5" onClick={(e) => e.stopPropagation()}>
                                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl w-44">
                                    {row.status === "OPEN" && (
                                        <DropdownMenuItem onClick={() => openClosingWizard(row.id)} className="text-xs gap-2 text-amber-700">
                                            <Lock className="w-3.5 h-3.5" /> Tutup Periode
                                        </DropdownMenuItem>
                                    )}
                                    {row.status === "CLOSED" && (
                                        <>
                                            <DropdownMenuItem onClick={() => setConfirmAction({ id: row.id, action: "reopen" })} className="text-xs gap-2 text-emerald-700">
                                                <Unlock className="w-3.5 h-3.5" /> Buka Kembali
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setConfirmAction({ id: row.id, action: "lock" })} className="text-xs gap-2 text-red-600 focus:text-red-600">
                                                <ShieldAlert className="w-3.5 h-3.5" /> Kunci Permanen
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                )}
            />

            {/* Create Period Dialog */}
            <CreatePeriodDialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={load}
            />

            {/* Closing Wizard Dialog */}
            <Dialog open={!!closingPeriodId} onOpenChange={(v) => { if (!v) { setClosingPeriodId(null); setClosingChecklist(null); } }}>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-xl sm:rounded-2xl p-0 gap-0">
                    <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-600 shrink-0 rounded-t-xl sm:rounded-t-2xl" />
                    <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3">
                        <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                            <Lock className="w-5 h-5 text-amber-500" /> Tutup Periode
                        </DialogTitle>
                    </DialogHeader>
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
                        {closingLoading && !closingChecklist ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">Memeriksa kesiapan...</span>
                            </div>
                        ) : closingChecklist && "checks" in closingChecklist ? (
                            <>
                                <div className="rounded-xl border p-3 bg-slate-50">
                                    <p className="text-xs font-semibold text-foreground mb-0.5">{closingChecklist.period?.name}</p>
                                    <p className="text-[11px] text-muted-foreground">{closingChecklist.period?.dateFrom} — {closingChecklist.period?.dateTo}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold">Checklist Penutupan</p>
                                    {closingChecklist.checks.map((check) => (
                                        <div key={check.key} className={`flex items-center gap-2 p-2.5 rounded-lg border ${check.passed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                                            {check.passed ? (
                                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"><svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0"><svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-medium ${check.passed ? "text-emerald-700" : "text-red-700"}`}>{check.label}</p>
                                                {"count" in check && !check.passed && <p className="text-[10px] text-red-500">{check.count} jurnal belum selesai</p>}
                                                {"missing" in check && !check.passed && <p className="text-[10px] text-red-500">{check.missing} transaksi belum dijurnal</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="outline" className="rounded-xl" onClick={() => { setClosingPeriodId(null); setClosingChecklist(null); }}>Batal</Button>
                                    <Button
                                        className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                                        disabled={!closingChecklist.allPassed || closingLoading}
                                        onClick={handleClosePeriod}
                                    >
                                        {closingLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                                        Tutup & Buat Jurnal Penutup
                                    </Button>
                                </div>
                            </>
                        ) : closingChecklist && "error" in closingChecklist ? (
                            <p className="text-sm text-red-600">{closingChecklist.error}</p>
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>

            <ActionConfirmDialog
                open={!!confirmAction}
                onOpenChange={() => setConfirmAction(null)}
                kind={confirmAction?.action === "lock" ? "delete" : "approve"}
                title={
                    confirmAction?.action === "close"
                        ? "Tutup Periode?"
                        : confirmAction?.action === "reopen"
                            ? "Buka Kembali Periode?"
                            : "Kunci Permanen Periode?"
                }
                description={
                    confirmAction?.action === "close"
                        ? "Jurnal dalam periode ini tidak bisa diubah lagi setelah ditutup. Anda masih bisa membuka kembali nanti."
                        : confirmAction?.action === "reopen"
                            ? "Jurnal dalam periode ini akan bisa diubah kembali setelah dibuka."
                            : "Periode yang dikunci tidak bisa dibuka kembali. Pastikan semua jurnal sudah benar sebelum mengunci."
                }
                confirmLabel="Konfirmasi"
                loading={isPending}
                confirmDisabled={
                    confirmAction?.action === "close"
                        ? !canClose
                        : confirmAction?.action === "reopen"
                            ? !canReopen
                            : !canLock
                }
                onConfirm={handleAction}
            />
        </div>
    );
}

function CreatePeriodDialog({
    open,
    onClose,
    onCreated,
}: {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
}) {
    const { form, isPending, onSubmit } = useCreatePeriod(open, onClose, onCreated);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="rounded-2xl max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg">Buat Periode Baru</DialogTitle>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Tentukan nama dan rentang tanggal periode
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                            Nama Periode
                        </Label>
                        <Input
                            {...form.register("name")}
                            placeholder="Contoh: April 2026"
                            className="rounded-xl h-10"
                        />
                        {form.formState.errors.name && (
                            <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                                Tanggal Mulai
                            </Label>
                            <Controller
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <DatePicker
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="Pilih tanggal"
                                        className="rounded-xl h-10"
                                    />
                                )}
                            />
                            {form.formState.errors.startDate && (
                                <p className="text-xs text-red-500 mt-1">{form.formState.errors.startDate.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                                Tanggal Selesai
                            </Label>
                            <Controller
                                control={form.control}
                                name="endDate"
                                render={({ field }) => (
                                    <DatePicker
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="Pilih tanggal"
                                        className="rounded-xl h-10"
                                    />
                                )}
                            />
                            {form.formState.errors.endDate && (
                                <p className="text-xs text-red-500 mt-1">{form.formState.errors.endDate.message}</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2 mt-4">
                        <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="rounded-xl gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-md shadow-amber-500/20"
                        >
                            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Buat Periode
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
