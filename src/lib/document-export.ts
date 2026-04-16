/**
 * Reusable document export utilities — print, PDF, CSV, Excel
 * Shared configuration for consistent output across all modules
 */

export interface DocumentColumn {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  width?: number; // mm for PDF, chars for Excel
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

export interface DocumentConfig {
  title: string;
  subtitle?: string;
  docNumber?: string;
  date?: string;
  infoRows?: { label: string; value: string }[];
  columns: DocumentColumn[];
  data: Record<string, unknown>[];
  totals?: { label: string; value: string }[] | undefined;
  notes?: string | undefined;
  signatures?: string[] | undefined;
  company?: { name: string; address?: string | null; phone?: string | null } | null | undefined;
}

// ─── Helpers ───

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function csvEscape(val: unknown): string {
  const s = String(val ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

// ─── PRINT (opens browser print dialog) ───

export function printDocument(config: DocumentConfig) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;

  const headerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1f2937;padding-bottom:10px;margin-bottom:15px;">
      <div>
        <h1 style="margin:0;font-size:18px;font-weight:800;">${esc(config.title)}</h1>
        ${config.company?.name ? `<p style="margin:3px 0 0;font-size:10px;color:#6b7280;">${esc(config.company.name)}</p>` : ""}
        ${config.company?.address ? `<p style="margin:2px 0 0;font-size:9px;color:#9ca3af;">${esc(config.company.address)}</p>` : ""}
        ${config.company?.phone ? `<p style="margin:2px 0 0;font-size:9px;color:#9ca3af;">Tel: ${esc(config.company.phone)}</p>` : ""}
      </div>
      <div style="text-align:right;">
        ${config.docNumber ? `<p style="margin:0;font-size:14px;font-weight:800;font-family:monospace;">${esc(config.docNumber)}</p>` : ""}
        ${config.date ? `<p style="margin:4px 0 0;font-size:10px;color:#6b7280;">${esc(config.date)}</p>` : ""}
        ${config.subtitle ? `<p style="margin:4px 0 0;font-size:10px;color:#6b7280;">${esc(config.subtitle)}</p>` : ""}
      </div>
    </div>
  `;

  const infoHTML = config.infoRows?.length ? `
    <div style="display:flex;gap:20px;margin-bottom:15px;flex-wrap:wrap;">
      ${config.infoRows.map((r) => `
        <div style="flex:1;min-width:180px;border:1px solid #e5e7eb;border-radius:6px;padding:10px;">
          <p style="margin:0 0 4px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;">${esc(r.label)}</p>
          <p style="margin:0;font-weight:700;font-size:12px;">${esc(r.value)}</p>
        </div>
      `).join("")}
    </div>
  ` : "";

  const thStyle = "text-align:{align};padding:6px;border-bottom:2px solid #d1d5db;";
  const tdStyle = "text-align:{align};padding:4px 6px;border-bottom:1px solid #e5e7eb;";

  const thead = config.columns.map((col) =>
    `<th style="${thStyle.replace("{align}", col.align || "left")}">${esc(col.header)}</th>`
  ).join("");

  const tbody = config.data.map((row) =>
    `<tr>${config.columns.map((col) => {
      const val = col.format ? col.format(row[col.key], row) : String(row[col.key] ?? "");
      return `<td style="${tdStyle.replace("{align}", col.align || "left")}">${esc(val)}</td>`;
    }).join("")}</tr>`
  ).join("");

  const totalsHTML = config.totals?.length ? `
    <div style="display:flex;justify-content:flex-end;margin-bottom:15px;">
      <div style="border:2px solid #1f2937;border-radius:6px;padding:8px 16px;">
        ${config.totals.map((t) => `
          <div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:2px;">
            <span style="font-size:11px;font-weight:600;">${esc(t.label)}</span>
            <span style="font-size:14px;font-weight:800;font-family:monospace;">${esc(t.value)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  ` : "";

  const notesHTML = config.notes ? `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;margin-bottom:15px;font-size:10px;"><strong>Catatan:</strong> ${esc(config.notes)}</div>` : "";

  const sigHTML = config.signatures?.length ? `
    <div style="display:flex;justify-content:space-between;margin-top:30px;">
      ${config.signatures.map((label) => `
        <div style="text-align:center;width:150px;">
          <p style="margin:0 0 50px;font-size:10px;font-weight:600;">${esc(label)}</p>
          <div style="border-top:1px solid #1f2937;padding-top:4px;font-size:10px;">( ________________ )</div>
        </div>
      `).join("")}
    </div>
  ` : "";

  const html = `<!DOCTYPE html><html><head><title>${esc(config.title)}</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:20px; font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#1f2937; }
    table { width:100%; border-collapse:collapse; margin-bottom:10px; font-size:11px; page-break-inside:auto; }
    tr { page-break-inside:avoid; page-break-after:auto; }
    thead { display:table-header-group; }
    tfoot { display:table-footer-group; }
    @media print { body { margin:0; padding:10px; } @page { size:A4; margin:10mm; } }
  </style></head>
  <body>
    ${headerHTML}
    ${infoHTML}
    <table><thead><tr style="background:#f3f4f6;">${thead}</tr></thead><tbody>${tbody}</tbody></table>
    ${totalsHTML}
    ${notesHTML}
    ${sigHTML}
  </body></html>`;

  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

// ─── PDF Export (jsPDF + autoTable) ───

export function exportToPDF(config: DocumentConfig, filename: string) {
  import("jspdf").then(({ default: jsPDF }) => {
    import("jspdf-autotable").then(({ default: autoTable }) => {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Header
      doc.setFontSize(16);
      doc.setTextColor(30);
      doc.text(config.title, 14, 18);
      if (config.company?.name) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(config.company.name, 14, 23);
      }
      if (config.docNumber) {
        doc.setFontSize(12);
        doc.setTextColor(30);
        doc.text(config.docNumber, 196, 18, { align: "right" });
      }
      if (config.date) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(config.date, 196, 23, { align: "right" });
      }
      if (config.subtitle) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(config.subtitle, 196, 28, { align: "right" });
      }

      doc.setDrawColor(30);
      doc.setLineWidth(0.5);
      doc.line(14, 31, 196, 31);

      // Info rows
      let startY = 35;
      if (config.infoRows?.length) {
        config.infoRows.forEach((r, i) => {
          const x = i % 2 === 0 ? 14 : 110;
          const y = startY + Math.floor(i / 2) * 10;
          doc.setFontSize(7);
          doc.setTextColor(100);
          doc.text(r.label.toUpperCase(), x, y);
          doc.setFontSize(10);
          doc.setTextColor(30);
          doc.text(r.value, x, y + 5);
        });
        startY += Math.ceil(config.infoRows.length / 2) * 10 + 4;
      }

      // Table
      const head = [config.columns.map((c) => c.header)];
      const body = config.data.map((row) =>
        config.columns.map((col) =>
          col.format ? col.format(row[col.key], row) : String(row[col.key] ?? "")
        )
      );

      const colStyles: Record<number, { halign: "left" | "center" | "right"; cellWidth?: number }> = {};
      config.columns.forEach((col, i) => {
        if (col.align || col.width) {
          colStyles[i] = {
            halign: col.align || "left",
            ...(col.width ? { cellWidth: col.width } : {}),
          };
        }
      });

      const titleForRepeat = config.docNumber
        ? `${config.title} — ${config.docNumber}`
        : config.title;

      autoTable(doc, {
        startY,
        head,
        body,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [243, 244, 246], textColor: 30, fontStyle: "bold" },
        columnStyles: colStyles,
        showHead: "everyPage",
        didDrawPage: (hookData) => {
          if (hookData.pageNumber > 1) {
            doc.setFontSize(10);
            doc.setTextColor(30);
            doc.text(titleForRepeat, 14, 8);
            doc.setDrawColor(220);
            doc.setLineWidth(0.2);
            doc.line(14, 10, 196, 10);
          }
        },
      });

      const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;

      // Totals
      let totalY = finalY + 8;
      if (config.totals?.length) {
        config.totals.forEach((t) => {
          doc.setFontSize(10);
          doc.setTextColor(30);
          doc.text(`${t.label}:`, 140, totalY);
          doc.setFontSize(12);
          doc.text(t.value, 196, totalY, { align: "right" });
          totalY += 7;
        });
      }

      // Notes
      if (config.notes) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Catatan: ${config.notes}`, 14, totalY + 4);
        totalY += 10;
      }

      // Signatures
      if (config.signatures?.length) {
        const sigY = totalY + 10;
        const spacing = 170 / config.signatures.length;
        config.signatures.forEach((label, i) => {
          const x = 30 + i * spacing;
          doc.setFontSize(8);
          doc.setTextColor(30);
          doc.text(label, x, sigY, { align: "center" });
          doc.line(x - 25, sigY + 25, x + 25, sigY + 25);
          doc.text("( ________________ )", x, sigY + 30, { align: "center" });
        });
      }

      doc.save(filename);
    });
  });
}

// ─── CSV Export ───

export function exportToCSV(config: DocumentConfig, filename: string) {
  const lines: string[] = [];

  // Info header
  lines.push(csvEscape(config.title));
  if (config.docNumber) lines.push(`${csvEscape("")},${csvEscape(config.docNumber)}`);
  if (config.infoRows?.length) {
    config.infoRows.forEach((r) => lines.push(`${csvEscape(r.label)},${csvEscape(r.value)}`));
  }
  lines.push("");

  // Column headers
  lines.push(config.columns.map((c) => csvEscape(c.header)).join(","));

  // Data
  config.data.forEach((row) => {
    lines.push(config.columns.map((col) => {
      const val = col.format ? col.format(row[col.key], row) : row[col.key];
      return csvEscape(val);
    }).join(","));
  });

  // Totals
  if (config.totals?.length) {
    lines.push("");
    config.totals.forEach((t) => {
      const pad = config.columns.length - 2;
      lines.push([...Array(pad).fill('""'), csvEscape(t.label), csvEscape(t.value)].join(","));
    });
  }

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Excel Export ───

export function exportToExcel(config: DocumentConfig, filename: string) {
  import("xlsx").then((XLSX) => {
    const wb = XLSX.utils.book_new();
    const colCount = config.columns.length;

    const sheetData: (string | number | null)[][] = [];
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

    // Helper: add a full-width merged row
    const addMergedRow = (text: string | number | null) => {
      const rowIdx = sheetData.length;
      sheetData.push([text, ...Array(colCount - 1).fill(null)]);
      if (colCount > 1) {
        merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: colCount - 1 } });
      }
    };

    // Title
    addMergedRow(config.title);

    // Doc number
    if (config.docNumber) addMergedRow(config.docNumber);

    // Date & subtitle
    if (config.date) addMergedRow(config.date);
    if (config.subtitle) addMergedRow(config.subtitle);

    // Empty separator
    sheetData.push([]);

    // Info rows — each as "Label: Value" merged across all columns
    if (config.infoRows?.length) {
      config.infoRows.forEach((r) => {
        addMergedRow(`${r.label}: ${r.value}`);
      });
    }

    // Empty row before table
    sheetData.push([]);

    // Column headers row
    sheetData.push(config.columns.map((c) => c.header));

    // Data rows
    config.data.forEach((row) => {
      sheetData.push(config.columns.map((col) => {
        const val = col.format ? col.format(row[col.key], row) : row[col.key];
        return val as string | number | null;
      }));
    });

    // Totals
    if (config.totals?.length) {
      sheetData.push([]);
      config.totals.forEach((t) => {
        const rowIdx = sheetData.length;
        // Merge label across all columns except last
        const labelCols = colCount - 1;
        sheetData.push([t.label, ...Array(labelCols - 1).fill(null), t.value]);
        if (labelCols > 1) {
          merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: labelCols - 1 } });
        }
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Apply merges
    ws["!merges"] = merges;

    // Column widths
    ws["!cols"] = config.columns.map((col) => ({ wch: col.width || 15 }));

    // Style title row (bold, larger) — XLSX utils doesn't support styles natively,
    // but we ensure the cell value is prominent
    const titleCell = ws["A1"];
    if (titleCell) titleCell.t = "s";

    // Style header row (make values uppercase-ish via the data already)
    // SheetJS community edition doesn't support cell styles, but structure is clean

    XLSX.utils.book_append_sheet(wb, ws, config.title.slice(0, 31));
    XLSX.writeFile(wb, filename);
  });
}
