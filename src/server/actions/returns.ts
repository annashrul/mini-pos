"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";

interface GetReturnsParams {
  page?: number;
  perPage?: number;
  limit?: number;
  search?: string;
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function getReturns(params: GetReturnsParams = {}) {
  await assertMenuActionAccess("returns", "view");

  const {
    page = 1,
    search,
    status,
    type,
    dateFrom,
    dateTo,
    branchId,
    sortBy,
    sortDir = "desc",
  } = params;
  const perPage = params.perPage || params.limit || 10;
  const skip = (page - 1) * perPage;

  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = { branch: { companyId } };
  if (branchId) where.branchId = branchId;
  if (status && status !== "ALL") where.status = status;
  if (type && type !== "ALL") where.type = type;
  if (search) {
    where.OR = [
      { returnNumber: { contains: search, mode: "insensitive" } },
      { transaction: { invoiceNumber: { contains: search, mode: "insensitive" } } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { reason: { contains: search, mode: "insensitive" } },
    ];
  }
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) createdAt.lte = new Date(dateTo + "T23:59:59");
    where.createdAt = createdAt;
  }

  const direction = sortDir === "asc" ? ("asc" as const) : ("desc" as const);
  const orderBy =
    sortBy === "returnNumber"
      ? { returnNumber: direction }
      : sortBy === "totalRefund"
        ? { totalRefund: direction }
        : sortBy === "status"
          ? { status: direction }
          : { createdAt: direction };

  const [returns, total] = await Promise.all([
    prisma.returnExchange.findMany({
      where,
      include: {
        transaction: { select: { invoiceNumber: true, grandTotal: true } },
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
        processedByUser: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, code: true } },
            exchangeProduct: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy,
      skip,
      take: perPage,
    }),
    prisma.returnExchange.count({ where }),
  ]);

  return {
    returns,
    total,
    totalPages: Math.ceil(total / perPage),
    currentPage: page,
  };
}

export async function getReturnById(id: string) {
  await assertMenuActionAccess("returns", "view");

  const returnData = await prisma.returnExchange.findUnique({
    where: { id },
    include: {
      transaction: {
        select: {
          id: true,
          invoiceNumber: true,
          grandTotal: true,
          subtotal: true,
          discountAmount: true,
          taxAmount: true,
          paymentMethod: true,
          status: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, code: true, sellingPrice: true } },
            },
          },
        },
      },
      customer: { select: { id: true, name: true, phone: true, email: true } },
      branch: { select: { id: true, name: true } },
      processedByUser: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, code: true, sellingPrice: true, imageUrl: true } },
          exchangeProduct: { select: { id: true, name: true, code: true, sellingPrice: true, imageUrl: true } },
        },
      },
    },
  });

  if (!returnData) {
    return { error: "Data return tidak ditemukan" };
  }

  return { data: returnData };
}

interface ReturnItemInput {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  reason: string | undefined;
  exchangeProductId: string | undefined;
  exchangeQuantity: number | undefined;
}

interface CreateReturnInput {
  transactionId: string;
  type: "RETURN" | "EXCHANGE";
  reason: string;
  notes: string | undefined;
  refundMethod: string | undefined;
  branchId: string | undefined;
  items: ReturnItemInput[];
}

export async function createReturn(input: CreateReturnInput) {
  await assertMenuActionAccess("returns", "create");

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  // Resolve user
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isActive: true },
  });
  if (!user || !user.isActive) {
    const userByEmail = session.user.email
      ? await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, isActive: true } })
      : null;
    if (!userByEmail || !userByEmail.isActive) {
      return { error: "Sesi tidak valid. Silakan login ulang." };
    }
  }
  const userId = user?.id ?? session.user.id;

  if (!input.items || input.items.length === 0) {
    return { error: "Pilih minimal satu item untuk di-return" };
  }

  if (!input.reason || input.reason.trim().length === 0) {
    return { error: "Alasan return wajib diisi" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Validate transaction exists
      const transaction = await tx.transaction.findUnique({
        where: { id: input.transactionId },
        include: {
          items: true,
          customer: { select: { id: true } },
        },
      });

      if (!transaction) {
        throw new Error("Transaksi tidak ditemukan");
      }

      if (transaction.status === "VOIDED") {
        throw new Error("Transaksi sudah di-void, tidak bisa di-return");
      }

      // Validate item quantities against original transaction
      for (const item of input.items) {
        const txItem = transaction.items.find((ti) => ti.productId === item.productId);
        if (!txItem) {
          throw new Error(`Produk ${item.productName} tidak ditemukan di transaksi ini`);
        }

        // Check already returned quantity
        const alreadyReturned = await tx.returnExchangeItem.aggregate({
          where: {
            productId: item.productId,
            returnExchange: {
              transactionId: input.transactionId,
              status: { in: ["PENDING", "APPROVED", "COMPLETED"] },
            },
          },
          _sum: { quantity: true },
        });

        const returnedQty = alreadyReturned._sum.quantity ?? 0;
        const availableQty = txItem.quantity - returnedQty;

        if (item.quantity > availableQty) {
          throw new Error(
            `Qty return ${item.productName} melebihi yang tersedia (maks: ${availableQty})`
          );
        }
      }

      // Validate exchange products exist
      if (input.type === "EXCHANGE") {
        for (const item of input.items) {
          if (item.exchangeProductId) {
            const exchangeProduct = await tx.product.findUnique({
              where: { id: item.exchangeProductId },
              select: { id: true, name: true, stock: true, isActive: true },
            });
            if (!exchangeProduct || !exchangeProduct.isActive) {
              throw new Error(`Produk pengganti tidak ditemukan atau tidak aktif`);
            }
          }
        }
      }

      // Generate return number: RET-YYMMDD-NNNN
      const today = new Date();
      const prefix = `RET-${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;

      const lastReturn = await tx.returnExchange.findFirst({
        where: { returnNumber: { startsWith: prefix } },
        orderBy: { returnNumber: "desc" },
      });

      let sequence = 1;
      if (lastReturn) {
        const lastSeq = parseInt(lastReturn.returnNumber.split("-").pop() || "0");
        sequence = lastSeq + 1;
      }
      const returnNumber = `${prefix}-${String(sequence).padStart(4, "0")}`;

      // Calculate total refund
      const totalRefund = input.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      );

      // Create return record
      const returnRecord = await tx.returnExchange.create({
        data: {
          returnNumber,
          transactionId: input.transactionId,
          customerId: transaction.customerId,
          type: input.type,
          status: "PENDING",
          reason: input.reason.trim(),
          notes: input.notes?.trim() || null,
          totalRefund,
          refundMethod: input.type === "RETURN" ? (input.refundMethod || "CASH") : null,
          branchId: input.branchId || transaction.branchId || null,
          processedBy: userId,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.unitPrice * item.quantity,
              reason: item.reason || null,
              exchangeProductId: item.exchangeProductId || null,
              exchangeQuantity: item.exchangeQuantity || null,
              restocked: false,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return returnRecord;
    }, { timeout: 15000 });

    revalidatePath("/returns");
    revalidatePath("/transactions");

    createAuditLog({
      action: "CREATE",
      entity: "ReturnExchange",
      entityId: result.id,
      details: {
        returnNumber: result.returnNumber,
        type: input.type,
        transactionId: input.transactionId,
        totalRefund: result.totalRefund,
        itemCount: input.items.length,
      },
      ...(input.branchId ? { branchId: input.branchId } : {}),
    }).catch(() => {});

    return { data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal membuat return";
    return { error: message };
  }
}

export async function approveReturn(id: string) {
  await assertMenuActionAccess("returns", "approve");

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const returnRecord = await tx.returnExchange.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, stock: true } },
            },
          },
          transaction: { select: { branchId: true } },
        },
      });

      if (!returnRecord) {
        throw new Error("Data return tidak ditemukan");
      }

      if (returnRecord.status !== "PENDING") {
        throw new Error("Return ini sudah diproses sebelumnya");
      }

      const branchId = returnRecord.branchId || returnRecord.transaction.branchId;

      // Restock returned items
      for (const item of returnRecord.items) {
        // Update global stock
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });

        // Update branch stock if applicable
        if (branchId) {
          const existingBs = await tx.branchStock.findFirst({ where: { branchId, productId: item.productId } });
          if (existingBs) {
            await tx.branchStock.update({ where: { id: existingBs.id }, data: { quantity: { increment: item.quantity } } });
          } else {
            await tx.branchStock.create({ data: { branchId, productId: item.productId, quantity: item.quantity } });
          }
        }

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            note: `Return: ${returnRecord.returnNumber} - ${item.productName}`,
            branchId: branchId || null,
          },
        });

        // Mark item as restocked
        await tx.returnExchangeItem.update({
          where: { id: item.id },
          data: { restocked: true },
        });

        // For exchange: deduct stock for the replacement product
        if (returnRecord.type === "EXCHANGE" && item.exchangeProductId && item.exchangeQuantity) {
          const exchangeQty = item.exchangeQuantity;

          await tx.product.update({
            where: { id: item.exchangeProductId },
            data: { stock: { decrement: exchangeQty } },
          });

          if (branchId) {
            const bs = await tx.branchStock.findUnique({
              where: {
                branchId_productId: {
                  branchId,
                  productId: item.exchangeProductId,
                },
              },
            });
            if (bs) {
              await tx.branchStock.update({
                where: {
                  branchId_productId: {
                    branchId,
                    productId: item.exchangeProductId,
                  },
                },
                data: { quantity: { decrement: exchangeQty } },
              });
            }
          }

          await tx.stockMovement.create({
            data: {
              productId: item.exchangeProductId,
              type: "OUT",
              quantity: exchangeQty,
              note: `Exchange: ${returnRecord.returnNumber} - pengganti ${item.productName}`,
              branchId: branchId || null,
            },
          });
        }
      }

      // Update return status
      const updated = await tx.returnExchange.update({
        where: { id },
        data: {
          status: "COMPLETED",
          approvedBy: session.user!.id,
          approvedAt: new Date(),
        },
      });

      return updated;
    }, { timeout: 15000 });

    revalidatePath("/returns");
    revalidatePath("/stock");
    revalidatePath("/products");

    createAuditLog({
      action: "APPROVE",
      entity: "ReturnExchange",
      entityId: id,
      details: {
        returnNumber: result.returnNumber,
        type: result.type,
        totalRefund: result.totalRefund,
      },
      ...(result.branchId ? { branchId: result.branchId } : {}),
    }).catch(() => {});

    // Auto-create accounting journal for return
    import("@/server/actions/accounting").then(({ createAutoJournal }) => {
      createAutoJournal({
        referenceType: "RETURN",
        referenceId: id,
      });
    }).catch(() => {});

    return { data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyetujui return";
    return { error: message };
  }
}

export async function rejectReturn(id: string, reason: string) {
  await assertMenuActionAccess("returns", "reject");

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  if (!reason || reason.trim().length === 0) {
    return { error: "Alasan penolakan wajib diisi" };
  }

  try {
    const returnRecord = await prisma.returnExchange.findUnique({
      where: { id },
      select: { id: true, status: true, returnNumber: true, branchId: true },
    });

    if (!returnRecord) {
      return { error: "Data return tidak ditemukan" };
    }

    if (returnRecord.status !== "PENDING") {
      return { error: "Return ini sudah diproses sebelumnya" };
    }

    const updated = await prisma.returnExchange.update({
      where: { id },
      data: {
        status: "REJECTED",
        notes: reason.trim(),
        approvedBy: session.user.id,
        approvedAt: new Date(),
      },
    });

    revalidatePath("/returns");

    createAuditLog({
      action: "REJECT",
      entity: "ReturnExchange",
      entityId: id,
      details: {
        returnNumber: returnRecord.returnNumber,
        reason: reason.trim(),
      },
      ...(returnRecord.branchId ? { branchId: returnRecord.branchId } : {}),
    }).catch(() => {});

    return { data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menolak return";
    return { error: message };
  }
}

export async function getReturnStats(branchId?: string) {
  await assertMenuActionAccess("returns", "view");
  const companyId = await getCurrentCompanyId();

  const where: Record<string, unknown> = { branch: { companyId } };
  if (branchId) where.branchId = branchId;

  const [totalReturns, totalExchanges, pendingCount, refundAgg] = await Promise.all([
    prisma.returnExchange.count({ where: { ...where, type: "RETURN" } }),
    prisma.returnExchange.count({ where: { ...where, type: "EXCHANGE" } }),
    prisma.returnExchange.count({ where: { ...where, status: "PENDING" } }),
    prisma.returnExchange.aggregate({
      where: { ...where, status: { in: ["APPROVED", "COMPLETED"] } },
      _sum: { totalRefund: true },
    }),
  ]);

  return {
    totalReturns,
    totalExchanges,
    pendingCount,
    totalRefundAmount: refundAgg._sum.totalRefund ?? 0,
  };
}

export async function searchTransactionForReturn(invoiceNumber: string) {
  await assertMenuActionAccess("returns", "create");

  if (!invoiceNumber || invoiceNumber.trim().length === 0) {
    return { error: "Masukkan nomor invoice" };
  }

  const companyId = await getCurrentCompanyId();
  const transaction = await prisma.transaction.findFirst({
    where: {
      invoiceNumber: { equals: invoiceNumber.trim(), mode: "insensitive" },
      branch: { companyId },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      branch: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      items: {
        include: {
          product: {
            select: { id: true, name: true, code: true, sellingPrice: true, imageUrl: true, isActive: true },
          },
        },
      },
    },
  });

  if (!transaction) {
    return { error: "Transaksi tidak ditemukan" };
  }

  if (transaction.status === "VOIDED") {
    return { error: "Transaksi ini sudah di-void" };
  }

  // Get already returned quantities per product
  const existingReturns = await prisma.returnExchangeItem.groupBy({
    by: ["productId"],
    where: {
      returnExchange: {
        transactionId: transaction.id,
        status: { in: ["PENDING", "APPROVED", "COMPLETED"] },
      },
    },
    _sum: { quantity: true },
  });

  const returnedMap = new Map(
    existingReturns.map((r) => [r.productId, r._sum.quantity ?? 0])
  );

  const itemsWithAvailability = transaction.items.map((item) => ({
    ...item,
    returnedQty: returnedMap.get(item.productId) ?? 0,
    availableQty: item.quantity - (returnedMap.get(item.productId) ?? 0),
  }));

  return {
    data: {
      ...transaction,
      items: itemsWithAvailability,
    },
  };
}

export async function searchProductsForExchange(query: string, branchId?: string) {
  await assertMenuActionAccess("returns", "create");

  if (!query || query.trim().length < 2) {
    return { products: [] };
  }

  const companyId = await getCurrentCompanyId();
  const where: Record<string, unknown> = {
    isActive: true,
    deletedAt: null,
    companyId,
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { code: { contains: query, mode: "insensitive" } },
      { barcode: { contains: query, mode: "insensitive" } },
    ],
  };

  const selectBase = {
    id: true as const,
    name: true as const,
    code: true as const,
    sellingPrice: true as const,
    stock: true as const,
    imageUrl: true as const,
    unit: true as const,
  };

  if (branchId) {
    const products = await prisma.product.findMany({
      where,
      select: {
        ...selectBase,
        branchStocks: { where: { branchId }, select: { quantity: true } },
      },
      take: 20,
      orderBy: { name: "asc" },
    });

    return {
      products: products.map((p) => ({
        ...p,
        availableStock: p.branchStocks[0] ? p.branchStocks[0].quantity : p.stock,
      })),
    };
  }

  const products = await prisma.product.findMany({
    where,
    select: selectBase,
    take: 20,
    orderBy: { name: "asc" },
  });

  return {
    products: products.map((p) => ({
      ...p,
      availableStock: p.stock,
    })),
  };
}
