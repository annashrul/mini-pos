"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { getTaxSummaryReport, getEFakturExport } from "@/server/actions/accounting-reports";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToPDF, exportToCSV, exportToExcel, type DocumentConfig } from "@/lib/document-export";
import {
  Receipt, FileDown, Loader2, TrendingUp, AlertTriangle,
  Search, FileText, FileSpreadsheet, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/components/providers/branch-provider";

type TaxReport = Awaited<ReturnType<typeof getTaxSummaryReport>>;

const TAX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  PPN_KELUARAN: { label: "PPN Keluaran", color: "bg-blue-50 text-blue-700 border-blue-200" },
  PPN_MASUKAN: { label: "PPN Masukan", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PPH21: { label: "PPh 21", color: "bg-amber-50 text-amber-700 border-amber-200" },
  PPH23: { label: "PPh 23", color: "bg-purple-50 text-purple-700 border-purple-200" },
};

const TYPE_PILLS = [
  { value: "ALL", label: "Semua" },
  { value: "PPN_KELUARAN", label: "PPN Keluaran" },
  { value: "PPN_MASUKAN", label: "PPN Masukan" },
  { value: "PPH21", label: "PPh 21" },
  { value: "PPH23", label: "PPh 23" },
];

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }

export function TaxReportContent() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(fmtDate(now));
  const [data, setData] = useState<TaxReport | null>(null);
  const [loading, startTransition] = useTransition();
  const [activeType, setActiveType] = useState("ALL");
  const [search, setSearch] = useState("");
  const { selectedBranchId, branchReady } = useBranch();
  const prevBranchRef = useRef(selectedBranchId);

  const fetchReport = () => {
    startTransition(async () => {
      const result = await getTaxSummaryReport({
        dateFrom, dateTo,
        ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
      });
      setData(result);
    });
  };

  useEffect(() => {
    if (!branchReady) return;
    if (prevBranchRef.current !== selectedBranchId) {
      prevBranchRef.current = selectedBranchId;
    }
    fetchReport();
  }, [branchReady, selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportEFaktur = async () => {
    const result = await getEFakturExport({ dateFrom, dateTo });
    const blob = new Blob(["\uFEFF" + result.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("e-Faktur CSV berhasil diunduh");
  };

  const filteredDetails = data?.details.filter((row) => {
    if (activeType !== "ALL" && row.tax_type !== activeType) return false;
    if (search) {
      const q = search.toLowerCase();
      return row.entry_number.toLowerCase().includes(q) || row.description.toLowerCase().includes(q) || row.reference.toLowerCase().includes(q);
    }
    return true;
  }) ?? [];

  const typeCounts = data ? {
    ALL: data.details.length,
    PPN_KELUARAN: data.details.filter((d) => d.tax_type === "PPN_KELUARAN").length,
    PPN_MASUKAN: data.details.filter((d) => d.tax_type === "PPN_MASUKAN").length,
    PPH21: data.details.filter((d) => d.tax_type === "PPH21").length,
    PPH23: data.details.filter((d) => d.tax_type === "PPH23").length,
  } : { ALL: 0, PPN_KELUARAN: 0, PPN_MASUKAN: 0, PPH21: 0, PPH23: 0 };

  const buildExportConfig = (): DocumentConfig => ({
    title: "LAPORAN PAJAK",
    docNumber: `Periode: ${dateFrom} s/d ${dateTo}`,
    columns: [
      { key: "date", header: "Tanggal", width: 12 },
      { key: "entry_number", header: "No. Jurnal", width: 18 },
      { key: "description", header: "Keterangan", width: 30 },
      { key: "tax_type", header: "Tipe", width: 15, format: (v) => TAX_TYPE_LABELS[v as string]?.label ?? String(v) },
      { key: "dpp", header: "DPP", align: "right", width: 15, format: (v) => formatCurrency(v as number) },
      { key: "tax_amount", header: "Pajak", align: "right", width: 15, format: (v) => formatCurrency(v as number) },
    ],
    data: filteredDetails.map((d) => ({ ...d, date: d.date?.slice(0, 10) })),
    totals: [
      { label: "PPN Keluaran", value: formatCurrency(data?.ppnKeluaran ?? 0) },
      { label: "PPN Masukan", value: formatCurrency(data?.ppnMasukan ?? 0) },
      { label: "PPN Kurang/Lebih Bayar", value: formatCurrency(data?.ppnKurangBayar ?? 0) },
    ],
  });

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {}, 300);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-200">
            <Receipt className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Laporan Pajak</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-muted-foreground text-xs sm:text-sm">PPN, PPh & e-Faktur</p>
              {data && (
                <Badge variant="secondary" className="rounded-full bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border border-rose-200 text-xs font-medium">
                  {data.details.length} transaksi
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl" disabled={!data}>
                <FileDown className="w-4 h-4 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleExportEFaktur}><Receipt className="w-3.5 h-3.5 mr-2" /> e-Faktur CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPDF(buildExportConfig(), `pajak-${dateFrom}.pdf`)}><FileDown className="w-3.5 h-3.5 mr-2" /> Export PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToCSV(buildExportConfig(), `pajak-${dateFrom}.csv`)}><FileText className="w-3.5 h-3.5 mr-2" /> Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(buildExportConfig(), `pajak-${dateFrom}.xlsx`)}><FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Export Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          <div className="rounded-xl sm:rounded-2xl border border-blue-100 p-3 sm:p-4 bg-gradient-to-br from-blue-50/80 to-indigo-50/50">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center"><TrendingUp className="w-3 h-3 text-blue-600" /></div>
              <p className="text-[10px] sm:text-[11px] text-blue-600 font-semibold uppercase tracking-wide">PPN Keluaran</p>
            </div>
            <p className="text-sm sm:text-xl font-bold tabular-nums text-blue-800 font-mono">{formatCurrency(data.ppnKeluaran)}</p>
          </div>
          <div className="rounded-xl sm:rounded-2xl border border-emerald-100 p-3 sm:p-4 bg-gradient-to-br from-emerald-50/80 to-green-50/50">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="w-3 h-3 text-emerald-600" /></div>
              <p className="text-[10px] sm:text-[11px] text-emerald-600 font-semibold uppercase tracking-wide">PPN Masukan</p>
            </div>
            <p className="text-sm sm:text-xl font-bold tabular-nums text-emerald-800 font-mono">{formatCurrency(data.ppnMasukan)}</p>
          </div>
          <div className={`rounded-xl sm:rounded-2xl border p-3 sm:p-4 bg-gradient-to-br ${data.ppnKurangBayar > 0 ? "border-red-100 from-red-50/80 to-rose-50/50" : "border-emerald-100 from-emerald-50/80 to-green-50/50"}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${data.ppnKurangBayar > 0 ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                {data.ppnKurangBayar > 0 ? <AlertTriangle className="w-3 h-3 text-red-600" /> : <TrendingUp className="w-3 h-3 text-emerald-600" />}
              </div>
              <p className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide ${data.ppnKurangBayar > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {data.ppnKurangBayar > 0 ? "Kurang Bayar" : "Lebih Bayar"}
              </p>
            </div>
            <p className={`text-sm sm:text-xl font-bold tabular-nums font-mono ${data.ppnKurangBayar > 0 ? "text-red-800" : "text-emerald-800"}`}>{formatCurrency(Math.abs(data.ppnKurangBayar))}</p>
          </div>
          <div className="rounded-xl sm:rounded-2xl border border-amber-100 p-3 sm:p-4 bg-gradient-to-br from-amber-50/80 to-orange-50/50">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center"><Receipt className="w-3 h-3 text-amber-600" /></div>
              <p className="text-[10px] sm:text-[11px] text-amber-600 font-semibold uppercase tracking-wide">PPh 21</p>
            </div>
            <p className="text-sm sm:text-xl font-bold tabular-nums text-amber-800 font-mono">{formatCurrency(data.pph21)}</p>
          </div>
          <div className="rounded-xl sm:rounded-2xl border border-purple-100 p-3 sm:p-4 bg-gradient-to-br from-purple-50/80 to-violet-50/50">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center"><Receipt className="w-3 h-3 text-purple-600" /></div>
              <p className="text-[10px] sm:text-[11px] text-purple-600 font-semibold uppercase tracking-wide">PPh 23</p>
            </div>
            <p className="text-sm sm:text-xl font-bold tabular-nums text-purple-800 font-mono">{formatCurrency(data.pph23)}</p>
          </div>
        </div>
      )}

      {/* Sticky: date filter + search + type pills */}
      <div className="sticky top-0 z-20 bg-background pb-3 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1 space-y-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <DateRangePicker from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t); }} presets />
          <Button onClick={fetchReport} size="sm" className="rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white h-9" disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5 mr-1.5" />}
            Tampilkan
          </Button>
          <div className="relative flex-1 max-w-xs hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Cari jurnal..." className="pl-9 rounded-xl h-9 text-xs" />
          </div>
        </div>
        {data && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {TYPE_PILLS.map((pill) => {
              const count = typeCounts[pill.value as keyof typeof typeCounts] ?? 0;
              return (
                <button key={pill.value} onClick={() => setActiveType(pill.value)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5 ${activeType === pill.value
                    ? "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-200/50"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                  {pill.label}
                  <span className={`text-[10px] font-bold min-w-[16px] h-4 rounded-full inline-flex items-center justify-center ${activeType === pill.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail List */}
      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white to-slate-50/50">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-rose-100 to-red-100 flex items-center justify-center mb-4">
            <Receipt className="w-6 h-6 sm:w-8 sm:h-8 text-rose-300" />
          </div>
          <p className="text-sm sm:text-base font-semibold text-foreground mb-1">Pilih periode dan tampilkan</p>
          <p className="text-xs sm:text-sm text-muted-foreground">Gunakan filter tanggal di atas</p>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-rose-500 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Memuat data pajak...</span>
        </div>
      )}

      {data && (
        <div className="space-y-2">
          {filteredDetails.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Tidak ada data pajak yang cocok</div>
          ) : (
            <>
              {/* Mobile: Card list */}
              <div className="sm:hidden space-y-2">
                {filteredDetails.map((row, i) => {
                  const cfg = TAX_TYPE_LABELS[row.tax_type] ?? { label: row.tax_type, color: "bg-slate-50 text-slate-700 border-slate-200" };
                  return (
                    <div key={i} className="rounded-xl border border-slate-200/60 bg-white p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-muted-foreground">{row.entry_number}</span>
                        <Badge className={`${cfg.color} border rounded-full text-[10px] px-2`}>{cfg.label}</Badge>
                      </div>
                      <p className="text-xs font-medium text-foreground truncate">{row.description}</p>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3 h-3" />{row.date?.slice(0, 10)}</span>
                        <div className="text-right">
                          <span className="text-muted-foreground mr-2">DPP: {formatCurrency(row.dpp)}</span>
                          <span className="font-bold text-foreground">{formatCurrency(row.tax_amount)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Table */}
              <div className="hidden sm:block rounded-xl border bg-white overflow-auto max-h-[calc(100vh-400px)]">
                <table className="w-full caption-bottom text-sm">
                  <thead className="sticky top-0 z-10 bg-white [box-shadow:0_1px_0_0_#e5e7eb] [&_tr]:border-b">
                    <tr className="border-b">
                      <th className="h-9 px-3 text-left align-middle font-semibold text-xs text-muted-foreground">Tanggal</th>
                      <th className="h-9 px-3 text-left align-middle font-semibold text-xs text-muted-foreground">No. Jurnal</th>
                      <th className="h-9 px-3 text-left align-middle font-semibold text-xs text-muted-foreground">Keterangan</th>
                      <th className="h-9 px-3 text-left align-middle font-semibold text-xs text-muted-foreground">Tipe</th>
                      <th className="h-9 px-3 text-right align-middle font-semibold text-xs text-muted-foreground">DPP</th>
                      <th className="h-9 px-3 text-right align-middle font-semibold text-xs text-muted-foreground">Pajak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDetails.map((row, i) => {
                      const cfg = TAX_TYPE_LABELS[row.tax_type] ?? { label: row.tax_type, color: "bg-slate-50 text-slate-700 border-slate-200" };
                      return (
                        <tr key={i} className="border-b transition-colors hover:bg-muted/50">
                          <td className="p-3 align-middle text-xs tabular-nums">{row.date?.slice(0, 10)}</td>
                          <td className="p-3 align-middle text-xs font-mono">{row.entry_number}</td>
                          <td className="p-3 align-middle text-xs max-w-[250px] truncate">{row.description}</td>
                          <td className="p-3 align-middle"><Badge className={`${cfg.color} border rounded-full text-[10px] px-2`}>{cfg.label}</Badge></td>
                          <td className="p-3 align-middle text-right text-xs tabular-nums">{formatCurrency(row.dpp)}</td>
                          <td className="p-3 align-middle text-right text-xs tabular-nums font-semibold">{formatCurrency(row.tax_amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
