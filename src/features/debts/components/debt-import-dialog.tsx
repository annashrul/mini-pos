"use client";
import { ImportDialog } from "@/components/ui/import-dialog";
import { importDebts, downloadDebtImportTemplate } from "@/server/actions/debts";
import { Wallet } from "lucide-react";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; branchId?: string | undefined; onImported: () => void; }

export function DebtImportDialog({ open, onOpenChange, branchId, onImported }: Props) {
  return (
    <ImportDialog open={open} onOpenChange={onOpenChange} title="Import Hutang Piutang" accentGradient="from-amber-500 via-orange-500 to-red-500"
      icon={<div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-200/50"><Wallet className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" /></div>}
      onImport={async (rows) => importDebts(rows.map((r) => ({ type: r[0] || "PAYABLE", partyName: r[1] || "", description: r[2] || "", totalAmount: Number(r[3]) || 0, dueDate: r[4] || "" })), branchId)}
      onDownloadTemplate={downloadDebtImportTemplate} onImported={onImported}
      guideNotes={["Kolom wajib: Tipe, Nama Pihak, Jumlah", "Tipe: PAYABLE (hutang) atau RECEIVABLE (piutang)"]} />
  );
}
