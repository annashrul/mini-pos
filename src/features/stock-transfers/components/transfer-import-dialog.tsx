"use client";
import { ImportDialog } from "@/components/ui/import-dialog";
import { importStockTransfers, downloadTransferImportTemplate } from "@/server/actions/stock-transfers";
import { ArrowLeftRight } from "lucide-react";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; onImported: () => void; }

export function TransferImportDialog({ open, onOpenChange, onImported }: Props) {
  return (
    <ImportDialog open={open} onOpenChange={onOpenChange} title="Import Transfer Stok" accentGradient="from-purple-500 via-violet-500 to-indigo-500"
      icon={<div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-md shadow-purple-200/50"><ArrowLeftRight className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" /></div>}
      onImport={async (rows) => importStockTransfers(rows.map((r) => ({ fromBranch: r[0] || "", toBranch: r[1] || "", items: r[2] || "", notes: r[3] || "" })))}
      onDownloadTemplate={downloadTransferImportTemplate} onImported={onImported}
      guideNotes={["Kolom wajib: Cabang Asal, Cabang Tujuan, Item", "Format item: kode:jumlah dipisah koma"]} />
  );
}
