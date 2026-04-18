"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartSelect } from "@/components/ui/smart-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Target, User, Building2, Calendar, Loader2, ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { startOfWeek, endOfWeek, format, eachDayOfInterval } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createSalesTarget,
  getSalesTargetUsers,
  getSalesTargetBranches,
} from "@/server/actions/sales-targets";

type PeriodType = "DAILY" | "WEEKLY" | "MONTHLY";

const targetSchema = z.object({
  assignTo: z.enum(["user", "branch"]),
  userId: z.string(),
  branchId: z.string(),
  type: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  period: z.string().min(1, "Periode wajib diisi"),
  targetRevenue: z.string(),
  targetTx: z.string(),
  targetItems: z.string(),
}).refine((data) => {
  if (data.assignTo === "user" && !data.userId) return false;
  if (data.assignTo === "branch" && !data.branchId) return false;
  return true;
}, { message: "Pilih kasir atau cabang", path: ["userId"] })
  .refine((data) => {
    return data.targetRevenue || data.targetTx || data.targetItems;
  }, { message: "Isi minimal satu target", path: ["targetRevenue"] });

type TargetFormValues = z.infer<typeof targetSchema>;

function getCurrentPeriodValue(type: PeriodType): string {
  const now = new Date();
  if (type === "DAILY") return now.toISOString().slice(0, 10);
  if (type === "WEEKLY") return now.toISOString().slice(0, 10);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Month Picker ─────────────────────────────────────
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [y, m] = (value || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`).split("-");
  const [year, setYear] = useState(Number(y));
  const [open, setOpen] = useState(false);
  const selectedMonth = Number(m) - 1;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start rounded-xl text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {MONTH_NAMES[selectedMonth]} {year}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 rounded-xl" align="start">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setYear(year - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold">{year}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setYear(year + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_NAMES.map((name, i) => (
            <button key={i} type="button"
              onClick={() => { onChange(`${year}-${String(i + 1).padStart(2, "0")}`); setOpen(false); }}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-all",
                selectedMonth === i && Number(y) === year
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-accent text-foreground"
              )}>
              {name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Week Picker ──────────────────────────────────────
// Value = date string "2026-04-14", highlight = Mon-Sun of that date's week

function WeekPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value + "T00:00:00") : undefined;
  const weekStart = selectedDate ? startOfWeek(selectedDate, { weekStartsOn: 1 }) : undefined;
  const weekEnd = selectedDate ? endOfWeek(selectedDate, { weekStartsOn: 1 }) : undefined;
  const selectedWeekDays = weekStart && weekEnd ? eachDayOfInterval({ start: weekStart, end: weekEnd }) : [];

  const displayLabel = weekStart && weekEnd
    ? `${format(weekStart, "dd MMM", { locale: idLocale })} - ${format(weekEnd, "dd MMM yyyy", { locale: idLocale })}`
    : "Pilih minggu";

  // Week hover: use event delegation on document (works across portals)
  useEffect(() => {
    if (!open) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      console.log("target", target)
      // Find the closest td, then its parent tr
      const td = target.closest("td");
      if (!td) return;
      const tr = td.parentElement;
      if (!tr || tr.tagName !== "TR") return;
      // Check this tr is inside our week picker
      const picker = tr.closest("[data-week-picker]");
      if (!picker) return;

      // Clear previous hover
      document.querySelectorAll("[data-week-hover-active] td").forEach((cell) => {
        (cell as HTMLElement).style.backgroundColor = "";
        (cell as HTMLElement).style.borderRadius = "";
        const btn = cell.querySelector("button");
        if (btn) (btn as HTMLElement).style.background = "";
      });
      document.querySelectorAll("[data-week-hover-active]").forEach((el) => el.removeAttribute("data-week-hover-active"));

      // Apply hover to entire row
      tr.setAttribute("data-week-hover-active", "1");
      const cells = tr.querySelectorAll("td");
      cells.forEach((cell, i) => {
        (cell as HTMLElement).style.backgroundColor = "hsl(var(--accent))";
        (cell as HTMLElement).style.borderRadius =
          i === 0 ? "0.375rem 0 0 0.375rem" :
            i === cells.length - 1 ? "0 0.375rem 0.375rem 0" : "0";
        const btn = cell.querySelector("button");
        if (btn) (btn as HTMLElement).style.background = "transparent";
      });
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const picker = target.closest("[data-week-picker]");
      if (!picker) return;
      document.querySelectorAll("[data-week-hover-active] td").forEach((cell) => {
        (cell as HTMLElement).style.backgroundColor = "";
        (cell as HTMLElement).style.borderRadius = "";
        const btn = cell.querySelector("button");
        if (btn) (btn as HTMLElement).style.background = "";
      });
      document.querySelectorAll("[data-week-hover-active]").forEach((el) => el.removeAttribute("data-week-hover-active"));
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseleave", handleMouseLeave, true);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseleave", handleMouseLeave, true);
      // Cleanup styles
      document.querySelectorAll("[data-week-hover-active] td").forEach((cell) => {
        (cell as HTMLElement).style.backgroundColor = "";
        (cell as HTMLElement).style.borderRadius = "";
      });
      document.querySelectorAll("[data-week-hover-active]").forEach((el) => el.removeAttribute("data-week-hover-active"));
    };
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start rounded-xl text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-xl" align="start">
        <div ref={calendarRef} data-week-picker="">
          <CalendarComponent
            mode="single"
            selected={selectedDate}
            {...(selectedDate ? { defaultMonth: selectedDate } : {})}
            onSelect={(date) => {
              if (date) { onChange(format(date, "yyyy-MM-dd")); setOpen(false); }
            }}
            modifiers={{ selectedWeek: selectedWeekDays }}
            modifiersClassNames={{
              selectedWeek: "bg-primary/15 text-primary rounded-none first:rounded-l-md last:rounded-r-md",
            }}
            initialFocus
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface SetTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SetTargetDialog({ open, onOpenChange, onSuccess }: SetTargetDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  const form = useForm<TargetFormValues>({
    resolver: zodResolver(targetSchema),
    defaultValues: {
      assignTo: "user",
      userId: "",
      branchId: "",
      type: "MONTHLY",
      period: getCurrentPeriodValue("MONTHLY"),
      targetRevenue: "",
      targetTx: "",
      targetItems: "",
    },
  });

  const { register, handleSubmit, watch, setValue, control, formState: { errors }, reset } = form;
  const assignTo = watch("assignTo");
  const type = watch("type");

  useEffect(() => {
    if (open) {
      getSalesTargetUsers().then(setUsers).catch(() => { });
      getSalesTargetBranches().then(setBranches).catch(() => { });
      reset({
        assignTo: "user", userId: "", branchId: "",
        type: "MONTHLY", period: getCurrentPeriodValue("MONTHLY"),
        targetRevenue: "", targetTx: "", targetItems: "",
      });
    }
  }, [open, reset]);

  useEffect(() => {
    setValue("period", getCurrentPeriodValue(type));
  }, [type, setValue]);

  const onSubmit = (data: TargetFormValues) => {
    startTransition(async () => {
      try {
        await createSalesTarget({
          userId: data.assignTo === "user" ? data.userId || undefined : undefined,
          branchId: data.assignTo === "branch" ? data.branchId || undefined : undefined,
          type: data.type,
          targetRevenue: data.targetRevenue ? parseFloat(data.targetRevenue) : undefined,
          targetTx: data.targetTx ? parseInt(data.targetTx) : undefined,
          targetItems: data.targetItems ? parseInt(data.targetItems) : undefined,
          period: data.period,
        });
        toast.success("Target berhasil disimpan!");
        onSuccess();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan target");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            Set Target
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="px-4 sm:px-6 space-y-3 sm:space-y-4">
            {/* Assign to */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Assign Ke <span className="text-red-400">*</span></Label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setValue("assignTo", "user"); setValue("branchId", ""); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all ${assignTo === "user" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500"
                    }`}>
                  <User className="w-3.5 h-3.5" /> Kasir
                </button>
                <button type="button" onClick={() => { setValue("assignTo", "branch"); setValue("userId", ""); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all ${assignTo === "branch" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500"
                    }`}>
                  <Building2 className="w-3.5 h-3.5" /> Cabang
                </button>
              </div>
            </div>

            {/* User / Branch selector */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{assignTo === "user" ? "Pilih Kasir" : "Pilih Cabang"} <span className="text-red-400">*</span></Label>
              {assignTo === "user" ? (
                <Controller
                  control={control}
                  name="userId"
                  render={({ field }) => (
                    <SmartSelect
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Pilih kasir..."
                      onSearch={async (query) =>
                        users
                          .filter((u) => !query || u.name.toLowerCase().includes(query.toLowerCase()))
                          .map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))
                      }
                      initialOptions={users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
                    />
                  )}
                />
              ) : (
                <Controller
                  control={control}
                  name="branchId"
                  render={({ field }) => (
                    <SmartSelect
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Pilih cabang..."
                      onSearch={async (query) =>
                        branches
                          .filter((b) => !query || b.name.toLowerCase().includes(query.toLowerCase()))
                          .map((b) => ({ value: b.id, label: b.name }))
                      }
                      initialOptions={branches.map((b) => ({ value: b.id, label: b.name }))}
                    />
                  )}
                />
              )}
              {errors.userId && <p className="text-xs text-red-500">{errors.userId.message}</p>}
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Tipe Target</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <div className="flex gap-3">
                    {([
                      { value: "DAILY", label: "Harian", icon: "📅" },
                      { value: "WEEKLY", label: "Mingguan", icon: "📆" },
                      { value: "MONTHLY", label: "Bulanan", icon: "🗓️" },
                    ] as const).map((opt) => (
                      <label key={opt.value}
                        className={cn(
                          "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-xs sm:text-sm font-medium",
                          field.value === opt.value
                            ? "border-amber-400 bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                            : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                        )}>
                        <input type="radio" name="targetType" value={opt.value} checked={field.value === opt.value}
                          onChange={() => field.onChange(opt.value)} className="sr-only" />
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                          field.value === opt.value ? "border-amber-500" : "border-slate-300"
                        )}>
                          {field.value === opt.value && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                        </div>
                        {opt.label}
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Period */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm"><Calendar className="w-3 h-3 inline mr-1" /> Periode <span className="text-red-400">*</span></Label>
              <Controller
                control={control}
                name="period"
                render={({ field }) => {
                  if (type === "MONTHLY") {
                    return <MonthPicker value={field.value} onChange={field.onChange} />;
                  }
                  if (type === "WEEKLY") {
                    return <WeekPicker value={field.value} onChange={field.onChange} />;
                  }
                  return <DatePicker value={field.value} onChange={field.onChange} placeholder="Pilih tanggal" className="rounded-xl" />;
                }}
              />
              {errors.period && <p className="text-xs text-red-500">{errors.period.message}</p>}
            </div>

            {/* Targets */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] sm:text-xs">Revenue</Label>
                <Input type="number" {...register("targetRevenue")} placeholder="Rp 0" min="0" className="rounded-xl text-xs sm:text-sm" onFocus={(e) => e.target.select()} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] sm:text-xs">Transaksi</Label>
                <Input type="number" {...register("targetTx")} placeholder="0" min="0" className="rounded-xl text-xs sm:text-sm" onFocus={(e) => e.target.select()} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] sm:text-xs">Items</Label>
                <Input type="number" {...register("targetItems")} placeholder="0" min="0" className="rounded-xl text-xs sm:text-sm" onFocus={(e) => e.target.select()} />
              </div>
            </div>
            {errors.targetRevenue && <p className="text-xs text-red-500">{errors.targetRevenue.message}</p>}
          </DialogBody>

          <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Batal</Button>
            <Button type="submit" disabled={isPending} className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
              {isPending ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</> : "Simpan Target"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
