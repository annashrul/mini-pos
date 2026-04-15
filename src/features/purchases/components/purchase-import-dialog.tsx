"use client";
import { ImportDialog } from "@/components/ui/import-dialog";
import { importPurchaseOrders, downloadPOImportTemplate } from "@/server/actions/purchases";
import { ShoppingCart } from "lucide-react";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; branchId?: string | undefined; onImported: () => void; }

export function PurchaseImportDialog({ open, onOpenChange, branchId, onImported }: Props) {
  return (
    <ImportDialog open={open} onOpenChange={onOpenChange} title="Import Purchase Order" accentGradient="from-blue-500 via-indigo-500 to-violet-500"
      icon={<div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200/50"><ShoppingCart className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" /></div>}
      onImport={async (rows) => importPurchaseOrders(rows.map((r) => ({ supplierName: r[0] || "", items: r[1] || "", notes: r[2] || "", orderDate: r[3] || "" })), branchId)}
      onDownloadTemplate={downloadPOImportTemplate} onImported={onImported}
      guideNotes={["Kolom wajib: Nama Supplier, Item", "Format item: kode:qty:harga dipisah koma. Harga opsional (default harga beli)"]} />
  );
}
