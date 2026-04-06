"use client";

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
  const [activeSection, setActiveSection] = useState<string>("Semua");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TableRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();
  const { selectedBranchId } = useBranch();
  const { canAction, cannotMessage } = useMenuActionAccess("tables");
  const canCreate = canAction("create");
  const canUpdate = canAction("update");
  const canDelete = canAction("delete");
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

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const [tablesData, statsData, sectionsData] = await Promise.all([
        getTables(selectedBranchId || undefined),
        getTableStats(selectedBranchId || undefined),
        getTableSections(selectedBranchId || undefined),
      ]);
      setTables(tablesData as TableRecord[]);
      setStats(statsData);
      setSections(sectionsData);
    });
  }, [selectedBranchId]);

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
    if (!canCreate) { toast.error(cannotMessage("create")); return; }
    setEditing(null);
    form.reset({ number: (tables.length > 0 ? Math.max(...tables.map(t => t.number)) + 1 : 1), name: "", capacity: 4, section: "", status: "AVAILABLE", isActive: true });
    setDialogOpen(true);
  };

  const openEditDialog = (table: TableRecord) => {
    if (!canUpdate) { toast.error(cannotMessage("update")); return; }
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
    if (!canUpdate) { toast.error(cannotMessage("update")); return; }
    try {
      await updateTableStatus(tableId, newStatus);
      toast.success(`Status meja diubah ke ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      fetchData();
    } catch {
      toast.error("Gagal mengubah status meja");
    }
  };

  const handleDelete = (id: string) => {
    if (!canDelete) { toast.error(cannotMessage("delete")); return; }
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

  // Filter tables by section
  const filteredTables = activeSection === "Semua"
    ? tables
    : tables.filter(t => (t.section || "Lainnya") === activeSection);

  // Group tables by section for display
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200/50">
            <Armchair className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Manajemen Meja</h1>
            <p className="text-xs text-muted-foreground">Kelola meja restoran, status, dan kapasitas</p>
          </div>
        </div>
        <Button
          onClick={openCreateDialog}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-md shadow-violet-200/50 gap-2"
        >
          <Plus className="w-4 h-4" />
          Tambah Meja
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Meja" value={stats.total} gradient="from-violet-500 to-purple-600" icon={<LayoutGrid className="w-4 h-4 text-white" />} />
        <StatsCard label="Tersedia" value={stats.available} gradient="from-emerald-500 to-emerald-600" icon={<CheckCircle2 className="w-4 h-4 text-white" />} />
        <StatsCard label="Terisi" value={stats.occupied} gradient="from-red-500 to-red-600" icon={<Users className="w-4 h-4 text-white" />} />
        <StatsCard label="Nonaktif" value={inactiveCount} gradient="from-gray-400 to-gray-500" icon={<XCircle className="w-4 h-4 text-white" />} />
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {["Semua", ...sections, ...(tables.some(t => !t.section) ? ["Lainnya"] : [])].filter((v, i, a) => a.indexOf(v) === i).map(sec => (
          <Button
            key={sec}
            variant={activeSection === sec ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSection(sec)}
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
    <Card className="rounded-2xl border-0 shadow-sm bg-white">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm", gradient)}>
          {icon}
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
          <p className="text-xl font-bold text-foreground leading-none mt-0.5">{value}</p>
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

  return (
    <Card className={cn(
      "rounded-2xl border shadow-sm transition-all duration-200 hover:shadow-md group relative overflow-hidden",
      !table.isActive && "opacity-50",
      statusCfg.borderColor
    )}>
      {/* Status bar top */}
      <div className={cn("h-1 bg-gradient-to-r", cardGradient)} />
      <CardContent className="p-3 space-y-2">
        {/* Number + actions */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold", statusCfg.bgColor, statusCfg.color)}>
              {table.number}
            </div>
            {!table.isActive && (
              <Badge variant="secondary" className="text-[9px] bg-gray-100 text-gray-500">
                Nonaktif
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
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
        </div>

        {/* Name */}
        {table.name && (
          <p className="text-xs font-medium text-foreground truncate">{table.name}</p>
        )}

        {/* Capacity + Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-3 h-3" />
            <span className="text-[10px]">{table.capacity}</span>
          </div>
          <Badge variant="secondary" className={cn("text-[9px] rounded-full px-2 py-0", statusCfg.bgColor, statusCfg.color, "border-0")}>
            {statusCfg.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
