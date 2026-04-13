"use client";

import { useState, useRef, useCallback, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import {
  Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, XCircle,
  AlertTriangle, FileUp, Trash2, Table2, ArrowRight, RotateCcw,
  FileCheck, FilePlus2, ChevronDown, ChevronUp, FileText, File as FileIcon,
  Maximize2, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Client-side CSV parser ───

function parseCSVClient(text: string): string[][] {
  // Detect delimiter from first line
  let firstLine = "";
  let inQ = false;
  for (const ch of text) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (!inQ && (ch === "\n" || ch === "\r")) break;
    if (!inQ) firstLine += ch;
  }
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  const delimiter = tabs > commas && tabs > semis ? "\t" : semis > commas ? ";" : ",";

  const rows: string[][] = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    const row: string[] = [];
    while (i < len) {
      if (text[i] === '"') {
        i++;
        const parts: string[] = [];
        let start = i;
        while (i < len) {
          if (text[i] === '"') {
            parts.push(text.substring(start, i));
            i++;
            if (i < len && text[i] === '"') { parts.push('"'); i++; start = i; }
            else break;
          } else { i++; }
        }
        row.push(parts.join("").trim());
        if (i < len && text[i] === delimiter) { i++; continue; }
        if (i < len && (text[i] === "\n" || text[i] === "\r")) {
          if (text[i] === "\r" && i + 1 < len && text[i + 1] === "\n") i++;
          i++; break;
        }
      } else {
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

// ─── Types ───

export interface ImportResult {
  row: number;
  success: boolean;
  name: string;
  error?: string;
}

export interface ImportPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export type TemplateFormat = "csv" | "excel" | "docx";

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  icon?: ReactNode;
  accentGradient?: string;
  /** Execute import on server with parsed rows */
  onImport: (rows: string[][]) => Promise<{
    results: ImportResult[];
    successCount: number;
    failedCount: number;
  }>;
  /** Rows per batch sent to server (default: 5000) */
  batchSize?: number;
  /** Download template in given format */
  onDownloadTemplate?: (format: TemplateFormat) => Promise<{ data: string; filename: string; mimeType: string }>;
  onImported: () => void;
  /** Guide notes shown in upload step */
  guideNotes?: string[];
  /** Accepted file extensions (default: .csv,.xlsx,.xls,.docx) */
  accept?: string;
}

// ─── Stepper ───

type Step = "upload" | "preview" | "result";

const STEPS = [
  { key: "upload" as const, label: "Upload", icon: Upload },
  { key: "preview" as const, label: "Preview", icon: Table2 },
  { key: "result" as const, label: "Hasil", icon: FileCheck },
];

const FORMAT_OPTIONS: { value: TemplateFormat; label: string; icon: typeof FileSpreadsheet; color: string }[] = [
  { value: "excel", label: "Excel (.xlsx)", icon: FileSpreadsheet, color: "text-emerald-600" },
  { value: "csv", label: "CSV (.csv)", icon: FileText, color: "text-blue-600" },
  { value: "docx", label: "Word (.docx)", icon: FileIcon, color: "text-blue-800" },
];

// ─── Component ───

export function ImportDialog({
  open,
  onOpenChange,
  title = "Import Data",
  icon,
  accentGradient = "from-blue-500 via-indigo-500 to-violet-500",
  onImport,
  batchSize = 5000,
  onDownloadTemplate,
  onImported,
  guideNotes = [
    "Baris pertama harus header kolom",
    "Pastikan format data sesuai template",
  ],
  accept = ".csv,.xlsx,.xls,.docx",
}: ImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number; successSoFar: number; failedSoFar: number } | null>(null);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [summary, setSummary] = useState<{ successCount: number; failedCount: number } | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [dragActive, setDragActive] = useState(false);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [allRows, setAllRows] = useState<string[][] | null>(null);
  const [allRowsLoading, setAllRowsLoading] = useState(false);
  const [fsSearch, setFsSearch] = useState("");
  const [fsPage, setFsPage] = useState(1);
  const fsPageSize = 25;

  // Parsed data stored on client — never sent as raw file to server
  const [, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResults(null);
    setSummary(null);
    setStep("upload");
    setDragActive(false);
    setShowAllErrors(false);
    setParsing(false);
    setImporting(false);
    setProgress(null);
    setParsedHeaders([]);
    setParsedRows([]);
    setFullscreenOpen(false);
    setAllRows(null);
    setAllRowsLoading(false);
    setFsSearch("");
    setFsPage(1);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleOpenFullscreen = useCallback(() => {
    setFullscreenOpen(true);
    setAllRows(parsedRows);
  }, [parsedRows]);

  const fsFilteredRows = useMemo(() => {
    if (!allRows) return [];
    if (!fsSearch) return allRows;
    const q = fsSearch.toLowerCase();
    return allRows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
  }, [allRows, fsSearch]);

  const fsTotalPages = Math.ceil(fsFilteredRows.length / fsPageSize);
  const fsPagedRows = fsFilteredRows.slice((fsPage - 1) * fsPageSize, fsPage * fsPageSize);

  const processFile = useCallback(async (f: File) => {
    setFile(f);
    setResults(null);
    setSummary(null);
    setParsing(true);

    try {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      let allParsedRows: string[][];

      if (ext === "csv" || ext === "txt") {
        // Parse CSV on client
        let text = await f.text();
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        allParsedRows = parseCSVClient(text);
      } else if (ext === "xlsx" || ext === "xls") {
        // Parse Excel on client using SheetJS
        const XLSX = await import("xlsx");
        const buffer = await f.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]!];
        if (!sheet) throw new Error("Sheet kosong");
        const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
        allParsedRows = json.filter((r) => r.some((c) => String(c).trim() !== "")).map((r) => r.map((c) => String(c).trim()));
      } else if (ext === "docx") {
        toast.error("Format .docx belum didukung untuk file besar. Gunakan CSV atau Excel.");
        setFile(null);
        setParsing(false);
        return;
      } else {
        toast.error("Format file tidak didukung.");
        setFile(null);
        setParsing(false);
        return;
      }

      if (allParsedRows.length < 2) {
        toast.error("File kosong atau hanya berisi header.");
        setFile(null);
        setParsing(false);
        return;
      }

      const headers = allParsedRows[0]!;
      const dataRows = allParsedRows.slice(1);

      setParsedHeaders(headers);
      setParsedRows(dataRows);
      setPreview({ headers, rows: dataRows.slice(0, 20), totalRows: dataRows.length });
      setStep("preview");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      console.error("[ImportDialog] Parse error:", err);
      toast.error(`Gagal membaca file: ${message}`);
      setFile(null);
    } finally {
      setParsing(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleDownloadTemplate = async (format: TemplateFormat) => {
    if (!onDownloadTemplate) return;
    setDownloadingTemplate(true);
    try {
      const { data, filename, mimeType } = await onDownloadTemplate(format);
      const byteString = atob(data);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Template berhasil diunduh");
    } catch {
      toast.error("Gagal mengunduh template");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImport = async () => {
    if (!file || parsedRows.length === 0) return;
    setImporting(true);

    const total = parsedRows.length;
    let allResults: ImportResult[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    setProgress({ processed: 0, total, successSoFar: 0, failedSoFar: 0 });

    try {
      const totalBatches = Math.ceil(total / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const batch = parsedRows.slice(start, start + batchSize);
        const result = await onImport(batch);

        allResults = allResults.concat(result.results);
        totalSuccess += result.successCount;
        totalFailed += result.failedCount;

        setProgress({
          processed: Math.min(start + batch.length, total),
          total,
          successSoFar: totalSuccess,
          failedSoFar: totalFailed,
        });
      }

      setResults(allResults);
      setSummary({ successCount: totalSuccess, failedCount: totalFailed });
      setStep("result");

      if (totalFailed === 0) {
        toast.success(`${totalSuccess} data berhasil diimport`);
        onImported();
      } else if (totalSuccess > 0) {
        toast.warning(`${totalSuccess} berhasil, ${totalFailed} gagal`);
        onImported();
      } else {
        toast.error(`Semua ${totalFailed} baris gagal diimport`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("timeout") || message.includes("TIMEOUT")) {
        toast.error("Proses import timeout. Coba kurangi jumlah data per file.");
      } else {
        toast.error("Gagal memproses file. Silakan coba lagi.");
      }
    }
    setImporting(false);
  };

  const fileExt = file?.name.split(".").pop()?.toUpperCase() || "";
  const failedResults = results?.filter((r) => !r.success) || [];
  const displayedErrors = showAllErrors ? failedResults : failedResults.slice(0, 5);

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (importing) return; if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="rounded-xl sm:rounded-2xl max-w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[100vh] flex flex-col overflow-hidden p-0 gap-0">
        <div className={cn("h-1 w-full bg-gradient-to-r rounded-t-2xl", accentGradient)} />
        <DialogHeader className="px-4 sm:px-6 pt-3 sm:pt-5">
          <DialogTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-lg font-bold">
            {icon || (
              <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200/50">
                <FileUp className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" />
              </div>
            )}
            {title}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="px-4 sm:px-6">
          <div className="space-y-4 sm:space-y-5">
            {/* Stepper */}
            <div className="flex items-center justify-center gap-2">
              {STEPS.map((s, idx) => {
                const Icon = s.icon;
                const isActive = step === s.key;
                const isPast = (step === "preview" && idx === 0) || (step === "result" && idx <= 1);
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    {idx > 0 && <div className={cn("w-6 sm:w-8 h-px transition-colors", isPast ? "bg-primary" : "bg-border")} />}
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <div className={cn(
                        "flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg transition-all",
                        isActive ? "bg-primary text-white shadow-sm shadow-primary/30"
                          : isPast ? "bg-primary/10 text-primary"
                            : "bg-muted/50 text-muted-foreground/50"
                      )}>
                        {isPast ? <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                      </div>
                      <span className={cn(
                        "text-[10px] sm:text-xs font-medium transition-colors",
                        isActive ? "text-foreground" : isPast ? "text-primary" : "text-muted-foreground/50"
                      )}>{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Step: Upload */}
            {step === "upload" && (
              <div className="space-y-3 sm:space-y-4">
                {onDownloadTemplate && (
                  <div className="rounded-lg sm:rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 p-3 sm:p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-100 text-blue-600 shrink-0">
                        <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-blue-900">Template Import</p>
                        <p className="text-[10px] sm:text-xs text-blue-600/70">Download template untuk format yang benar</p>
                      </div>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800 shrink-0 text-[11px] sm:text-xs h-8"
                          disabled={downloadingTemplate}
                        >
                          {downloadingTemplate ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" />}
                          Download
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-44 p-1 rounded-xl">
                        {FORMAT_OPTIONS.map((fmt) => {
                          const FmtIcon = fmt.icon;
                          return (
                            <button
                              key={fmt.value}
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-accent transition-colors"
                              onClick={() => handleDownloadTemplate(fmt.value)}
                            >
                              <FmtIcon className={cn("w-3.5 h-3.5", fmt.color)} />
                              {fmt.label}
                            </button>
                          );
                        })}
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div
                  className={cn(
                    "relative rounded-xl sm:rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer transition-all duration-200",
                    parsing && "pointer-events-none opacity-60",
                    dragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/40 hover:border-primary/40 hover:bg-muted/20"
                  )}
                  onClick={() => !parsing && fileRef.current?.click()}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input ref={fileRef} type="file" accept={accept} onChange={handleFileChange} className="hidden" />
                  <div className="flex flex-col items-center gap-2 sm:gap-3">
                    <div className={cn(
                      "flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl transition-all",
                      parsing ? "bg-primary/10 text-primary" : dragActive ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground/40"
                    )}>
                      {parsing ? <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" /> : <Upload className="w-6 h-6 sm:w-7 sm:h-7" />}
                    </div>
                    <div className="space-y-0.5 sm:space-y-1">
                      <p className="text-xs sm:text-sm font-semibold text-foreground">
                        {parsing ? "Membaca file..." : dragActive ? "Lepas file di sini" : "Drag & drop file"}
                      </p>
                      {!parsing && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          atau <span className="text-primary font-medium underline underline-offset-2">pilih file</span> dari komputer
                        </p>
                      )}
                    </div>
                    {!parsing && (
                      <div className="flex items-center gap-3 sm:gap-4 mt-1">
                        <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground/60">
                          <FileSpreadsheet className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> .xlsx
                        </span>
                        <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground/60">
                          <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> .csv
                        </span>
                        <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground/60">
                          <FileIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> .docx
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {guideNotes.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2">
                    <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-[10px] sm:text-[11px] text-amber-700 space-y-0.5">
                      <p className="font-medium">Panduan Import:</p>
                      <ul className="list-disc list-inside text-amber-600/80 space-y-0.5">
                        {guideNotes.map((note, i) => <li key={i}>{note}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step: Preview */}
            {step === "preview" && preview && (
              <div className="space-y-3 sm:space-y-4">
                <div className="rounded-lg sm:rounded-xl border border-border/40 bg-muted/20 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 shadow-sm shadow-green-200/50">
                      <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-[200px] sm:max-w-[280px]">{file?.name}</p>
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-1.5 py-0 h-4 rounded-md font-mono">{preview.totalRows} baris</Badge>
                        <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-1.5 py-0 h-4 rounded-md font-mono">{preview.headers.length} kolom</Badge>
                        <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-1.5 py-0 h-4 rounded-md font-mono">{fileExt}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); reset(); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 sm:gap-1.5">
                      <Table2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Preview
                    </p>
                    <div className="flex items-center gap-2">
                      {preview.totalRows > preview.rows.length && (
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground/60 font-mono">{preview.rows.length} / {preview.totalRows}</span>
                      )}
                      {parsedRows.length > 0 && (
                        <button
                          type="button"
                          className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          onClick={handleOpenFullscreen}
                          title="Lihat semua data"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg sm:rounded-xl border border-border/30 overflow-hidden shadow-sm max-h-[280px] sm:max-h-[320px] overflow-y-auto">
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] sm:text-xs">
                        <thead>
                          <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 sticky top-0 z-10">
                            <th className="px-2 sm:px-2.5 py-1.5 sm:py-2 text-center font-semibold text-muted-foreground/60 w-6 sm:w-8 bg-slate-50">#</th>
                            {preview.headers.map((h, i) => (
                              <th key={i} className="px-2 sm:px-2.5 py-1.5 sm:py-2 text-left font-semibold text-muted-foreground whitespace-nowrap bg-slate-50">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((row, ri) => (
                            <tr key={ri} className="border-t border-border/10 hover:bg-muted/20 transition-colors">
                              <td className="px-2 sm:px-2.5 py-1.5 sm:py-2 text-center font-mono text-muted-foreground/40 text-[9px] sm:text-[10px]">{ri + 1}</td>
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-2 sm:px-2.5 py-1.5 sm:py-2 whitespace-nowrap text-foreground/80">{cell || <span className="text-muted-foreground/30">—</span>}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {importing && progress && (
                  <div className="space-y-2 rounded-lg sm:rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px]">
                      <span className="text-foreground font-medium">Mengimport data...</span>
                      <span className="font-mono tabular-nums text-foreground font-semibold">
                        {progress.processed.toLocaleString()} / {progress.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2.5 sm:h-3 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
                        style={{ width: `${progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3 h-3 inline mr-0.5" />{progress.successSoFar.toLocaleString()} berhasil
                        </span>
                        {progress.failedSoFar > 0 && (
                          <span className="text-red-500 font-medium">
                            <XCircle className="w-3 h-3 inline mr-0.5" />{progress.failedSoFar.toLocaleString()} gagal
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground font-mono">
                        {Math.round((progress.processed / Math.max(progress.total, 1)) * 100)}%
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/60">
                      Mohon jangan tutup atau refresh halaman ini
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step: Result */}
            {step === "result" && results && summary && (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="rounded-lg sm:rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-green-50/50 p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 shadow-md shadow-emerald-200/50">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-lg sm:text-2xl font-bold text-emerald-700 font-mono tabular-nums">{summary.successCount}</p>
                      <p className="text-[10px] sm:text-[11px] text-emerald-600/70 font-medium">Berhasil</p>
                    </div>
                  </div>
                  <div className={cn(
                    "rounded-lg sm:rounded-xl border p-3 sm:p-4 flex items-center gap-2 sm:gap-3",
                    summary.failedCount > 0 ? "border-red-200/60 bg-gradient-to-br from-red-50 to-rose-50/50" : "border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-50/50"
                  )}>
                    <div className={cn(
                      "flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl shadow-md",
                      summary.failedCount > 0 ? "bg-gradient-to-br from-red-400 to-rose-500 shadow-red-200/50" : "bg-gradient-to-br from-slate-300 to-slate-400 shadow-slate-200/50"
                    )}>
                      <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                      <p className={cn("text-lg sm:text-2xl font-bold font-mono tabular-nums", summary.failedCount > 0 ? "text-red-700" : "text-slate-400")}>{summary.failedCount}</p>
                      <p className={cn("text-[10px] sm:text-[11px] font-medium", summary.failedCount > 0 ? "text-red-600/70" : "text-slate-400")}>Gagal</p>
                    </div>
                  </div>
                </div>

                {summary.failedCount === 0 && (
                  <div className="rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-100">
                      <FilePlus2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                    </div>
                    <p className="text-xs sm:text-sm text-emerald-700 font-medium">Semua data berhasil diimport!</p>
                  </div>
                )}

                {failedResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] sm:text-xs font-semibold text-red-600 flex items-center gap-1 sm:gap-1.5">
                      <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Detail Error ({failedResults.length})
                    </p>
                    <div className="rounded-lg sm:rounded-xl border border-red-100 overflow-hidden">
                      <div className="max-h-[180px] sm:max-h-[220px] overflow-y-auto divide-y divide-red-50">
                        {displayedErrors.map((r) => (
                          <div key={r.row} className="flex items-start gap-2 px-3 py-2 hover:bg-red-50/30 transition-colors">
                            <Badge className="rounded-md text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 bg-red-100 text-red-600 border-0 shrink-0 mt-0.5 font-mono">#{r.row}</Badge>
                            <div className="min-w-0">
                              <p className="text-[11px] sm:text-xs font-medium text-red-800 truncate">{r.name || "—"}</p>
                              <p className="text-[10px] sm:text-[11px] text-red-500/80 mt-0.5">{r.error}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {failedResults.length > 5 && (
                        <button
                          type="button"
                          className="w-full flex items-center justify-center gap-1 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-medium text-red-500 hover:bg-red-50/50 border-t border-red-50 transition-colors"
                          onClick={() => setShowAllErrors(!showAllErrors)}
                        >
                          {showAllErrors ? <><ChevronUp className="w-3 h-3" /> Tampilkan lebih sedikit</> : <><ChevronDown className="w-3 h-3" /> Lihat semua {failedResults.length} error</>}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="px-4 sm:px-6 pb-3 sm:pb-5">
          <div className="flex items-center justify-between w-full">
            <div>
              {step === "preview" && (
                <Button variant="ghost" size="sm" className="rounded-lg text-[11px] sm:text-xs text-muted-foreground h-8" onClick={reset}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Ganti File
                </Button>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button variant="outline" className="rounded-lg sm:rounded-xl text-[11px] sm:text-sm h-8 sm:h-10" onClick={() => { reset(); onOpenChange(false); }}>
                {step === "result" ? "Tutup" : "Batal"}
              </Button>
              {step === "preview" && (
                <Button className="rounded-lg sm:rounded-xl shadow-md shadow-primary/20 text-[11px] sm:text-sm h-8 sm:h-10" onClick={handleImport} disabled={!file || importing}>
                  {importing ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Mengimport...</> : <><ArrowRight className="w-3.5 h-3.5 mr-1" /> Import {preview?.totalRows || 0} Data</>}
                </Button>
              )}
              {step === "result" && summary && summary.failedCount > 0 && (
                <Button className="rounded-lg sm:rounded-xl shadow-md shadow-primary/20 text-[11px] sm:text-sm h-8 sm:h-10" onClick={reset}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Import Ulang
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Fullscreen Preview Dialog */}
    <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
      <DialogContent className="rounded-xl sm:rounded-2xl max-w-[calc(100vw-1rem)] sm:max-w-5xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-border/30 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Table2 className="w-4 h-4 text-muted-foreground" />
              Preview Data
              <Badge variant="secondary" className="text-[10px] sm:text-xs font-mono ml-1">{fsFilteredRows.length} baris</Badge>
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={fsSearch}
                onChange={(e) => { setFsSearch(e.target.value); setFsPage(1); }}
                placeholder="Cari data..."
                className="pl-9 h-8 sm:h-9 rounded-lg text-xs sm:text-sm"
              />
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-auto p-0">
          {allRowsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Memuat data...</span>
            </div>
          ) : (
            <table className="w-full text-[10px] sm:text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-border/30">
                  <th className="px-2.5 sm:px-3 py-2 text-center font-semibold text-muted-foreground/60 w-10 bg-slate-50">#</th>
                  {preview?.headers.map((h, i) => (
                    <th key={i} className="px-2.5 sm:px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap bg-slate-50">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fsPagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={(preview?.headers.length ?? 0) + 1} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      {fsSearch ? "Tidak ada data yang cocok" : "Tidak ada data"}
                    </td>
                  </tr>
                ) : (
                  fsPagedRows.map((row, ri) => {
                    const actualIndex = (fsPage - 1) * fsPageSize + ri + 1;
                    return (
                      <tr key={ri} className="border-b border-border/10 hover:bg-muted/20 transition-colors">
                        <td className="px-2.5 sm:px-3 py-2 text-center font-mono text-muted-foreground/40 text-[9px] sm:text-[10px]">{actualIndex}</td>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-2.5 sm:px-3 py-2 whitespace-nowrap text-foreground/80">{cell || <span className="text-muted-foreground/30">—</span>}</td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </DialogBody>

        {fsTotalPages > 1 && (
          <div className="shrink-0 border-t border-border/30 px-4 sm:px-6 py-2.5 flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              {(fsPage - 1) * fsPageSize + 1}–{Math.min(fsPage * fsPageSize, fsFilteredRows.length)} dari {fsFilteredRows.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={fsPage <= 1} onClick={() => setFsPage(fsPage - 1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs font-mono tabular-nums px-2">{fsPage} / {fsTotalPages}</span>
              <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={fsPage >= fsTotalPages} onClick={() => setFsPage(fsPage + 1)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
