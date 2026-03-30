"use client";

import { useCallback } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";

type ServerFieldErrors = Record<string, string | string[]>;

interface ServerErrorPayload {
  message?: string;
  fieldErrors?: ServerFieldErrors;
}

interface UseFormErrorHandlerOptions<T extends FieldValues> {
  setError: UseFormSetError<T>;
  fieldMap?: Record<string, Path<T>>;
  onUnhandledError?: (message: string) => void;
}

export function useFormErrorHandler<T extends FieldValues>({
  setError,
  fieldMap,
  onUnhandledError,
}: UseFormErrorHandlerOptions<T>) {
  const applyFieldErrors = useCallback((fieldErrors: ServerFieldErrors) => {
    for (const [rawField, rawMessage] of Object.entries(fieldErrors)) {
      const mappedField = (fieldMap?.[rawField] ?? rawField) as Path<T>;
      const message = Array.isArray(rawMessage) ? rawMessage[0] : rawMessage;
      if (!message) continue;
      setError(mappedField, { type: "server", message });
    }
  }, [fieldMap, setError]);

  const handleServerError = useCallback((payload: string | ServerErrorPayload) => {
    if (typeof payload === "string") {
      toast.error(payload);
      onUnhandledError?.(payload);
      return;
    }
    if (payload.fieldErrors) {
      applyFieldErrors(payload.fieldErrors);
    }
    const message = payload.message ?? "Terjadi kesalahan saat memproses form";
    toast.error(message);
    onUnhandledError?.(message);
  }, [applyFieldErrors, onUnhandledError]);

  return { handleServerError, applyFieldErrors };
}
