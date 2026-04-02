"use client";

import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

interface PaginationControlProps {
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

    return (
        <div className="px-1 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                    {totalItems > 0 ? `Menampilkan ${startItem}–${endItem} dari ${totalItems.toLocaleString()} data` : "0 data"}
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
            {totalPages > 1 && (
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage <= 1} onClick={() => onPageChange(1)}>
                        <ChevronsLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    {(() => {
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
                        return pages.map((p, i) =>
                            p === "..." ? (
                                <span key={`e${i}`} className="px-1 text-xs text-muted-foreground/50">...</span>
                            ) : (
                                <button key={p} type="button" onClick={() => onPageChange(p)}
                                    className={`h-7 min-w-[28px] rounded-lg text-xs font-medium transition-all ${p === currentPage ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"}`}>
                                    {p}
                                </button>
                            )
                        );
                    })()}
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage >= totalPages} onClick={() => onPageChange(totalPages)}>
                        <ChevronsRight className="w-3.5 h-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
}
