"use client";

import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";

export function BranchesSearch(props: {
    value: string;
    loading: boolean;
    onChange: (value: string) => void;
}) {
    const { value, loading, onChange } = props;

    return (
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <Input
                placeholder="Cari cabang..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pl-9 rounded-xl h-10"
            />
            {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
        </div>
    );
}

