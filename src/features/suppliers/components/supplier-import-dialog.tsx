"use client";

import { ImportDialog } from "@/components/ui/import-dialog";
import { importSuppliers, downloadSupplierImportTemplate } from "@/server/actions/suppliers";
import { Truck } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function SupplierImportDialog({ open, onOpenChange, onImported }: Props) {
  return (
    <ImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import Supplier"
      accentGradient="from-orange-500 via-amber-500 to-yellow-500"
      icon={
        <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-md shadow-orange-200/50">
          <Truck className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" />
        </div>
      }
      onImport={async (rows) => {
        return importSuppliers(rows.map((r) => ({
          name: r[0] || "", contact: r[1] || "", email: r[2] || "", address: r[3] || "",
        })));
      }}
      onDownloadTemplate={downloadSupplierImportTemplate}
      onImported={onImported}
      guideNotes={["Kolom wajib: Nama"]}
    />
  );
}
