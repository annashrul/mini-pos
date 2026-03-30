"use client";

import { useSession } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();

  const user = session?.user
    ? {
        id: session.user.id as string,
        name: session.user.name || "",
        email: session.user.email || "",
        role: ((session.user as { role?: string }).role || "") as string,
      }
    : null;

  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    hasRole,
    session,
  };
}
