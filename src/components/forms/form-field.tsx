"use client";

import type { ReactNode } from "react";
import type { FieldValues, Path, Control, FieldError } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getSmartHelperText, getSmartPlaceholder, moveToNextField } from "@/lib/form-ux";
import { AlertCircle } from "lucide-react";

// ===========================
// Shared wrapper for all form fields
// ===========================

interface FieldWrapperProps {
  label?: string | undefined;
  required?: boolean | undefined;
  error?: FieldError | undefined;
  helperText?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function FieldWrapper({ label, required, error, helperText, className, children }: FieldWrapperProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
      )}
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error.message}
        </p>
      )}
      {!error && helperText && (
        <p className="text-[11px] text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

// ===========================
// FormInput - text, email, password, etc
// ===========================

interface FormInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  type?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  suffix?: ReactNode;
}

export function FormInput<T extends FieldValues>({
  control, name, label, required, placeholder, helperText, type = "text",
  disabled, className, autoFocus, onBlur: customOnBlur, suffix,
}: FormInputProps<T>) {
  const normalizedPlaceholder = placeholder ?? getSmartPlaceholder(label);
  const normalizedHelperText = helperText ?? getSmartHelperText(label, required);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <FieldWrapper label={label} required={required} error={error} helperText={normalizedHelperText} className={className}>
          <div className="relative">
            <Input
              {...field}
              type={type}
              placeholder={normalizedPlaceholder}
              disabled={disabled}
              autoFocus={autoFocus}
              className={cn("rounded-lg", error && "border-red-400 focus-visible:ring-red-400", suffix && "pr-10")}
              onBlur={() => { field.onBlur(); customOnBlur?.(); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && type !== "textarea") {
                  event.preventDefault();
                  moveToNextField(event.currentTarget);
                }
              }}
              value={field.value ?? ""}
            />
            {suffix && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {suffix}
              </div>
            )}
          </div>
        </FieldWrapper>
      )}
    />
  );
}

// ===========================
// FormNumber - numeric input
// ===========================

interface FormNumberProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  onChange?: (value: number) => void;
}

export function FormNumber<T extends FieldValues>({
  control, name, label, required, placeholder, helperText,
  min, max, step, disabled, className, onChange: customOnChange,
}: FormNumberProps<T>) {
  const normalizedPlaceholder = placeholder ?? getSmartPlaceholder(label, "Isi angka");
  const normalizedHelperText = helperText ?? getSmartHelperText(label, required);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <FieldWrapper label={label} required={required} error={error} helperText={normalizedHelperText} className={className}>
          <Input
            type="number"
            {...field}
            onChange={(e) => {
              const val = e.target.value === "" ? 0 : Number(e.target.value);
              field.onChange(val);
              customOnChange?.(val);
            }}
            value={field.value ?? 0}
            placeholder={normalizedPlaceholder}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className={cn("rounded-lg", error && "border-red-400 focus-visible:ring-red-400")}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                moveToNextField(event.currentTarget);
              }
            }}
          />
        </FieldWrapper>
      )}
    />
  );
}

// ===========================
// FormCurrency - formatted currency input
// ===========================

interface FormCurrencyProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  required?: boolean;
  helperText?: string;
  disabled?: boolean;
  className?: string;
  onChange?: (value: number) => void;
}

export function FormCurrency<T extends FieldValues>({
  control, name, label, required, helperText, disabled, className, onChange: customOnChange,
}: FormCurrencyProps<T>) {
  const normalizedHelperText = helperText ?? getSmartHelperText(label, required);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <FieldWrapper label={label} required={required} error={error} helperText={normalizedHelperText} className={className}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
            <Input
              type="number"
              {...field}
              onChange={(e) => {
                const val = e.target.value === "" ? 0 : Number(e.target.value);
                field.onChange(val);
                customOnChange?.(val);
              }}
              value={field.value ?? 0}
              min={0}
              disabled={disabled}
              className={cn("rounded-lg pl-8", error && "border-red-400 focus-visible:ring-red-400")}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  moveToNextField(event.currentTarget);
                }
              }}
            />
          </div>
        </FieldWrapper>
      )}
    />
  );
}

// ===========================
// FormTextarea
// ===========================

interface FormTextareaProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}

export function FormTextarea<T extends FieldValues>({
  control, name, label, required, placeholder, helperText, rows = 3, disabled, className,
}: FormTextareaProps<T>) {
  const normalizedPlaceholder = placeholder ?? getSmartPlaceholder(label, "Tulis keterangan");
  const normalizedHelperText = helperText ?? getSmartHelperText(label, required);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <FieldWrapper label={label} required={required} error={error} helperText={normalizedHelperText} className={className}>
          <textarea
            {...field}
            rows={rows}
            placeholder={normalizedPlaceholder}
            disabled={disabled}
            value={field.value ?? ""}
            className={cn(
              "flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              error && "border-red-400 focus-visible:ring-red-400"
            )}
          />
        </FieldWrapper>
      )}
    />
  );
}

// ===========================
// FormCheckbox
// ===========================

interface FormCheckboxProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
}

export function FormCheckbox<T extends FieldValues>({
  control, name, label, helperText, disabled, className,
}: FormCheckboxProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={cn("flex items-center gap-2", className)}>
          <input
            type="checkbox"
            checked={field.value ?? false}
            onChange={(e) => field.onChange(e.target.checked)}
            disabled={disabled}
            className="rounded border-border"
          />
          <Label className="text-sm font-normal cursor-pointer">{label}</Label>
          {helperText && <span className="text-[11px] text-muted-foreground">({helperText})</span>}
        </div>
      )}
    />
  );
}

// ===========================
// FormSelect - static options
// ===========================

interface FormSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  required?: boolean;
  helperText?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}

export function FormSelect<T extends FieldValues>({
  control, name, label, required, helperText, placeholder = "Pilih...", options, disabled, className,
}: FormSelectProps<T>) {
  const normalizedHelperText = helperText ?? getSmartHelperText(label, required);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <FieldWrapper label={label} required={required} error={error} helperText={normalizedHelperText} className={className}>
          <select
            {...field}
            disabled={disabled}
            value={field.value ?? ""}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                moveToNextField(event.currentTarget);
              }
            }}
            className={cn(
              "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              error && "border-red-400 focus-visible:ring-red-400",
              !field.value && "text-muted-foreground"
            )}
          >
            <option value="">{placeholder}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </FieldWrapper>
      )}
    />
  );
}
