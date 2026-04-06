"use client";

import { useMemo } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SmartTable, type SmartColumn, type SmartFilter } from "@/components/ui/smart-table";
import { BookOpen, Plus } from "lucide-react";
import { useJournals } from "../hooks";
import { STATUS_CONFIG, TYPE_CONFIG } from "../utils";
import { JournalFormDialog } from "./journal-form-dialog";
import { JournalDetailDialog } from "./journal-detail-dialog";
import type { Journal } from "../types";

const smartFilters: SmartFilter[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "ALL", label: "Semua Status" },
      { value: "DRAFT", label: "Draft" },
      { value: "POSTED", label: "Posted" },
      { value: "VOID", label: "Void" },
    ],
  },
  { key: "dateFrom", label: "Dari Tanggal", type: "date" },
  { key: "dateTo", label: "Sampai Tanggal", type: "date" },
];

export function JournalsContent() {
  const {
    data,
    page,
    pageSize,
    formOpen,
    detailOpen,
    selectedJournal,
    loading,
    activeFilters,
    setPage,
    setFormOpen,
    setDetailOpen,
    handleRowClick,
    handleFormClose,
    handleSearchChange,
    handleFilterChange,
    handlePageSizeChange,
  } = useJournals();

  const columns = useMemo<SmartColumn<Journal>[]>(
    () => [
      {
        key: "number",
        header: "No. Jurnal",
        render: (row) => (
          <span className="font-mono text-sm font-medium text-gray-900">
            {row.number}
          </span>
        ),
        exportValue: (row) => row.number,
      },
      {
        key: "date",
        header: "Tanggal",
        render: (row) => (
          <span className="text-sm text-gray-600">{formatDate(row.date)}</span>
        ),
        exportValue: (row) => row.date,
      },
      {
        key: "description",
        header: "Deskripsi",
        render: (row) => (
          <span className="text-sm text-gray-700 max-w-[220px] truncate block">
            {row.description}
          </span>
        ),
        exportValue: (row) => row.description,
      },
      {
        key: "reference",
        header: "Referensi",
        render: (row) => (
          <span className="text-sm text-gray-500">
            {row.reference || "-"}
          </span>
        ),
        exportValue: (row) => row.reference || "-",
      },
      {
        key: "type",
        header: "Tipe",
        render: (row) => {
          const typeCfg = TYPE_CONFIG[row.type] || TYPE_CONFIG.GENERAL;
          return (
            <Badge
              variant="secondary"
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 ${typeCfg?.className}`}
            >
              {typeCfg?.label}
            </Badge>
          );
        },
        exportValue: (row) => {
          const typeCfg = TYPE_CONFIG[row.type] || TYPE_CONFIG.GENERAL;
          return typeCfg?.label || row.type;
        },
      },
      {
        key: "totalDebit",
        header: "Debit",
        align: "right",
        render: (row) => (
          <span className="text-sm font-mono font-semibold text-gray-900 tabular-nums">
            {formatCurrency(row.totalDebit)}
          </span>
        ),
        exportValue: (row) => row.totalDebit,
      },
      {
        key: "totalCredit",
        header: "Kredit",
        align: "right",
        render: (row) => (
          <span className="text-sm font-mono font-semibold text-gray-900 tabular-nums">
            {formatCurrency(row.totalCredit)}
          </span>
        ),
        exportValue: (row) => row.totalCredit,
      },
      {
        key: "status",
        header: "Status",
        render: (row) => {
          const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.DRAFT;
          const className =
            row.status === "DRAFT"
              ? "bg-gray-100 text-gray-600"
              : row.status === "POSTED"
              ? "bg-emerald-100 text-emerald-700"
              : row.status === "VOID"
              ? "bg-red-100 text-red-700"
              : statusCfg?.className;
          return (
            <Badge
              variant="secondary"
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 ${className}`}
            >
              {statusCfg?.label}
            </Badge>
          );
        },
        exportValue: (row) => {
          const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.DRAFT;
          return statusCfg?.label || row.status;
        },
      },
      {
        key: "createdByName",
        header: "Dibuat oleh",
        render: (row) => (
          <span className="text-sm text-gray-600">{row.createdByName}</span>
        ),
        exportValue: (row) => row.createdByName,
      },
    ],
    [],
  );

  const createButton = (
    <Button
      onClick={() => setFormOpen(true)}
      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-600/20 h-8 px-4 text-xs"
    >
      <Plus className="w-4 h-4 mr-1.5" />
      Buat Jurnal
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Jurnal Umum
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Catat dan kelola seluruh entri jurnal akuntansi perusahaan
          </p>
        </div>
        <Button
          onClick={() => setFormOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-600/20 h-10 px-5"
        >
          <Plus className="w-4 h-4 mr-2" />
          Buat Jurnal
        </Button>
      </div>

      {/* ── SmartTable ─────────────────────────────────────────────────── */}
      <SmartTable<Journal>
        data={data.journals}
        columns={columns}
        totalItems={data.total}
        totalPages={data.totalPages}
        currentPage={page}
        pageSize={pageSize}
        loading={loading}
        title="Jurnal Umum"
        titleIcon={<BookOpen className="w-4 h-4 text-blue-600" />}
        headerActions={createButton}
        searchPlaceholder="Cari no. jurnal, deskripsi..."
        onSearch={handleSearchChange}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
        filters={smartFilters}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onRowClick={handleRowClick}
        exportFilename="jurnal-umum"
        emptyIcon={<BookOpen className="w-6 h-6 text-muted-foreground/40" />}
        emptyTitle="Belum ada jurnal"
        emptyDescription='Klik "Buat Jurnal" untuk membuat entri pertama'
        mobileRender={(row) => {
          const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.DRAFT;
          const typeCfg = TYPE_CONFIG[row.type] || TYPE_CONFIG.GENERAL;
          const statusClass =
            row.status === "DRAFT"
              ? "bg-gray-100 text-gray-600"
              : row.status === "POSTED"
              ? "bg-emerald-100 text-emerald-700"
              : row.status === "VOID"
              ? "bg-red-100 text-red-700"
              : statusCfg?.className;
          return (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium text-gray-900">{row.number}</span>
                <Badge variant="secondary" className={`rounded-full px-2 py-0.5 text-[11px] font-medium border-0 ${statusClass}`}>
                  {statusCfg?.label}
                </Badge>
              </div>
              <div className="text-xs text-gray-500">
                {formatDate(row.date)} <span className="mx-1">&bull;</span> {typeCfg?.label}
              </div>
              <p className="text-xs text-gray-600 truncate">{row.description}</p>
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                <span className="text-gray-700">Debit: <span className="font-semibold">{formatCurrency(row.totalDebit)}</span></span>
                <span className="text-gray-700">Kredit: <span className="font-semibold">{formatCurrency(row.totalCredit)}</span></span>
              </div>
            </div>
          );
        }}
      />

      {/* ── Dialogs ────────────────────────────────────────────────────── */}
      <JournalFormDialog open={formOpen} onClose={handleFormClose} />
      <JournalDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        journal={selectedJournal}
      />
    </div>
  );
}
