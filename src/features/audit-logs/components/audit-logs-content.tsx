"use client";

import { useState, useRef, useEffect, useTransition, useMemo, useCallback } from "react";
import { useQueryParams } from "@/hooks/use-query-params";
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
    const qp = useQueryParams({ pageSize: 15, filters: { entity: "ALL", action: "ALL" } });
    const { page, pageSize, search, filters: activeFilters } = qp;
    const setPage = qp.setPage;
    const [searchInput, setSearchInput] = useState(search);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [loading, startTransition] = useTransition();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const isAllExpanded = data.logs.length > 0 && expandedIds.size >= data.logs.length;

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
        prevBranchRef.current = selectedBranchId;
        fetchData({});
    }, [branchReady, selectedBranchId, page, pageSize, search, activeFilters.entity, activeFilters.action]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const toggleExpandAll = () => {
        if (isAllExpanded) {
            setExpandedIds(new Set());
            qp.setFilter("expanded", null);
        } else {
            setExpandedIds(new Set(data.logs.map((l) => l.id)));
            qp.setFilter("expanded", "all");
        }
    };

    // Sync expanded state from URL on data load
    useEffect(() => {
        if (qp.filters.expanded === "all" && data.logs.length > 0) {
            setExpandedIds(new Set(data.logs.map((l) => l.id)));
        }
    }, [data.logs]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleFilterChange = (key: string, value: string) => {
        qp.setFilters({ ...activeFilters, [key]: value });
    };

    const handleFilterBatch = (updates: Record<string, string>) => {
        qp.setFilters({ ...activeFilters, ...updates });
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
            <AuditLogsHeader stats={stats} isAllExpanded={isAllExpanded} onToggleExpandAll={toggleExpandAll} />

            <AuditLogsFilters
                search={searchInput}
                onSearchChange={(v) => {
                    setSearchInput(v);
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => {
                        qp.setSearch(v);
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
                onPageChange={(p) => setPage(p)}
                onPageSizeChange={(s) => qp.setParams({ pageSize: s, page: 1 })}
            />
        </div>
    );
}
