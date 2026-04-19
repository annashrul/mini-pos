"use client";

import { SearchInput } from "@/components/ui/search-input";

export function BranchesSearch(props: {
    value: string;
    loading: boolean;
    onChange: (value: string) => void;
}) {
    const { value, loading, onChange } = props;

    return (
        <SearchInput
            value={value}
            onChange={onChange}
            placeholder="Cari cabang..."
            loading={loading}
        />
    );
}
