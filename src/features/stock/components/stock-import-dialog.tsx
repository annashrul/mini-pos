"use client";
import { ImportDialog } from "@/components/ui/import-dialog";
import { importStockMovements, downloadStockImportTemplate } from "@/server/actions/stock";
import { Package } from "lucide-react";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; branchId?: string | undefined; onImported: () => void; }

export function StockImportDialog({ open, onOpenChange, branchId, onImported }: Props) {
  return (
    <ImportDialog open={open} onOpenChange={onOpenChange} title="Import Pergerakan Stok" accentGradient="from-teal-500 via-emerald-500 to-green-500"
      icon={<div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-md shadow-teal-200/50"><Package className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" /></div>}
      batchSize={500}
      onImport={async (rows) => importStockMovements(rows.map((r) => ({ productCode: r[0] || "", type: r[1] || "IN", quantity: Number(r[2]) || 0, note: r[3] || "" })), branchId)}
      onDownloadTemplate={downloadStockImportTemplate} onImported={onImported}
      guideNotes={["Kolom wajib: Kode Produk, Tipe, Jumlah", "Tipe: IN (masuk) atau OUT (keluar)"]} />
  );
}
