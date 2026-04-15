"use client";

import { ImportDialog } from "@/components/ui/import-dialog";
import { importTransactions, downloadTransactionImportTemplate } from "@/server/actions/transactions";
import { Receipt } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string | undefined;
  onImported: () => void;
}

export function TransactionImportDialog({ open, onOpenChange, branchId, onImported }: Props) {
  return (
    <ImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import Transaksi"
      accentGradient="from-indigo-500 via-violet-500 to-purple-500"
      icon={
        <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200/50">
          <Receipt className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" />
        </div>
      }
      batchSize={200}
      onImport={async (rows) => {
        const mapped = rows.map((row) => ({
          invoiceNumber: row[0] || "",
          date: row[1] || "",
          cashierName: row[2] || "",
          customerName: row[3] || "",
          paymentMethod: row[4] || "CASH",
          items: row[5] || "",
          discountAmount: Number(row[6]) || 0,
          taxAmount: Number(row[7]) || 0,
          grandTotal: Number(row[8]) || 0,
          notes: row[9] || "",
        }));
        return importTransactions(mapped, branchId);
      }}
      onDownloadTemplate={downloadTransactionImportTemplate}
      onImported={onImported}
      guideNotes={[
        "Baris pertama harus header kolom",
        "Kolom wajib: Item (kode:qty:harga)",
        "Format item: kode_produk:jumlah:harga dipisah koma (contoh: PRD-001:2:3500,PRD-002:1:4000)",
        "Harga per item opsional — jika kosong menggunakan harga jual produk",
        "Metode: CASH, TRANSFER, QRIS, EWALLET, DEBIT, CREDIT_CARD",
        "Invoice otomatis jika dikosongkan",
        ...(branchId ? ["Data akan diimport ke lokasi yang sedang difilter"] : ["Lokasi belum difilter — pilih lokasi di sidebar"]),
      ]}
    />
  );
}
