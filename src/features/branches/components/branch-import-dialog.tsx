"use client";
import { ImportDialog } from "@/components/ui/import-dialog";
import { importBranches, downloadBranchImportTemplate } from "@/server/actions/branches";
import { Building2 } from "lucide-react";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; onImported: () => void; }

export function BranchImportDialog({ open, onOpenChange, onImported }: Props) {
  return (
    <ImportDialog open={open} onOpenChange={onOpenChange} title="Import Cabang" accentGradient="from-sky-500 via-blue-500 to-indigo-500"
      icon={<div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-sky-200/50"><Building2 className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" /></div>}
      onImport={async (rows) => importBranches(rows.map((r) => ({ name: r[0] || "", code: r[1] || "", address: r[2] || "", phone: r[3] || "" })))}
      onDownloadTemplate={downloadBranchImportTemplate} onImported={onImported}
      guideNotes={["Kolom wajib: Nama Cabang"]} />
  );
}
