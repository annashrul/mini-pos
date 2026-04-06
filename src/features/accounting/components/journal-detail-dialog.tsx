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
import { FileText, Calendar, User, Hash, Tag } from "lucide-react";
import { STATUS_CONFIG, TYPE_CONFIG } from "../utils";
import type { JournalDetailDialogProps } from "../types";

export function JournalDetailDialog({
  open,
  onClose,
  journal,
}: JournalDetailDialogProps) {
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

          {/* ── Close button ───────────────────────────────────────────── */}
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-gray-200"
            >
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
