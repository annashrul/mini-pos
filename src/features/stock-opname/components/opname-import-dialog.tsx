"use client";
import { ImportDialog } from "@/components/ui/import-dialog";
import { importStockOpname, downloadOpnameImportTemplate } from "@/server/actions/stock-opname";
import { ClipboardList } from "lucide-react";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; branchId?: string | undefined; onImported: () => void; }

export function OpnameImportDialog({ open, onOpenChange, branchId, onImported }: Props) {
  return (
    <ImportDialog open={open} onOpenChange={onOpenChange} title="Import Stock Opname" accentGradient="from-cyan-500 via-teal-500 to-emerald-500"
      icon={<div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-md shadow-cyan-200/50"><ClipboardList className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" /></div>}
      onImport={async (rows) => importStockOpname(rows.map((r) => ({ productCode: r[0] || "", actualQty: Number(r[1]) || 0, note: r[2] || "" })), branchId)}
      onDownloadTemplate={downloadOpnameImportTemplate} onImported={onImported}
      guideNotes={["Kolom wajib: Kode Produk, Stok Aktual", "Semua item akan dibuat dalam 1 opname berstatus DRAFT"]} />
  );
}
