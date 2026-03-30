"use client";

import { useState, useTransition } from "react";
import { getAuditLogs } from "@/features/audit-logs";
import { Badge } from "@/components/ui/badge";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { ScrollText } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { AuditLog } from "@/types";

interface Props {
  initialData: { logs: AuditLog[]; total: number; totalPages: number };
}

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  LOGIN: "bg-purple-100 text-purple-700",
  VOID: "bg-orange-100 text-orange-700",
  REFUND: "bg-yellow-100 text-yellow-700",
};

export function AuditLogsContent({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
    entity: "ALL",
  });
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, startTransition] = useTransition();

  const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) => {
    startTransition(async () => {
      const f = params.filters ?? activeFilters;
      const sk = params.sortKey ?? sortKey;
      const sd = params.sortDir ?? sortDir;
      const query = {
        search: params.search ?? search,
        page: params.page ?? page,
        perPage: params.pageSize ?? pageSize,
        ...(f.entity !== "ALL" ? { entity: f.entity } : {}),
        ...(sk ? { sortBy: sk, sortDir: sd } : {}),
      };
      const result = await getAuditLogs(query);
      setData(result);
    });
  };

  const columns: SmartColumn<AuditLog>[] = [
    {
      key: "createdAt", header: "Waktu", sortable: true, width: "160px",
      render: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(row.createdAt), "dd MMM yyyy HH:mm", { locale: idLocale })}</span>,
      exportValue: (row) => format(new Date(row.createdAt), "dd/MM/yyyy HH:mm"),
    },
    {
      key: "user", header: "User", sortable: true,
      render: (row) => <span className="text-sm font-medium">{row.user.name}</span>,
      exportValue: (row) => row.user.name,
    },
    {
      key: "action", header: "Aksi",
      render: (row) => <Badge className={actionColors[row.action] || "bg-slate-100 text-slate-700"}>{row.action}</Badge>,
      exportValue: (row) => row.action,
    },
    {
      key: "entity", header: "Entity", sortable: true,
      render: (row) => <span className="text-sm">{row.entity}</span>,
      exportValue: (row) => row.entity,
    },
    {
      key: "details", header: "Detail",
      render: (row) => <span className="text-xs text-muted-foreground max-w-[300px] truncate block">{row.details || "-"}</span>,
      exportValue: (row) => row.details || "-",
    },
  ];

  const filters: SmartFilter[] = [
    {
      key: "entity", label: "Entity", type: "select",
      options: [
        { value: "Product", label: "Produk" },
        { value: "Transaction", label: "Transaksi" },
        { value: "User", label: "User" },
        { value: "Category", label: "Kategori" },
        { value: "Stock", label: "Stok" },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-muted-foreground text-sm">Riwayat semua aktivitas sistem</p>
      </div>

      <SmartTable<AuditLog>
        data={data.logs}
        columns={columns}
        totalItems={data.total}
        totalPages={data.totalPages}
        currentPage={page}
        pageSize={pageSize}
        loading={loading}
        title="Log Aktivitas"
        titleIcon={<ScrollText className="w-4 h-4 text-muted-foreground" />}
        searchPlaceholder="Cari log..."
        onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
        onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1); fetchData({ page: 1, sortKey: key, sortDir: dir }); }}
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
        exportFilename="audit-log"
        emptyIcon={<ScrollText className="w-10 h-10 text-muted-foreground/30" />}
        emptyTitle="Tidak ada log ditemukan"
      />
    </div>
  );
}
