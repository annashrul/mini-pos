"use client";

import { useState, useRef } from "react";
import { importProducts, getImportTemplate } from "@/server/actions/products";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

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

function detectDelimiter(text: string): string {
    // Take the first line (outside quotes) to detect delimiter
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
    const [preview, setPreview] = useState<string[][] | null>(null);
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState<ImportResult[] | null>(null);
    const [summary, setSummary] = useState<{ successCount: number; failedCount: number } | null>(null);

    const reset = () => {
        setFile(null);
        setPreview(null);
        setResults(null);
        setSummary(null);
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;

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
            // Strip BOM if present
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            const rows = parseCSV(text);
            setPreview(rows.slice(0, 6)); // header + 5 rows preview
        };
        reader.readAsText(f, "UTF-8");
    };

    const handleDownloadTemplate = async () => {
        try {
            const template = await getImportTemplate();
            const rows = [
                template.headerLabels,
                ...template.sampleRows,
            ];

            // Add reference notes
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

            // Skip header row, map data rows
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

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
            <DialogContent className="rounded-2xl max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4" /> Import Produk
                    </DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <div className="space-y-4">
                        {/* Download template */}
                        <div className="rounded-xl border border-dashed border-border/60 p-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">Template Import</p>
                                <p className="text-xs text-muted-foreground">Download template CSV untuk format yang benar</p>
                            </div>
                            <Button variant="outline" size="sm" className="rounded-lg" onClick={handleDownloadTemplate}>
                                <Download className="w-3.5 h-3.5 mr-1.5" /> Download Template
                            </Button>
                        </div>

                        {/* File upload */}
                        <div
                            className="rounded-xl border-2 border-dashed border-border/50 p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
                            onClick={() => fileRef.current?.click()}
                        >
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {file ? (
                                <div className="space-y-1">
                                    <FileSpreadsheet className="w-8 h-8 text-primary mx-auto" />
                                    <p className="text-sm font-medium">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {preview ? `${preview.length - 1} baris data (preview)` : "Memproses..."}
                                    </p>
                                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={(e) => { e.stopPropagation(); reset(); }}>
                                        Ganti file
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                                    <p className="text-sm text-muted-foreground">Klik atau drag file CSV ke sini</p>
                                    <p className="text-[11px] text-muted-foreground/60">Format: .csv (comma atau semicolon separated)</p>
                                </div>
                            )}
                        </div>

                        {/* Preview */}
                        {preview && preview.length > 1 && !results && (
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview Data</p>
                                <div className="rounded-lg border border-border/40 overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-muted/30">
                                                {preview[0]?.map((h, i) => (
                                                    <th key={i} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.slice(1).map((row, ri) => (
                                                <tr key={ri} className="border-t border-border/20">
                                                    {row.map((cell, ci) => (
                                                        <td key={ci} className="px-2 py-1.5 whitespace-nowrap">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {preview.length >= 6 && (
                                    <p className="text-[10px] text-muted-foreground text-center">Menampilkan 5 baris pertama</p>
                                )}
                            </div>
                        )}

                        {/* Results */}
                        {results && summary && (
                            <div className="space-y-3">
                                {/* Summary cards */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                        <div>
                                            <p className="text-lg font-bold text-emerald-700">{summary.successCount}</p>
                                            <p className="text-[10px] text-emerald-600">Berhasil</p>
                                        </div>
                                    </div>
                                    {summary.failedCount > 0 && (
                                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-center gap-2">
                                            <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                                            <div>
                                                <p className="text-lg font-bold text-red-700">{summary.failedCount}</p>
                                                <p className="text-[10px] text-red-600">Gagal</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Failed rows detail */}
                                {results.filter((r) => !r.success).length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-medium text-red-600 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Detail Gagal
                                        </p>
                                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                                            {results.filter((r) => !r.success).map((r) => (
                                                <div key={r.row} className="flex items-start gap-2 text-xs bg-red-50/60 rounded-lg px-3 py-1.5">
                                                    <Badge variant="outline" className="rounded-md text-[9px] shrink-0 mt-0.5">Baris {r.row}</Badge>
                                                    <span className="text-red-700">{r.name}: {r.error}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogBody>
                <DialogFooter>
                    <Button variant="outline" className="rounded-lg" onClick={() => { reset(); onOpenChange(false); }}>
                        {results ? "Tutup" : "Batal"}
                    </Button>
                    {!results && (
                        <Button className="rounded-lg" onClick={handleImport} disabled={!file || importing}>
                            {importing ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Mengimport...</> : <><Upload className="w-4 h-4 mr-1.5" /> Import</>}
                        </Button>
                    )}
                    {results && summary && summary.failedCount > 0 && (
                        <Button className="rounded-lg" onClick={() => { setResults(null); setSummary(null); }}>
                            Import Ulang
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
