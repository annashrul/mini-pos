"use client";

import { ImportDialog } from "@/components/ui/import-dialog";
import {
  importProducts,
  downloadProductImportTemplate,
} from "@/server/actions/products";
import { FileUp } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string | undefined;
  onImported: () => void;
}

export function ProductImportDialog({ open, onOpenChange, branchId, onImported }: Props) {
  return (
    <ImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import Produk"
      icon={
        <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200/50">
          <FileUp className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" />
        </div>
      }
      onImport={async (rows) => {
        const mapped = rows.map((row) => ({
          code: row[0] || "",
          name: row[1] || "",
          categoryName: row[2] || "",
          brandName: row[3] || "",
          unit: row[4] || "PCS",
          purchasePrice: Number(row[5]) || 0,
          sellingPrice: Number(row[6]) || 0,
          stock: Number(row[7]) || 0,
          minStock: Number(row[8]) || 0,
          barcode: row[9] || "",
          description: row[10] || "",
        }));
        return importProducts(mapped, branchId);
      }}
      onDownloadTemplate={downloadProductImportTemplate}
      onImported={onImported}
      guideNotes={[
        "Baris pertama harus header kolom",
        "Kolom wajib: Nama Produk, Kategori, Satuan, Harga Beli, Harga Jual",
        "Kode produk otomatis jika dikosongkan",
        "Mendukung format Excel (.xlsx) dan CSV (.csv)",
        ...(branchId ? ["Data akan diimport ke lokasi yang sedang difilter"] : ["Data akan diimport ke semua lokasi aktif"]),
      ]}
    />
  );
}
