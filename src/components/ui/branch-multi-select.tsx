"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";

interface Branch {
    id: string;
    name: string;
}

interface BranchMultiSelectProps {
    branches: Branch[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    className?: string;
}

export function BranchMultiSelect({ branches, value, onChange, placeholder = "Pilih lokasi", className }: BranchMultiSelectProps) {
    const [open, setOpen] = useState(false);
    const allSelected = value.length === branches.length;

    const toggleAll = () => {
        onChange(allSelected ? [] : branches.map((b) => b.id));
    };

    const toggleBranch = (id: string) => {
        onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
    };

    const label = value.length === 0
        ? placeholder
        : allSelected
            ? "Semua Lokasi"
            : value.length === 1
                ? branches.find((b) => b.id === value[0])?.name ?? "1 lokasi"
                : `${value.length} lokasi dipilih`;

    return (
        <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between rounded-lg font-normal h-9 text-sm", !value.length && "text-muted-foreground", className)}
                >
                    <span className="flex items-center gap-2 truncate">
                        <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        {label}
                    </span>
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[--radix-popover-trigger-width] p-1 rounded-xl z-[60]"
                align="start"
                onWheel={(e) => e.stopPropagation()}
            >
                {/* Select all */}
                <button
                    type="button"
                    onClick={toggleAll}
                    className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent font-medium",
                        allSelected && "bg-primary/5 text-primary"
                    )}
                >
                    <div className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        allSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                    )}>
                        {allSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    Semua Lokasi
                </button>

                <div className="h-px bg-border/50 my-1" />

                {/* Individual branches */}
                <div className="max-h-[200px] overflow-y-auto overscroll-contain">
                    {branches.map((branch) => {
                        const selected = value.includes(branch.id);
                        return (
                            <button
                                key={branch.id}
                                type="button"
                                onClick={() => toggleBranch(branch.id)}
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                                    selected && "bg-accent/60"
                                )}
                            >
                                <div className={cn(
                                    "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                    selected ? "bg-primary border-primary" : "border-muted-foreground/30"
                                )}>
                                    {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                                </div>
                                {branch.name}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
