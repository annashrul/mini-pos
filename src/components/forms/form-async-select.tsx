"use client";

import { useState } from "react";
import type { FieldValues, Path, Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { SmartSelect, type SmartSelectOption } from "@/components/ui/smart-select";
import { FieldWrapper } from "./form-field";

type SearchResult =
    | SmartSelectOption[]
    | { items: SmartSelectOption[]; hasMore: boolean };

interface FormAsyncSelectProps<T extends FieldValues> {
    control: Control<T>;
    name: Path<T>;
    label?: string;
    required?: boolean;
    helperText?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    initialOptions?: SmartSelectOption[];
    onSearch: (query: string, page: number) => Promise<SearchResult>;
    createLabel?: string;
    onCreateSubmit?: (data: FormData) => Promise<{ id: string; name: string } | { error: string }>;
    createFields?: { name: string; label: string; type?: string; required?: boolean }[];
}

export function FormAsyncSelect<T extends FieldValues>({
    control, name, label, required, helperText, placeholder, disabled, className,
    initialOptions, onSearch, createLabel, onCreateSubmit, createFields,
}: FormAsyncSelectProps<T>) {
    const [loading, setLoading] = useState(false);

    const wrappedSearch = async (query: string, page: number) => {
        setLoading(true);
        try {
            return await onSearch(query, page);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Controller
            control={control}
            name={name}
            render={({ field, fieldState: { error } }) => (
                <FieldWrapper
                    label={label}
                    required={required}
                    error={error}
                    helperText={loading ? "Memuat opsi..." : helperText}
                    className={className}
                >
                    <SmartSelect
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onSearch={wrappedSearch}
                        placeholder={placeholder}
                        disabled={disabled}
                        initialOptions={initialOptions}
                        createLabel={createLabel}
                        onCreateSubmit={onCreateSubmit}
                        createFields={createFields}
                    />
                </FieldWrapper>
            )}
        />
    );
}
