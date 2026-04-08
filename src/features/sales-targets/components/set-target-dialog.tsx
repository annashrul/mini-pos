"use client";

import { useState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, User, Building2, Calendar } from "lucide-react";
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
  if (type === "WEEKLY") {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = form;
  const assignTo = watch("assignTo");
  const type = watch("type");

  useEffect(() => {
    if (open) {
      getSalesTargetUsers().then(setUsers).catch(() => {});
      getSalesTargetBranches().then(setBranches).catch(() => {});
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
                <button type="button" onClick={() => setValue("assignTo", "user")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                    assignTo === "user" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500"
                  }`}>
                  <User className="w-3.5 h-3.5" /> Kasir
                </button>
                <button type="button" onClick={() => setValue("assignTo", "branch")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                    assignTo === "branch" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500"
                  }`}>
                  <Building2 className="w-3.5 h-3.5" /> Cabang
                </button>
              </div>
            </div>

            {/* User / Branch selector */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{assignTo === "user" ? "Pilih Kasir" : "Pilih Cabang"} <span className="text-red-400">*</span></Label>
              {assignTo === "user" ? (
                <select {...register("userId")} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="">-- Pilih kasir --</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              ) : (
                <select {...register("branchId")} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="">-- Pilih cabang --</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              {errors.userId && <p className="text-xs text-red-500">{errors.userId.message}</p>}
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Tipe Target</Label>
              <div className="flex gap-1.5 sm:gap-2">
                {(["DAILY", "WEEKLY", "MONTHLY"] as PeriodType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setValue("type", t)}
                    className={`flex-1 px-2 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
                      type === t ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500"
                    }`}>
                    {t === "DAILY" ? "Harian" : t === "WEEKLY" ? "Mingguan" : "Bulanan"}
                  </button>
                ))}
              </div>
            </div>

            {/* Period */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm"><Calendar className="w-3 h-3 inline mr-1" /> Periode <span className="text-red-400">*</span></Label>
              <Input type={type === "DAILY" ? "date" : type === "WEEKLY" ? "week" : "month"} {...register("period")} className="rounded-xl" />
              {errors.period && <p className="text-xs text-red-500">{errors.period.message}</p>}
            </div>

            {/* Targets */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] sm:text-xs">Revenue</Label>
                <Input type="number" {...register("targetRevenue")} placeholder="Rp 0" min="0" className="rounded-xl text-xs sm:text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] sm:text-xs">Transaksi</Label>
                <Input type="number" {...register("targetTx")} placeholder="0" min="0" className="rounded-xl text-xs sm:text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] sm:text-xs">Items</Label>
                <Input type="number" {...register("targetItems")} placeholder="0" min="0" className="rounded-xl text-xs sm:text-sm" />
              </div>
            </div>
            {errors.targetRevenue && <p className="text-xs text-red-500">{errors.targetRevenue.message}</p>}
          </DialogBody>

          <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Batal</Button>
            <Button type="submit" disabled={isPending} className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
              {isPending ? "Menyimpan..." : "Simpan Target"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
