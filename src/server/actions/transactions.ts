"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { emitEvent, EVENTS } from "@/lib/socket-emit";

interface BundleComponentItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  purchasePrice: number;
}

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
  bundleId?: string;
  bundleItems?: BundleComponentItem[];
}

interface PaymentEntry {
  method:
    | "CASH"
    | "TRANSFER"
    | "QRIS"
    | "EWALLET"
    | "DEBIT"
    | "CREDIT_CARD"
    | "TERMIN";
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
    ? await prisma.setting.findFirst({
        where: { key: "pos.validateStock", branchId: input.branchId },
      })
    : null;
  if (!validateStockSetting) {
    validateStockSetting = await prisma.setting.findFirst({
      where: { key: "pos.validateStock", branchId: null },
    });
  }
  const shouldValidateStock = validateStockSetting?.value !== "false";

  try {
    // Separate regular items and bundle items
    const regularItems = input.items.filter(
      (i) => !i.productId.startsWith("bundle:"),
    );
    const bundleItems = input.items.filter((i) =>
      i.productId.startsWith("bundle:"),
    );

    // Flatten bundle components for stock validation
    const bundleComponents: {
      productId: string;
      productName: string;
      quantity: number;
    }[] = [];
    for (const bundle of bundleItems) {
      if (bundle.bundleItems) {
        for (const comp of bundle.bundleItems) {
          bundleComponents.push({
            productId: comp.productId,
            productName: comp.productName,
            quantity: comp.quantity * bundle.quantity,
          });
        }
      }
    }

    // All product IDs that need stock validation
    const allStockItems = [
      ...regularItems.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity * (i.conversionQty || 1),
      })),
      ...bundleComponents,
    ];
    const aggregatedStockMap = new Map<
      string,
      { productName: string; quantity: number }
    >();
    for (const it of allStockItems) {
      const prev = aggregatedStockMap.get(it.productId);
      aggregatedStockMap.set(it.productId, {
        productName: prev?.productName ?? it.productName,
        quantity: (prev?.quantity ?? 0) + it.quantity,
      });
    }
    const aggregatedStockItems = Array.from(aggregatedStockMap.entries()).map(
      ([productId, v]) => ({
        productId,
        productName: v.productName,
        quantity: v.quantity,
      }),
    );

    const transaction = await prisma.$transaction(
      async (tx) => {
        // Check stock availability (skip if validation disabled)
        if (shouldValidateStock && aggregatedStockItems.length > 0) {
          const productIds = aggregatedStockItems.map((i) => i.productId);
          if (input.branchId) {
            const branchStocks = await tx.branchStock.findMany({
              where: {
                branchId: input.branchId,
                productId: { in: productIds },
              },
            });
            const stockMap = new Map(
              branchStocks.map((bs) => [bs.productId, bs.quantity]),
            );
            for (const item of aggregatedStockItems) {
              const available = stockMap.get(item.productId) ?? 0;
              if (available < item.quantity) {
                throw new Error(
                  `Stok ${item.productName} tidak mencukupi di cabang ini (sisa: ${available})`,
                );
              }
            }
          } else {
            const products = await tx.product.findMany({
              where: { id: { in: productIds } },
              select: { id: true, name: true, stock: true },
            });
            const stockMap = new Map(products.map((p) => [p.id, p.stock]));
            for (const item of aggregatedStockItems) {
              const stock = stockMap.get(item.productId);
              if (stock === undefined)
                throw new Error(`Produk ${item.productName} tidak ditemukan`);
              if (stock < item.quantity) {
                throw new Error(
                  `Stok ${item.productName} tidak mencukupi (sisa: ${stock})`,
                );
              }
            }
          }
        }

        // Validate regular products exist (skip bundle: prefixed items)
        const regularProductIds = regularItems.map((i) => i.productId);
        const bundleComponentIds = bundleComponents.map((i) => i.productId);
        const allRealProductIds = [
          ...new Set([...regularProductIds, ...bundleComponentIds]),
        ];
        if (allRealProductIds.length > 0) {
          const existingProducts = await tx.product.findMany({
            where: { id: { in: allRealProductIds } },
            select: { id: true },
          });
          const existingIds = new Set(existingProducts.map((p) => p.id));
          for (const item of regularItems) {
            if (!existingIds.has(item.productId)) {
              throw new Error(
                `Produk "${item.productName}" tidak ditemukan. Muat ulang halaman POS.`,
              );
            }
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
              create: input.items.map((item) => {
                // For bundles, use first component's productId as reference
                const isBundle = item.productId.startsWith("bundle:");
                const refProductId =
                  isBundle && item.bundleItems?.[0]
                    ? item.bundleItems[0].productId
                    : item.productId;
                return {
                  productId: refProductId,
                  productName: item.productName,
                  productCode: item.productCode,
                  quantity: item.quantity,
                  unitName: isBundle ? "PAKET" : item.unitName || "PCS",
                  conversionQty: item.conversionQty || 1,
                  baseQty: item.quantity * (item.conversionQty || 1),
                  unitPrice: item.unitPrice,
                  discount: item.discount,
                  subtotal: item.subtotal,
                };
              }),
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
        // Build stock deduction list: regular items + exploded bundle components
        const stockDeductions: {
          productId: string;
          quantity: number;
          note: string;
        }[] = [];
        for (const item of input.items) {
          if (item.productId.startsWith("bundle:") && item.bundleItems) {
            // Bundle: deduct stock for each component
            for (const comp of item.bundleItems) {
              stockDeductions.push({
                productId: comp.productId,
                quantity: comp.quantity * item.quantity,
                note: `Penjualan ${invoiceNumber} (${item.productName})`,
              });
            }
          } else {
            // Regular item
            stockDeductions.push({
              productId: item.productId,
              quantity: item.quantity * (item.conversionQty || 1),
              note: `Penjualan ${invoiceNumber}`,
            });
          }
        }

        const aggregatedDeductions = new Map<
          string,
          { quantity: number; note: string }
        >();
        for (const d of stockDeductions) {
          const prev = aggregatedDeductions.get(d.productId);
          aggregatedDeductions.set(d.productId, {
            quantity: (prev?.quantity ?? 0) + d.quantity,
            note: prev?.note ?? d.note,
          });
        }
        const uniqueDeductions = Array.from(aggregatedDeductions.entries()).map(
          ([productId, v]) => ({
            productId,
            quantity: v.quantity,
            note: v.note,
          }),
        );

        await Promise.all(
          uniqueDeductions.map(async (deduction) => {
            const ops: Promise<unknown>[] = [
              tx.product.update({
                where: { id: deduction.productId },
                data: { stock: { decrement: deduction.quantity } },
              }),
              tx.stockMovement.create({
                data: {
                  productId: deduction.productId,
                  branchId: input.branchId || null,
                  type: "OUT",
                  quantity: deduction.quantity,
                  note: deduction.note,
                  reference: invoiceNumber,
                },
              }),
            ];

            if (input.branchId) {
              ops.push(
                tx.branchStock.update({
                  where: {
                    branchId_productId: {
                      branchId: input.branchId,
                      productId: deduction.productId,
                    },
                  },
                  data: { quantity: { decrement: deduction.quantity } },
                }),
              );
            }

            return Promise.all(ops);
          }),
        );

        return newTx;
      },
      { maxWait: 5000, timeout: 20000 },
    );

    // Auto-create receivable debt for TERMIN payment
    const terminPayment = (input.payments ?? []).find(
      (p) => p.method === "TERMIN",
    );
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

    createAuditLog({
      action: "CREATE",
      entity: "Transaction",
      entityId: transaction.id,
      details: {
        data: {
          invoiceNumber,
          grandTotal: input.grandTotal,
          paymentMethod: input.paymentMethod,
          itemCount: input.items.length,
          ...(terminPayment && terminPayment.amount > 0
            ? { terminAmount: terminPayment.amount }
            : {}),
        },
      },
    }).catch(() => {});

    emitEvent(
      EVENTS.TRANSACTION_CREATED,
      {
        invoiceNumber: transaction.invoiceNumber,
        grandTotal: input.grandTotal,
      },
      input.branchId,
    );

    // Auto-create accounting journal
    import("@/server/actions/accounting")
      .then(({ createAutoJournal }) => {
        createAutoJournal({
          referenceType: "TRANSACTION",
          referenceId: transaction.id,
          ...(input.branchId ? { branchId: input.branchId } : {}),
        });
      })
      .catch(() => {});

    // Auto-create kitchen display order (if enabled)
    import("@/server/actions/settings")
      .then(async ({ getSetting }) => {
        const kitchenEnabled = await getSetting(
          "kitchen.enabled",
          input.branchId || null,
        );
        const autoSendKitchen = await getSetting(
          "pos.autoSendKitchen",
          input.branchId || null,
        );
        if (kitchenEnabled === "true" || autoSendKitchen === "true") {
          const { createOrderFromTransaction } =
            await import("@/server/actions/order-queue");
          createOrderFromTransaction(transaction.id);
        }
      })
      .catch(() => {});

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
    const tx0 = await prisma.transaction.findUnique({
      where: { id },
      select: { invoiceNumber: true, grandTotal: true, branchId: true },
    });

    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transaction) throw new Error("Transaksi tidak ditemukan");
      if (transaction.status !== "COMPLETED")
        throw new Error("Hanya transaksi COMPLETED yang bisa di-void");

      // Restore stock (use baseQty which accounts for unit conversion)
      await Promise.all(
        transaction.items.map(async (item) => {
          const restoreQty =
            item.baseQty ?? item.quantity * (item.conversionQty ?? 1);
          return Promise.all([
            tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: restoreQty } },
            }),
            tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: "IN",
                quantity: restoreQty,
                note: `Void transaksi ${transaction.invoiceNumber}`,
                reference: transaction.invoiceNumber,
              },
            }),
          ]);
        }),
      );

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

    createAuditLog({
      action: "VOID",
      entity: "Transaction",
      entityId: id,
      details: {
        data: {
          invoiceNumber: tx0?.invoiceNumber,
          grandTotal: tx0?.grandTotal,
          reason,
        },
      },
    }).catch(() => {});

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
    const tx0 = await prisma.transaction.findUnique({
      where: { id },
      select: { invoiceNumber: true, grandTotal: true, branchId: true },
    });

    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!transaction) throw new Error("Transaksi tidak ditemukan");
      if (transaction.status !== "COMPLETED")
        throw new Error("Hanya transaksi COMPLETED yang bisa di-refund");

      // Restore stock (use baseQty which accounts for unit conversion)
      await Promise.all(
        transaction.items.map(async (item) => {
          const restoreQty =
            item.baseQty ?? item.quantity * (item.conversionQty ?? 1);
          return Promise.all([
            tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: restoreQty } },
            }),
            tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: "IN",
                quantity: restoreQty,
                note: `Refund transaksi ${transaction.invoiceNumber}`,
                reference: transaction.invoiceNumber,
              },
            }),
          ]);
        }),
      );

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

    createAuditLog({
      action: "REFUND",
      entity: "Transaction",
      entityId: id,
      details: {
        data: {
          invoiceNumber: tx0?.invoiceNumber,
          grandTotal: tx0?.grandTotal,
          reason,
        },
      },
    }).catch(() => {});

    emitEvent(EVENTS.TRANSACTION_REFUNDED, { id }, tx0?.branchId || undefined);

    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gagal refund transaksi",
    };
  }
}
