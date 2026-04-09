"use client";

import { useState, useRef, useEffect, useTransition, useMemo, useCallback } from "react";
import { getAuditLogs } from "@/features/audit-logs";
import { useBranch } from "@/components/providers/branch-provider";
import { format } from "date-fns";
import { PaginationControl } from "@/components/ui/pagination-control";
import { AuditLogsFilters } from "./audit-logs-filters";
import { AuditLogsHeader } from "./audit-logs-header";
import { AuditLogsTimeline } from "./audit-logs-timeline";

type AuditLogsResult = Awaited<ReturnType<typeof getAuditLogs>>;
type AuditLogRow = AuditLogsResult["logs"][number];

// === Main component ===

export function AuditLogsContent() {
    const [data, setData] = useState<AuditLogsResult>({ logs: [], total: 0, totalPages: 0 });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [search, setSearch] = useState("");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ entity: "ALL", action: "ALL" });
    const [loading, startTransition] = useTransition();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);

    const fetchData = useCallback((params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string> }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const result = await getAuditLogs({
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(f.entity !== "ALL" ? { entity: f.entity } : {}),
                ...(f.action && f.action !== "ALL" ? { action: f.action } : {}),
                ...(f.date_from ? { dateFrom: f.date_from } : {}),
                ...(f.date_to ? { dateTo: f.date_to } : {}),
                ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
            });
            setData(result);
        });
    }, [activeFilters, search, page, pageSize, selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!branchReady) return;
        if (prevBranchRef.current !== selectedBranchId) {
            prevBranchRef.current = selectedBranchId;
            setPage(1);
            fetchData({ page: 1 });
        } else {
            fetchData({});
        }
    }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const stats = useMemo(() => {
        const logs = data.logs;
        return {
            total: data.total,
            create: logs.filter((l) => l.action === "CREATE").length,
            update: logs.filter((l) => l.action === "UPDATE").length,
            delete: logs.filter((l) => l.action === "DELETE").length,
        };
    }, [data]);

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const expandAll = () => setExpandedIds(new Set(data.logs.map((l) => l.id)));
    const collapseAll = () => setExpandedIds(new Set());

    const handleFilterChange = (key: string, value: string) => {
        const f = { ...activeFilters, [key]: value };
        setActiveFilters(f);
        setPage(1);
        fetchData({ filters: f, page: 1 });
    };

    const handleFilterBatch = (updates: Record<string, string>) => {
        const f = { ...activeFilters, ...updates };
        setActiveFilters(f);
        setPage(1);
        fetchData({ filters: f, page: 1 });
    };


    // Group logs by date
    const groupedLogs = useMemo(() => {
        const groups: { date: string; logs: AuditLogRow[] }[] = [];
        let currentDate = "";
        for (const log of data.logs) {
            const d = format(new Date(log.createdAt), "yyyy-MM-dd");
            if (d !== currentDate) {
                currentDate = d;
                groups.push({ date: d, logs: [] });
            }
            groups[groups.length - 1]!.logs.push(log);
        }
        return groups;
    }, [data.logs]);

    return (
        <div className="space-y-5">
            <AuditLogsHeader stats={stats} onExpandAll={expandAll} onCollapseAll={collapseAll} />

            <AuditLogsFilters
                search={search}
                onSearchChange={(v) => {
                    setSearch(v);
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => {
                        setPage(1);
                        fetchData({ search: v, page: 1 });
                    }, 300);
                }}
                filters={activeFilters}
                onFilterChange={handleFilterChange}
                onFilterBatch={handleFilterBatch}
                onRefresh={() => fetchData({})}
                loading={loading}
            />

            <AuditLogsTimeline
                groups={groupedLogs}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpand}
                loading={loading}
                hasLogs={data.logs.length > 0}
            />

            {/* Pagination */}
            <PaginationControl
                currentPage={page}
                totalPages={data.totalPages}
                totalItems={data.total}
                pageSize={pageSize}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
            />
        </div>
    );
}
