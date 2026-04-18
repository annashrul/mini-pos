"use client";

import { useState, useEffect, useMemo, useRef, useTransition, useCallback } from "react";
import { useQueryParams } from "@/hooks/use-query-params";
import { getTaxSummaryReport, getEFakturExport } from "@/server/actions/accounting-reports";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SmartTable, type SmartColumn, type SmartFilter } from "@/components/ui/smart-table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Receipt, FileDown, TrendingUp, AlertTriangle, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/components/providers/branch-provider";

type TaxReport = Awaited<ReturnType<typeof getTaxSummaryReport>>;
type TaxDetail = TaxReport["details"][number];

const TAX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  PPN_KELUARAN: { label: "PPN Keluaran", color: "bg-blue-50 text-blue-700 border-blue-200" },
  PPN_MASUKAN: { label: "PPN Masukan", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PPH21: { label: "PPh 21", color: "bg-amber-50 text-amber-700 border-amber-200" },
  PPH23: { label: "PPh 23", color: "bg-purple-50 text-purple-700 border-purple-200" },
};

const smartFilters: SmartFilter[] = [
  {
    key: "taxType",
    label: "Tipe Pajak",
    type: "select",
    options: [
      { value: "PPN_KELUARAN", label: "PPN Keluaran" },
      { value: "PPN_MASUKAN", label: "PPN Masukan" },
      { value: "PPH21", label: "PPh 21" },
      { value: "PPH23", label: "PPh 23" },
    ],
  },
  { key: "dateFrom", label: "Dari Tanggal", type: "date" },
  { key: "dateTo", label: "Sampai Tanggal", type: "date" },
];

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }

export function TaxReportContent() {
  const now = new Date();
  const defaultDateFrom = fmtDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultDateTo = fmtDate(now);
  const [data, setData] = useState<TaxReport | null>(null);
  const [loading, startTransition] = useTransition();
  const qp = useQueryParams({
    pageSize: 10,
    filters: { taxType: "ALL", dateFrom: defaultDateFrom, dateTo: defaultDateTo },
  });
  const { page, pageSize, search, filters } = qp;
  const activeFilters = filters;
  const { selectedBranchId, branchReady } = useBranch();
  const prevBranchRef = useRef(selectedBranchId);

  const fetchReport = useCallback((params?: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string> }) => {
    startTransition(async () => {
      const f = params?.filters ?? activeFilters;
      const result = await getTaxSummaryReport({
        dateFrom: f.dateFrom || defaultDateFrom,
        dateTo: f.dateTo || defaultDateTo,
        ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
        ...(f.taxType && f.taxType !== "ALL" ? { taxType: f.taxType } : {}),
        ...(params?.search ?? search ? { search: params?.search ?? search } : {}),
        page: params?.page ?? page,
        perPage: params?.pageSize ?? pageSize,
      });
      setData(result);
    });
  }, [activeFilters, selectedBranchId, search, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!branchReady) return;
    prevBranchRef.current = selectedBranchId;
    fetchReport();
  }, [branchReady, selectedBranchId, page, pageSize, search, filters.taxType, filters.dateFrom, filters.dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = (q: string) => qp.setSearch(q);
  const handleFilterChange = (f: Record<string, string>) => qp.setFilters(f);
  const handlePageChange = (p: number) => qp.setPage(p);
  const handlePageSizeChange = (s: number) => qp.setPageSize(s);

  const handleExportEFaktur = async () => {
    const result = await getEFakturExport({
      dateFrom: activeFilters.dateFrom || fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      dateTo: activeFilters.dateTo || fmtDate(now),
    });
    const blob = new Blob(["\uFEFF" + result.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("e-Faktur CSV berhasil diunduh");
  };

  const columns = useMemo<SmartColumn<TaxDetail>[]>(() => [
    {
      key: "date",
      header: "Tanggal",
      sortable: true,
      render: (row) => <span className="text-xs tabular-nums">{row.date?.slice(0, 10)}</span>,
      exportValue: (row) => row.date?.slice(0, 10) ?? "",
    },
    {
      key: "entry_number",
      header: "No. Jurnal",
      stickyLeft: true,
      render: (row) => <span className="font-mono text-xs font-semibold">{row.entry_number}</span>,
      exportValue: (row) => row.entry_number,
    },
    {
      key: "description",
      header: "Keterangan",
      render: (row) => <span className="text-xs truncate max-w-[200px] block">{row.description}</span>,
      exportValue: (row) => row.description,
    },
    {
      key: "tax_type",
      header: "Tipe Pajak",
      render: (row) => {
        const cfg = TAX_TYPE_LABELS[row.tax_type] ?? { label: row.tax_type, color: "bg-slate-50 text-slate-700 border-slate-200" };
        return <Badge className={`${cfg.color} border rounded-full text-[10px] px-2`}>{cfg.label}</Badge>;
      },
      exportValue: (row) => TAX_TYPE_LABELS[row.tax_type]?.label ?? row.tax_type,
    },
    {
      key: "dpp",
      header: "DPP",
      align: "right",
      sortable: true,
      render: (row) => <span className="text-xs tabular-nums">{formatCurrency(row.dpp)}</span>,
      exportValue: (row) => row.dpp.toString(),
    },
    {
      key: "tax_amount",
      header: "Pajak",
      align: "right",
      sortable: true,
      render: (row) => <span className="text-xs tabular-nums font-semibold">{formatCurrency(row.tax_amount)}</span>,
      exportValue: (row) => row.tax_amount.toString(),
    },
  ], []);

  const exportButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="rounded-xl" disabled={!data}>
          <FileDown className="w-4 h-4 mr-2" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handleExportEFaktur}><Receipt className="w-3.5 h-3.5 mr-2" /> e-Faktur CSV</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

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
                  {data.total} transaksi
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {exportButton}
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

      {/* SmartTable */}
      <SmartTable<TaxDetail>
        data={data?.details ?? []}
        columns={columns}
        totalItems={data?.total ?? 0}
        totalPages={data?.totalPages ?? 0}
        currentPage={page}
        pageSize={pageSize}
        loading={loading}
        title="Detail Pajak"
        titleIcon={<Receipt className="w-4 h-4 text-rose-600" />}
        searchPlaceholder="Cari no. jurnal, keterangan..."
        searchValue={search}
        onSearch={handleSearchChange}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        filters={smartFilters}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        planMenuKey="accounting-tax"
        exportModule="tax-report"
        emptyIcon={<Receipt className="w-6 h-6 text-muted-foreground/40" />}
        emptyTitle="Tidak ada data pajak"
        emptyDescription="Belum ada transaksi pajak di periode ini"
        mobileRender={(row) => {
          const cfg = TAX_TYPE_LABELS[row.tax_type] ?? { label: row.tax_type, color: "bg-slate-50 text-slate-700 border-slate-200" };
          return (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold">{row.entry_number}</span>
                <Badge className={`${cfg.color} border rounded-full text-[10px] px-2`}>{cfg.label}</Badge>
              </div>
              <p className="text-xs text-foreground truncate">{row.description}</p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{row.date?.slice(0, 10)}</span>
                <div>
                  <span className="mr-2">DPP: {formatCurrency(row.dpp)}</span>
                  <span className="font-bold text-foreground">{formatCurrency(row.tax_amount)}</span>
                </div>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
