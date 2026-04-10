import { auth } from "@/lib/auth";

/**
 * Get the current user's companyId from the session.
 * Throws if not authenticated or no companyId.
 */
export async function getCurrentCompanyId(): Promise<string> {
  const session = await auth();
  const companyId = (session?.user as Record<string, unknown> | undefined)
    ?.companyId as string | undefined;
  if (!companyId) {
    throw new Error("Unauthorized: no company context");
  }
  return companyId;
}
