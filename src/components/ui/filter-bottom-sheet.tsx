"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  count?: number | undefined;
  borderColor?: string | undefined;
}

export interface FilterSection {
  key: string;
  label: string;
  type?: "select" | "text" | "date" | "daterange";
  options?: FilterOption[];
  allLabel?: string;
}

interface FilterBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  sections: FilterSection[];
  values: Record<string, string>;
  onApply: (values: Record<string, string>) => void;
  /** If true, clicking an option immediately applies and closes the sheet */
  immediate?: boolean;
  /** Accent color for active states (default: "primary") */
  accentColor?: string;
}

export function FilterBottomSheet({
  open,
  onOpenChange,
  title: _title,
  sections,
  values,
  onApply,
  immediate = false,
  accentColor,
}: FilterBottomSheetProps) {
  const [temp, setTemp] = useState<Record<string, string>>(values);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Sync temp with external values when sheet opens
  useEffect(() => {
    if (open) {
      setTemp(values);
      // Default: expand all sections
      const all: Record<string, boolean> = {};
      sections.forEach((s) => { all[s.key] = true; });
      setExpanded(all);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (key: string, value: string) => {
    const next = { ...temp, [key]: value };
    setTemp(next);
    if (immediate) {
      onApply(next);
      onOpenChange(false);
    }
  };

  const handleReset = () => {
    const empty: Record<string, string> = {};
    sections.forEach((s) => {
      if (s.type === "daterange") {
        empty[`${s.key}_from`] = "";
        empty[`${s.key}_to`] = "";
      } else {
        empty[s.key] = "ALL";
      }
    });
    setTemp(empty);
    onApply(empty);
    onOpenChange(false);
  };

  const handleApply = () => {
    onApply(temp);
    onOpenChange(false);
  };

  // Active accent classes
  const activeClasses = accentColor
    ? `bg-${accentColor}-50 text-${accentColor}-700 ring-1 ring-${accentColor}-200`
    : "bg-primary/10 text-primary ring-1 ring-primary/20";
  const activeBadgeClasses = accentColor
    ? `bg-${accentColor}-200/60 text-${accentColor}-700`
    : "bg-primary/10 text-primary";
  const activeCheckClasses = accentColor
    ? `text-${accentColor}-600`
    : "text-primary";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-2 max-h-[80vh] flex flex-col" showCloseButton={false}>
        <div className="shrink-0">
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
          </div>
          {/* <SheetHeader className="px-4 pb-3 pt-0">
            <SheetTitle className="text-base font-bold">{title}</SheetTitle>
          </SheetHeader> */}
        </div>

        <div className="flex-1 overflow-y-auto">
          {sections.map((section, idx) => {
            const isExpanded = expanded[section.key] ?? false;
            const type = section.type ?? "select";
            const currentVal = temp[section.key];
            const selectedLabel = type === "select" && currentVal && currentVal !== "ALL"
              ? section.options?.find((o) => o.value === currentVal)?.label
              : null;
            const hasDateVal = type === "date" && temp[section.key];
            const hasRangeVal = type === "daterange" && (temp[`${section.key}_from`] || temp[`${section.key}_to`]);
            const hasTextVal = type === "text" && temp[section.key];

            return (
              <div key={section.key} className={idx < sections.length - 1 ? "border-b border-border/20" : ""}>
                {/* Sticky section header */}
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                  className="w-full flex items-center justify-between py-3 px-4 sticky top-0 z-10 bg-background/95 backdrop-blur-sm"
                >
                  <span className="text-sm font-semibold text-foreground">{section.label}</span>
                  <div className="flex items-center gap-1.5">
                    {selectedLabel && (
                      <span className={cn("text-[11px] font-medium rounded-full px-2 py-0.5", activeBadgeClasses)}>{selectedLabel}</span>
                    )}
                    {hasDateVal && (
                      <span className={cn("text-[11px] font-medium rounded-full px-2 py-0.5", activeBadgeClasses)}>{temp[section.key]}</span>
                    )}
                    {hasRangeVal && (
                      <span className={cn("text-[11px] font-medium rounded-full px-2 py-0.5", activeBadgeClasses)}>Terpilih</span>
                    )}
                    {hasTextVal && (
                      <span className={cn("text-[11px] font-medium rounded-full px-2 py-0.5 max-w-[80px] truncate", activeBadgeClasses)}>{temp[section.key]}</span>
                    )}
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                  </div>
                </button>

                {/* Collapsible content */}
                {isExpanded && (
                  <div className="px-4 pb-3">
                    {type === "select" && section.options && (
                      <div className="space-y-1">
                        <button
                          onClick={() => handleSelect(section.key, "ALL")}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                            (!currentVal || currentVal === "ALL") ? activeClasses : "bg-muted/30 text-foreground hover:bg-muted/60"
                          )}
                        >
                          <span>{section.allLabel ?? "Semua"}</span>
                          {(!currentVal || currentVal === "ALL") && <Check className={cn("w-4 h-4", activeCheckClasses)} />}
                        </button>
                        {section.options.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleSelect(section.key, opt.value)}
                            className={cn(
                              "w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                              opt.borderColor && `border-l-4 ${opt.borderColor}`,
                              currentVal === opt.value ? activeClasses : "bg-muted/30 text-foreground hover:bg-muted/60"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              {opt.label}
                              {opt.count != null && (
                                <span className={cn(
                                  "text-[11px] font-bold min-w-[20px] h-5 rounded-full inline-flex items-center justify-center px-1.5",
                                  currentVal === opt.value ? activeBadgeClasses : "bg-muted text-muted-foreground"
                                )}>{opt.count}</span>
                              )}
                            </span>
                            {currentVal === opt.value && <Check className={cn("w-4 h-4", activeCheckClasses)} />}
                          </button>
                        ))}
                      </div>
                    )}
                    {type === "text" && (
                      <Input
                        value={temp[section.key] || ""}
                        onChange={(e) => setTemp({ ...temp, [section.key]: e.target.value })}
                        className="w-full rounded-xl"
                        placeholder={`Cari ${section.label.toLowerCase()}...`}
                      />
                    )}
                    {type === "date" && (
                      <DatePicker
                        value={temp[section.key] || ""}
                        onChange={(v) => setTemp({ ...temp, [section.key]: v })}
                        className="w-full"
                      />
                    )}
                    {type === "daterange" && (
                      <DateRangePicker
                        from={temp[`${section.key}_from`] || ""}
                        to={temp[`${section.key}_to`] || ""}
                        onChange={(f, t) => setTemp({ ...temp, [`${section.key}_from`]: f, [`${section.key}_to`]: t })}
                        placeholder="Pilih rentang tanggal"
                        className="w-full"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!immediate && (
          <SheetFooter className="shrink-0 border-t px-4 py-3 flex-row gap-2">
            <Button variant="outline" className="flex-1 rounded-xl h-10 text-sm" onClick={handleReset}>
              Reset
            </Button>
            <Button className="flex-1 rounded-xl h-10 text-sm shadow-md" onClick={handleApply}>
              Terapkan
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
