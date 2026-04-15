"use client";

import { ImportDialog } from "@/components/ui/import-dialog";
import { importBundles, downloadBundleImportTemplate } from "@/server/actions/bundles";
import { Package } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string | undefined;
  onImported: () => void;
}

export function BundleImportDialog({ open, onOpenChange, branchId, onImported }: Props) {
  return (
    <ImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import Paket Produk"
      accentGradient="from-blue-500 via-indigo-500 to-violet-500"
      icon={
        <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200/50">
          <Package className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" />
        </div>
      }
      onImport={async (rows) => {
        const mapped = rows.map((row) => ({
          code: row[0] || "",
          name: row[1] || "",
          description: row[2] || "",
          sellingPrice: Number(row[3]) || 0,
          categoryName: row[4] || "",
          barcode: row[5] || "",
          items: row[6] || "",
        }));
        return importBundles(mapped, branchId);
      }}
      onDownloadTemplate={downloadBundleImportTemplate}
      onImported={onImported}
      guideNotes={[
        "Baris pertama harus header kolom",
        "Kolom wajib: Nama Paket, Harga Jual, Item",
        "Format item: kode_produk:jumlah dipisah koma (contoh: PRD-001:2,PRD-002:1)",
        "Kode paket otomatis jika dikosongkan",
        ...(branchId ? ["Data akan diimport ke lokasi yang sedang difilter"] : ["Data akan diimport ke semua lokasi aktif"]),
      ]}
    />
  );
}
