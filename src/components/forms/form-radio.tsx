"use client";

import type { Control, FieldValues, Path } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FieldWrapper } from "./form-field";

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface FormRadioProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  required?: boolean;
  helperText?: string;
  options: RadioOption[];
  className?: string;
}

export function FormRadio<T extends FieldValues>({
  control,
  name,
  label,
  required,
  helperText,
  options,
  className,
}: FormRadioProps<T>) {
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
          <div className="space-y-2">
            {options.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 px-3 py-2 transition-colors hover:bg-muted/30",
                  field.value === option.value && "border-primary bg-primary/5"
                )}
              >
                <input
                  type="radio"
                  checked={field.value === option.value}
                  onChange={() => field.onChange(option.value)}
                  className="h-4 w-4 border-border text-primary"
                />
                <div>
                  <Label className="cursor-pointer text-sm">{option.label}</Label>
                  {option.description && (
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </FieldWrapper>
      )}
    />
  );
}
