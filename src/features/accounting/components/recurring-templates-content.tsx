"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getRecurringTemplates,
  createRecurringTemplate,
  deleteRecurringTemplate,
  toggleRecurringTemplate,
  executeRecurringJournals,
} from "@/server/actions/accounting";
import { getAccounts } from "@/server/actions/accounting";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import {
  CalendarClock, Plus, Play, Pause, Trash2, Loader2,
  CalendarDays, RefreshCw, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

type TemplatesData = Awaited<ReturnType<typeof getRecurringTemplates>>;

const FREQ_LABELS: Record<string, { label: string; color: string }> = {
  MONTHLY: { label: "Bulanan", color: "bg-blue-50 text-blue-700 border-blue-200" },
  QUARTERLY: { label: "Quarterly", color: "bg-purple-50 text-purple-700 border-purple-200" },
  YEARLY: { label: "Tahunan", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function RecurringTemplatesContent() {
  const [data, setData] = useState<TemplatesData>({ templates: [], total: 0, totalPages: 0 });
  const [loading, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string }>>([]);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formFreq, setFormFreq] = useState("MONTHLY");
  const [formDay, setFormDay] = useState(1);
  const [formLines, setFormLines] = useState<Array<{ accountId: string; description: string; debit: number; credit: number }>>([
    { accountId: "", description: "", debit: 0, credit: 0 },
    { accountId: "", description: "", debit: 0, credit: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = () => {
    startTransition(async () => {
      const result = await getRecurringTemplates();
      setData(result);
    });
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAccounts = async () => {
    const result = await getAccounts({ perPage: 500 });
    const accs = Array.isArray(result) ? result : (result as { accounts: Array<{ id: string; code: string; name: string }> }).accounts ?? [];
    setAccounts(accs.map((a: Record<string, unknown>) => ({ id: a.id as string, code: a.code as string, name: a.name as string })));
  };

  const openCreate = () => {
    setFormName(""); setFormDesc(""); setFormFreq("MONTHLY"); setFormDay(1);
    setFormLines([{ accountId: "", description: "", debit: 0, credit: 0 }, { accountId: "", description: "", debit: 0, credit: 0 }]);
    loadAccounts();
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!formName.trim()) { toast.error("Nama template wajib diisi"); return; }
    const validLines = formLines.filter((l) => l.accountId && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) { toast.error("Minimal 2 baris jurnal"); return; }
    setSubmitting(true);
    const result = await createRecurringTemplate({
      name: formName, description: formDesc || undefined, frequency: formFreq, dayOfMonth: formDay, lines: validLines,
    });
    if ("error" in result) toast.error(result.error);
    else { toast.success("Template berhasil dibuat"); setCreateOpen(false); fetchData(); }
    setSubmitting(false);
  };

  const handleToggle = async (id: string) => {
    const result = await toggleRecurringTemplate(id);
    if ("error" in result) toast.error(result.error);
    else fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    const result = await deleteRecurringTemplate(deleteTargetId);
    if ("error" in result) toast.error(result.error);
    else { toast.success("Template dihapus"); fetchData(); }
    setDeleteConfirmOpen(false); setDeleteTargetId(null);
  };

  const handleRunAll = async () => {
    const result = await executeRecurringJournals();
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(`${result.created} jurnal berhasil dibuat${result.failed > 0 ? `, ${result.failed} gagal` : ""}`);
      fetchData();
    }
  };

  const totalDebit = formLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = formLines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
            <CalendarClock className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Jurnal Berulang</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-muted-foreground text-xs sm:text-sm">Template jurnal otomatis</p>
              <Badge variant="secondary" className="rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-xs">{data.total} template</Badge>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Button variant="outline" className="rounded-xl" onClick={handleRunAll} disabled={data.templates.filter((t) => t.isActive).length === 0}>
            <Play className="w-4 h-4 mr-2" /> Jalankan Sekarang
          </Button>
          <Button className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-200/50" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Buat Template
          </Button>
        </div>
        <div className="sm:hidden fixed bottom-4 right-4 z-50">
          <Button onClick={openCreate} size="icon" className="h-12 w-12 rounded-full shadow-xl shadow-violet-300/50 bg-gradient-to-br from-violet-500 to-purple-600">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Template List */}
      {loading && data.templates.length === 0 ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-violet-500 animate-spin mr-2" /><span className="text-sm text-muted-foreground">Memuat...</span></div>
      ) : data.templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white to-slate-50/50">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-4">
            <CalendarClock className="w-6 h-6 sm:w-8 sm:h-8 text-violet-300" />
          </div>
          <p className="text-sm sm:text-base font-semibold text-foreground mb-1">Belum ada template</p>
          <p className="text-xs sm:text-sm text-muted-foreground">Buat template jurnal berulang untuk transaksi rutin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
          {data.templates.map((tmpl) => {
            const freq = FREQ_LABELS[tmpl.frequency] ?? { label: tmpl.frequency, color: "bg-slate-50 text-slate-700 border-slate-200" };
            const totalDebit = tmpl.lines.reduce((s, l) => s + l.debit, 0);
            return (
              <div key={tmpl.id} className={`group rounded-xl border bg-white p-3 sm:p-4 space-y-2 transition-all hover:shadow-md ${!tmpl.isActive ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{tmpl.name}</p>
                      <Badge className={`${freq.color} border rounded-full text-[10px] px-2 shrink-0`}>{freq.label}</Badge>
                    </div>
                    {tmpl.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{tmpl.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleToggle(tmpl.id)} title={tmpl.isActive ? "Nonaktifkan" : "Aktifkan"}>
                      {tmpl.isActive ? <Pause className="w-3.5 h-3.5 text-amber-500" /> : <Play className="w-3.5 h-3.5 text-emerald-500" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => { setDeleteTargetId(tmpl.id); setDeleteConfirmOpen(true); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />Tgl {tmpl.dayOfMonth} setiap {freq.label.toLowerCase()}</span>
                  <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" />Next: {format(new Date(tmpl.nextRunDate), "dd MMM yy", { locale: idLocale })}</span>
                  {tmpl.lastRunDate && <span className="flex items-center gap-1"><Zap className="w-3 h-3" />Last: {format(new Date(tmpl.lastRunDate), "dd MMM yy", { locale: idLocale })}</span>}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-[11px] text-muted-foreground">{tmpl.lines.length} baris</span>
                  <span className="text-xs font-bold tabular-nums text-foreground">{formatCurrency(totalDebit)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl rounded-xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600 shrink-0" />
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-bold">Buat Template Jurnal Berulang</DialogTitle>
          </DialogHeader>
          <DialogBody className="px-4 sm:px-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nama Template <span className="text-red-400">*</span></Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Beban Sewa Bulanan" className="rounded-xl h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Frekuensi</Label>
                <Select value={formFreq} onValueChange={setFormFreq}>
                  <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Bulanan</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="YEARLY">Tahunan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tanggal</Label>
                <Input type="number" min={1} max={28} value={formDay} onChange={(e) => setFormDay(Number(e.target.value))} className="rounded-xl h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Deskripsi</Label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Opsional..." className="rounded-xl h-9" />
            </div>

            {/* Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Baris Jurnal</Label>
                <div className="flex items-center gap-2">
                  <Badge className={`rounded-full text-[10px] ${isBalanced ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                    {isBalanced ? "Seimbang" : `Selisih: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
                  </Badge>
                  <Button type="button" variant="outline" size="sm" className="rounded-lg h-7 text-xs"
                    onClick={() => setFormLines([...formLines, { accountId: "", description: "", debit: 0, credit: 0 }])}>
                    <Plus className="w-3 h-3 mr-1" /> Baris
                  </Button>
                </div>
              </div>
              {formLines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_80px_80px_28px] gap-1.5 items-center">
                  <Select value={line.accountId} onValueChange={(v) => { const next = [...formLines]; next[idx] = { ...next[idx]!, accountId: v }; setFormLines(next); }}>
                    <SelectTrigger className="rounded-lg h-8 text-xs"><SelectValue placeholder="Akun" /></SelectTrigger>
                    <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={line.description} onChange={(e) => { const next = [...formLines]; next[idx] = { ...next[idx]!, description: e.target.value }; setFormLines(next); }}
                    placeholder="Keterangan" className="rounded-lg h-8 text-xs" />
                  <Input type="number" value={line.debit || ""} onChange={(e) => { const next = [...formLines]; next[idx] = { ...next[idx]!, debit: Number(e.target.value) || 0 }; setFormLines(next); }}
                    onFocus={(e) => e.target.select()} placeholder="Debit" className="rounded-lg h-8 text-xs text-right" min={0} />
                  <Input type="number" value={line.credit || ""} onChange={(e) => { const next = [...formLines]; next[idx] = { ...next[idx]!, credit: Number(e.target.value) || 0 }; setFormLines(next); }}
                    onFocus={(e) => e.target.select()} placeholder="Credit" className="rounded-lg h-8 text-xs text-right" min={0} />
                  {formLines.length > 2 && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600"
                      onClick={() => setFormLines(formLines.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </DialogBody>
          <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-5">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={handleCreate} disabled={submitting || !isBalanced || !formName.trim()} className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />}
              Simpan Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ActionConfirmDialog open={deleteConfirmOpen} onOpenChange={(v) => { setDeleteConfirmOpen(v); if (!v) setDeleteTargetId(null); }}
        kind="delete" description="Yakin ingin menghapus template ini?" onConfirm={handleDelete} />
    </div>
  );
}
