import type { ApiResponse } from "@/shared/types/api-response";

export function ok<T>(data: T, message = "OK"): ApiResponse<T> {
  return { success: true, message, data };
}

export function fail(message: string): ApiResponse<null> {
  return { success: false, message, error: message, data: null };
}
