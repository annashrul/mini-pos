import type { NextAuthConfig } from "next-auth";

/**
 * Lightweight auth config for Edge middleware.
 * No Prisma, bcrypt, or other heavy dependencies.
 */
export const authConfig: NextAuthConfig = {
  providers: [], // Providers are added in the full auth.ts
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Public routes
      if (pathname === "/login") {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // Root redirect
      if (pathname === "/" && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      // Protect all other routes
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as Record<string, unknown>).role;
        token.branchId = (user as Record<string, unknown>).branchId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).branchId =
          token.branchId;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
};
