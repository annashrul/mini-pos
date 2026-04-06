"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
              <span className="font-mono text-gray-400 mr-1.5 text-xs">
                {selected.code}
              </span>
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
            <CommandEmpty className="py-4 text-center text-sm text-gray-400">
              Akun tidak ditemukan
            </CommandEmpty>
            <CommandGroup>
              {accounts.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.code} ${a.name}`}
                  onSelect={() => {
                    onChange(a.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === a.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="font-mono text-xs text-gray-400 mr-2">
                    {a.code}
                  </span>
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

/* ── Journal form dialog (Sheet) ────────────────────────────────────── */
export function JournalFormDialog({ open, onClose }: JournalFormDialogProps) {
  const {
    date,
    setDate,
    description,
    setDescription,
    reference,
    setReference,
    notes,
    setNotes,
    lines,
    accounts,
    saving,
    totalDebit,
    totalCredit,
    difference,
    isBalanced,
    updateLine,
    addLine,
    removeLine,
    handleSave,
  } = useJournalForm(open, onClose);

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[900px] overflow-y-auto p-0"
      >
        {/* Gradient top bar */}
        <div className="h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600" />

        <SheetHeader className="px-6 pt-5 pb-4 border-b border-gray-100">
          <SheetTitle className="text-xl font-bold text-gray-900">
            Buat Jurnal Baru
          </SheetTitle>
          <p className="text-sm text-gray-500 mt-0.5">
            Isi detail jurnal dan tambahkan baris entri debit/kredit
          </p>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* ── Header fields ──────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Tanggal <span className="text-red-400">*</span>
                </Label>
                <DatePicker value={date} onChange={setDate} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Referensi
                </Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="No. invoice, PO, dll (opsional)"
                  className="rounded-xl border-gray-200 h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Deskripsi <span className="text-red-400">*</span>
              </Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi jurnal"
                className="rounded-xl border-gray-200 h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Catatan
              </Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan (opsional)"
                className="rounded-xl border-gray-200 h-10"
              />
            </div>
          </div>

          {/* ── Line items ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-gray-900">
                Baris Jurnal
              </Label>
            </div>

            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                    <TableHead className="w-[260px] font-semibold text-slate-600">
                      Akun
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600">
                      Deskripsi
                    </TableHead>
                    <TableHead className="w-[150px] font-semibold text-slate-600 text-right">
                      Debit
                    </TableHead>
                    <TableHead className="w-[150px] font-semibold text-slate-600 text-right">
                      Kredit
                    </TableHead>
                    <TableHead className="w-[48px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id} className="group">
                      <TableCell className="p-2">
                        <AccountSelect
                          accounts={accounts}
                          value={line.accountId}
                          onChange={(v) => updateLine(line.id, "accountId", v)}
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          value={line.description}
                          onChange={(e) =>
                            updateLine(line.id, "description", e.target.value)
                          }
                          placeholder="Keterangan"
                          className="rounded-xl h-9 text-sm border-gray-200"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="number"
                          value={line.debit}
                          onChange={(e) =>
                            updateLine(line.id, "debit", e.target.value)
                          }
                          placeholder="0"
                          className="rounded-xl h-9 text-sm text-right font-mono border-gray-200"
                          min="0"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="number"
                          value={line.credit}
                          onChange={(e) =>
                            updateLine(line.id, "credit", e.target.value)
                          }
                          placeholder="0"
                          className="rounded-xl h-9 text-sm text-right font-mono border-gray-200"
                          min="0"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-slate-50/70">
                    <TableCell colSpan={2} className="text-right font-semibold text-gray-700">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold font-mono tabular-nums text-gray-900">
                      {formatCurrency(totalDebit)}
                    </TableCell>
                    <TableCell className="text-right font-bold font-mono tabular-nums text-gray-900">
                      {formatCurrency(totalCredit)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Add line button */}
            <button
              type="button"
              onClick={addLine}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tambah Baris
            </button>

            {/* Balance indicator */}
            <Badge
              variant="secondary"
              className={cn(
                "w-full justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-0",
                isBalanced
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              )}
            >
              {isBalanced ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Jurnal seimbang (balance)
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Selisih: {formatCurrency(Math.abs(difference))}
                  {difference > 0
                    ? " (Debit lebih besar)"
                    : " (Kredit lebih besar)"}
                </>
              )}
            </Badge>
          </div>

          {/* ── Actions ────────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              variant="outline"
              onClick={() => onClose()}
              className="rounded-xl border-gray-200"
            >
              Batal
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="rounded-xl border-gray-300"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan Draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving || !isBalanced}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-600/20"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Posting
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
