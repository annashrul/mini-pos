"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Sun, Sunset, Moon, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

type UserOption = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type ScheduleEntry = {
  id: string;
  userId: string;
  date: Date;
  shiftStart: string;
  shiftEnd: string;
  shiftLabel: string | null;
  status: string;
  notes: string | null;
} | null;

const SHIFT_PRESETS = [
  { label: "Pagi", value: "Pagi", start: "08:00", end: "16:00", icon: Sun, color: "bg-blue-100 text-blue-700 border-blue-300" },
  { label: "Siang", value: "Siang", start: "14:00", end: "22:00", icon: Sunset, color: "bg-amber-100 text-amber-700 border-amber-300" },
  { label: "Malam", value: "Malam", start: "22:00", end: "06:00", icon: Moon, color: "bg-purple-100 text-purple-700 border-purple-300" },
  { label: "Custom", value: "Custom", start: "", end: "", icon: Clock, color: "bg-gray-100 text-gray-700 border-gray-300" },
] as const;

const STATUS_OPTIONS = [
  { label: "Terjadwal", value: "SCHEDULED" },
  { label: "Dikonfirmasi", value: "CONFIRMED" },
  { label: "Tidak Hadir", value: "ABSENT" },
  { label: "Cuti", value: "LEAVE" },
];

const scheduleSchema = z.object({
  employeeId: z.string().min(1, "Pilih karyawan"),
  date: z.string().min(1, "Pilih tanggal"),
  startTime: z.string().min(1, "Isi waktu mulai"),
  endTime: z.string().min(1, "Isi waktu selesai"),
  status: z.string(),
  notes: z.string().optional(),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    userId: string;
    date: string;
    shiftStart: string;
    shiftEnd: string;
    shiftLabel?: string | undefined;
    branchId?: string | undefined;
    notes?: string | undefined;
    status?: string | undefined;
  }) => Promise<void>;
  onDelete?: ((id: string) => Promise<void>) | undefined;
  users: UserOption[];
  initialDate?: string | undefined;
  initialUserId?: string | undefined;
  existing?: ScheduleEntry | undefined;
  branchId?: string | undefined;
}

export function ScheduleDialog({
  open,
  onClose,
  onSave,
  onDelete,
  users,
  initialDate,
  initialUserId,
  existing,
  branchId,
}: ScheduleDialogProps) {
  const [shiftPreset, setShiftPreset] = useState<string>("Pagi");
  const [saving, setSaving] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingSubmitValues, setPendingSubmitValues] = useState<ScheduleFormValues | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      employeeId: initialUserId || "",
      date: initialDate || "",
      startTime: "08:00",
      endTime: "16:00",
      status: "SCHEDULED",
      notes: "",
    },
  });

  const watchedDate = watch("date");
  const watchedEmployeeId = watch("employeeId");

  useEffect(() => {
    if (open) {
      if (existing) {
        const dateStr = existing.date instanceof Date
          ? existing.date.toISOString().slice(0, 10)
          : String(existing.date).slice(0, 10);
        reset({
          employeeId: existing.userId,
          date: dateStr,
          startTime: existing.shiftStart,
          endTime: existing.shiftEnd,
          status: existing.status,
          notes: existing.notes || "",
        });
        const matchedPreset = SHIFT_PRESETS.find(
          (p) => p.start === existing.shiftStart && p.end === existing.shiftEnd,
        );
        setShiftPreset(matchedPreset ? matchedPreset.value : "Custom");
      } else {
        reset({
          employeeId: initialUserId || "",
          date: initialDate || "",
          startTime: "08:00",
          endTime: "16:00",
          status: "SCHEDULED",
          notes: "",
        });
        setShiftPreset("Pagi");
      }
    }
  }, [open, existing, initialDate, initialUserId, reset]);

  function handlePresetClick(preset: typeof SHIFT_PRESETS[number]) {
    setShiftPreset(preset.value);
    if (preset.value !== "Custom") {
      setValue("startTime", preset.start);
      setValue("endTime", preset.end);
    }
  }

  async function executeSave(values: ScheduleFormValues) {
    setSaving(true);
    try {
      await onSave({
        userId: values.employeeId,
        date: values.date,
        shiftStart: values.startTime,
        shiftEnd: values.endTime,
        shiftLabel: shiftPreset === "Custom" ? undefined : shiftPreset,
        branchId: branchId || undefined,
        notes: values.notes || undefined,
        status: values.status,
      });
      onClose();
    } catch {
      toast.error("Gagal menyimpan jadwal");
    } finally {
      setSaving(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function onSubmit(data: any) {
    const values = data as ScheduleFormValues;
    setPendingSubmitValues(values);
    setSubmitConfirmOpen(true);
  }

  async function handleDeleteConfirmed() {
    if (!existing?.id || !onDelete) return;
    setSaving(true);
    try {
      await onDelete(existing.id);
      onClose();
    } catch {
      toast.error("Gagal menghapus jadwal");
    } finally {
      setSaving(false);
    }
  }

  const selectedUser = users.find((u) => u.id === watchedEmployeeId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] flex flex-col p-0 rounded-2xl overflow-hidden gap-0 sm:max-w-md">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>
            {existing ? "Edit Jadwal" : "Tambah Jadwal"}
          </DialogTitle>
          <DialogDescription>
            {existing ? "Ubah detail jadwal karyawan" : "Buat jadwal shift baru untuk karyawan"}
          </DialogDescription>
        </DialogHeader>

        <form id="schedule-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Employee Select */}
            <div className="space-y-2">
              <Label>Karyawan <span className="text-red-500">*</span></Label>
              <Controller
                control={control}
                name="employeeId"
                render={({ field }) => (
                  <Popover open={userOpen} onOpenChange={setUserOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={userOpen}
                        className="w-full justify-between font-normal"
                        disabled={!!existing}
                      >
                        {selectedUser
                          ? selectedUser.name || selectedUser.email
                          : "Pilih karyawan..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cari karyawan..." />
                        <CommandList>
                          <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {users.map((u) => (
                              <CommandItem
                                key={u.id}
                                value={`${u.name || ""} ${u.email}`}
                                onSelect={() => {
                                  field.onChange(u.id);
                                  setUserOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === u.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{u.name || u.email}</span>
                                  <span className="text-xs text-muted-foreground">{u.role}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.employeeId && (
                <p className="text-xs text-red-500">{errors.employeeId.message}</p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Tanggal <span className="text-red-500">*</span></Label>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Pilih tanggal..."
                  />
                )}
              />
              {errors.date && (
                <p className="text-xs text-red-500">{errors.date.message}</p>
              )}
              {watchedDate && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(watchedDate + "T00:00:00"), "EEEE, d MMMM yyyy", { locale: idLocale })}
                </p>
              )}
            </div>

            {/* Shift Presets */}
            <div className="space-y-2">
              <Label>Shift <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-4 gap-2">
                {SHIFT_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 text-xs font-medium transition-all",
                        shiftPreset === preset.value
                          ? preset.color + " border-current shadow-sm"
                          : "border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Time */}
            {shiftPreset === "Custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Mulai <span className="text-red-500">*</span></Label>
                  <Controller
                    control={control}
                    name="startTime"
                    render={({ field }) => (
                      <TimePicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  {errors.startTime && (
                    <p className="text-xs text-red-500">{errors.startTime.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Selesai <span className="text-red-500">*</span></Label>
                  <Controller
                    control={control}
                    name="endTime"
                    render={({ field }) => (
                      <TimePicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  {errors.endTime && (
                    <p className="text-xs text-red-500">{errors.endTime.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Time display for presets */}
            {shiftPreset !== "Custom" && (
              <p className="text-sm text-muted-foreground text-center">
                {watch("startTime")} - {watch("endTime")}
              </p>
            )}

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                {...register("notes")}
                placeholder="Catatan opsional..."
                rows={2}
              />
            </div>
          </div>
        </form>

        <DialogFooter className="shrink-0 px-6 pb-6">
          {existing && onDelete && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={saving}
              className="mr-auto"
            >
              Hapus
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" form="schedule-form" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
        <ActionConfirmDialog
          open={submitConfirmOpen}
          onOpenChange={setSubmitConfirmOpen}
          kind="submit"
          title={existing ? "Update Jadwal?" : "Simpan Jadwal Baru?"}
          description={existing ? "Perubahan jadwal karyawan akan disimpan." : "Jadwal baru akan ditambahkan."}
          confirmLabel={existing ? "Update" : "Simpan"}
          loading={saving}
          onConfirm={async () => {
            if (!pendingSubmitValues) return;
            await executeSave(pendingSubmitValues);
            setSubmitConfirmOpen(false);
            setPendingSubmitValues(null);
          }}
          size="sm"
        />
        <ActionConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          kind="delete"
          title="Hapus Jadwal?"
          description="Jadwal karyawan ini akan dihapus permanen."
          confirmLabel="Ya, Hapus"
          loading={saving}
          onConfirm={handleDeleteConfirmed}
          size="sm"
        />
      </DialogContent>
    </Dialog>
  );
}
