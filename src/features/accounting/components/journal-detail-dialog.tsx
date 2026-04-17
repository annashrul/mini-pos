"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { FileText, Calendar, User, Hash, Tag, CheckCircle2, XCircle, Send, Clock, Loader2 } from "lucide-react";
import { STATUS_CONFIG, TYPE_CONFIG } from "../utils";
import type { JournalDetailDialogProps } from "../types";
import { submitJournalForApproval, approveJournalEntry, rejectJournalEntry, getJournalChangeHistory } from "@/server/actions/accounting";
import { useMenuActionAccess } from "@/features/access-control";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export function JournalDetailDialog({
  open,
  onClose,
  journal,
  onRefresh,
}: JournalDetailDialogProps & { onRefresh?: () => void }) {
  const { canAction } = useMenuActionAccess("accounting-journals");
  const canApprove = canAction("approve");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [changeLogs, setChangeLogs] = useState<Array<{ action: string; createdAt: Date | string; user: { name: string } }>>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (open && journal) {
      getJournalChangeHistory(journal.id).then((logs) => setChangeLogs(logs as typeof changeLogs)).catch(() => {});
    }
  }, [open, journal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (action: "submit" | "approve" | "reject") => {
    if (!journal) return;
    setActionLoading(true);
    let result: { success?: boolean; error?: string };
    if (action === "submit") result = await submitJournalForApproval(journal.id);
    else if (action === "approve") result = await approveJournalEntry(journal.id);
    else result = await rejectJournalEntry(journal.id, rejectReason);
    if ("error" in result && result.error) toast.error(result.error);
    else { toast.success(action === "submit" ? "Diajukan" : action === "approve" ? "Disetujui" : "Ditolak"); onRefresh?.(); onClose(); }
    setActionLoading(false);
    setShowReject(false);
    setRejectReason("");
  };

  if (!journal) return null;

  const statusCfg = STATUS_CONFIG[journal.status] || STATUS_CONFIG.DRAFT;
  const typeCfg = TYPE_CONFIG[journal.type] || TYPE_CONFIG.GENERAL;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[780px] rounded-2xl max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/15">
              <FileText className="w-5 h-5 text-white" />
            </div>
            Detail Jurnal
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* ── Metadata ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-2.5 text-sm">
              <Hash className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <span className="text-gray-500 block text-xs">No. Jurnal</span>
                <span className="font-mono font-semibold text-gray-900">
                  {journal.number}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <span className="text-gray-500 block text-xs">Tanggal</span>
                <span className="font-medium text-gray-900">
                  {formatDate(journal.date)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <span className="text-gray-500 block text-xs">Dibuat oleh</span>
                <span className="font-medium text-gray-900">
                  {journal.createdByName}
                </span>
              </div>
            </div>
          </div>

          {/* ── Badges ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2.5">
            <Badge
              variant="secondary"
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 ${
                journal.status === "DRAFT"
                  ? "bg-gray-100 text-gray-600"
                  : journal.status === "POSTED"
                  ? "bg-emerald-100 text-emerald-700"
                  : journal.status === "VOID"
                  ? "bg-red-100 text-red-700"
                  : statusCfg?.className
              }`}
            >
              {statusCfg?.label ?? journal.status}
            </Badge>
            <Badge
              variant="secondary"
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 ${typeCfg?.className}`}
            >
              <Tag className="w-3 h-3 mr-1" />
              {typeCfg?.label}
            </Badge>
          </div>

          {/* ── Description box ────────────────────────────────────────── */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-gray-900">
              {journal.description}
            </p>
            {journal.reference && (
              <p className="text-xs text-gray-500">
                Referensi:{" "}
                <span className="font-mono font-medium text-gray-700">
                  {journal.reference}
                </span>
              </p>
            )}
            {journal.notes && (
              <p className="text-xs text-gray-500">
                Catatan:{" "}
                <span className="font-medium text-gray-700">
                  {journal.notes}
                </span>
              </p>
            )}
          </div>

          {/* ── Line items table ───────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                  <TableHead className="font-semibold text-slate-600">
                    Kode Akun
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600">
                    Nama Akun
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600">
                    Keterangan
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 text-right">
                    Debit
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 text-right">
                    Kredit
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journal.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono text-sm text-gray-500">
                      {line.accountCode}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-gray-900">
                      {line.accountName}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {line.description || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono tabular-nums font-semibold text-gray-900">
                      {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono tabular-nums font-semibold text-gray-900">
                      {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-slate-50/70 font-bold">
                  <TableCell colSpan={3} className="text-right text-gray-700">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-gray-900">
                    {formatCurrency(journal.totalDebit)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-gray-900">
                    {formatCurrency(journal.totalCredit)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* ── Rejection note ─────────────────────────────────────────── */}
          {journal.rejectionNote && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-[11px] text-red-500 font-medium mb-0.5">Alasan Penolakan</p>
              <p className="text-xs text-red-700">{journal.rejectionNote}</p>
            </div>
          )}

          {/* ── Audit Trail ────────────────────────────────────────────── */}
          <div>
            <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Clock className="w-3 h-3" /> {showHistory ? "Sembunyikan" : "Tampilkan"} Riwayat ({changeLogs.length})
            </button>
            {showHistory && changeLogs.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {changeLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                    <span className="font-medium text-foreground">{log.action}</span>
                    <span>oleh {log.user.name}</span>
                    <span className="ml-auto tabular-nums">{new Date(log.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Reject input ───────────────────────────────────────────── */}
          {showReject && (
            <div className="flex items-center gap-2">
              <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Alasan penolakan..." className="rounded-xl h-9 text-xs flex-1" />
              <Button size="sm" variant="destructive" className="rounded-xl h-9" disabled={!rejectReason.trim() || actionLoading}
                onClick={() => handleAction("reject")}>
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Tolak"}
              </Button>
              <Button size="sm" variant="ghost" className="rounded-xl h-9" onClick={() => { setShowReject(false); setRejectReason(""); }}>Batal</Button>
            </div>
          )}

          {/* ── Action buttons ─────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {journal.status === "DRAFT" && (
              <Button variant="outline" className="rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50" disabled={actionLoading}
                onClick={() => handleAction("submit")}>
                <Send className="w-4 h-4 mr-2" /> Ajukan Approval
              </Button>
            )}
            {journal.status === "PENDING_APPROVAL" && canApprove && !showReject && (
              <>
                <Button variant="outline" className="rounded-xl text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowReject(true)}>
                  <XCircle className="w-4 h-4 mr-2" /> Tolak
                </Button>
                <Button className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white" disabled={actionLoading}
                  onClick={() => handleAction("approve")}>
                  {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Setujui
                </Button>
              </>
            )}
            <Button variant="outline" onClick={onClose} className="rounded-xl border-gray-200">Tutup</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
