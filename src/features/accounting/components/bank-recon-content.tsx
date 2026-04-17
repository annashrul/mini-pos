"use client";

import { useState, useEffect, useTransition } from "react";
import { getReconciliations, createReconciliation, autoMatchItems, completeReconciliation } from "@/server/actions/bank-reconciliation";
import { getAccounts } from "@/server/actions/accounting";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import {
  Landmark, Plus, Loader2, CheckCircle2, CalendarDays, ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

type ReconsData = Awaited<ReturnType<typeof getReconciliations>>;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  IN_PROGRESS: { label: "Berjalan", color: "bg-amber-50 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Selesai", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export function BankReconContent() {
  const [data, setData] = useState<ReconsData>({ items: [], total: 0, totalPages: 0 });
  const [loading, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [formAccountId, setFormAccountId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formBalance, setFormBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = () => {
    startTransition(async () => {
      const result = await getReconciliations();
      setData(result);
    });
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = async () => {
    const result = await getAccounts({ perPage: 500 });
    const accs = Array.isArray(result) ? result : (result as { accounts: Array<Record<string, unknown>> }).accounts ?? [];
    // Only bank accounts (code starts with 1-1001 or 1-1002)
    setAccounts((accs as Array<Record<string, unknown>>).filter((a) => {
      const code = String(a.code ?? "");
      return code.startsWith("1-1001") || code.startsWith("1-1002");
    }).map((a) => ({ id: String(a.id), code: String(a.code), name: String(a.name) })));
    setFormAccountId(""); setFormDate(""); setFormBalance(0);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!formAccountId || !formDate) { toast.error("Pilih akun dan tanggal"); return; }
    setSubmitting(true);
    const result = await createReconciliation({ accountId: formAccountId, statementDate: formDate, statementBalance: formBalance });
    if ("error" in result && result.error) toast.error(result.error as string);
    else { toast.success("Rekonsiliasi dibuat"); setCreateOpen(false); fetchData(); }
    setSubmitting(false);
  };

  const handleAutoMatch = async (id: string) => {
    const result = await autoMatchItems(id);
    if ("error" in result) toast.error(result.error);
    else { toast.success(`${result.matched} transaksi berhasil di-match`); fetchData(); }
  };

  const handleComplete = async (id: string) => {
    const result = await completeReconciliation(id);
    if ("error" in result) toast.error(result.error);
    else { toast.success("Rekonsiliasi selesai"); fetchData(); }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-200">
            <Landmark className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Rekonsiliasi Bank</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-muted-foreground text-xs sm:text-sm">Cocokkan statement bank dengan buku besar</p>
              <Badge variant="secondary" className="rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 text-xs">{data.total} rekon</Badge>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Button className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-200/50" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Mulai Rekonsiliasi
          </Button>
        </div>
        <div className="sm:hidden fixed bottom-4 right-4 z-50">
          <Button onClick={openCreate} size="icon" className="h-12 w-12 rounded-full shadow-xl shadow-cyan-300/50 bg-gradient-to-br from-cyan-500 to-blue-600">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* List */}
      {loading && data.items.length === 0 ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-cyan-500 animate-spin mr-2" /><span className="text-sm text-muted-foreground">Memuat...</span></div>
      ) : data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white to-slate-50/50">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center mb-4">
            <Landmark className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-300" />
          </div>
          <p className="text-sm sm:text-base font-semibold text-foreground mb-1">Belum ada rekonsiliasi</p>
          <p className="text-xs sm:text-sm text-muted-foreground">Mulai rekonsiliasi pertama untuk mencocokkan data bank</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
          {data.items.map((item) => {
            const cfg = STATUS_CONFIG[item.status] || { label: item.status, color: "bg-slate-50 text-slate-700 border-slate-200" };
            const diff = item.statementBalance - item.bookBalance;
            return (
              <div key={item.id} className="group rounded-xl border border-slate-200/60 border-l-4 border-l-cyan-500 bg-white hover:shadow-md transition-all p-3 sm:p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-100 to-blue-200 flex items-center justify-center shrink-0">
                      <Landmark className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold truncate">{item.account.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{item.account.code}</p>
                    </div>
                  </div>
                  <Badge className={`${cfg.color} border rounded-full text-[10px] px-2 shrink-0`}>{cfg.label}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{format(new Date(item.statementDate), "dd MMM yy", { locale: idLocale })}</span>
                  <span>Saldo Bank: <strong className="text-foreground">{formatCurrency(item.statementBalance)}</strong></span>
                  <span>Saldo Buku: <strong className="text-foreground">{formatCurrency(item.bookBalance)}</strong></span>
                  {Math.abs(diff) > 0.01 && <span className="text-red-500 font-medium">Selisih: {formatCurrency(diff)}</span>}
                </div>
                {item.status === "IN_PROGRESS" && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                    <Button variant="ghost" size="sm" className="h-7 rounded-lg text-xs text-cyan-600 hover:bg-cyan-50" onClick={() => handleAutoMatch(item.id)}>
                      <ArrowLeftRight className="w-3 h-3 mr-1" /> Auto-Match
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 rounded-lg text-xs text-emerald-600 hover:bg-emerald-50" onClick={() => handleComplete(item.id)}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Selesai
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-xl sm:rounded-2xl p-0 gap-0">
          <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-600 shrink-0 rounded-t-xl" />
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3">
            <DialogTitle className="text-base font-bold">Mulai Rekonsiliasi Bank</DialogTitle>
          </DialogHeader>
          <DialogBody className="px-4 sm:px-6 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Akun Bank <span className="text-red-400">*</span></Label>
              <Select value={formAccountId} onValueChange={setFormAccountId}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue placeholder="Pilih akun bank" /></SelectTrigger>
                <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tanggal Statement <span className="text-red-400">*</span></Label>
              <DatePicker value={formDate} onChange={setFormDate} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Saldo Akhir Statement Bank <span className="text-red-400">*</span></Label>
              <Input type="number" value={formBalance || ""} onChange={(e) => setFormBalance(Number(e.target.value))} onFocus={(e) => e.target.select()} className="rounded-xl h-9" placeholder="0" />
            </div>
          </DialogBody>
          <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-5">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={handleCreate} disabled={submitting || !formAccountId || !formDate} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Landmark className="w-4 h-4 mr-2" />}
              Mulai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
