/**
 * PO-specific print/export using reusable document-export utilities
 */

import { exportToPDF, exportToCSV, exportToExcel, type DocumentConfig, type DocumentColumn } from "./document-export";

export interface POPrintData {
  orderNumber: string;
  orderDate: string;
  expectedDate?: string | null;
  status: string;
  supplier: { name: string; contact?: string | null; address?: string | null };
  branch?: { name: string } | null;
  items: { productName: string; productCode?: string; quantity: number; receivedQty?: number; unitPrice: number; subtotal: number; unit?: string }[];
  totalAmount: number;
  notes?: string | null;
  company?: { name: string; address?: string | null; phone?: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ORDERED: "Dipesan",
  PARTIAL: "Diterima Sebagian",
  RECEIVED: "Diterima",
  CLOSED: "Ditutup",
  CANCELLED: "Dibatalkan",
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function buildPOConfig(data: POPrintData): DocumentConfig {
  const hasReceived = data.status !== "DRAFT" && data.status !== "ORDERED";

  const columns: DocumentColumn[] = [
    { key: "no", header: "No", align: "center", width: 5 },
    { key: "productName", header: "Produk", align: "left", width: 30 },
    { key: "unit", header: "Satuan", align: "center", width: 8 },
    { key: "quantity", header: "Order", align: "center", width: 10 },
  ];

  if (hasReceived) {
    columns.push(
      { key: "received", header: "Diterima", align: "center", width: 12 },
      { key: "gap", header: "Selisih", align: "center", width: 10, format: (v) => { const n = v as number; return n > 0 ? `-${n}` : "✓"; } },
    );
  }

  columns.push(
    { key: "unitPrice", header: "Harga", align: "right", width: 15, format: (v) => formatCurrency(v as number) },
    { key: "subtotal", header: "Subtotal", align: "right", width: 18, format: (v) => formatCurrency(v as number) },
  );

  const tableData = data.items.map((item, i) => {
    const received = item.receivedQty ?? 0;
    return {
      no: i + 1,
      productName: item.productName,
      unit: item.unit || "PCS",
      quantity: item.quantity,
      received,
      gap: item.quantity - received,
      unitPrice: item.unitPrice,
      subtotal: hasReceived ? received * item.unitPrice : item.subtotal,
    };
  });

  const totals: { label: string; value: string }[] = [];
  if (hasReceived) {
    const receivedTotal = data.items.reduce((s, i) => s + (i.receivedQty ?? 0) * i.unitPrice, 0);
    totals.push(
      { label: "Total Order", value: formatCurrency(data.totalAmount) },
      { label: "Total Diterima", value: formatCurrency(receivedTotal) },
    );
  } else {
    totals.push({ label: "Total", value: formatCurrency(data.totalAmount) });
  }

  return {
    title: "PURCHASE ORDER",
    docNumber: data.orderNumber,
    date: `Tanggal: ${formatDate(data.orderDate)}`,
    subtitle: `Status: ${STATUS_LABELS[data.status] || data.status}`,
    company: data.company,
    infoRows: [
      { label: "Supplier", value: data.supplier.name },
      { label: "Dikirim Ke", value: data.branch?.name || "Semua Cabang" },
    ],
    columns,
    data: tableData,
    totals,
    notes: data.notes || undefined,
    signatures: ["Dibuat Oleh", "Disetujui Oleh", "Diterima Oleh"],
  };
}

// ─── 3-Ply Print (Original + Copy 1 + Copy 2) ───
// This one is PO-specific because it prints 3 copies with labels

export function printPO(data: POPrintData) {
  const config = buildPOConfig(data);

  // For 3-ply we use a custom HTML with 3 copies
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;

  const copies = ["ORIGINAL", "COPY 1", "COPY 2"];
  const pagesHTML = copies.map((copyLabel) => {
    // Reuse the generic print but wrap with copy label
    const thStyle = (align: string) => `text-align:${align};padding:6px;border-bottom:2px solid #d1d5db;`;
    const tdStyle = (align: string) => `text-align:${align};padding:4px 6px;border-bottom:1px solid #e5e7eb;`;

    const thead = config.columns.map((col) =>
      `<th style="${thStyle(col.align || "left")}">${col.header}</th>`
    ).join("");

    const tbody = config.data.map((row) =>
      `<tr>${config.columns.map((col) => {
        const val = col.format ? col.format(row[col.key], row) : String(row[col.key] ?? "");
        return `<td style="${tdStyle(col.align || "left")}">${val}</td>`;
      }).join("")}</tr>`
    ).join("");

    return `
      <div style="page-break-after:always;padding:15px 20px;font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1f2937;max-width:210mm;margin:0 auto;position:relative;">
        <div style="position:absolute;top:10px;right:20px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;border:1px solid #d1d5db;padding:2px 8px;border-radius:4px;">${copyLabel}</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px;border-bottom:2px solid #1f2937;padding-bottom:10px;">
          <div>
            <h1 style="margin:0;font-size:18px;font-weight:800;">PURCHASE ORDER</h1>
            ${config.company?.name ? `<p style="margin:3px 0 0;font-size:10px;color:#6b7280;">${config.company.name}</p>` : ""}
            ${config.company?.address ? `<p style="margin:2px 0 0;font-size:9px;color:#9ca3af;">${config.company.address}</p>` : ""}
            ${config.company?.phone ? `<p style="margin:2px 0 0;font-size:9px;color:#9ca3af;">Tel: ${config.company.phone}</p>` : ""}
          </div>
          <div style="text-align:right;">
            <p style="margin:0;font-size:14px;font-weight:800;font-family:monospace;">${data.orderNumber}</p>
            <p style="margin:4px 0 0;font-size:10px;color:#6b7280;">Tanggal: ${formatDate(data.orderDate)}</p>
            ${data.expectedDate ? `<p style="margin:2px 0 0;font-size:10px;color:#6b7280;">Est. Terima: ${formatDate(data.expectedDate)}</p>` : ""}
            <p style="margin:4px 0 0;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;background:${data.status === "RECEIVED" ? "#d1fae5;color:#065f46" : data.status === "CANCELLED" ? "#fee2e2;color:#991b1b" : "#dbeafe;color:#1e40af"};">${STATUS_LABELS[data.status] || data.status}</span></p>
          </div>
        </div>
        <div style="display:flex;gap:20px;margin-bottom:15px;">
          <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:10px;">
            <p style="margin:0 0 4px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;">Supplier</p>
            <p style="margin:0;font-weight:700;font-size:12px;">${data.supplier.name}</p>
            ${data.supplier.contact ? `<p style="margin:2px 0 0;font-size:10px;color:#6b7280;">Tel: ${data.supplier.contact}</p>` : ""}
            ${data.supplier.address ? `<p style="margin:2px 0 0;font-size:10px;color:#6b7280;">${data.supplier.address}</p>` : ""}
          </div>
          <div style="flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:10px;">
            <p style="margin:0 0 4px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;">Dikirim ke</p>
            <p style="margin:0;font-weight:700;font-size:12px;">${data.branch?.name || "Semua Cabang"}</p>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px;">
          <thead><tr style="background:#f3f4f6;">${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;margin-bottom:15px;">
          <div style="border:2px solid #1f2937;border-radius:6px;padding:8px 16px;">
            ${(config.totals || []).map((t) => `
              <div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:2px;">
                <span style="font-size:11px;font-weight:600;">${t.label}</span>
                <span style="font-size:14px;font-weight:800;font-family:monospace;">${t.value}</span>
              </div>
            `).join("")}
          </div>
        </div>
        ${data.notes ? `<div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;margin-bottom:15px;font-size:10px;"><strong>Catatan:</strong> ${data.notes}</div>` : ""}
        <div style="display:flex;justify-content:space-between;margin-top:30px;">
          ${(config.signatures || []).map((label) => `
            <div style="text-align:center;width:150px;">
              <p style="margin:0 0 50px;font-size:10px;font-weight:600;">${label}</p>
              <div style="border-top:1px solid #1f2937;padding-top:4px;font-size:10px;">( ________________ )</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  const html = `<!DOCTYPE html><html><head><title>PO ${data.orderNumber}</title>
  <style>
    * { box-sizing:border-box; } body { margin:0; padding:0; }
    table { page-break-inside:auto; } tr { page-break-inside:avoid; page-break-after:auto; }
    thead { display:table-header-group; } tfoot { display:table-footer-group; }
    @media print { body { margin:0; padding:0; } @page { size:A4; margin:10mm; } }
  </style></head><body>${pagesHTML}</body></html>`;

  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

// ─── Export wrappers using reusable functions ───

export function exportPOtoPDF(data: POPrintData) {
  exportToPDF(buildPOConfig(data), `${data.orderNumber}.pdf`);
}

export function exportPOtoCSV(data: POPrintData) {
  exportToCSV(buildPOConfig(data), `${data.orderNumber}.csv`);
}

export function exportPOtoExcel(data: POPrintData) {
  exportToExcel(buildPOConfig(data), `${data.orderNumber}.xlsx`);
}
