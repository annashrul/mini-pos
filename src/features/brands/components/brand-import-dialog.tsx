"use client";

import { ImportDialog } from "@/components/ui/import-dialog";
import { importBrands, downloadBrandImportTemplate } from "@/server/actions/brands";
import { Tag } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function BrandImportDialog({ open, onOpenChange, onImported }: Props) {
  return (
    <ImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import Brand"
      accentGradient="from-violet-500 via-purple-500 to-fuchsia-500"
      icon={
        <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-200/50">
          <Tag className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" />
        </div>
      }
      onImport={async (rows) => {
        return importBrands(rows.map((r) => ({ name: r[0] || "" })));
      }}
      onDownloadTemplate={downloadBrandImportTemplate}
      onImported={onImported}
      guideNotes={["Kolom wajib: Nama Brand"]}
    />
  );
}
