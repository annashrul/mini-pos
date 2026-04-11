import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  events: {
    async signIn({ user }) {
      if (user?.id) {
        prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "LOGIN",
            entity: "Session",
            details: JSON.stringify({ email: user.email }),
          },
        }).catch(() => {});
      }
    },
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (token?.id) {
        prisma.auditLog.create({
          data: {
            userId: token.id as string,
            action: "LOGOUT",
            entity: "Session",
            details: null,
          },
        }).catch(() => {});
      }
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.isActive) return null;
        if (user.role === "SUPER_ADMIN" && !user.emailVerified) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          branchId: user.branchId,
        } as Record<string, unknown> as import("next-auth").User;
      },
    }),
    Credentials({
      id: "verification-otp-login",
      name: "verification-otp-login",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const token = credentials?.token as string | undefined;
        if (!token || !token.startsWith("login_")) return null;

        const tokenRows = await prisma.$queryRawUnsafe<
          { id: string; email: string; expiresAt: Date }[]
        >(
          `
          SELECT id, email, "expiresAt"
          FROM email_verification_tokens
          WHERE token = $1
          LIMIT 1
          `,
          token,
        );
        const record = tokenRows[0];
        if (!record || record.expiresAt < new Date()) return null;

        const user = await prisma.user.findUnique({
          where: { email: record.email },
        });
        if (!user || !user.isActive || !user.emailVerified) return null;

        await prisma.$executeRawUnsafe(
          `DELETE FROM email_verification_tokens WHERE id = $1`,
          record.id,
        );

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          branchId: user.branchId,
        } as Record<string, unknown> as import("next-auth").User;
      },
    }),
  ],
});
