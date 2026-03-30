"use client";

import type { Control, FieldValues, Path } from "react-hook-form";
import { Controller } from "react-hook-form";
import { DatePicker } from "@/components/ui/date-picker";
import { FieldWrapper } from "./form-field";

interface FormDatePickerProps<T extends FieldValues> {
    control: Control<T>;
    name: Path<T>;
    label?: string;
    required?: boolean;
    helperText?: string;
    placeholder?: string;
    className?: string;
}

export function FormDatePicker<T extends FieldValues>({
    control,
    name,
    label,
    required,
    helperText,
    placeholder,
    className,
}: FormDatePickerProps<T>) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field, fieldState: { error } }) => (
                <FieldWrapper
                    label={label}
                    required={required}
                    error={error}
                    helperText={helperText}
                    className={className}
                >
                    <DatePicker
                        value={typeof field.value === "string" ? field.value : ""}
                        onChange={field.onChange}
                        {...(placeholder ? { placeholder } : {})}
                    />
                </FieldWrapper>
            )}
        />
    );
}
