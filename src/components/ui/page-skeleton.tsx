import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/60", className)} />;
}

/** Dashboard loading skeleton */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Bone className="h-7 w-40" />
        <Bone className="h-4 w-56" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-5 space-y-3">
            <div className="flex justify-between">
              <Bone className="h-10 w-10 rounded-xl" />
              <Bone className="h-4 w-12" />
            </div>
            <Bone className="h-8 w-32" />
            <Bone className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-2xl bg-white p-6 space-y-4">
          <Bone className="h-5 w-48" />
          <Bone className="h-[280px] w-full rounded-xl" />
        </div>
        <div className="lg:col-span-2 rounded-2xl bg-white p-6 space-y-4">
          <Bone className="h-5 w-36" />
          <Bone className="h-[180px] w-full rounded-full mx-auto max-w-[180px]" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Bone className="h-3 w-20" />
                <Bone className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Table page loading skeleton (products, transactions, etc) */
export function TablePageSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Bone className="h-7 w-48" />
          <Bone className="h-4 w-32" />
        </div>
        <Bone className="h-9 w-32 rounded-lg" />
      </div>
      {/* Table card */}
      <div className="rounded-2xl bg-white border border-border/40 overflow-hidden">
        {/* Table header bar */}
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
              <Bone className="h-9 w-9 rounded-lg" />
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

/** Form/settings page loading skeleton */
export function FormPageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Bone className="h-7 w-40" />
        <Bone className="h-4 w-56" />
      </div>
      <div className="rounded-2xl bg-white border border-border/40 p-6 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-4 w-24" />
            <Bone className="h-9 w-full rounded-lg" />
          </div>
        ))}
        <Bone className="h-10 w-28 rounded-lg" />
      </div>
    </div>
  );
}

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
