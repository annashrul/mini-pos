"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SmartTable, type SmartColumn, type SmartFilter } from "@/components/ui/smart-table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
    AlertTriangle,
} from "lucide-react";
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

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ status: "ALL" });

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
                        <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg gap-1.5 text-xs h-8 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 transition-colors"
                            onClick={() => setConfirmAction({ id: p.id, action: "close" })}
                        >
                            <Lock className="w-3 h-3" />
                            Tutup
                        </Button>
                    )}
                    {p.status === "CLOSED" && (
                        <>
                            <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg gap-1.5 text-xs h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 transition-colors"
                                onClick={() => setConfirmAction({ id: p.id, action: "reopen" })}
                            >
                                <Unlock className="w-3 h-3" />
                                Buka
                            </Button>
                            <Button
                                size="sm"
                                className="rounded-lg gap-1.5 text-xs h-8 bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-500/20 transition-colors"
                                onClick={() => setConfirmAction({ id: p.id, action: "lock" })}
                            >
                                <ShieldAlert className="w-3 h-3" />
                                Kunci
                            </Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                        <BookOpenCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Tutup Buku</h1>
                        <p className="text-sm text-gray-500">
                            Kelola periode akuntansi, tutup buku, dan kunci periode
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => setShowCreate(true)}
                    className="rounded-xl gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-md shadow-amber-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Buat Periode
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
                headerActions={
                    <Button
                        onClick={() => setShowCreate(true)}
                        size="sm"
                        className="rounded-lg h-8 text-xs gap-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-sm shadow-amber-500/20"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Buat Periode
                    </Button>
                }
                searchPlaceholder="Cari periode..."
                onSearch={(q) => { setSearch(q); setPage(1); }}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={(f) => { setActiveFilters(f); setPage(1); }}
                exportFilename="tutup-buku"
                emptyIcon={<Calendar className="w-6 h-6 text-muted-foreground/40" />}
                emptyTitle={isPending ? "Memuat periode..." : "Belum Ada Periode"}
                emptyDescription={isPending ? "Mohon tunggu" : "Buat periode baru untuk memulai"}
            />

            {/* Create Period Dialog */}
            <CreatePeriodDialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={load}
            />

            {/* Confirm Action Dialog */}
            <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center ${confirmAction?.action === "close"
                                    ? "bg-amber-100"
                                    : confirmAction?.action === "reopen"
                                        ? "bg-emerald-100"
                                        : "bg-red-100"
                                    }`}
                            >
                                {confirmAction?.action === "close" && (
                                    <Lock className="w-5 h-5 text-amber-600" />
                                )}
                                {confirmAction?.action === "reopen" && (
                                    <Unlock className="w-5 h-5 text-emerald-600" />
                                )}
                                {confirmAction?.action === "lock" && (
                                    <ShieldAlert className="w-5 h-5 text-red-600" />
                                )}
                            </div>
                            <DialogTitle className="text-lg">
                                {confirmAction?.action === "close" && "Tutup Periode?"}
                                {confirmAction?.action === "reopen" && "Buka Kembali Periode?"}
                                {confirmAction?.action === "lock" && "Kunci Permanen Periode?"}
                            </DialogTitle>
                        </div>
                    </DialogHeader>
                    <DialogDescription className="text-sm text-gray-500 leading-relaxed">
                        {confirmAction?.action === "close" &&
                            "Jurnal dalam periode ini tidak bisa diubah lagi setelah ditutup. Anda masih bisa membuka kembali nanti."}
                        {confirmAction?.action === "reopen" &&
                            "Jurnal dalam periode ini akan bisa diubah kembali setelah dibuka."}
                        {confirmAction?.action === "lock" && (
                            <span className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                <span>
                                    Periode yang dikunci{" "}
                                    <strong className="text-red-600">
                                        TIDAK BISA dibuka kembali
                                    </strong>
                                    . Pastikan semua jurnal sudah benar sebelum mengunci.
                                </span>
                            </span>
                        )}
                    </DialogDescription>
                    <DialogFooter className="gap-2 mt-2">
                        <Button
                            variant="outline"
                            onClick={() => setConfirmAction(null)}
                            className="rounded-xl"
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleAction}
                            disabled={isPending}
                            variant={
                                confirmAction?.action === "lock" ? "destructive" : "default"
                            }
                            className={`rounded-xl gap-2 ${confirmAction?.action === "close"
                                ? "bg-amber-600 hover:bg-amber-700"
                                : confirmAction?.action === "reopen"
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : ""
                                }`}
                        >
                            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Konfirmasi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
