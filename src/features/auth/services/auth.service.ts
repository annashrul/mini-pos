import { signIn, signOut } from "next-auth/react";
import type { LoginCredentials } from "../types/auth.types";

export const authService = {
  login: (payload: LoginCredentials) =>
    signIn("credentials", {
      redirect: false,
      email: payload.email,
      password: payload.password,
    }),
  logout: () => signOut({ callbackUrl: "/login" }),
};
