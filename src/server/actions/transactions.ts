"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { emitEvent, EVENTS } from "@/lib/socket-emit";

interface CartItem {
  productId: string;
  categoryId?: string;
  productName: string;
  productCode: string;
  lineId?: string;
  tebusPromoId?: string;
  tebusPromoName?: string;
  quantity: number;
  unitName?: string;
  conversionQty?: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

interface PaymentEntry {
  method: "CASH" | "TRANSFER" | "QRIS" | "EWALLET" | "DEBIT" | "CREDIT_CARD" | "TERMIN";
  amount: number;
  reference?: string;
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
    | "CREDIT_CARD"
    | "TERMIN";
  paymentAmount: number;
  changeAmount: number;
  payments?: PaymentEntry[];
  customerId?: string;
  branchId?: string;
  promoApplied?: string;
  promoIds?: string[];
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

  // Check if stock validation is enabled (branch-specific first, then global)
  let validateStockSetting = input.branchId
    ? await prisma.setting.findFirst({ where: { key: "pos.validateStock", branchId: input.branchId } })
    : null;
  if (!validateStockSetting) {
    validateStockSetting = await prisma.setting.findFirst({ where: { key: "pos.validateStock", branchId: null } });
  }
  const shouldValidateStock = validateStockSetting?.value !== "false";

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      // Check stock availability (skip if validation disabled)
      if (shouldValidateStock) {
        for (const item of input.items) {
          if (input.branchId) {
            const branchStock = await tx.branchStock.findUnique({
              where: {
                branchId_productId: {
                  branchId: input.branchId,
                  productId: item.productId,
                },
              },
            });
            const available = branchStock?.quantity ?? 0;
            const baseQtyNeeded = item.quantity * (item.conversionQty || 1);
            if (available < baseQtyNeeded) {
              throw new Error(
                `Stok ${item.productName} tidak mencukupi di cabang ini (sisa: ${available})`,
              );
            }
          } else {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
            });
            if (!product)
              throw new Error(`Produk ${item.productName} tidak ditemukan`);
            const baseQtyNeeded = item.quantity * (item.conversionQty || 1);
            if (product.stock < baseQtyNeeded) {
              throw new Error(
                `Stok ${item.productName} tidak mencukupi (sisa: ${product.stock})`,
              );
            }
          }
        }
      }

      // Validate all products exist
      const productIds = input.items.map((i) => i.productId);
      const existingProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true },
      });
      const existingIds = new Set(existingProducts.map((p) => p.id));
      for (const item of input.items) {
        if (!existingIds.has(item.productId)) {
          throw new Error(
            `Produk "${item.productName}" tidak ditemukan. Muat ulang halaman POS.`,
          );
        }
      }

      // Determine primary payment method (highest amount or first)
      const paymentsData =
        input.payments && input.payments.length > 0
          ? input.payments
          : [{ method: input.paymentMethod, amount: input.paymentAmount }];
      const primaryMethod = paymentsData.reduce((a, b) =>
        a.amount >= b.amount ? a : b,
      ).method;
      const totalPaid = paymentsData.reduce((s, p) => s + p.amount, 0);

      // Create transaction
      const newTx = await tx.transaction.create({
        data: {
          invoiceNumber,
          userId,
          branchId: input.branchId || null,
          customerId: input.customerId || null,
          subtotal: input.subtotal,
          discountAmount: input.discountAmount,
          taxAmount: input.taxAmount,
          grandTotal: input.grandTotal,
          paymentMethod: primaryMethod as never,
          paymentAmount: totalPaid,
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
              unitName: item.unitName || "PCS",
              conversionQty: item.conversionQty || 1,
              baseQty: item.quantity * (item.conversionQty || 1),
              unitPrice: item.unitPrice,
              discount: item.discount,
              subtotal: item.subtotal,
            })),
          },
          payments: {
            create: paymentsData.map((p) => ({
              method: p.method as never,
              amount: p.amount,
              reference: (p as PaymentEntry).reference || null,
            })),
          },
        },
        include: { items: true },
      });

      if (input.promoIds && input.promoIds.length > 0) {
        await tx.promotion.updateMany({
          where: { id: { in: Array.from(new Set(input.promoIds)) } },
          data: { usageCount: { increment: 1 } },
        });
      }

      // Update stock & create stock movements
      for (const item of input.items) {
        // Always update global stock (use base qty)
        const baseQty = item.quantity * (item.conversionQty || 1);
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: baseQty } },
        });

        // Update branch stock if applicable
        if (input.branchId) {
          await tx.branchStock.update({
            where: {
              branchId_productId: {
                branchId: input.branchId,
                productId: item.productId,
              },
            },
            data: { quantity: { decrement: baseQty } },
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            branchId: input.branchId || null,
            type: "OUT",
            quantity: baseQty,
            note: `Penjualan ${invoiceNumber}`,
            reference: invoiceNumber,
          },
        });
      }

      return newTx;
    });

    // Auto-create receivable debt for TERMIN payment
    const terminPayment = (input.payments ?? []).find(p => p.method === "TERMIN");
    if (terminPayment && terminPayment.amount > 0) {
      let partyName = "Customer";
      if (input.customerId) {
        const customer = await prisma.customer.findUnique({
          where: { id: input.customerId },
          select: { name: true },
        });
        partyName = customer?.name || "Customer";
      }
      await prisma.debt.create({
        data: {
          type: "RECEIVABLE",
          referenceType: "TRANSACTION",
          referenceId: transaction.id,
          partyType: input.customerId ? "CUSTOMER" : "OTHER",
          partyId: input.customerId || null,
          partyName,
          description: `Termin pembayaran invoice ${transaction.invoiceNumber}`,
          totalAmount: terminPayment.amount,
          paidAmount: 0,
          remainingAmount: terminPayment.amount,
          status: "UNPAID",
          branchId: input.branchId || null,
          createdBy: userId,
        },
      });
    }

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
    if (terminPayment && terminPayment.amount > 0) {
      revalidatePath("/debts");
    }

    createAuditLog({ action: "CREATE", entity: "Transaction", entityId: transaction.id, details: { data: { invoiceNumber, grandTotal: input.grandTotal, paymentMethod: input.paymentMethod, itemCount: input.items.length, ...(terminPayment && terminPayment.amount > 0 ? { terminAmount: terminPayment.amount } : {}) } } }).catch(() => {});

    emitEvent(EVENTS.TRANSACTION_CREATED, { invoiceNumber: transaction.invoiceNumber, grandTotal: input.grandTotal }, input.branchId);

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
  branchId?: string;
  userId?: string;
  shiftId?: string;
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
    branchId,
    userId,
    shiftId,
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
  if (branchId) where.branchId = branchId;
  if (userId) where.userId = userId;
  if (shiftId) where.shiftId = shiftId;

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
        branch: { select: { name: true } },
        items: true,
        payments: {
          orderBy: { amount: "desc" },
          select: { id: true, method: true, amount: true },
        },
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
      payments: { orderBy: { amount: "desc" } },
    },
  });
}

export async function voidTransaction(id: string, reason: string) {
  await assertMenuActionAccess("transactions", "void");
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) return { error: authResult.error };
  const userId = authResult.userId;

  try {
    const tx0 = await prisma.transaction.findUnique({ where: { id }, select: { invoiceNumber: true, grandTotal: true, branchId: true } });

    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transaction) throw new Error("Transaksi tidak ditemukan");
      if (transaction.status !== "COMPLETED")
        throw new Error("Hanya transaksi COMPLETED yang bisa di-void");

      // Restore stock (use baseQty which accounts for unit conversion)
      for (const item of transaction.items) {
        const restoreQty = item.baseQty ?? item.quantity * (item.conversionQty ?? 1);
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: restoreQty } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: restoreQty,
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

    createAuditLog({ action: "VOID", entity: "Transaction", entityId: id, details: { data: { invoiceNumber: tx0?.invoiceNumber, grandTotal: tx0?.grandTotal, reason } } }).catch(() => {});

    emitEvent(EVENTS.TRANSACTION_VOIDED, { id }, tx0?.branchId || undefined);

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
    const tx0 = await prisma.transaction.findUnique({ where: { id }, select: { invoiceNumber: true, grandTotal: true, branchId: true } });

    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transaction) throw new Error("Transaksi tidak ditemukan");
      if (transaction.status !== "COMPLETED")
        throw new Error("Hanya transaksi COMPLETED yang bisa di-refund");

      // Restore stock (use baseQty which accounts for unit conversion)
      for (const item of transaction.items) {
        const restoreQty = item.baseQty ?? item.quantity * (item.conversionQty ?? 1);
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: restoreQty } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: restoreQty,
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

    createAuditLog({ action: "REFUND", entity: "Transaction", entityId: id, details: { data: { invoiceNumber: tx0?.invoiceNumber, grandTotal: tx0?.grandTotal, reason } } }).catch(() => {});

    emitEvent(EVENTS.TRANSACTION_REFUNDED, { id }, tx0?.branchId || undefined);

    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal refund transaksi",
    };
  }
}
