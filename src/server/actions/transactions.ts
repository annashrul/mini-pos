"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";

interface CartItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

interface CreateTransactionInput {
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod:
    | "CASH"
    | "TRANSFER"
    | "QRIS"
    | "EWALLET"
    | "DEBIT"
    | "CREDIT_CARD";
  paymentAmount: number;
  changeAmount: number;
  customerId?: string;
  promoApplied?: string;
  notes?: string;
  redeemPoints?: number;
}

async function resolveSessionUserId() {
  const session = await auth();
  const sessionUserId = session?.user?.id;
  const sessionEmail = session?.user?.email;

  if (!sessionUserId && !sessionEmail) {
    return { error: "Unauthorized" };
  }

  let user = null;

  if (sessionUserId) {
    user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true, isActive: true },
    });
  }

  if (!user && sessionEmail) {
    user = await prisma.user.findUnique({
      where: { email: sessionEmail },
      select: { id: true, isActive: true },
    });
  }

  if (!user || !user.isActive) {
    return { error: "Sesi tidak valid. Silakan login ulang." };
  }

  return { userId: user.id };
}

export async function createTransaction(input: CreateTransactionInput) {
  await assertMenuActionAccess("pos", "create");
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) {
    return { error: authResult.error };
  }
  const userId = authResult.userId;

  // Generate invoice number
  const today = new Date();
  const prefix = `INV-${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;

  const lastInvoice = await prisma.transaction.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSeq = parseInt(lastInvoice.invoiceNumber.split("-").pop() || "0");
    sequence = lastSeq + 1;
  }
  const invoiceNumber = `${prefix}-${String(sequence).padStart(4, "0")}`;

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      // Check stock availability
      for (const item of input.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product)
          throw new Error(`Produk ${item.productName} tidak ditemukan`);
        if (product.stock < item.quantity) {
          throw new Error(
            `Stok ${item.productName} tidak mencukupi (sisa: ${product.stock})`,
          );
        }
      }

      // Create transaction
      const newTx = await tx.transaction.create({
        data: {
          invoiceNumber,
          userId,
          customerId: input.customerId || null,
          subtotal: input.subtotal,
          discountAmount: input.discountAmount,
          taxAmount: input.taxAmount,
          grandTotal: input.grandTotal,
          paymentMethod: input.paymentMethod as never,
          paymentAmount: input.paymentAmount,
          changeAmount: input.changeAmount,
          promoApplied: input.promoApplied || null,
          notes: input.notes || null,
          status: "COMPLETED",
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              productCode: item.productCode,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              subtotal: item.subtotal,
            })),
          },
        },
        include: { items: true },
      });

      // Update stock & create stock movements
      for (const item of input.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "OUT",
            quantity: item.quantity,
            note: `Penjualan ${invoiceNumber}`,
            reference: invoiceNumber,
          },
        });
      }

      return newTx;
    });

    // Loyalty points: earn + redeem
    let pointsEarned = 0;
    if (input.customerId) {
      const { earnPoints, confirmRedeem } =
        await import("@/server/actions/points");

      // Earn points
      const earnResult = await earnPoints(
        input.customerId,
        input.grandTotal,
        transaction.invoiceNumber,
      );
      if (earnResult?.earned) pointsEarned = earnResult.earned;

      // Confirm redeem if used
      if (input.redeemPoints && input.redeemPoints > 0) {
        await confirmRedeem(
          input.customerId,
          input.redeemPoints,
          transaction.invoiceNumber,
        );
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidatePath("/products");
    revalidatePath("/customers");

    return {
      success: true,
      invoiceNumber: transaction.invoiceNumber,
      pointsEarned,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal menyimpan transaksi",
    };
  }
}

interface GetTransactionsParams {
  page?: number;
  limit?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function getTransactions(params: GetTransactionsParams = {}) {
  const {
    page = 1,
    limit = 10,
    search,
    dateFrom,
    dateTo,
    status,
    sortBy,
    sortDir = "desc",
  } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.invoiceNumber = { contains: search, mode: "insensitive" };
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom)
      (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1);
      (where.createdAt as Record<string, unknown>).lt = to;
    }
  }

  if (status && status !== "all") {
    where.status = status;
  }

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "invoiceNumber"
      ? { invoiceNumber: direction }
      : sortBy === "grandTotal"
        ? { grandTotal: direction }
        : sortBy === "paymentMethod"
          ? { paymentMethod: direction }
          : sortBy === "user"
            ? { user: { name: direction } }
            : { createdAt: direction };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        user: { select: { name: true } },
        items: true,
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
}

export async function getTransactionById(id: string) {
  return prisma.transaction.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { product: true } },
    },
  });
}

export async function voidTransaction(id: string, reason: string) {
  await assertMenuActionAccess("transactions", "void");
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };
  const userId = authResult.userId;

  try {
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transaction) throw new Error("Transaksi tidak ditemukan");
      if (transaction.status !== "COMPLETED")
        throw new Error("Hanya transaksi COMPLETED yang bisa di-void");

      // Restore stock
      for (const item of transaction.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            note: `Void transaksi ${transaction.invoiceNumber}`,
            reference: transaction.invoiceNumber,
          },
        });
      }

      await tx.transaction.update({
        where: { id },
        data: {
          status: "VOIDED",
          voidReason: reason,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: "VOID",
          entity: "Transaction",
          entityId: id,
          details: `Void ${transaction.invoiceNumber}: ${reason}`,
        },
      });
    });

    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/products");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal void transaksi",
    };
  }
}

export async function refundTransaction(id: string, reason: string) {
  await assertMenuActionAccess("transactions", "refund");
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };
  const userId = authResult.userId;

  try {
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transaction) throw new Error("Transaksi tidak ditemukan");
      if (transaction.status !== "COMPLETED")
        throw new Error("Hanya transaksi COMPLETED yang bisa di-refund");

      // Restore stock
      for (const item of transaction.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            note: `Refund transaksi ${transaction.invoiceNumber}`,
            reference: transaction.invoiceNumber,
          },
        });
      }

      await tx.transaction.update({
        where: { id },
        data: {
          status: "REFUNDED",
          voidReason: reason,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: "REFUND",
          entity: "Transaction",
          entityId: id,
          details: `Refund ${transaction.invoiceNumber}: ${reason}`,
        },
      });
    });

    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/products");
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal refund transaksi",
    };
  }
}
