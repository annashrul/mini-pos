"use client";
import { ImportDialog } from "@/components/ui/import-dialog";
import { importExpenses, downloadExpenseImportTemplate } from "@/server/actions/expenses";
import { Receipt } from "lucide-react";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; branchId?: string | undefined; onImported: () => void; }

export function ExpenseImportDialog({ open, onOpenChange, branchId, onImported }: Props) {
  return (
    <ImportDialog open={open} onOpenChange={onOpenChange} title="Import Pengeluaran" accentGradient="from-red-500 via-rose-500 to-pink-500"
      icon={<div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-md shadow-red-200/50"><Receipt className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" /></div>}
      onImport={async (rows) => importExpenses(rows.map((r) => ({ category: r[0] || "", description: r[1] || "", amount: Number(r[2]) || 0, date: r[3] || "" })), branchId)}
      onDownloadTemplate={downloadExpenseImportTemplate} onImported={onImported}
      guideNotes={["Kolom wajib: Kategori, Jumlah", "Format tanggal: YYYY-MM-DD"]} />
  );
}
