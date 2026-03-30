"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

interface UseFormSubmitOptions<TResult> {
  onSuccess?: (result: TResult) => void;
  onError?: (error: string) => void;
  successMessage?: string;
  debounceMs?: number;
}

export function useFormSubmit<TInput, TResult extends { error?: string; success?: boolean }>(
  submitFn: (data: TInput) => Promise<TResult>,
  options: UseFormSubmitOptions<TResult> = {}
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lockRef = useRef(false);
  const lastSubmitRef = useRef(0);

  const handleSubmit = useCallback(async (data: TInput): Promise<TResult | undefined> => {
    if (lockRef.current || isSubmitting) return undefined;
    const now = Date.now();
    const debounceMs = options.debounceMs ?? 400;
    if (now - lastSubmitRef.current < debounceMs) return undefined;
    lastSubmitRef.current = now;
    lockRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await submitFn(data);

      if (result.error) {
        toast.error(result.error);
        options.onError?.(result.error);
      } else {
        if (options.successMessage) toast.success(options.successMessage);
        options.onSuccess?.(result);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      toast.error(message);
      options.onError?.(message);
      return undefined;
    } finally {
      setIsSubmitting(false);
      lockRef.current = false;
    }
  }, [submitFn, options, isSubmitting]);

  return { handleSubmit, isSubmitting };
}
