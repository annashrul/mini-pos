"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Lightweight audit log for POS cashier activities.
 * Fire-and-forget — doesn't block the UI.
 */
export async function logPosActivity(params: {
  action: string;
  entity: string;
  entityId?: string | undefined;
  details?: Record<string, unknown> | undefined;
  branchId?: string | undefined;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) return;

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        details: params.details ? JSON.stringify(params.details) : null,
        branchId: params.branchId ?? null,
      },
    });
  } catch {
    // Silently fail — never block POS
  }
}
