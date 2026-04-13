import ExcelJS from "exceljs";

export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
}

export type ExportFormat = "xlsx" | "csv" | "pdf";

export interface CompanyInfo {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
}

// ─── CSV ─────────────────────────────

export function generateCSV(
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): string {
  const header = columns.map((c) => `"${c.header}"`).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const val = row[c.key];
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}`;
}

// ─── Excel ─────────────────────────────

export async function generateExcel(
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  title: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "POS System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title);

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 15,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  for (const row of rows) {
    const values: Record<string, unknown> = {};
    for (const col of columns) {
      values[col.key] = row[col.key] ?? "";
    }
    sheet.addRow(values);
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─── PDF (generated client-side via jspdf) ─────────────────────────────
// PDF generation is handled in the client ExportMenu component
// Server only returns data, client generates the PDF file

// ─── Unified generator ─────────────────────────────

export async function generateExportFile(
  format: ExportFormat,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  title: string,
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  switch (format) {
    case "csv":
      return {
        buffer: Buffer.from(generateCSV(columns, rows), "utf-8"),
        contentType: "text/csv",
        extension: "csv",
      };
    case "xlsx":
      return {
        buffer: await generateExcel(columns, rows, title),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
      };
    case "pdf":
      throw new Error("PDF generation is handled client-side");
  }
}
