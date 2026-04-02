import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Create an audit log entry. Plain async utility (NOT a server action)
 * so it can be called directly from other server actions.
 *
 * `details` accepts a string OR an object — objects are JSON-stringified automatically.
 * IP address and user agent are automatically captured from request headers.
 */
export async function createAuditLog(params: {
  action: string;
  entity: string;
  entityId?: string;
  details?: string | Record<string, unknown>;
  branchId?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) return;

    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });
    if (!userExists) return;

    // Capture request metadata
    let ipAddress: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      ipAddress =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null;
      userAgent = h.get("user-agent") ?? null;
    } catch {
      // headers() may not be available in some contexts
    }

    const detailsStr =
      params.details == null
        ? null
        : typeof params.details === "string"
          ? params.details
          : JSON.stringify(params.details);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        details: detailsStr,
        branchId: params.branchId ?? null,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[AuditLog] Failed:", params.action, params.entity, err);
  }
}
