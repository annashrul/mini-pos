"use client";

import { useState } from "react";
import { authService } from "../services/auth.service";
import type { LoginCredentials } from "../types/auth.types";

export function useAuthFeature() {
  const [loading, setLoading] = useState(false);

  const login = async (payload: LoginCredentials) => {
    setLoading(true);
    const result = await authService.login(payload);
    setLoading(false);
    return result;
  };

  return {
    loading,
    login,
    logout: authService.logout,
  };
}
