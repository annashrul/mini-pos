import { auth } from "@/lib/auth";

/**
 * Get the current user's companyId from the session.
 * Throws if not authenticated or no companyId (unless PLATFORM_OWNER).
 */
export async function getCurrentCompanyId(): Promise<string> {
  const session = await auth();
  const user = session?.user as Record<string, unknown> | undefined;
  const companyId = user?.companyId as string | undefined;
  if (!companyId) {
    // PLATFORM_OWNER may not have a companyId
    if (user?.role === "PLATFORM_OWNER") {
      throw new Error("PLATFORM_OWNER has no company context");
    }
    throw new Error("Unauthorized: no company context");
  }
  return companyId;
}

/**
 * Get companyId or null (for PLATFORM_OWNER).
 */
export async function getCurrentCompanyIdOrNull(): Promise<string | null> {
  const session = await auth();
  const companyId = (session?.user as Record<string, unknown> | undefined)
    ?.companyId as string | undefined;
  return companyId || null;
}
