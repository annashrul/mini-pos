"use client";

import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

export interface PaginationControlProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
}

export function PaginationControl({
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
}: PaginationControlProps) {
    if (totalPages <= 1 && !onPageSizeChange) return null;

    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    // Build page numbers
    const pages: (number | "...")[] = [];
    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (currentPage > 3) pages.push("...");
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
        if (currentPage < totalPages - 2) pages.push("...");
        pages.push(totalPages);
    }

    return (
        <div className="px-1 py-3 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
            {/* Info + page size */}
            <div className="flex items-center justify-between sm:justify-start gap-3">
                <span className="text-xs text-muted-foreground">
                    {totalItems > 0 ? (
                        <>
                            <span className="hidden sm:inline">Menampilkan </span>
                            {startItem}–{endItem}
                            <span className="hidden sm:inline"> dari</span>
                            <span className="sm:hidden"> /</span> {totalItems.toLocaleString()}
                        </>
                    ) : "0 data"}
                </span>
                {onPageSizeChange && (
                    <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
                        <SelectTrigger className="w-[70px] h-7 rounded-lg text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {pageSizeOptions.map((size) => (
                                <SelectItem key={size} value={String(size)} className="text-xs">{size}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Page buttons */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center sm:justify-end gap-1">
                    {/* First + Prev — hide first/last on mobile */}
                    <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg hidden sm:inline-flex" disabled={currentPage <= 1} onClick={() => onPageChange(1)}>
                        <ChevronsLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>

                    {/* Page numbers — show fewer on mobile */}
                    <span className="sm:hidden text-xs font-medium text-muted-foreground px-2 tabular-nums">
                        {currentPage} / {totalPages}
                    </span>
                    <div className="hidden sm:flex items-center gap-1">
                        {pages.map((p, i) =>
                            p === "..." ? (
                                <span key={`e${i}`} className="px-1 text-xs text-muted-foreground/50">...</span>
                            ) : (
                                <button key={p} type="button" onClick={() => onPageChange(p)}
                                    className={`h-7 min-w-[28px] rounded-lg text-xs font-medium transition-all ${p === currentPage ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"}`}>
                                    {p}
                                </button>
                            )
                        )}
                    </div>

                    {/* Next + Last */}
                    <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg hidden sm:inline-flex" disabled={currentPage >= totalPages} onClick={() => onPageChange(totalPages)}>
                        <ChevronsRight className="w-3.5 h-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
}
