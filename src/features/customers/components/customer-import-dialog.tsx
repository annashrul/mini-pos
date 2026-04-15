"use client";

import { ImportDialog } from "@/components/ui/import-dialog";
import { importCustomers, downloadCustomerImportTemplate } from "@/server/actions/customers";
import { Users } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function CustomerImportDialog({ open, onOpenChange, onImported }: Props) {
  return (
    <ImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import Customer"
      accentGradient="from-emerald-500 via-teal-500 to-cyan-500"
      icon={
        <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-200/50">
          <Users className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" />
        </div>
      }
      onImport={async (rows) => {
        return importCustomers(rows.map((r) => ({
          name: r[0] || "", phone: r[1] || "", email: r[2] || "", address: r[3] || "", memberLevel: r[4] || "REGULAR",
        })));
      }}
      onDownloadTemplate={downloadCustomerImportTemplate}
      onImported={onImported}
      guideNotes={["Kolom wajib: Nama", "Level: REGULAR, SILVER, GOLD, PLATINUM"]}
    />
  );
}
