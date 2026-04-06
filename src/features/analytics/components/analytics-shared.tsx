"use client";

import { TableRow, TableCell } from "@/components/ui/table";
import { ACCENT_COLORS } from "@/features/analytics/utils";

/* ─── Rank badge helper ─── */
export function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 font-bold text-xs ring-2 ring-amber-200">1</span>;
  if (rank === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-xs ring-2 ring-slate-200">2</span>;
  if (rank === 3) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-bold text-xs ring-2 ring-orange-200">3</span>;
  return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-50 text-slate-400 font-semibold text-xs">{rank}</span>;
}

/* ─── Section header helper ─── */
export function SectionHeader({ icon: Icon, title, description, accentColor = "blue" }: { icon: React.ElementType; title: string; description?: string; accentColor?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-1 h-8 rounded-full ${ACCENT_COLORS[accentColor] || ACCENT_COLORS.blue}`} />
      <Icon className="w-5 h-5 text-slate-500" />
      <div>
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>
    </div>
  );
}

/* ─── Empty state helper ─── */
export function EmptyState({ icon: Icon, message, colSpan }: { icon: React.ElementType; message: string; colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-40">
        <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
            <Icon className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm">{message}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}

/* ─── Custom tooltip for charts ─── */
export function ChartTooltipContent({ active, payload, label, formatValue }: { active?: boolean; payload?: ReadonlyArray<{ value?: unknown; name?: unknown; color?: string | number }>; label?: unknown; formatValue?: (value: number, name: string) => [string, string] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-slate-100 shadow-xl px-4 py-3 min-w-[160px]">
      <p className="text-xs font-medium text-slate-500 mb-2">{String(label ?? "")}</p>
      {payload.map((entry, i) => {
        const rawValue = Array.isArray(entry.value) ? entry.value[0] : entry.value;
        const value = Number(rawValue ?? 0);
        const name = String(entry.name ?? "");
        const [formattedValue, displayName] = formatValue
          ? formatValue(value, name)
          : [String(value), name];
        return (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: String(entry.color ?? "#94a3b8") }} />
              <span className="text-slate-600">{displayName}</span>
            </div>
            <span className="font-semibold text-slate-800">{formattedValue}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Loading skeleton ─── */
export function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-xl" />
          <div>
            <div className="h-7 w-52 bg-slate-200 rounded-lg" />
            <div className="h-4 w-72 bg-slate-100 rounded-lg mt-1" />
          </div>
        </div>
      </div>
      {/* KPI summary cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/30 bg-white p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-3 w-24 bg-slate-100 rounded" />
                <div className="h-8 w-16 bg-slate-200 rounded-lg" />
                <div className="h-3 w-32 bg-slate-100 rounded" />
              </div>
              <div className="w-12 h-12 bg-slate-100 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
      {/* Tabs skeleton */}
      <div className="flex gap-1 bg-slate-100/80 rounded-2xl p-1.5 overflow-x-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-28 bg-slate-200/60 rounded-xl shrink-0" />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-2xl border border-border/30 bg-white p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-slate-200 rounded-full" />
          <div className="w-5 h-5 bg-slate-100 rounded" />
          <div className="h-5 w-36 bg-slate-200 rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-7 h-7 bg-slate-100 rounded-full" />
              <div className="h-4 flex-1 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-50 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Tab content loading skeleton ─── */
export function TabLoadingSkeleton() {
  return (
    <div className="rounded-2xl border border-border/30 bg-white p-6 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-1 h-8 bg-slate-200 rounded-full" />
        <div className="w-5 h-5 bg-slate-100 rounded" />
        <div className="h-5 w-36 bg-slate-200 rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-7 h-7 bg-slate-100 rounded-full" />
            <div className="h-4 flex-1 bg-slate-100 rounded" />
            <div className="h-4 w-20 bg-slate-100 rounded" />
            <div className="h-4 w-20 bg-slate-50 rounded" />
            <div className="h-4 w-16 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
