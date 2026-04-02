import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
    return <div className={cn("animate-pulse rounded-lg bg-gray-200/80", className)} />;
}

/** Shared header block: gradient icon + title/subtitle + optional right element */
function SkeletonHeader({ hasButton = false }: { hasButton?: boolean }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <Bone className="w-12 h-12 rounded-2xl shrink-0" />
                <div className="space-y-1.5">
                    <Bone className="h-7 w-48" />
                    <Bone className="h-4 w-64" />
                </div>
            </div>
            {hasButton && <Bone className="h-10 w-36 rounded-xl" />}
        </div>
    );
}

/** Shared stats pills row */
function StatsPills({ count = 4 }: { count?: number }) {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {Array.from({ length: count }).map((_, i) => (
                <Bone key={i} className="h-8 w-24 rounded-full" />
            ))}
        </div>
    );
}

/** Shared search bar */
function SearchBar() {
    return (
        <div className="flex items-center gap-3">
            <Bone className="h-10 flex-1 max-w-sm rounded-xl" />
        </div>
    );
}

// ─────────────────────────────────────────────
// 1. DashboardSkeleton
// ─────────────────────────────────────────────

/** Dashboard loading skeleton */
export function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* Welcome header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                    <Bone className="h-7 w-48" />
                    <div className="flex items-center gap-2">
                        <Bone className="h-3.5 w-3.5 rounded" />
                        <Bone className="h-4 w-56" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Bone className="h-9 w-28 rounded-full" />
                    <Bone className="h-9 w-32 rounded-full" />
                </div>
            </div>

            {/* KPI cards 3x2 */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white border border-border/30 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <Bone className="w-11 h-11 rounded-xl" />
                            <Bone className="h-5 w-14 rounded-full" />
                        </div>
                        <Bone className="h-8 w-36" />
                        <Bone className="h-3 w-28" />
                        <Bone className="h-3 w-20" />
                    </div>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Sales chart */}
                <div className="lg:col-span-3 rounded-2xl bg-white border border-border/30 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <Bone className="h-5 w-40" />
                        <div className="flex gap-1.5">
                            <Bone className="h-7 w-16 rounded-lg" />
                            <Bone className="h-7 w-16 rounded-lg" />
                        </div>
                    </div>
                    <Bone className="h-[280px] w-full rounded-xl" />
                </div>
                {/* Pie / breakdown */}
                <div className="lg:col-span-2 rounded-2xl bg-white border border-border/30 p-6 space-y-4">
                    <Bone className="h-5 w-36" />
                    <Bone className="h-[180px] w-[180px] rounded-full mx-auto" />
                    <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Bone className="h-3 w-3 rounded-full" />
                                    <Bone className="h-3 w-20" />
                                </div>
                                <Bone className="h-3 w-16" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-white border border-border/30 p-6 space-y-4">
                    <Bone className="h-5 w-36" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <Bone className="h-9 w-9 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <Bone className="h-4 w-32" />
                                <Bone className="h-3 w-20" />
                            </div>
                            <Bone className="h-4 w-24" />
                        </div>
                    ))}
                </div>
                {/* Top cashier */}
                <div className="rounded-2xl bg-white border border-border/30 p-6 space-y-4">
                    <Bone className="h-5 w-40" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <Bone className="h-8 w-8 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <Bone className="h-4 w-28" />
                                <Bone className="h-3 w-16" />
                            </div>
                            <Bone className="h-4 w-20" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// 2. TablePageSkeleton
// ─────────────────────────────────────────────

/** Table page loading skeleton (products, transactions, stock, purchases, stock-opname, stock-transfers, shifts) */
export function TablePageSkeleton() {
    return (
        <div className="space-y-5">
            {/* Header with gradient icon */}
            <SkeletonHeader hasButton />

            {/* Stats pills */}
            <StatsPills count={4} />

            {/* Table card */}
            <div className="rounded-2xl bg-white border border-border/40 overflow-hidden">
                {/* Table toolbar */}
                <div className="p-4 border-b border-border/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bone className="h-4 w-4 rounded" />
                        <Bone className="h-4 w-28" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Bone className="h-8 w-48 rounded-lg" />
                        <Bone className="h-8 w-8 rounded-lg" />
                        <Bone className="h-8 w-8 rounded-lg" />
                        <Bone className="h-8 w-8 rounded-lg" />
                    </div>
                </div>
                {/* Table rows */}
                <div className="divide-y divide-border/20">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="px-4 py-3 flex items-center gap-4">
                            <Bone className="h-4 w-4 rounded" />
                            <Bone className="h-9 w-9 rounded-lg shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <Bone className="h-4 w-40" />
                                <Bone className="h-3 w-24" />
                            </div>
                            <Bone className="h-5 w-16 rounded-full" />
                            <Bone className="h-4 w-20" />
                            <Bone className="h-4 w-20" />
                            <Bone className="h-7 w-14 rounded-lg" />
                        </div>
                    ))}
                </div>
                {/* Pagination */}
                <div className="p-4 border-t border-border/30 flex items-center justify-between">
                    <Bone className="h-4 w-32" />
                    <div className="flex items-center gap-1">
                        <Bone className="h-8 w-8 rounded-lg" />
                        <Bone className="h-8 w-8 rounded-lg" />
                        <Bone className="h-8 w-8 rounded-lg" />
                        <Bone className="h-8 w-8 rounded-lg" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// 3. CardGridSkeleton
// ─────────────────────────────────────────────

/** Card grid page skeleton (branches, users) */
export function CardGridSkeleton() {
    return (
        <div className="space-y-5">
            {/* Header */}
            <SkeletonHeader hasButton />

            {/* Stats pills */}
            <StatsPills count={3} />

            {/* Search bar */}
            <SearchBar />

            {/* 3-column card grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white border border-border/40 p-5 space-y-4">
                        {/* Card header with avatar/icon + actions */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <Bone className="h-11 w-11 rounded-xl shrink-0" />
                                <div className="space-y-1.5">
                                    <Bone className="h-5 w-32" />
                                    <Bone className="h-3 w-20" />
                                </div>
                            </div>
                            <Bone className="h-5 w-14 rounded-full" />
                        </div>
                        {/* Card details */}
                        <div className="space-y-2.5 pt-1">
                            <div className="flex items-center gap-2">
                                <Bone className="h-3.5 w-3.5 rounded shrink-0" />
                                <Bone className="h-3.5 w-40" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Bone className="h-3.5 w-3.5 rounded shrink-0" />
                                <Bone className="h-3.5 w-32" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Bone className="h-3.5 w-3.5 rounded shrink-0" />
                                <Bone className="h-3.5 w-36" />
                            </div>
                        </div>
                        {/* Card footer */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                            <Bone className="h-8 w-20 rounded-lg" />
                            <Bone className="h-8 w-20 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <Bone className="h-4 w-36" />
                <div className="flex items-center gap-1">
                    <Bone className="h-8 w-8 rounded-lg" />
                    <Bone className="h-8 w-8 rounded-lg" />
                    <Bone className="h-8 w-8 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// 4. CardListSkeleton
// ─────────────────────────────────────────────

/** Card list page skeleton (promotions, expenses, closing-reports) */
export function CardListSkeleton() {
    return (
        <div className="space-y-5">
            {/* Header */}
            <SkeletonHeader hasButton />

            {/* Stats pills */}
            <StatsPills count={4} />

            {/* Search + filter bar */}
            <div className="space-y-3">
                <SearchBar />
                <div className="flex items-center gap-1.5 flex-wrap">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Bone key={i} className="h-8 w-20 rounded-full" />
                    ))}
                </div>
            </div>

            {/* Horizontal card list */}
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white border border-border/40 p-5 flex items-center gap-5">
                        {/* Left: type icon */}
                        <Bone className="h-12 w-12 rounded-xl shrink-0" />
                        {/* Center: details */}
                        <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                                <Bone className="h-5 w-40" />
                                <Bone className="h-5 w-16 rounded-full" />
                            </div>
                            <div className="flex items-center gap-4">
                                <Bone className="h-3.5 w-28" />
                                <Bone className="h-3.5 w-24" />
                            </div>
                        </div>
                        {/* Right: value + actions */}
                        <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right space-y-1">
                                <Bone className="h-6 w-24" />
                                <Bone className="h-3 w-16 ml-auto" />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Bone className="h-8 w-8 rounded-lg" />
                                <Bone className="h-8 w-8 rounded-lg" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <Bone className="h-4 w-36" />
                <div className="flex items-center gap-1">
                    <Bone className="h-8 w-8 rounded-lg" />
                    <Bone className="h-8 w-8 rounded-lg" />
                    <Bone className="h-8 w-8 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// 5. TimelineSkeleton
// ─────────────────────────────────────────────

/** Timeline page skeleton (audit log) */
export function TimelineSkeleton() {
    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Bone className="w-12 h-12 rounded-2xl shrink-0" />
                    <div className="space-y-1.5">
                        <Bone className="h-7 w-36" />
                        <Bone className="h-4 w-56" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Bone className="h-8 w-28 rounded-lg" />
                    <Bone className="h-8 w-28 rounded-lg" />
                </div>
            </div>

            {/* Stats pills */}
            <StatsPills count={4} />

            {/* Filter bar card */}
            <div className="rounded-xl border border-border/40 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Bone className="h-3.5 w-3.5 rounded" />
                    <Bone className="h-3.5 w-12" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Bone className="h-9 flex-1 min-w-[200px] rounded-xl" />
                    <Bone className="h-9 w-[150px] rounded-xl" />
                    <Bone className="h-9 w-[130px] rounded-xl" />
                    <Bone className="h-9 w-9 rounded-xl" />
                </div>
            </div>

            {/* Timeline items grouped by date */}
            <div className="space-y-4">
                {/* Date header */}
                <div className="flex items-center gap-3">
                    <Bone className="h-4 w-4 rounded" />
                    <Bone className="h-4 w-32" />
                    <div className="flex-1 h-px bg-gray-100" />
                </div>

                {/* Timeline entries */}
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl bg-white border border-border/40 p-4 flex items-start gap-4">
                        {/* Action icon */}
                        <Bone className="h-9 w-9 rounded-xl shrink-0" />
                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                                <Bone className="h-4 w-48" />
                                <Bone className="h-5 w-14 rounded-full" />
                            </div>
                            <div className="flex items-center gap-3">
                                <Bone className="h-3 w-20" />
                                <Bone className="h-3 w-24" />
                                <Bone className="h-3 w-16" />
                            </div>
                        </div>
                        {/* Right: timestamp + expand */}
                        <div className="flex items-center gap-2 shrink-0">
                            <Bone className="h-3 w-16" />
                            <Bone className="h-7 w-7 rounded-lg" />
                        </div>
                    </div>
                ))}

                {/* Second date group */}
                <div className="flex items-center gap-3">
                    <Bone className="h-4 w-4 rounded" />
                    <Bone className="h-4 w-28" />
                    <div className="flex-1 h-px bg-gray-100" />
                </div>

                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={`g2-${i}`} className="rounded-xl bg-white border border-border/40 p-4 flex items-start gap-4">
                        <Bone className="h-9 w-9 rounded-xl shrink-0" />
                        <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                                <Bone className="h-4 w-40" />
                                <Bone className="h-5 w-14 rounded-full" />
                            </div>
                            <div className="flex items-center gap-3">
                                <Bone className="h-3 w-20" />
                                <Bone className="h-3 w-20" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Bone className="h-3 w-16" />
                            <Bone className="h-7 w-7 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <Bone className="h-4 w-36" />
                <div className="flex items-center gap-1">
                    <Bone className="h-8 w-8 rounded-lg" />
                    <Bone className="h-8 w-8 rounded-lg" />
                    <Bone className="h-8 w-8 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// 6. FormPageSkeleton
// ─────────────────────────────────────────────

/** Form/settings page loading skeleton */
export function FormPageSkeleton() {
    return (
        <div className="space-y-5">
            {/* Header with gradient icon */}
            <div className="flex items-center gap-4">
                <Bone className="w-12 h-12 rounded-2xl shrink-0" />
                <div className="space-y-1.5">
                    <Bone className="h-7 w-40" />
                    <Bone className="h-4 w-56" />
                </div>
            </div>
            {/* Form card */}
            <div className="rounded-2xl bg-white border border-border/40 p-6 space-y-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Bone className="h-4 w-24" />
                        <Bone className="h-9 w-full rounded-lg" />
                    </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Bone className="h-4 w-20" />
                        <Bone className="h-9 w-full rounded-lg" />
                    </div>
                    <div className="space-y-2">
                        <Bone className="h-4 w-20" />
                        <Bone className="h-9 w-full rounded-lg" />
                    </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                    <Bone className="h-10 w-28 rounded-lg" />
                    <Bone className="h-10 w-20 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// 7. POSSkeleton
// ─────────────────────────────────────────────

/** POS fullscreen loading skeleton */
export function POSSkeleton() {
    return (
        <div className="flex h-screen bg-[#F1F5F9]">
            {/* Left panel */}
            <div className="w-[320px] bg-white border-r border-border/40 flex flex-col shrink-0">
                <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                    <Bone className="h-8 w-8 rounded-lg" />
                    <div className="text-center space-y-1">
                        <Bone className="h-4 w-20 mx-auto" />
                        <Bone className="h-3 w-28 mx-auto" />
                    </div>
                    <Bone className="h-8 w-8 rounded-lg" />
                </div>
                <div className="px-3 py-2 border-b border-border/20">
                    <div className="flex gap-1.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Bone key={i} className="h-7 w-16 rounded-full shrink-0" />
                        ))}
                    </div>
                </div>
                <div className="flex-1 px-3 py-3">
                    <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-border/40 overflow-hidden">
                                <Bone className="aspect-square w-full" />
                                <div className="p-2.5 space-y-1.5">
                                    <Bone className="h-3 w-full" />
                                    <Bone className="h-3 w-12" />
                                    <Bone className="h-4 w-16" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Center panel */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="px-5 py-3 bg-white border-b border-border/40">
                    <Bone className="h-12 w-full rounded-xl" />
                </div>
                <div className="flex-1 px-5 py-3">
                    <div className="bg-white rounded-2xl border border-border/40 h-full p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <Bone className="h-4 w-4 rounded" />
                            <Bone className="h-4 w-20" />
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center space-y-2">
                                <Bone className="h-14 w-14 rounded-xl mx-auto" />
                                <Bone className="h-4 w-28 mx-auto" />
                                <Bone className="h-3 w-40 mx-auto" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Right panel */}
            <div className="w-[340px] bg-white border-l border-border/40 p-5 space-y-4">
                <div className="space-y-2.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex justify-between">
                            <Bone className="h-4 w-16" />
                            <Bone className="h-4 w-20" />
                        </div>
                    ))}
                </div>
                <Bone className="h-24 w-full rounded-xl" />
                <div className="space-y-2">
                    <Bone className="h-3 w-12" />
                    <Bone className="h-8 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                    <Bone className="h-3 w-12" />
                    <Bone className="h-8 w-full rounded-lg" />
                </div>
                <div className="mt-auto pt-4">
                    <Bone className="h-14 w-full rounded-xl" />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// 8. BranchPricesSkeleton
// ─────────────────────────────────────────────

/** Branch prices page skeleton */
export function BranchPricesSkeleton() {
    return (
        <div className="space-y-5">
            {/* Header */}
            <SkeletonHeader hasButton />

            {/* Stats pills */}
            <StatsPills count={3} />

            {/* Branch selector + search */}
            <div className="flex items-center gap-3 flex-wrap">
                <Bone className="h-10 w-[200px] rounded-xl" />
                <Bone className="h-10 flex-1 max-w-sm rounded-xl" />
            </div>

            {/* Product price cards */}
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white border border-border/40 p-4 flex items-center gap-4">
                        {/* Left: product icon */}
                        <Bone className="h-12 w-12 rounded-xl shrink-0" />
                        {/* Center: product info */}
                        <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                                <Bone className="h-4 w-36" />
                                <Bone className="h-4 w-16 rounded-full" />
                            </div>
                            <div className="flex items-center gap-3">
                                <Bone className="h-3 w-20" />
                                <Bone className="h-3 w-24" />
                            </div>
                        </div>
                        {/* Right: prices */}
                        <div className="flex items-center gap-6 shrink-0">
                            <div className="text-right space-y-1">
                                <Bone className="h-3 w-16 ml-auto" />
                                <Bone className="h-5 w-24" />
                            </div>
                            <div className="text-right space-y-1">
                                <Bone className="h-3 w-20 ml-auto" />
                                <Bone className="h-5 w-24" />
                            </div>
                            <Bone className="h-8 w-8 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <Bone className="h-4 w-36" />
                <div className="flex items-center gap-1">
                    <Bone className="h-8 w-8 rounded-lg" />
                    <Bone className="h-8 w-8 rounded-lg" />
                    <Bone className="h-8 w-8 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// 9. ReportSkeleton
// ─────────────────────────────────────────────

/** Reports / analytics / customer-intelligence page skeleton */
export function ReportSkeleton() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1.5">
                    <Bone className="h-8 w-52" />
                    <Bone className="h-4 w-72" />
                </div>
                <div className="flex gap-2">
                    <Bone className="h-9 w-28 rounded-xl" />
                    <Bone className="h-9 w-28 rounded-xl" />
                </div>
            </div>

            {/* Date range filter bar */}
            <div className="rounded-2xl bg-white border border-border/40 p-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <Bone className="h-8 w-20 rounded-lg" />
                    <Bone className="h-9 w-[180px] rounded-xl" />
                    <Bone className="h-4 w-8" />
                    <Bone className="h-9 w-[180px] rounded-xl" />
                    <Bone className="h-8 w-24 rounded-xl" />
                </div>
            </div>

            {/* Section label */}
            <div className="flex items-center gap-2">
                <Bone className="h-5 w-1 rounded-full" />
                <Bone className="h-4 w-40" />
            </div>

            {/* 4 stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white border border-border/40 p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <Bone className="h-10 w-10 rounded-xl" />
                            <Bone className="h-5 w-16 rounded-lg" />
                        </div>
                        <Bone className="h-8 w-36" />
                        <Bone className="h-3 w-40" />
                    </div>
                ))}
            </div>

            {/* 2 charts side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-white border border-border/40 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <Bone className="h-5 w-44" />
                        <Bone className="h-8 w-24 rounded-lg" />
                    </div>
                    <Bone className="h-[260px] w-full rounded-xl" />
                </div>
                <div className="rounded-2xl bg-white border border-border/40 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <Bone className="h-5 w-40" />
                        <Bone className="h-8 w-24 rounded-lg" />
                    </div>
                    <Bone className="h-[260px] w-full rounded-xl" />
                </div>
            </div>

            {/* Bottom list / table (e.g. top products) */}
            <div className="rounded-2xl bg-white border border-border/40 overflow-hidden">
                <div className="p-5 border-b border-border/30 flex items-center justify-between">
                    <Bone className="h-5 w-36" />
                    <Bone className="h-8 w-28 rounded-lg" />
                </div>
                <div className="divide-y divide-border/20">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                            <Bone className="h-8 w-8 rounded-lg shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <Bone className="h-4 w-40" />
                                <Bone className="h-3 w-20" />
                            </div>
                            <Bone className="h-4 w-20" />
                            <Bone className="h-4 w-24" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Legacy: DetailPageSkeleton (kept for compatibility)
// ─────────────────────────────────────────────

/** Closing reports / detail page skeleton */
export function DetailPageSkeleton() {
    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2">
                <Bone className="h-6 w-6 rounded" />
                <Bone className="h-7 w-48" />
            </div>
            <Bone className="h-4 w-64" />
            {/* Table */}
            <div className="rounded-2xl bg-white border border-border/40 overflow-hidden">
                <div className="p-4 border-b border-border/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bone className="h-4 w-4 rounded" />
                        <Bone className="h-4 w-28" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Bone className="h-8 w-48 rounded-lg" />
                        <Bone className="h-8 w-8 rounded-lg" />
                        <Bone className="h-8 w-8 rounded-lg" />
                    </div>
                </div>
                <div className="divide-y divide-border/20">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="px-4 py-3 flex items-center gap-4">
                            <div className="flex-1 space-y-1.5">
                                <Bone className="h-4 w-32" />
                                <Bone className="h-3 w-20" />
                            </div>
                            <Bone className="h-4 w-24" />
                            <Bone className="h-4 w-24" />
                            <Bone className="h-5 w-16 rounded-full" />
                            <Bone className="h-7 w-20 rounded-lg" />
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-border/30 flex items-center justify-between">
                    <Bone className="h-4 w-32" />
                    <div className="flex items-center gap-1">
                        <Bone className="h-8 w-8 rounded-lg" />
                        <Bone className="h-8 w-8 rounded-lg" />
                        <Bone className="h-8 w-8 rounded-lg" />
                    </div>
                </div>
            </div>
        </div>
    );
}
