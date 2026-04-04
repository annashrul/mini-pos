"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// List approval requests with pagination & filters
// ---------------------------------------------------------------------------
export async function getApprovalRequests(params?: {
  status?: string;
  type?: string;
  branchId?: string;
  page?: number;
  perPage?: number;
}) {
  const { status, type, branchId, page = 1, perPage = 10 } = params || {};

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (branchId) where.branchId = branchId;

  const [requests, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, email: true, role: true } },
        approver: { select: { id: true, name: true, email: true, role: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.approvalRequest.count({ where }),
  ]);

  return { requests, total, totalPages: Math.ceil(total / perPage) };
}

// ---------------------------------------------------------------------------
// Create a new approval request
// ---------------------------------------------------------------------------
export async function createApprovalRequest(data: {
  type: string;
  referenceId?: string;
  details?: string;
  reason: string;
  branchId?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const validTypes = ["VOID", "REFUND", "LARGE_DISCOUNT", "PRICE_OVERRIDE"];
  if (!validTypes.includes(data.type)) {
    return { error: "Tipe approval tidak valid" };
  }

  if (!data.reason || data.reason.trim().length === 0) {
    return { error: "Alasan wajib diisi" };
  }

  try {
    const request = await prisma.approvalRequest.create({
      data: {
        type: data.type,
        referenceId: data.referenceId ?? null,
        details: data.details ?? null,
        reason: data.reason.trim(),
        branchId: data.branchId ?? (session.user as unknown as Record<string, unknown>).branchId as string | null ?? null,
        requestedBy: session.user.id,
        status: "PENDING",
      },
    });

    createAuditLog({
      action: "CREATE",
      entity: "ApprovalRequest",
      entityId: request.id,
      details: {
        type: data.type,
        referenceId: data.referenceId,
        reason: data.reason,
      },
      ...(data.branchId ? { branchId: data.branchId } : {}),
    }).catch(() => {});

    revalidatePath("/approvals");
    return { success: true, id: request.id };
  } catch (err) {
    console.error("[ApprovalRequest] create failed:", err);
    return { error: "Gagal membuat permintaan approval" };
  }
}

// ---------------------------------------------------------------------------
// Approve a request
// ---------------------------------------------------------------------------
export async function approveRequest(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  // Only SUPER_ADMIN, ADMIN, and MANAGER can approve
  const userRole = (session.user as unknown as Record<string, unknown>).role as string;
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(userRole)) {
    return { error: "Anda tidak memiliki izin untuk approve" };
  }

  const request = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!request) return { error: "Permintaan approval tidak ditemukan" };
  if (request.status !== "PENDING") return { error: "Permintaan ini sudah diproses" };

  // Requester cannot approve their own request
  if (request.requestedBy === session.user.id) {
    return { error: "Tidak dapat menyetujui permintaan sendiri" };
  }

  try {
    // Update approval status
    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedBy: session.user.id,
      },
    });

    // Execute side effects based on type
    if (request.type === "VOID" && request.referenceId) {
      await prisma.transaction.update({
        where: { id: request.referenceId },
        data: {
          status: "VOIDED",
          voidReason: request.reason,
        },
      });
    }

    if (request.type === "REFUND" && request.referenceId) {
      let refundDetails: { refundAmount?: number; refundMethod?: string; isPartial?: boolean; itemsReturned?: string } = {};
      if (request.details) {
        try {
          refundDetails = JSON.parse(request.details);
        } catch {
          // details not valid JSON, ignore
        }
      }

      const transaction = await prisma.transaction.findUnique({ where: { id: request.referenceId } });
      if (transaction) {
        await prisma.refund.create({
          data: {
            transactionId: request.referenceId,
            reason: request.reason ?? "Approved refund",
            refundAmount: refundDetails.refundAmount ?? transaction.grandTotal,
            refundMethod: (refundDetails.refundMethod as "CASH" | "TRANSFER" | "QRIS" | "EWALLET" | "DEBIT" | "CREDIT_CARD" | "TERMIN") ?? "CASH",
            refundedBy: session.user.id,
            isPartial: refundDetails.isPartial ?? false,
            itemsReturned: refundDetails.itemsReturned ?? null,
          },
        });

        await prisma.transaction.update({
          where: { id: request.referenceId },
          data: { status: "REFUNDED" },
        });
      }
    }

    createAuditLog({
      action: "APPROVE",
      entity: "ApprovalRequest",
      entityId: updated.id,
      details: {
        type: request.type,
        referenceId: request.referenceId,
        approvedBy: session.user.id,
      },
      ...(request.branchId ? { branchId: request.branchId } : {}),
    }).catch(() => {});

    revalidatePath("/approvals");
    return { success: true };
  } catch (err) {
    console.error("[ApprovalRequest] approve failed:", err);
    return { error: "Gagal menyetujui permintaan" };
  }
}

// ---------------------------------------------------------------------------
// Reject a request
// ---------------------------------------------------------------------------
export async function rejectRequest(id: string, note?: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const userRole = (session.user as unknown as Record<string, unknown>).role as string;
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(userRole)) {
    return { error: "Anda tidak memiliki izin untuk menolak" };
  }

  const request = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!request) return { error: "Permintaan approval tidak ditemukan" };
  if (request.status !== "PENDING") return { error: "Permintaan ini sudah diproses" };

  try {
    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedBy: session.user.id,
        rejectionNote: note?.trim() || null,
      },
    });

    createAuditLog({
      action: "REJECT",
      entity: "ApprovalRequest",
      entityId: updated.id,
      details: {
        type: request.type,
        referenceId: request.referenceId,
        rejectionNote: note,
        rejectedBy: session.user.id,
      },
      ...(request.branchId ? { branchId: request.branchId } : {}),
    }).catch(() => {});

    revalidatePath("/approvals");
    return { success: true };
  } catch (err) {
    console.error("[ApprovalRequest] reject failed:", err);
    return { error: "Gagal menolak permintaan" };
  }
}

// ---------------------------------------------------------------------------
// Count pending approvals (for notification badge)
// ---------------------------------------------------------------------------
export async function getPendingApprovalsCount(branchId?: string) {
  const where: Record<string, unknown> = { status: "PENDING" };
  if (branchId) where.branchId = branchId;

  const count = await prisma.approvalRequest.count({ where });
  return count;
}
