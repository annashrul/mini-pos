"use client";
import { ImportDialog } from "@/components/ui/import-dialog";
import { importUsers, downloadUserImportTemplate } from "@/server/actions/users";
import { Users } from "lucide-react";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; onImported: () => void; }

export function UserImportDialog({ open, onOpenChange, onImported }: Props) {
  return (
    <ImportDialog open={open} onOpenChange={onOpenChange} title="Import User" accentGradient="from-violet-500 via-purple-500 to-fuchsia-500"
      icon={<div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-200/50"><Users className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" /></div>}
      batchSize={200}
      onImport={async (rows) => importUsers(rows.map((r) => ({ name: r[0] || "", email: r[1] || "", password: r[2] || "", role: r[3] || "CASHIER", branchName: r[4] || "" })))}
      onDownloadTemplate={downloadUserImportTemplate} onImported={onImported}
      guideNotes={["Kolom wajib: Nama, Email", "Role: ADMIN, MANAGER, CASHIER", "Password default: 12345678"]} />
  );
}
