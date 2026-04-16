"use client";

import { useState } from "react";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Loader2,
  Plus,
  Trash2,
  Check,
  ChevronsUpDown,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useJournalForm } from "../hooks";
import type { AccountSimple, JournalFormDialogProps } from "../types";

/* ── Account combobox select ────────────────────────────────────────── */
function AccountSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: AccountSimple[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between rounded-xl font-normal h-9 text-sm border-gray-200"
        >
          {selected ? (
            <span className="truncate">
              <span className="font-mono text-gray-400 mr-1.5 text-xs">{selected.code}</span>
              {selected.name}
            </span>
          ) : (
            <span className="text-gray-400">Pilih akun...</span>
          )}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari kode atau nama akun..." />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-sm text-gray-400">Akun tidak ditemukan</CommandEmpty>
            <CommandGroup>
              {accounts.map((a) => (
                <CommandItem key={a.id} value={`${a.code} ${a.name}`} onSelect={() => { onChange(a.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === a.id ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono text-xs text-gray-400 mr-2">{a.code}</span>
                  <span className="text-sm">{a.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ── Journal form dialog ──────────────────────────────────────────────── */
export function JournalFormDialog({ open, onClose }: JournalFormDialogProps) {
  const {
    date, setDate,
    description, setDescription,
    reference, setReference,
    notes, setNotes,
    lines, accounts, saving,
    totalDebit, totalCredit, difference, isBalanced,
    updateLine, addLine, removeLine,
    handleSave,
    validationErrors, clearError,
  } = useJournalForm(open, onClose);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-blue-600 to-indigo-600 shrink-0" />

        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 shrink-0">
          <DialogTitle className="text-base sm:text-lg font-bold text-gray-900">Buat Jurnal Baru</DialogTitle>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Isi detail dan tambahkan baris debit/kredit</p>
        </DialogHeader>

        <DialogBody className="px-4 sm:px-6 space-y-4 sm:space-y-5">
          {/* Header fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Tanggal <span className="text-red-400">*</span></Label>
                <DatePicker value={date} onChange={(v) => { setDate(v); clearError("date"); }} />
                {validationErrors.date && <p className="text-xs text-red-500">{validationErrors.date}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Referensi</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="No. invoice, PO, dll" className="rounded-xl border-gray-200" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs sm:text-sm font-medium text-gray-700">Deskripsi <span className="text-red-400">*</span></Label>
              <Input value={description} onChange={(e) => { setDescription(e.target.value); clearError("description"); }} placeholder="Deskripsi jurnal" className="rounded-xl border-gray-200" />
              {validationErrors.description && <p className="text-xs text-red-500">{validationErrors.description}</p>}
            </div>

            <div className="space-y-1">
              <Label className="text-xs sm:text-sm font-medium text-gray-700">Catatan</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan tambahan (opsional)" className="rounded-xl border-gray-200" />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-3">
            <Label className="text-xs sm:text-sm font-semibold text-gray-900">Baris Jurnal</Label>
            {validationErrors.lines && <p className="text-xs text-red-500">{validationErrors.lines}</p>}

            {/* Mobile: card-based */}
            <div className="sm:hidden space-y-2">
              {lines.map((line, idx) => (
                <div key={line.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">Baris {idx + 1}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(line.id)}>
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </Button>
                  </div>
                  <AccountSelect accounts={accounts} value={line.accountId} onChange={(v) => updateLine(line.id, "accountId", v)} />
                  <Input value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)} placeholder="Keterangan" className="rounded-lg border-gray-200 text-xs" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-gray-400 font-medium">Debit</span>
                      <Input type="number" value={line.debit} onChange={(e) => updateLine(line.id, "debit", e.target.value)} placeholder="0" className="rounded-lg text-xs text-right font-mono border-gray-200" min="0" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-gray-400 font-medium">Kredit</span>
                      <Input type="number" value={line.credit} onChange={(e) => updateLine(line.id, "credit", e.target.value)} placeholder="0" className="rounded-lg text-xs text-right font-mono border-gray-200" min="0" />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 text-xs font-mono tabular-nums">
                <span className="font-semibold text-gray-600">Total</span>
                <div className="flex gap-3">
                  <span className="text-emerald-700 font-bold">D {formatCurrency(totalDebit)}</span>
                  <span className="text-rose-700 font-bold">K {formatCurrency(totalCredit)}</span>
                </div>
              </div>
            </div>

            {/* Desktop: table-based */}
            <div className="hidden sm:block rounded-xl border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                    <TableHead className="w-[260px] font-semibold text-slate-600">Akun</TableHead>
                    <TableHead className="font-semibold text-slate-600">Deskripsi</TableHead>
                    <TableHead className="w-[150px] font-semibold text-slate-600 text-right">Debit</TableHead>
                    <TableHead className="w-[150px] font-semibold text-slate-600 text-right">Kredit</TableHead>
                    <TableHead className="w-[48px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id} className="group">
                      <TableCell className="p-2"><AccountSelect accounts={accounts} value={line.accountId} onChange={(v) => updateLine(line.id, "accountId", v)} /></TableCell>
                      <TableCell className="p-2"><Input value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)} placeholder="Keterangan" className="rounded-xl h-9 text-sm border-gray-200" /></TableCell>
                      <TableCell className="p-2"><Input type="number" value={line.debit} onChange={(e) => updateLine(line.id, "debit", e.target.value)} placeholder="0" className="rounded-xl h-9 text-sm text-right font-mono border-gray-200" min="0" /></TableCell>
                      <TableCell className="p-2"><Input type="number" value={line.credit} onChange={(e) => updateLine(line.id, "credit", e.target.value)} placeholder="0" className="rounded-xl h-9 text-sm text-right font-mono border-gray-200" min="0" /></TableCell>
                      <TableCell className="p-2"><Button type="button" variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeLine(line.id)}><Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-slate-50/70">
                    <TableCell colSpan={2} className="text-right font-semibold text-gray-700">Total</TableCell>
                    <TableCell className="text-right font-bold font-mono tabular-nums text-gray-900">{formatCurrency(totalDebit)}</TableCell>
                    <TableCell className="text-right font-bold font-mono tabular-nums text-gray-900">{formatCurrency(totalCredit)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            <button type="button" onClick={addLine} className="w-full flex items-center justify-center gap-2 py-2 sm:py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-xs sm:text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-colors">
              <Plus className="w-4 h-4" /> Tambah Baris
            </button>

            {/* Balance indicator */}
            <Badge
              variant="secondary"
              className={cn(
                "w-full justify-center gap-2 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium border-0",
                isBalanced ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              )}
            >
              {isBalanced ? (
                <><CheckCircle2 className="w-4 h-4" /> Jurnal seimbang</>
              ) : (
                <><AlertTriangle className="w-4 h-4" /> Selisih: {formatCurrency(Math.abs(difference))}</>
              )}
            </Badge>
            {validationErrors.balance && <p className="text-xs text-red-500 text-center">{validationErrors.balance}</p>}
          </div>
        </DialogBody>

        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
          <Button type="button" variant="outline" onClick={() => onClose()} className="rounded-xl">Batal</Button>
          <Button type="button" variant="outline" onClick={() => handleSave(false)} disabled={saving} className="rounded-xl">
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Draft
          </Button>
          <Button type="button" onClick={() => setPostConfirmOpen(true)} disabled={saving || !isBalanced} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-600/20">
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Posting
          </Button>
        </DialogFooter>

        <ActionConfirmDialog
          open={postConfirmOpen}
          onOpenChange={setPostConfirmOpen}
          kind="submit"
          title="Posting Jurnal?"
          description="Jurnal yang sudah diposting tidak dapat diedit. Pastikan semua data sudah benar."
          confirmLabel="Ya, Posting"
          onConfirm={async () => { await handleSave(true); setPostConfirmOpen(false); }}
        />
      </DialogContent>
    </Dialog>
  );
}
