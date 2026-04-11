"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Pre-validate login credentials and return specific error messages.
 * Called before signIn() to provide better UX.
 */
export async function validateLogin(email: string, password: string) {
  if (!email || !password) {
    return { error: "Email dan password wajib diisi" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { password: true, isActive: true, emailVerified: true, role: true },
  });

  if (!user) {
    return { error: "Email atau password salah" };
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return { error: "Email atau password salah" };
  }

  if (!user.isActive) {
    return { error: "Akun Anda telah dinonaktifkan. Hubungi administrator." };
  }

  if (user.role === "SUPER_ADMIN" && !user.emailVerified) {
    return { error: "EMAIL_NOT_VERIFIED", email };
  }

  return { ok: true };
}
