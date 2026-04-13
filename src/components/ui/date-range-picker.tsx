"use client";

import { useState, useCallback, useEffect } from "react";
import { CalendarIcon, X, ArrowRight, Check } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { format, isToday, isYesterday, differenceInDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface DateRangePickerProps {
  from?: string | undefined;
  to?: string | undefined;
  onChange: (from: string, to: string) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
  presets?: boolean;
}

interface PresetItem {
  key: string;
  label: string;
  getValue: () => { from: string; to: string };
}

const PRESETS: PresetItem[] = [
  {
    key: "today",
    label: "Hari Ini",
    getValue: () => { const d = format(new Date(), "yyyy-MM-dd"); return { from: d, to: d }; },
  },
  {
    key: "yesterday",
    label: "Kemarin",
    getValue: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = format(d, "yyyy-MM-dd"); return { from: s, to: s }; },
  },
  {
    key: "7days",
    label: "7 Hari",
    getValue: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6); return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }; },
  },
  {
    key: "30days",
    label: "30 Hari",
    getValue: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29); return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") }; },
  },
  {
    key: "this-month",
    label: "Bulan Ini",
    getValue: () => { const now = new Date(); return { from: format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") }; },
  },
  {
    key: "last-month",
    label: "Bulan Lalu",
    getValue: () => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth() - 1, 1); const end = new Date(now.getFullYear(), now.getMonth(), 0); return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd") }; },
  },
];

function getSmartLabel(fromDate: Date | undefined, toDate: Date | undefined, from: string, to: string): string {
  if (!fromDate) return "";
  if (!toDate || from === to) {
    if (isToday(fromDate)) return "Hari Ini";
    if (isYesterday(fromDate)) return "Kemarin";
    return format(fromDate, "dd MMM yyyy", { locale: idLocale });
  }
  const days = differenceInDays(toDate, fromDate) + 1;
  if (days === 7 && isToday(toDate)) return "7 Hari Terakhir";
  if (days === 30 && isToday(toDate)) return "30 Hari Terakhir";
  if (fromDate.getMonth() === toDate.getMonth() && fromDate.getFullYear() === toDate.getFullYear()) {
    return `${format(fromDate, "dd", { locale: idLocale })} - ${format(toDate, "dd MMM yyyy", { locale: idLocale })}`;
  }
  return `${format(fromDate, "dd MMM", { locale: idLocale })} - ${format(toDate, "dd MMM yyyy", { locale: idLocale })}`;
}

function SelectedRangeHeader({ fromDate, toDate, from, to }: { fromDate: Date | undefined; toDate: Date | undefined; from: string; to: string }) {
  if (!from) return null;
  return (
    <div className="px-4 py-2.5 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/30">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium text-primary">{fromDate ? format(fromDate, "dd MMM yyyy", { locale: idLocale }) : ""}</span>
        {from !== to && (
          <>
            <ArrowRight className="w-3 h-3 text-primary/50" />
            <span className="font-medium text-primary">{toDate ? format(toDate, "dd MMM yyyy", { locale: idLocale }) : ""}</span>
          </>
        )}
        {fromDate && toDate && from !== to && (
          <span className="text-muted-foreground ml-auto">({differenceInDays(toDate, fromDate) + 1} hari)</span>
        )}
      </div>
    </div>
  );
}

function PresetChips({ presets, from, to, onSelect }: { presets: PresetItem[]; from: string; to: string; onSelect: (p: PresetItem) => void }) {
  return (
    <div className="flex gap-1.5 px-3 py-2.5 border-b border-border/30 overflow-x-auto scrollbar-none">
      {presets.map((p) => {
        const pv = p.getValue();
        const isActive = !!from && pv.from === from && pv.to === to;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onSelect(p)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-accent/60 text-foreground hover:bg-accent",
            )}
          >
            {isActive && <Check className="w-3 h-3" />}
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function ActionBar({ pendingRange, onReset, onApply }: { pendingRange: DateRange | undefined; onReset: () => void; onApply: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30 bg-muted/20">
      <div className="text-[11px] text-muted-foreground">
        {pendingRange?.from && pendingRange?.to ? (
          <span>
            {format(pendingRange.from, "dd MMM", { locale: idLocale })}
            {" → "}
            {format(pendingRange.to, "dd MMM yyyy", { locale: idLocale })}
            <span className="ml-1.5 text-muted-foreground/60">({differenceInDays(pendingRange.to, pendingRange.from) + 1} hari)</span>
          </span>
        ) : pendingRange?.from ? (
          <span>Pilih tanggal akhir...</span>
        ) : (
          <span>Pilih tanggal mulai...</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg px-3" onClick={onReset}>
          Reset
        </Button>
        <Button size="sm" className="h-7 text-xs rounded-lg px-4 shadow-sm" onClick={onApply} disabled={!pendingRange?.from}>
          Terapkan
        </Button>
      </div>
    </div>
  );
}

export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = "Pilih tanggal",
  className,
  align = "start",
  presets = true,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);
  const isMobile = useMediaQuery("(max-width: 639px)");

  const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
  const toDate = to ? new Date(`${to}T00:00:00`) : undefined;
  const hasValue = !!from;

  useEffect(() => {
    if (open) {
      setPendingRange(fromDate ? { from: fromDate, to: toDate ?? fromDate } : undefined);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreset = useCallback((preset: PresetItem) => {
    const { from: f, to: t } = preset.getValue();
    onChange(f, t);
    setOpen(false);
  }, [onChange]);

  const handleCalendarSelect = useCallback((selected: DateRange | undefined) => {
    setPendingRange(selected);
  }, []);

  const handleApply = useCallback(() => {
    if (pendingRange?.from) {
      const f = format(pendingRange.from, "yyyy-MM-dd");
      const t = pendingRange.to ? format(pendingRange.to, "yyyy-MM-dd") : f;
      onChange(f, t);
    }
    setOpen(false);
  }, [pendingRange, onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange("", "");
    setOpen(false);
  }, [onChange]);

  const label = hasValue ? getSmartLabel(fromDate, toDate, from!, to!) : placeholder;

  // Trigger button (shared)
  const triggerButton = (
    <div className={cn("relative inline-flex group", className)}>
      <Button
        variant="outline"
        className={cn(
          "justify-start text-left font-normal gap-2 w-full",
          !hasValue && "text-muted-foreground",
          hasValue && "pr-8",
        )}
        onClick={isMobile ? () => setOpen(true) : undefined}
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-50" />
        <span className="truncate text-xs">{label}</span>
      </Button>
      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-muted transition-all z-10"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  // ─── Mobile: Sheet (bottom) ───
  if (isMobile) {
    return (
      <>
        {triggerButton}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-0 max-h-[85vh] flex flex-col">
            {/* Title */}
            <div className="px-4 pb-2 border-b border-border/30 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-3" />
              <h3 className="text-sm font-semibold">Pilih Rentang Tanggal</h3>
            </div>

            {/* Selected range */}
            <SelectedRangeHeader fromDate={fromDate} toDate={toDate} from={from || ""} to={to || ""} />

            {/* Preset chips */}
            {presets && (
              <PresetChips presets={PRESETS} from={from || ""} to={to || ""} onSelect={handlePreset} />
            )}

            {/* Calendar - full width */}
            <div className="flex-1 overflow-y-auto">
              <Calendar
                mode="range"
                selected={pendingRange}
                onSelect={handleCalendarSelect}
                numberOfMonths={1}
                locale={idLocale}
                className="w-full p-3 [--cell-size:--spacing(10)]"
                classNames={{ root: "w-full", month: "w-full", month_grid: "w-full" }}
              />
            </div>

            {/* Action bar */}
            <div className="shrink-0">
              <ActionBar pendingRange={pendingRange} onReset={() => setPendingRange(undefined)} onApply={handleApply} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // ─── Desktop: Popover ───
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative inline-flex group", className)}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal gap-2 w-full",
              !hasValue && "text-muted-foreground",
              hasValue && "pr-8",
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-50" />
            <span className="truncate text-xs">{label}</span>
          </Button>
        </PopoverTrigger>
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-muted transition-all z-10"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-border/50 overflow-hidden" align={align} sideOffset={8}>
        <SelectedRangeHeader fromDate={fromDate} toDate={toDate} from={from || ""} to={to || ""} />

        <div className="flex">
          {/* Presets sidebar */}
          {presets && (
            <div className="border-r border-border/30 w-[170px] shrink-0">
              <div className="p-1.5 space-y-0.5 max-h-[340px] overflow-y-auto">
                {PRESETS.map((p) => {
                  const pv = p.getValue();
                  const isActive = hasValue && pv.from === from && pv.to === to;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handlePreset(p)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-xl transition-all duration-150",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:bg-accent/70",
                      )}
                    >
                      <span className={cn("text-xs font-medium", isActive ? "" : "text-foreground")}>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Calendar panel */}
          <div className="flex flex-col">
            <Calendar
              mode="range"
              selected={pendingRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              locale={idLocale}
              initialFocus
            />
            <ActionBar pendingRange={pendingRange} onReset={() => setPendingRange(undefined)} onApply={handleApply} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
