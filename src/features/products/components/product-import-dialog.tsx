"use client";

import { useState, useRef, useCallback } from "react";
import { importProducts, getImportTemplate } from "@/server/actions/products";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import {
    Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, XCircle,
    AlertTriangle, FileUp, Trash2, Table2, ArrowRight, Info, RotateCcw,
    FileCheck, FilePlus2, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImported: () => void;
}

interface ImportResult {
    row: number;
    success: boolean;
    name: string;
    error?: string;
}

type Step = "upload" | "preview" | "result";

function detectDelimiter(text: string): string {
    let firstLine = "";
    let inQ = false;
    for (const ch of text) {
        if (ch === '"') { inQ = !inQ; continue; }
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

function parseCSV(text: string): string[][] {
    const delimiter = detectDelimiter(text);
    const rows: string[][] = [];
    let current = "";
    let inQuotes = false;
    let row: string[] = [];

    for (let i = 0; i < text.length; i++) {
        const ch = text[i]!;
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === delimiter) {
                row.push(current.trim());
                current = "";
            } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
                row.push(current.trim());
                if (row.some((c) => c !== "")) rows.push(row);
                row = [];
                current = "";
                if (ch === "\r") i++;
            } else {
                current += ch;
            }
        }
    }
    row.push(current.trim());
    if (row.some((c) => c !== "")) rows.push(row);

    return rows;
}

export function ProductImportDialog({ open, onOpenChange, onImported }: Props) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [allRows, setAllRows] = useState<string[][] | null>(null);
    const [preview, setPreview] = useState<string[][] | null>(null);
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState<ImportResult[] | null>(null);
    const [summary, setSummary] = useState<{ successCount: number; failedCount: number } | null>(null);
    const [step, setStep] = useState<Step>("upload");
    const [dragActive, setDragActive] = useState(false);
    const [showAllErrors, setShowAllErrors] = useState(false);

    const reset = () => {
        setFile(null);
        setAllRows(null);
        setPreview(null);
        setResults(null);
        setSummary(null);
        setStep("upload");
        setDragActive(false);
        setShowAllErrors(false);
        if (fileRef.current) fileRef.current.value = "";
    };

    const processFile = useCallback((f: File) => {
        const ext = f.name.split(".").pop()?.toLowerCase();
        if (ext !== "csv") {
            toast.error("Hanya file CSV yang didukung");
            return;
        }

        setFile(f);
        setResults(null);
        setSummary(null);

        const reader = new FileReader();
        reader.onload = (ev) => {
            let text = ev.target?.result as string;
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            const rows = parseCSV(text);
            setAllRows(rows);
            setPreview(rows.slice(0, 6));
            setStep("preview");
        };
        reader.readAsText(f, "UTF-8");
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

    const handleDownloadTemplate = async () => {
        try {
            const template = await getImportTemplate();
            const rows = [template.headerLabels, ...template.sampleRows];
            const categoryNote = ["", "", `Kategori: ${template.categories.join(", ")}`];
            const brandNote = ["", "", `Brand: ${(template.brands ?? []).join(", ")}`];
            const csvContent = [...rows, [], categoryNote, brandNote]
                .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
                .join("\n");
            const BOM = "\uFEFF";
            const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "template-import-produk.csv";
            link.click();
            URL.revokeObjectURL(url);
            toast.success("Template berhasil diunduh");
        } catch {
            toast.error("Gagal mengunduh template");
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setImporting(true);
        try {
            let text = await file.text();
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            const rows = parseCSV(text);

            if (rows.length < 2) {
                toast.error("File kosong atau hanya berisi header");
                setImporting(false);
                return;
            }

            const dataRows = rows.slice(1).filter((row) => row.some((c) => c !== ""));
            const mapped = dataRows.map((row) => ({
                code: row[0] || "",
                name: row[1] || "",
                categoryName: row[2] || "",
                brandName: row[3] || "",
                unit: row[4] || "PCS",
                purchasePrice: Number(row[5]) || 0,
                sellingPrice: Number(row[6]) || 0,
                stock: Number(row[7]) || 0,
                minStock: Number(row[8]) || 0,
                barcode: row[9] || "",
                description: row[10] || "",
            }));

            const result = await importProducts(mapped);
            setResults(result.results);
            setSummary({ successCount: result.successCount, failedCount: result.failedCount });
            setStep("result");

            if (result.failedCount === 0) {
                toast.success(`${result.successCount} produk berhasil diimport`);
                onImported();
            } else if (result.successCount > 0) {
                toast.warning(`${result.successCount} berhasil, ${result.failedCount} gagal`);
                onImported();
            } else {
                toast.error(`Semua ${result.failedCount} baris gagal diimport`);
            }
        } catch {
            toast.error("Gagal memproses file");
        }
        setImporting(false);
    };

    const totalDataRows = allRows ? allRows.length - 1 : 0;
    const failedResults = results?.filter((r) => !r.success) || [];
    const displayedErrors = showAllErrors ? failedResults : failedResults.slice(0, 5);

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
            <DialogContent className="rounded-xl sm:rounded-2xl max-w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
                {/* Gradient accent */}
                <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-t-2xl -mt-6 mb-2" />

                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-lg font-bold">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200/50">
                            <FileUp className="w-4.5 h-4.5 text-white" />
                        </div>
                        Import Produk
                    </DialogTitle>
                </DialogHeader>

                <DialogBody>
                    <div className="space-y-5">
                        {/* Stepper */}
                        <div className="flex items-center justify-center gap-2">
                            {[
                                { key: "upload", label: "Upload", icon: Upload },
                                { key: "preview", label: "Preview", icon: Table2 },
                                { key: "result", label: "Hasil", icon: FileCheck },
                            ].map((s, idx) => {
                                const Icon = s.icon;
                                const isActive = step === s.key;
                                const isPast = (step === "preview" && idx === 0) || (step === "result" && idx <= 1);
                                return (
                                    <div key={s.key} className="flex items-center gap-2">
                                        {idx > 0 && (
                                            <div className={cn(
                                                "w-8 h-px transition-colors",
                                                isPast ? "bg-primary" : "bg-border"
                                            )} />
                                        )}
                                        <div className="flex items-center gap-1.5">
                                            <div className={cn(
                                                "flex items-center justify-center w-7 h-7 rounded-lg transition-all",
                                                isActive
                                                    ? "bg-primary text-white shadow-sm shadow-primary/30"
                                                    : isPast
                                                        ? "bg-primary/10 text-primary"
                                                        : "bg-muted/50 text-muted-foreground/50"
                                            )}>
                                                {isPast ? (
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Icon className="w-3.5 h-3.5" />
                                                )}
                                            </div>
                                            <span className={cn(
                                                "text-xs font-medium transition-colors",
                                                isActive ? "text-foreground" : isPast ? "text-primary" : "text-muted-foreground/50"
                                            )}>
                                                {s.label}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Step: Upload */}
                        {step === "upload" && (
                            <div className="space-y-4">
                                {/* Template download card */}
                                <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 p-4 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 text-blue-600 shrink-0">
                                            <FileSpreadsheet className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-blue-900">Template Import</p>
                                            <p className="text-xs text-blue-600/70">Download template CSV untuk format yang benar</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-lg border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800 shrink-0"
                                        onClick={handleDownloadTemplate}
                                    >
                                        <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                                    </Button>
                                </div>

                                {/* Drag & Drop area */}
                                <div
                                    className={cn(
                                        "relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200",
                                        dragActive
                                            ? "border-primary bg-primary/5 scale-[1.01]"
                                            : "border-border/40 hover:border-primary/40 hover:bg-muted/20"
                                    )}
                                    onClick={() => fileRef.current?.click()}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <div className="flex flex-col items-center gap-3">
                                        <div className={cn(
                                            "flex items-center justify-center w-14 h-14 rounded-2xl transition-all",
                                            dragActive
                                                ? "bg-primary/10 text-primary"
                                                : "bg-muted/50 text-muted-foreground/40"
                                        )}>
                                            <Upload className="w-7 h-7" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-foreground">
                                                {dragActive ? "Lepas file di sini" : "Drag & drop file CSV"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                atau <span className="text-primary font-medium underline underline-offset-2">pilih file</span> dari komputer
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                                <FileSpreadsheet className="w-3 h-3" /> .csv
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                                <Info className="w-3 h-3" /> Comma / Semicolon / Tab
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Info notes */}
                                <div className="flex items-start gap-2 rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                    <div className="text-[11px] text-amber-700 space-y-0.5">
                                        <p className="font-medium">Panduan Import:</p>
                                        <ul className="list-disc list-inside text-amber-600/80 space-y-0.5">
                                            <li>Baris pertama harus header kolom</li>
                                            <li>Kolom wajib: Nama Produk, Kategori</li>
                                            <li>Kode produk otomatis jika dikosongkan</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step: Preview */}
                        {step === "preview" && preview && (
                            <div className="space-y-4">
                                {/* File info card */}
                                <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 shadow-sm shadow-green-200/50">
                                            <FileSpreadsheet className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground truncate max-w-[280px]">{file?.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-md font-mono">
                                                    {totalDataRows} baris data
                                                </Badge>
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-md font-mono">
                                                    {preview[0]?.length || 0} kolom
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                        onClick={(e) => { e.stopPropagation(); reset(); }}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>

                                {/* Preview table */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                            <Table2 className="w-3.5 h-3.5" /> Preview Data
                                        </p>
                                        {totalDataRows > 5 && (
                                            <span className="text-[10px] text-muted-foreground/60 font-mono">
                                                5 / {totalDataRows} baris
                                            </span>
                                        )}
                                    </div>
                                    <div className="rounded-xl border border-border/30 overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50">
                                                        <th className="px-2.5 py-2 text-center font-semibold text-muted-foreground/60 w-8">#</th>
                                                        {preview[0]?.map((h, i) => (
                                                            <th key={i} className="px-2.5 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {preview.slice(1).map((row, ri) => (
                                                        <tr key={ri} className="border-t border-border/10 hover:bg-muted/20 transition-colors">
                                                            <td className="px-2.5 py-2 text-center font-mono text-muted-foreground/40 text-[10px]">{ri + 1}</td>
                                                            {row.map((cell, ci) => (
                                                                <td key={ci} className="px-2.5 py-2 whitespace-nowrap text-foreground/80">{cell || <span className="text-muted-foreground/30">—</span>}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step: Result */}
                        {step === "result" && results && summary && (
                            <div className="space-y-4">
                                {/* Summary cards */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-green-50/50 p-4 flex items-center gap-3">
                                        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 shadow-md shadow-emerald-200/50">
                                            <CheckCircle2 className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">{summary.successCount}</p>
                                            <p className="text-[11px] text-emerald-600/70 font-medium">Berhasil diimport</p>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "rounded-xl border p-4 flex items-center gap-3",
                                        summary.failedCount > 0
                                            ? "border-red-200/60 bg-gradient-to-br from-red-50 to-rose-50/50"
                                            : "border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-50/50"
                                    )}>
                                        <div className={cn(
                                            "flex items-center justify-center w-11 h-11 rounded-xl shadow-md",
                                            summary.failedCount > 0
                                                ? "bg-gradient-to-br from-red-400 to-rose-500 shadow-red-200/50"
                                                : "bg-gradient-to-br from-slate-300 to-slate-400 shadow-slate-200/50"
                                        )}>
                                            <XCircle className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <p className={cn(
                                                "text-2xl font-bold font-mono tabular-nums",
                                                summary.failedCount > 0 ? "text-red-700" : "text-slate-400"
                                            )}>{summary.failedCount}</p>
                                            <p className={cn(
                                                "text-[11px] font-medium",
                                                summary.failedCount > 0 ? "text-red-600/70" : "text-slate-400"
                                            )}>Gagal diimport</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Success message */}
                                {summary.failedCount === 0 && (
                                    <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 p-4 flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100">
                                            <FilePlus2 className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <p className="text-sm text-emerald-700 font-medium">
                                            Semua produk berhasil diimport ke database!
                                        </p>
                                    </div>
                                )}

                                {/* Failed rows detail */}
                                {failedResults.length > 0 && (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5" /> Detail Error ({failedResults.length})
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-red-100 overflow-hidden">
                                            <div className="max-h-[220px] overflow-y-auto divide-y divide-red-50">
                                                {displayedErrors.map((r) => (
                                                    <div key={r.row} className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-red-50/30 transition-colors">
                                                        <Badge className="rounded-md text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 border-0 shrink-0 mt-0.5 font-mono">
                                                            #{r.row}
                                                        </Badge>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-medium text-red-800 truncate">{r.name || "—"}</p>
                                                            <p className="text-[11px] text-red-500/80 mt-0.5">{r.error}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {failedResults.length > 5 && (
                                                <button
                                                    type="button"
                                                    className="w-full flex items-center justify-center gap-1 py-2 text-[11px] font-medium text-red-500 hover:bg-red-50/50 border-t border-red-50 transition-colors"
                                                    onClick={() => setShowAllErrors(!showAllErrors)}
                                                >
                                                    {showAllErrors ? (
                                                        <><ChevronUp className="w-3 h-3" /> Tampilkan lebih sedikit</>
                                                    ) : (
                                                        <><ChevronDown className="w-3 h-3" /> Lihat semua {failedResults.length} error</>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogBody>

                <DialogFooter>
                    <div className="flex items-center justify-between w-full">
                        <div>
                            {step === "preview" && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-lg text-xs text-muted-foreground"
                                    onClick={reset}
                                >
                                    <RotateCcw className="w-3 h-3 mr-1.5" /> Ganti File
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => { reset(); onOpenChange(false); }}
                            >
                                {step === "result" ? "Tutup" : "Batal"}
                            </Button>

                            {step === "preview" && (
                                <Button
                                    className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                                    onClick={handleImport}
                                    disabled={!file || importing}
                                >
                                    {importing ? (
                                        <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Mengimport...</>
                                    ) : (
                                        <><ArrowRight className="w-4 h-4 mr-1.5" /> Import {totalDataRows} Produk</>
                                    )}
                                </Button>
                            )}

                            {step === "result" && summary && summary.failedCount > 0 && (
                                <Button
                                    className="rounded-xl shadow-md shadow-primary/20"
                                    onClick={reset}
                                >
                                    <RotateCcw className="w-4 h-4 mr-1.5" /> Import Ulang
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
