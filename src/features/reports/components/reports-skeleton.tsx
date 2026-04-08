"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ReportsSkeleton() {
    return (
        <div className="space-y-4 sm:space-y-8">





            {/* P&L cards skeleton */}
            <div className="space-y-2 sm:space-y-4">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-4 sm:h-5 w-1 rounded-full" />
                    <Skeleton className="h-3 sm:h-4 w-32 sm:w-40" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 sm:h-36 rounded-xl sm:rounded-2xl" />
                    ))}
                </div>
            </div>

            {/* KPI cards skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 sm:h-28 rounded-xl sm:rounded-2xl" />
                ))}
            </div>

            {/* Tab selector skeleton */}
            <Skeleton className="h-9 sm:h-11 w-full sm:w-96 rounded-xl sm:rounded-2xl" />

            {/* Chart skeleton */}
            <Skeleton className="h-[200px] sm:h-[320px] rounded-xl sm:rounded-2xl" />

            {/* Bottom section skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Skeleton className="h-[200px] sm:h-[280px] rounded-xl sm:rounded-2xl" />
                <Skeleton className="h-[200px] sm:h-[280px] rounded-xl sm:rounded-2xl" />
            </div>
        </div>
    );
}
