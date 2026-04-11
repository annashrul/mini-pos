import { NextResponse } from "next/server";
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
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;

      // Public routes
      if (pathname === "/login" || pathname === "/register" || pathname === "/verify-email") {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }

      // Root redirect
      if (pathname === "/" && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      // Protect all other routes
      if (!isLoggedIn) return false;

      // Set x-pathname header for layout access control
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-pathname", pathname);
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as Record<string, unknown>).role;
        token.companyId = (user as Record<string, unknown>).companyId;
        token.branchId = (user as Record<string, unknown>).branchId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).companyId =
          token.companyId;
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
