"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, User, Building2, Calendar } from "lucide-react";
import { toast } from "sonner";
import {
  createSalesTarget,
  getSalesTargetUsers,
  getSalesTargetBranches,
} from "@/server/actions/sales-targets";

type PeriodType = "DAILY" | "WEEKLY" | "MONTHLY";

interface SetTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

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

export function SetTargetDialog({ open, onOpenChange, onSuccess }: SetTargetDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [assignTo, setAssignTo] = useState<"user" | "branch">("user");
  const [userId, setUserId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [type, setType] = useState<PeriodType>("MONTHLY");
  const [period, setPeriod] = useState(getCurrentPeriodValue("MONTHLY"));
  const [targetRevenue, setTargetRevenue] = useState("");
  const [targetTx, setTargetTx] = useState("");
  const [targetItems, setTargetItems] = useState("");

  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (open) {
      getSalesTargetUsers().then(setUsers).catch(() => {});
      getSalesTargetBranches().then(setBranches).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    setPeriod(getCurrentPeriodValue(type));
  }, [type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createSalesTarget({
          userId: assignTo === "user" ? userId || undefined : undefined,
          branchId: assignTo === "branch" ? branchId || undefined : undefined,
          type,
          targetRevenue: targetRevenue ? parseFloat(targetRevenue) : undefined,
          targetTx: targetTx ? parseInt(targetTx) : undefined,
          targetItems: targetItems ? parseInt(targetItems) : undefined,
          period,
        });
        toast.success("Target berhasil disimpan!");
        // Reset
        setUserId("");
        setBranchId("");
        setTargetRevenue("");
        setTargetTx("");
        setTargetItems("");
        onSuccess();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan target");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            Set Target Penjualan
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {/* Assign to user or branch */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Assign Ke</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignTo("user")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    assignTo === "user"
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Kasir
                </button>
                <button
                  type="button"
                  onClick={() => setAssignTo("branch")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    assignTo === "branch"
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Cabang
                </button>
              </div>
            </div>

            {/* User / Branch selector */}
            {assignTo === "user" ? (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Pilih Kasir</label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  required
                >
                  <option value="">-- Pilih kasir --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Pilih Cabang</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  required
                >
                  <option value="">-- Pilih cabang --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Type */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Tipe Target</label>
              <div className="flex gap-2">
                {(["DAILY", "WEEKLY", "MONTHLY"] as PeriodType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                      type === t
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {t === "DAILY" ? "Harian" : t === "WEEKLY" ? "Mingguan" : "Bulanan"}
                  </button>
                ))}
              </div>
            </div>

            {/* Period */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Periode
              </label>
              {type === "DAILY" ? (
                <input
                  type="date"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  required
                />
              ) : type === "WEEKLY" ? (
                <input
                  type="week"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  required
                />
              ) : (
                <input
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  required
                />
              )}
            </div>

            {/* Targets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Target Revenue</label>
                <input
                  type="number"
                  value={targetRevenue}
                  onChange={(e) => setTargetRevenue(e.target.value)}
                  placeholder="Rp 0"
                  min="0"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Target Transaksi</label>
                <input
                  type="number"
                  value={targetTx}
                  onChange={(e) => setTargetTx(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Target Items</label>
                <input
                  type="number"
                  value={targetItems}
                  onChange={(e) => setTargetItems(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              {isPending ? "Menyimpan..." : "Simpan Target"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
