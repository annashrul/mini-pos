"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Download, FileSpreadsheet, FileText, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportModuleData, exportGenericData } from "@/server/actions/export";
import type { ExportColumn, ExportFormat, CompanyInfo } from "@/lib/export-generators";
import type { jsPDF as JsPDFType } from "jspdf";

interface ExportMenuProps {
  /** Module name for backend data fetching */
  module?: string | undefined;
  /** Or pass data directly (columns + rows) for generic export */
  columns?: ExportColumn[] | undefined;
  rows?: Record<string, unknown>[] | undefined;
  title?: string | undefined;
  /** Filters passed to backend fetcher */
  filters?: Record<string, string | undefined> | undefined;
  /** Branch filter */
  branchId?: string | undefined;
  /** Disable the button */
  disabled?: boolean | undefined;
  /** Button variant */
  variant?: "default" | "outline" | "ghost" | undefined;
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon" | undefined;
  /** Custom className for trigger button */
  className?: string | undefined;
}

const formats = [
  { key: "xlsx" as const, label: "Excel (.xlsx)", icon: FileSpreadsheet, color: "text-emerald-600" },
  { key: "csv" as const, label: "CSV (.csv)", icon: FileText, color: "text-blue-600" },
  { key: "pdf" as const, label: "PDF (.pdf)", icon: FileDown, color: "text-red-600" },
];

function downloadBase64(data: string, filename: string, contentType: string) {
  const binaryString = atob(data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function generatePDFClient(
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  title: string,
  company: CompanyInfo,
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc: JsPDFType = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  // ── Header area ──────────────────────────────
  let headerY = margin;

  // Logo (if available)
  if (company.logo) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = company.logo!;
      });
      doc.addImage(img, "PNG", margin, headerY, 18, 18);
    } catch {
      // Logo gagal dimuat — skip
    }
  }

  // Company info (right of logo)
  const infoX = company.logo ? margin + 22 : margin;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(company.name, infoX, headerY + 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // slate-500
  const infoLines: string[] = [];
  if (company.address) infoLines.push(company.address);
  const contactParts: string[] = [];
  if (company.phone) contactParts.push(company.phone);
  if (company.email) contactParts.push(company.email);
  if (contactParts.length) infoLines.push(contactParts.join(" | "));
  infoLines.forEach((line, i) => {
    doc.text(line, infoX, headerY + 10 + i * 4);
  });

  // Divider line
  headerY += 22;
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.5);
  doc.line(margin, headerY, pageW - margin, headerY);
  headerY += 4;

  // Report title + date
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(title, margin, headerY + 4);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`${dateStr} • ${timeStr}`, pageW - margin, headerY + 4, { align: "right" });
  headerY += 10;

  // ── Table ──────────────────────────────
  autoTable(doc, {
    startY: headerY,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ""))),
    styles: {
      fontSize: 7,
      cellPadding: 2.5,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: 3,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin, bottom: 18 },
    tableLineColor: [203, 213, 225],
    tableLineWidth: 0.2,
  });

  // ── Footer (after table is fully rendered) ──────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Bottom border
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);

    // Footer text
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.text(`${company.name} — ${title}`, margin, pageH - 8);
    doc.text(`Total: ${rows.length} data`, pageW / 2, pageH - 8, { align: "center" });
    doc.text(`Halaman ${i} / ${totalPages}`, pageW - margin, pageH - 8, { align: "right" });
  }

  return doc.output("arraybuffer");
}

export function ExportMenu({
  module,
  columns,
  rows,
  title,
  filters,
  branchId,
  disabled,
  variant = "outline",
  size = "sm",
  className: customClassName,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setLoading(format);
    try {
      let result: { data: string; filename: string; contentType: string; pdfData?: { columns: ExportColumn[]; rows: Record<string, unknown>[]; title: string; company: CompanyInfo } | undefined };

      if (columns && rows) {
        result = await exportGenericData({ format, title: title ?? "Export", columns, rows });
      } else if (module) {
        result = await exportModuleData({ format, module, filters, branchId });
      } else {
        toast.error("Konfigurasi export tidak valid");
        return;
      }

      if (format === "pdf" && result.pdfData) {
        const buffer = await generatePDFClient(result.pdfData.columns, result.pdfData.rows, result.pdfData.title, result.pdfData.company);
        const blob = new Blob([buffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        downloadBase64(result.data, result.filename, result.contentType);
      }

      toast.success(`Berhasil mengekspor ${result.filename}`);
      setOpen(false);
    } catch {
      toast.error("Gagal mengekspor data");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size={size} className={customClassName ?? "rounded-xl gap-1.5 text-xs"} disabled={disabled}>
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1 rounded-xl" align="end">
        {formats.map((f) => {
          const Icon = f.icon;
          const isLoading = loading === f.key;
          return (
            <button
              key={f.key}
              onClick={() => handleExport(f.key)}
              disabled={!!loading}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <Icon className={`w-4 h-4 ${f.color}`} />
              )}
              <span>{isLoading ? "Mengekspor..." : f.label}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
