import ExcelJS from "exceljs";
import mammoth from "mammoth";
import {
  Document,
  Packer,
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  WidthType,
  BorderStyle,
  AlignmentType,
} from "docx";

// ─── CSV Parser ───

function detectDelimiter(text: string): string {
  let firstLine = "";
  let inQ = false;
  for (const ch of text) {
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && (ch === "\n" || ch === "\r")) break;
    if (!inQ) firstLine += ch;
  }
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  if (tabCount > commaCount && tabCount > semicolonCount) return "\t";
  if (semicolonCount > commaCount) return ";";
  return ",";
}

function parseCSVText(text: string, maxRows?: number): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    if (maxRows && rows.length >= maxRows) break;
    const row: string[] = [];

    // Parse one row
    while (i < len) {
      if (text[i] === '"') {
        // Quoted field — find closing quote
        i++; // skip opening quote
        const parts: string[] = [];
        let start = i;
        while (i < len) {
          if (text[i] === '"') {
            parts.push(text.substring(start, i));
            i++;
            if (i < len && text[i] === '"') {
              parts.push('"');
              i++;
              start = i;
            } else {
              break;
            }
          } else {
            i++;
          }
        }
        if (start < i) parts.push(text.substring(start, i));
        row.push(parts.join("").trim());
        // Skip delimiter or newline after closing quote
        if (i < len && text[i] === delimiter) { i++; continue; }
        if (i < len && (text[i] === "\n" || text[i] === "\r")) {
          if (text[i] === "\r" && i + 1 < len && text[i + 1] === "\n") i++;
          i++;
          break;
        }
      } else {
        // Unquoted field — scan until delimiter or newline
        const start = i;
        while (i < len && text[i] !== delimiter && text[i] !== "\n" && text[i] !== "\r") i++;
        row.push(text.substring(start, i).trim());
        if (i < len && text[i] === delimiter) { i++; continue; }
        if (i < len && text[i] === "\r" && i + 1 < len && text[i + 1] === "\n") i++;
        if (i < len) i++;
        break;
      }
    }

    if (row.length > 0 && row.some((c) => c !== "")) rows.push(row);
  }

  return rows;
}

// ─── Excel Parser ───

async function parseExcelBuffer(buffer: ArrayBuffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(String(cell.value ?? "").trim());
    });
    if (cells.some((c) => c !== "")) rows.push(cells);
  });
  return rows;
}

// ─── DOCX Parser ───

async function parseDocxBuffer(buffer: ArrayBuffer): Promise<string[][]> {
  const result = await mammoth.convertToHtml({ buffer: buffer as any });
  const html = result.value;

  // Extract table rows from HTML
  const rows: string[][] = [];
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);

  if (tableMatch) {
    // Parse HTML table
    const trMatches = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trMatches) {
      const cells: string[] = [];
      const tdMatches = tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      for (const td of tdMatches) {
        const text = td.replace(/<[^>]+>/g, "").trim();
        cells.push(text);
      }
      if (cells.some((c) => c !== "")) rows.push(cells);
    }
  } else {
    // No table found — try to parse line-by-line from paragraphs
    const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    for (const p of paragraphs) {
      const text = p.replace(/<[^>]+>/g, "").trim();
      if (!text) continue;
      // Split by tab or multiple spaces
      const cells = text.split(/\t|;\s*/).map((c) => c.trim());
      if (cells.some((c) => c !== "")) rows.push(cells);
    }
  }

  return rows;
}

// ─── FormData file content extractor ───

interface FileInput {
  ext: string;
  text: string | null;
  buffer: ArrayBuffer | null;
}

export function extractFileFromFormData(formData: FormData): FileInput {
  const fileName = formData.get("fileName") as string;
  const ext = (formData.get("fileExt") as string) || fileName?.split(".").pop()?.toLowerCase() || "";
  const content = formData.get("fileContent") as string;
  const encoding = formData.get("fileEncoding") as string | null;

  if (encoding === "base64") {
    // Binary file (xlsx, docx) — decode base64
    const binaryStr = Buffer.from(content, "base64");
    return { ext, text: null, buffer: binaryStr.buffer.slice(binaryStr.byteOffset, binaryStr.byteOffset + binaryStr.byteLength) };
  }

  // Text file (csv)
  let text = content;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return { ext, text, buffer: null };
}

// ─── Unified Parser ───

export interface ParsedFile {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

function countCSVLines(text: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes && (ch === "\n" || (ch === "\r" && text[i + 1] !== "\n"))) count++;
    if (!inQuotes && ch === "\r" && text[i + 1] === "\n") { count++; i++; }
  }
  return count; // approximate line count (includes header)
}

export async function parseImportFile(
  file: File,
  previewLimit = 20,
): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv" || ext === "txt") {
    let text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    if (previewLimit < 999999) {
      // Preview mode: parse only header + N rows, count total lines cheaply
      const partialRows = parseCSVText(text, previewLimit + 2); // +2 for header + buffer
      const totalLines = countCSVLines(text);
      if (partialRows.length === 0) return { headers: [], rows: [], totalRows: 0 };
      const headers = partialRows[0]!;
      const dataRows = partialRows.slice(1);
      return { headers, rows: dataRows.slice(0, previewLimit), totalRows: Math.max(totalLines - 1, 0) };
    }

    // Full parse
    const allRows = parseCSVText(text);
    if (allRows.length === 0) return { headers: [], rows: [], totalRows: 0 };
    const headers = allRows[0]!;
    const dataRows = allRows.slice(1).filter((r) => r.some((c) => c !== ""));
    return { headers, rows: dataRows, totalRows: dataRows.length };
  }

  // Excel / DOCX: parse all (no efficient line-count alternative)
  let allRows: string[][];
  if (ext === "xlsx" || ext === "xls") {
    const arrayBuffer = await file.arrayBuffer();
    allRows = await parseExcelBuffer(arrayBuffer);
  } else if (ext === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    allRows = await parseDocxBuffer(arrayBuffer);
  } else {
    let text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    allRows = parseCSVText(text);
  }

  if (allRows.length === 0) return { headers: [], rows: [], totalRows: 0 };
  const headers = allRows[0]!;
  const dataRows = allRows.slice(1).filter((r) => r.some((c) => c !== ""));
  return { headers, rows: dataRows.slice(0, previewLimit), totalRows: dataRows.length };
}

export async function parseImportFileAllRows(
  file: File,
): Promise<{ headers: string[]; rows: string[][] }> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  let allRows: string[][];

  if (ext === "xlsx" || ext === "xls") {
    const arrayBuffer = await file.arrayBuffer();
    allRows = await parseExcelBuffer(arrayBuffer);
  } else if (ext === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    allRows = await parseDocxBuffer(arrayBuffer);
  } else {
    let text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    allRows = parseCSVText(text);
  }

  if (allRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = allRows[0]!;
  const dataRows = allRows.slice(1).filter((r) => r.some((c) => c !== ""));
  return { headers, rows: dataRows };
}

// ─── FormData-based parsers (for server actions) ───

async function parseRowsFromInput(input: FileInput): Promise<string[][]> {
  if (input.text !== null) {
    return parseCSVText(input.text);
  }
  if (input.buffer) {
    if (input.ext === "xlsx" || input.ext === "xls") {
      return parseExcelBuffer(input.buffer);
    }
    if (input.ext === "docx") {
      return parseDocxBuffer(input.buffer);
    }
  }
  return [];
}

export async function parseFormDataPreview(formData: FormData, previewLimit = 20): Promise<ParsedFile> {
  const input = extractFileFromFormData(formData);

  // CSV preview optimization: parse only needed rows + count lines
  if ((input.ext === "csv" || input.ext === "txt") && input.text !== null && previewLimit < 999999) {
    const partialRows = parseCSVText(input.text, previewLimit + 2);
    const totalLines = countCSVLines(input.text);
    if (partialRows.length === 0) return { headers: [], rows: [], totalRows: 0 };
    const headers = partialRows[0]!;
    const dataRows = partialRows.slice(1);
    return { headers, rows: dataRows.slice(0, previewLimit), totalRows: Math.max(totalLines - 1, 0) };
  }

  const allRows = await parseRowsFromInput(input);
  if (allRows.length === 0) return { headers: [], rows: [], totalRows: 0 };
  const headers = allRows[0]!;
  const dataRows = allRows.slice(1).filter((r) => r.some((c) => c !== ""));
  return { headers, rows: dataRows.slice(0, previewLimit), totalRows: dataRows.length };
}

export async function parseFormDataAllRows(formData: FormData): Promise<{ headers: string[]; rows: string[][] }> {
  const input = extractFileFromFormData(formData);
  const allRows = await parseRowsFromInput(input);
  if (allRows.length === 0) return { headers: [], rows: [] };
  const headers = allRows[0]!;
  const dataRows = allRows.slice(1).filter((r) => r.some((c) => c !== ""));
  return { headers, rows: dataRows };
}

// ─── Template Generator ───

export interface TemplateColumn {
  header: string;
  width?: number;
  sampleValues?: string[];
}

export async function generateImportTemplate(
  columns: TemplateColumn[],
  sampleRowCount = 2,
  notes?: string[],
  format: "csv" | "excel" | "docx" = "excel",
): Promise<{ data: string; filename: string; mimeType: string }> {
  const headers = columns.map((c) => c.header);
  const sampleRows: string[][] = [];
  for (let i = 0; i < sampleRowCount; i++) {
    sampleRows.push(columns.map((c) => c.sampleValues?.[i] ?? ""));
  }

  if (format === "csv") {
    const allRows = [headers, ...sampleRows];
    if (notes) allRows.push([], ...notes.map((n) => ["", "", n]));
    const BOM = "\uFEFF";
    const csvContent =
      BOM +
      allRows
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
        )
        .join("\n");
    const base64 = Buffer.from(csvContent, "utf-8").toString("base64");
    return {
      data: base64,
      filename: "template.csv",
      mimeType: "text/csv;charset=utf-8",
    };
  }

  if (format === "excel") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");

    // Header row
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Sample rows
    for (const sr of sampleRows) {
      const row = sheet.addRow(sr);
      row.eachCell((cell) => {
        cell.font = { color: { argb: "FF9CA3AF" }, italic: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    }

    // Column widths
    columns.forEach((col, i) => {
      sheet.getColumn(i + 1).width =
        col.width ?? Math.max(col.header.length + 4, 15);
    });

    // Notes
    if (notes && notes.length > 0) {
      sheet.addRow([]);
      for (const note of notes) {
        const r = sheet.addRow([note]);
        r.getCell(1).font = {
          italic: true,
          color: { argb: "FF6B7280" },
          size: 10,
        };
      }
    }

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return {
      data: base64,
      filename: "template.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  // DOCX
  const borderStyle = { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" };
  const cellBorders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

  const headerCells = headers.map((h) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: "FFFFFF", font: "Arial" })], alignment: AlignmentType.CENTER })],
    shading: { fill: "4F46E5" },
    borders: cellBorders,
    width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
  }));

  const dataTableRows = sampleRows.map((sr) => new TableRow({
    children: sr.map((cell) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: cell, size: 18, color: "9CA3AF", italics: true, font: "Arial" })] })],
      borders: cellBorders,
    })),
  }));

  const docChildren: (Table | Paragraph)[] = [
    new Paragraph({ children: [new TextRun({ text: "Template Import", bold: true, size: 28, font: "Arial" })], spacing: { after: 100 } }),
    new Paragraph({ children: [new TextRun({ text: "Gunakan template ini sebagai panduan format import data", size: 18, color: "6B7280", font: "Arial" })], spacing: { after: 200 } }),
    new Table({ rows: [new TableRow({ children: headerCells }), ...dataTableRows], width: { size: 9000, type: WidthType.DXA } }),
  ];

  if (notes && notes.length > 0) {
    docChildren.push(new Paragraph({ spacing: { before: 200 } }));
    for (const note of notes) {
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: `• ${note}`, size: 16, color: "6B7280", italics: true, font: "Arial" })],
        spacing: { after: 40 },
      }));
    }
  }

  const doc = new Document({ sections: [{ children: docChildren }] });
  const buffer = await Packer.toBuffer(doc);
  const base64 = Buffer.from(buffer).toString("base64");
  return {
    data: base64,
    filename: "template.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}
