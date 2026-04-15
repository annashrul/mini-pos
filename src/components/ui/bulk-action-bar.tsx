"use client";

import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface BulkActionBarProps {
  selectedCount: number;
  actions: { label: string; icon?: ReactNode; onClick: () => void; variant?: "default" | "destructive" }[];
  onClear: () => void;
}

export function BulkActionBar({ selectedCount, actions, onClear }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-2 sm:gap-3 px-4 py-3 bg-white text-foreground rounded-2xl shadow-xl border-2 border-primary">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">{selectedCount}</span>
          <span className="text-xs font-medium hidden sm:inline">dipilih</span>
        </div>
        <div className="h-4 w-px bg-border shrink-0" />
        <div className="flex items-center gap-1.5 flex-1">
          {actions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant === "destructive" ? "destructive" : "secondary"}
              size="sm"
              className="rounded-lg h-8 text-xs gap-1.5"
              onClick={action.onClick}
            >
              {action.icon} {action.label}
            </Button>
          ))}
        </div>
        <button onClick={onClear} className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0" title="Batalkan pilihan">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
