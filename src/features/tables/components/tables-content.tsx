"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    getTables,
    createTable,
    updateTable,
    deleteTable,
    updateTableStatus,
    getTableStats,
    getTableSections,
} from "@/server/actions/tables";
import { useMenuActionAccess } from "@/features/access-control";
import { useBranch } from "@/components/providers/branch-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Armchair,
    Plus,
    Users,
    Pencil,
    Trash2,
    MoreVertical,
    Loader2,
    CheckCircle2,
    XCircle,
    Sparkles,
    LayoutGrid,
    SlidersHorizontal,
    Check,
    Search,
} from "lucide-react";

// --- Types ---

type TableRecord = {
    id: string;
    number: number;
    name: string | null;
    capacity: number;
    status: string;
    branchId: string | null;
    isActive: boolean;
    sortOrder: number;
    section: string | null;
    createdAt: Date;
    updatedAt: Date;
};

type Stats = {
    total: number;
    active: number;
    available: number;
    occupied: number;
    reserved: number;
    cleaning: number;
};

// --- Zod schema ---

const tableFormSchema = z.object({
    number: z.coerce.number().int().min(1, "Nomor meja harus minimal 1"),
    name: z.string().optional(),
    capacity: z.coerce.number().int().min(1, "Kapasitas minimal 1"),
    section: z.string().optional(),
    status: z.string(),
    isActive: z.boolean(),
});

type TableFormValues = z.infer<typeof tableFormSchema>;

// --- Status config ---

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; iconColor: string }> = {
    AVAILABLE: { label: "Tersedia", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-200", iconColor: "text-emerald-500" },
    OCCUPIED: { label: "Terisi", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-200", iconColor: "text-red-500" },
    RESERVED: { label: "Dipesan", color: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-200", iconColor: "text-amber-500" },
    CLEANING: { label: "Dibersihkan", color: "text-gray-700", bgColor: "bg-gray-50", borderColor: "border-gray-200", iconColor: "text-gray-500" },
};

const STATUS_CARD_GRADIENT: Record<string, string> = {
    AVAILABLE: "from-emerald-500 to-emerald-600",
    OCCUPIED: "from-red-500 to-red-600",
    RESERVED: "from-amber-500 to-amber-600",
    CLEANING: "from-gray-400 to-gray-500",
};

// --- Component ---

export function TablesContent() {
    const [tables, setTables] = useState<TableRecord[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, active: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0 });
    const [sections, setSections] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [activeSection, setActiveSection] = useState<string>("Semua");
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [draftSection, setDraftSection] = useState("Semua");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<TableRecord | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [loading, startTransition] = useTransition();
    const { selectedBranchId } = useBranch();
    const { canAction, cannotMessage } = useMenuActionAccess("tables");
    const { canAction: canPlanAction, getPlanBlockMessage } = usePlanAccess();
    const canCreate = canAction("create") && canPlanAction("tables", "create");
    const canUpdate = canAction("update") && canPlanAction("tables", "update");
    const canDelete = canAction("delete") && canPlanAction("tables", "delete");
    const getMessage = (ak: string) => getPlanBlockMessage("tables", ak) ?? cannotMessage(ak);
    const didFetchRef = useRef(false);

    const form = useForm({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(tableFormSchema) as any,
        defaultValues: {
            number: 1,
            name: "",
            capacity: 4,
            section: "",
            status: "AVAILABLE",
            isActive: true,
        },
    });

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchRef = useRef(search);
    const sectionRef = useRef(activeSection);
    searchRef.current = search;
    sectionRef.current = activeSection;

    const fetchData = useCallback((params?: { search?: string; section?: string }) => {
        const q = (params?.search ?? searchRef.current).trim() || undefined;
        const sec = params?.section ?? sectionRef.current;
        const sectionParam = sec === "Semua" ? undefined : sec;
        startTransition(async () => {
            const [tablesData, statsData, sectionsData] = await Promise.all([
                getTables(selectedBranchId || undefined, q, sectionParam),
                getTableStats(selectedBranchId || undefined),
                getTableSections(selectedBranchId || undefined),
            ]);
            setTables(tablesData as TableRecord[]);
            setStats(statsData);
            setSections(sectionsData);
        });
    }, [selectedBranchId]);

    const handleSearch = (value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchData({ search: value });
        }, 300);
    };

    const handleSectionFilter = (section: string) => {
        setActiveSection(section);
        fetchData({ section });
    };

    useEffect(() => {
        if (didFetchRef.current) return;
        didFetchRef.current = true;
        fetchData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (didFetchRef.current) {
            fetchData();
        }
    }, [selectedBranchId, fetchData]);

    const openCreateDialog = () => {
        if (!canCreate) { toast.error(getMessage("create")); return; }
        setEditing(null);
        form.reset({ number: (tables.length > 0 ? Math.max(...tables.map(t => t.number)) + 1 : 1), name: "", capacity: 4, section: "", status: "AVAILABLE", isActive: true });
        setDialogOpen(true);
    };

    const openEditDialog = (table: TableRecord) => {
        if (!canUpdate) { toast.error(getMessage("update")); return; }
        setEditing(table);
        form.reset({
            number: table.number,
            name: table.name || "",
            capacity: table.capacity,
            section: table.section || "",
            status: table.status,
            isActive: table.isActive,
        });
        setDialogOpen(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSubmit = async (raw: any) => {
        const values = raw as TableFormValues;
        try {
            if (editing) {
                await updateTable(editing.id, {
                    number: values.number,
                    ...(values.name ? { name: values.name } : {}),
                    capacity: values.capacity,
                    ...(values.section ? { section: values.section } : {}),
                    isActive: values.isActive,
                    sortOrder: values.number,
                });
                toast.success("Meja berhasil diperbarui");
            } else {
                await createTable({
                    number: values.number,
                    ...(values.name ? { name: values.name } : {}),
                    capacity: values.capacity,
                    ...(values.section ? { section: values.section } : {}),
                    ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
                });
                toast.success("Meja berhasil ditambahkan");
            }
            setDialogOpen(false);
            setEditing(null);
            fetchData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Gagal menyimpan meja");
        }
    };

    const handleStatusChange = async (tableId: string, newStatus: string) => {
        if (!canUpdate) { toast.error(getMessage("update")); return; }
        try {
            await updateTableStatus(tableId, newStatus);
            toast.success(`Status meja diubah ke ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
            fetchData();
        } catch {
            toast.error("Gagal mengubah status meja");
        }
    };

    const handleDelete = (id: string) => {
        if (!canDelete) { toast.error(getMessage("delete")); return; }
        setPendingDeleteId(id);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!pendingDeleteId) return;
        try {
            await deleteTable(pendingDeleteId);
            toast.success("Meja berhasil dihapus");
            fetchData();
        } catch {
            toast.error("Gagal menghapus meja");
        }
        setDeleteDialogOpen(false);
        setPendingDeleteId(null);
    };

    // Group tables by section for display (filtering is now server-side)
    const filteredTables = tables;
    const groupedTables = filteredTables.reduce<Record<string, TableRecord[]>>((acc, table) => {
        const sec = table.section || "Lainnya";
        if (!acc[sec]) acc[sec] = [];
        acc[sec].push(table);
        return acc;
    }, {});

    const inactiveCount = stats.total - stats.active;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200/50 shrink-0">
                        <Armchair className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">Manajemen Meja</h1>
                        <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Kelola meja, status, dan kapasitas</p>
                    </div>
                </div>
                <Button
                    onClick={openCreateDialog}
                    className="hidden sm:inline-flex rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-md shadow-violet-200/50 gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Tambah Meja
                </Button>
            </div>

            {/* Mobile: Floating button */}
            <div className="sm:hidden fixed bottom-4 right-4 z-50">
                <Button
                    onClick={openCreateDialog}
                    size="icon"
                    className="h-12 w-12 rounded-full shadow-xl shadow-violet-300/50 bg-gradient-to-br from-violet-500 to-purple-600"
                >
                    <Plus className="w-5 h-5" />
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-4">
                <StatsCard label="Total" value={stats.total} gradient="from-violet-500 to-purple-600" icon={<LayoutGrid className="w-3 h-3 sm:w-4 sm:h-4 text-white" />} />
                <StatsCard label="Tersedia" value={stats.available} gradient="from-emerald-500 to-emerald-600" icon={<CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />} />
                <StatsCard label="Terisi" value={stats.occupied} gradient="from-red-500 to-red-600" icon={<Users className="w-3 h-3 sm:w-4 sm:h-4 text-white" />} />
                <StatsCard label="Nonaktif" value={inactiveCount} gradient="from-gray-400 to-gray-500" icon={<XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />} />
            </div>

            {/* Search + Filter */}
            {(() => {
                const sectionOptions = ["Semua", ...sections, ...(tables.some(t => !t.section) ? ["Lainnya"] : [])].filter((v, i, a) => a.indexOf(v) === i);
                return (
                    <>
                        {/* Mobile: search + filter button side by side */}
                        <div className="sm:hidden flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari meja..."
                                    value={search}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="pl-9 rounded-xl h-9"
                                />
                                {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                            </div>
                            <Button variant="outline" size="sm" className="shrink-0 rounded-xl h-9 gap-1.5 relative" onClick={() => { setDraftSection(activeSection); setFilterSheetOpen(true); }}>
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span className="text-xs">Filter</span>
                                {activeSection !== "Semua" && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">1</span>
                                )}
                            </Button>
                            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                                <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                                    <div className="shrink-0">
                                        <div className="flex justify-center pt-3 pb-2">
                                            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                                        </div>
                                        <SheetHeader className="px-4 pb-3 pt-0">
                                            <SheetTitle className="text-base font-bold">Filter Bagian</SheetTitle>
                                        </SheetHeader>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 space-y-1">
                                        {sectionOptions.map((sec) => {
                                            const isActive = draftSection === sec;
                                            return (
                                                <button
                                                    key={sec}
                                                    onClick={() => setDraftSection(sec)}
                                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"}`}
                                                >
                                                    <span>{sec}</span>
                                                    {isActive && <Check className="w-4 h-4" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <SheetFooter className="shrink-0 border-t px-4 py-3 flex-row gap-2">
                                        <Button variant="outline" className="flex-1 rounded-xl h-10 text-sm" onClick={() => setDraftSection("Semua")}>
                                            Reset
                                        </Button>
                                        <Button className="flex-1 rounded-xl h-10 text-sm shadow-md" onClick={() => { handleSectionFilter(draftSection); setFilterSheetOpen(false); }}>
                                            Terapkan Filter
                                        </Button>
                                    </SheetFooter>
                                </SheetContent>
                            </Sheet>
                        </div>
                        {/* Desktop: search left + pills right */}
                        <div className="hidden sm:flex items-center justify-between gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari nomor, nama, atau bagian meja..."
                                    value={search}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="pl-9 rounded-xl h-10"
                                />
                                {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                {sectionOptions.map(sec => (
                                    <Button
                                        key={sec}
                                        variant={activeSection === sec ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handleSectionFilter(sec)}
                                        className={cn(
                                            "rounded-full text-xs h-8 px-4",
                                            activeSection === sec
                                                ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm"
                                                : "border-slate-200 text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        {sec}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </>
                );
            })()}

            {/* Loading state */}
            {loading && tables.length === 0 && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                </div>
            )}

            {/* Empty state */}
            {!loading && tables.length === 0 && (
                <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-4">
                            <Armchair className="w-8 h-8 text-violet-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">Belum ada meja</h3>
                        <p className="text-xs text-muted-foreground mb-4">Tambahkan meja pertama untuk mulai mengelola restoran</p>
                        <Button
                            onClick={openCreateDialog}
                            className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 gap-2"
                            size="sm"
                        >
                            <Plus className="w-4 h-4" />
                            Tambah Meja
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Table Grid by Section */}
            {Object.entries(groupedTables).map(([sectionName, sectionTables]) => (
                <div key={sectionName} className="space-y-3">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{sectionName}</h3>
                        <Badge variant="secondary" className="text-[10px] rounded-full bg-slate-100 text-slate-500">
                            {sectionTables.length} meja
                        </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {sectionTables.map(table => (
                            <TableCard
                                key={table.id}
                                table={table}
                                canUpdate={canUpdate}
                                canDelete={canDelete}
                                onEdit={() => openEditDialog(table)}
                                onDelete={() => handleDelete(table.id)}
                                onStatusChange={(status) => handleStatusChange(table.id, status)}
                            />
                        ))}
                    </div>
                </div>
            ))}

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}>
                <DialogContent className="sm:max-w-[440px] rounded-2xl p-0 overflow-hidden">
                    {/* Gradient accent bar */}
                    <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-600" />
                    <div className="p-6 space-y-5">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold">
                                {editing ? "Edit Meja" : "Tambah Meja Baru"}
                            </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Nomor Meja <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="number"
                                        {...form.register("number")}
                                        className="rounded-xl h-9 text-sm"
                                        placeholder="1"
                                    />
                                    {form.formState.errors.number && (
                                        <p className="text-[10px] text-red-500">{form.formState.errors.number.message}</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Kapasitas <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="number"
                                        {...form.register("capacity")}
                                        className="rounded-xl h-9 text-sm"
                                        placeholder="4"
                                    />
                                    {form.formState.errors.capacity && (
                                        <p className="text-[10px] text-red-500">{form.formState.errors.capacity.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Nama Meja</Label>
                                <Input
                                    {...form.register("name")}
                                    className="rounded-xl h-9 text-sm"
                                    placeholder="cth: Meja VIP 1, Outdoor 3"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Section / Area</Label>
                                <Input
                                    {...form.register("section")}
                                    className="rounded-xl h-9 text-sm"
                                    placeholder="cth: Indoor, Outdoor, VIP"
                                    list="section-options"
                                />
                                <datalist id="section-options">
                                    {sections.map(s => <option key={s} value={s} />)}
                                </datalist>
                            </div>

                            {editing && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Status</Label>
                                    <Select
                                        value={form.watch("status")}
                                        onValueChange={(v) => form.setValue("status", v)}
                                    >
                                        <SelectTrigger className="rounded-xl h-9 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                                <SelectItem key={key} value={key}>
                                                    <span className={cfg.color}>{cfg.label}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {editing && (
                                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <div>
                                        <p className="text-xs font-medium text-foreground">Aktif</p>
                                        <p className="text-[10px] text-muted-foreground">Meja nonaktif tidak muncul di POS</p>
                                    </div>
                                    <Switch
                                        checked={form.watch("isActive")}
                                        onCheckedChange={(v) => form.setValue("isActive", v)}
                                    />
                                </div>
                            )}

                            <DialogFooter className="gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => { setDialogOpen(false); setEditing(null); }}
                                    className="rounded-xl"
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={form.formState.isSubmitting}
                                    className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 gap-2"
                                >
                                    {form.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {editing ? "Simpan" : "Tambah"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Meja</AlertDialogTitle>
                        <AlertDialogDescription>
                            Apakah Anda yakin ingin menghapus meja ini? Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl" onClick={() => setPendingDeleteId(null)}>
                            Batal
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="rounded-xl bg-red-500 hover:bg-red-600"
                        >
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// --- Stats Card ---

function StatsCard({ label, value, gradient, icon }: { label: string; value: number; gradient: string; icon: React.ReactNode }) {
    return (
        <Card className="rounded-2xl border-0 shadow-sm bg-white py-0 gap-0">
            <CardContent className="p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
                <div className={cn("w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm shrink-0", gradient)}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">{label}</p>
                    <p className="text-sm sm:text-xl font-bold text-foreground leading-none mt-0.5">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

// --- Table Card ---

function TableCard({
    table,
    canUpdate,
    canDelete,
    onEdit,
    onDelete,
    onStatusChange,
}: {
    table: TableRecord;
    canUpdate: boolean;
    canDelete: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onStatusChange: (status: string) => void;
}) {
    const statusCfg = (STATUS_CONFIG[table.status] ?? STATUS_CONFIG["AVAILABLE"])!;
    const cardGradient = STATUS_CARD_GRADIENT[table.status] || STATUS_CARD_GRADIENT.AVAILABLE;

    const chairCount = Math.min(table.capacity, 8);

    return (
        <div className={cn(
            "group relative rounded-xl sm:rounded-2xl border-2 transition-all duration-200 hover:shadow-lg overflow-hidden",
            !table.isActive && "opacity-50",
            statusCfg.borderColor,
            table.status === "AVAILABLE" ? "bg-gradient-to-br from-white to-emerald-50/30" :
            table.status === "OCCUPIED" ? "bg-gradient-to-br from-white to-red-50/40" :
            table.status === "RESERVED" ? "bg-gradient-to-br from-white to-amber-50/40" :
            "bg-gradient-to-br from-white to-gray-50/40"
        )}>
            {/* Dropdown trigger */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 h-5 w-5 sm:h-6 sm:w-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white shadow-sm z-10">
                        <MoreVertical className="w-3 h-3 text-muted-foreground" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl w-44">
                    {canUpdate && (
                        <DropdownMenuItem onClick={onEdit} className="text-xs gap-2">
                            <Pencil className="w-3.5 h-3.5" /> Edit Meja
                        </DropdownMenuItem>
                    )}
                    {canUpdate && Object.entries(STATUS_CONFIG).filter(([key]) => key !== table.status).map(([key, cfg]) => (
                        <DropdownMenuItem key={key} onClick={() => onStatusChange(key)} className="text-xs gap-2">
                            <Sparkles className={cn("w-3.5 h-3.5", cfg.iconColor)} />
                            <span>{cfg.label}</span>
                        </DropdownMenuItem>
                    ))}
                    {canDelete && (
                        <DropdownMenuItem onClick={onDelete} className="text-xs gap-2 text-red-600 focus:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Table content */}
            <div className="flex flex-col items-center justify-center py-4 sm:py-5 px-2">
                {/* Table number */}
                <span className={cn("text-xl sm:text-2xl font-extrabold font-mono tabular-nums", statusCfg.color)}>
                    {table.number}
                </span>

                {/* Table name */}
                {table.name && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate max-w-full mt-0.5">{table.name}</p>
                )}

                {/* Chairs */}
                <div className="flex items-center justify-center gap-1 sm:gap-1.5 mt-2 sm:mt-3">
                    {Array.from({ length: chairCount }).map((_, i) => (
                        <div key={i} className={cn("w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br shadow-sm", cardGradient)} />
                    ))}
                </div>

                {/* Capacity + Status */}
                <div className="flex items-center gap-1.5 mt-1.5 sm:mt-2">
                    <div className="flex items-center gap-0.5 text-muted-foreground">
                        <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span className="text-[9px] sm:text-[10px] font-medium">{table.capacity}</span>
                    </div>
                    <span className="text-muted-foreground/30">·</span>
                    <span className={cn("text-[9px] sm:text-[10px] font-semibold", statusCfg.color)}>{statusCfg.label}</span>
                </div>

                {!table.isActive && (
                    <Badge variant="secondary" className="text-[8px] sm:text-[9px] bg-gray-100 text-gray-500 mt-1 px-1.5 py-0">
                        Nonaktif
                    </Badge>
                )}
            </div>
        </div>
    );
}
