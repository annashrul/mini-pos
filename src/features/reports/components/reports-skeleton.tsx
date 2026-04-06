"use client";

export function ReportsSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-slate-200 rounded-lg" />
          <div className="h-4 w-72 bg-slate-100 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-slate-100 rounded-xl" />
          <div className="h-9 w-28 bg-slate-100 rounded-xl" />
        </div>
      </div>
      {/* Filter bar skeleton */}
      <div className="rounded-2xl border border-border/40 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-20 bg-slate-100 rounded-lg" />
          <div className="h-8 w-[180px] bg-slate-100 rounded-xl" />
          <div className="h-3 w-6 bg-slate-100 rounded" />
          <div className="h-8 w-[180px] bg-slate-100 rounded-xl" />
          <div className="h-8 w-24 bg-slate-200 rounded-xl" />
        </div>
      </div>
      {/* P&L stat cards skeleton */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-1 bg-slate-200 rounded-full" />
          <div className="h-4 w-40 bg-slate-200 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-slate-50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                <div className="h-5 w-16 bg-slate-200 rounded-lg" />
              </div>
              <div className="h-8 w-36 bg-slate-200 rounded-lg" />
              <div className="h-3 w-28 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
      {/* Overview cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/30 bg-white p-4 space-y-3">
            <div className="w-9 h-9 bg-slate-100 rounded-xl" />
            <div className="h-6 w-20 bg-slate-200 rounded" />
            <div className="h-3 w-16 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      {/* Chart area skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border/30 bg-white p-6 space-y-4">
          <div className="h-5 w-44 bg-slate-200 rounded" />
          <div className="h-[280px] bg-slate-50 rounded-xl" />
        </div>
        <div className="rounded-2xl border border-border/30 bg-white p-6 space-y-4">
          <div className="h-5 w-44 bg-slate-200 rounded" />
          <div className="h-[280px] bg-slate-50 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
