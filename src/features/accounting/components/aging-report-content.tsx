"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useQueryParams } from "@/hooks/use-query-params";
import { getAgingReport } from "@/server/actions/accounting-reports";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToPDF, exportToCSV, exportToExcel, type DocumentConfig } from "@/lib/document-export";
import {
  Clock, Loader2, FileDown, Users, Search,
  FileText, FileSpreadsheet, AlertTriangle,
} from "lucide-react";
import { useBranch } from "@/components/providers/branch-provider";

type AgingData = Awaited<ReturnType<typeof getAgingReport>>;

const BUCKET_CONFIG = [
  { key: "current", label: "Belum JT", shortLabel: "Blm JT", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
  { key: "days1to30", label: "1-30 Hari", shortLabel: "1-30", color: "text-blue-700", bg: "bg-blue-50 border-blue-100" },
  { key: "days31to60", label: "31-60 Hari", shortLabel: "31-60", color: "text-amber-700", bg: "bg-amber-50 border-amber-100" },
  { key: "days61to90", label: "61-90 Hari", shortLabel: "61-90", color: "text-orange-700", bg: "bg-orange-50 border-orange-100" },
  { key: "over90", label: "> 90 Hari", shortLabel: ">90", color: "text-red-700", bg: "bg-red-50 border-red-100" },
];

export function AgingReportContent() {
  const qp = useQueryParams({ filters: { type: "RECEIVABLE" } });
  const type = (qp.filters.type || "RECEIVABLE") as "PAYABLE" | "RECEIVABLE";
  const setType = (t: "PAYABLE" | "RECEIVABLE") => qp.setFilter("type", t);
  const search = qp.search;
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, startTransition] = useTransition();
  const { selectedBranchId, branchReady } = useBranch();
  const prevBranchRef = useRef(selectedBranchId);

  const fetchReport = () => {
    startTransition(async () => {
      const result = await getAgingReport({ type, ...(selectedBranchId ? { branchId: selectedBranchId } : {}) });
      setData(result);
    });
  };

  useEffect(() => {
    if (!branchReady) return;
    prevBranchRef.current = selectedBranchId;
    fetchReport();
  }, [branchReady, selectedBranchId, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredParties = data?.byParty.filter((p) => {
    if (!search) return true;
    return p.partyName.toLowerCase().includes(search.toLowerCase());
  }) ?? [];

  const buildExportConfig = (): DocumentConfig => ({
    title: `AGING REPORT — ${type === "RECEIVABLE" ? "PIUTANG" : "HUTANG"}`,
    date: `Per tanggal: ${data?.asOfDate ?? ""}`,
    columns: [
      { key: "partyName", header: "Nama", width: 25 },
      ...BUCKET_CONFIG.map((b) => ({ key: b.key, header: b.shortLabel, align: "right" as const, width: 12, format: (v: unknown) => { const n = v as number; return n > 0 ? formatCurrency(n) : "—"; } })),
      { key: "total", header: "Total", align: "right" as const, width: 15, format: (v: unknown) => formatCurrency(v as number) },
    ],
    data: filteredParties,
    totals: [{ label: "Grand Total", value: formatCurrency(data?.summary.total ?? 0) }],
  });

  const [searchInput, setSearchInput] = useState(search);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearch = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => { qp.setSearch(value); }, 400);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-200">
            <Clock className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Aging Report</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-muted-foreground text-xs sm:text-sm">Analisis umur hutang & piutang</p>
              {data && (
                <Badge variant="secondary" className="rounded-full bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200 text-xs font-medium">
                  {data.byParty.length} pihak
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl" disabled={!data}><FileDown className="w-4 h-4 mr-2" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => exportToPDF(buildExportConfig(), `aging-${type.toLowerCase()}.pdf`)}><FileDown className="w-3.5 h-3.5 mr-2" /> PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToCSV(buildExportConfig(), `aging-${type.toLowerCase()}.csv`)}><FileText className="w-3.5 h-3.5 mr-2" /> CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(buildExportConfig(), `aging-${type.toLowerCase()}.xlsx`)}><FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
          {BUCKET_CONFIG.map((bucket) => {
            const val = (data.summary as Record<string, number>)[bucket.key] ?? 0;
            const isHighRisk = (bucket.key === "over90" || bucket.key === "days61to90") && val > 0;
            return (
              <div key={bucket.key} className={`rounded-xl sm:rounded-2xl border p-2.5 sm:p-4 ${bucket.bg}`}>
                <div className="flex items-center gap-1 mb-1">
                  {isHighRisk && <AlertTriangle className="w-3 h-3 text-red-500" />}
                  <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wide opacity-70">{bucket.label}</p>
                </div>
                <p className={`text-xs sm:text-lg font-bold tabular-nums font-mono ${isHighRisk ? "text-red-700" : bucket.color}`}>{formatCurrency(val)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky: type toggle + search */}
      <div className="sticky top-0 z-20 bg-background pb-3 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1 space-y-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 shrink-0">
            {(["RECEIVABLE", "PAYABLE"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${type === t ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "RECEIVABLE" ? "Piutang (AR)" : "Hutang (AP)"}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={searchInput} onChange={(e) => handleSearch(e.target.value)} placeholder="Cari nama..." className="pl-9 rounded-xl h-9 text-xs" />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading && !data && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Memuat data...</span>
        </div>
      )}

      {data && filteredParties.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white to-slate-50/50">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 sm:w-8 sm:h-8 text-amber-300" />
          </div>
          <p className="text-sm sm:text-base font-semibold text-foreground mb-1">
            {search ? "Tidak ditemukan" : `Tidak ada ${type === "RECEIVABLE" ? "piutang" : "hutang"} outstanding`}
          </p>
        </div>
      )}

      {data && filteredParties.length > 0 && (
        <>
          {/* Mobile: Card list */}
          <div className="sm:hidden space-y-2">
            {filteredParties.map((party) => (
              <div key={party.partyName} className="rounded-xl border border-slate-200/60 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <span className="text-xs font-semibold text-foreground truncate">{party.partyName}</span>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-foreground">{formatCurrency(party.total)}</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {BUCKET_CONFIG.map((b) => {
                    const val = (party as Record<string, unknown>)[b.key] as number;
                    return (
                      <div key={b.key} className="text-center">
                        <p className="text-[8px] text-muted-foreground">{b.shortLabel}</p>
                        <p className={`text-[10px] font-bold tabular-nums ${val > 0 ? b.color : "text-slate-300"}`}>{val > 0 ? formatCurrency(val) : "—"}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block rounded-xl border bg-white overflow-auto max-h-[calc(100vh-400px)]">
            <table className="w-full caption-bottom text-sm">
              <thead className="sticky top-0 z-10 bg-white [box-shadow:0_1px_0_0_#e5e7eb] [&_tr]:border-b">
                <tr className="border-b">
                  <th className="h-9 px-3 text-left align-middle font-semibold text-xs text-muted-foreground"><Users className="w-3 h-3 inline mr-1" />Nama</th>
                  {BUCKET_CONFIG.map((b) => (
                    <th key={b.key} className="h-9 px-3 text-right align-middle font-semibold text-xs text-muted-foreground">{b.shortLabel}</th>
                  ))}
                  <th className="h-9 px-3 text-right align-middle font-semibold text-xs text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredParties.map((party) => (
                  <tr key={party.partyName} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-3 align-middle text-xs font-medium">{party.partyName}</td>
                    {BUCKET_CONFIG.map((b) => {
                      const val = (party as Record<string, unknown>)[b.key] as number;
                      const isHighRisk = (b.key === "over90" || b.key === "days61to90") && val > 0;
                      return (
                        <td key={b.key} className={`p-3 align-middle text-right text-xs tabular-nums ${isHighRisk ? "text-red-600 font-bold" : val > 0 ? "text-foreground" : "text-slate-300"}`}>
                          {val > 0 ? formatCurrency(val) : "—"}
                        </td>
                      );
                    })}
                    <td className="p-3 align-middle text-right text-xs tabular-nums font-bold">{formatCurrency(party.total)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                  <td className="p-3 text-xs">Total</td>
                  {BUCKET_CONFIG.map((b) => (
                    <td key={b.key} className="p-3 text-right text-xs tabular-nums font-bold">{formatCurrency((data.summary as Record<string, number>)[b.key] ?? 0)}</td>
                  ))}
                  <td className="p-3 text-right text-xs tabular-nums font-bold text-foreground">{formatCurrency(data.summary.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
