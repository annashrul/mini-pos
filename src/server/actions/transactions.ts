"use server";

import { prisma } from "@/lib/prisma";

import { auth } from "@/lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { redisDelByPrefix } from "@/lib/redis";
import { emitEvent, EVENTS } from "@/lib/socket-emit";
import { getCurrentCompanyId } from "@/lib/company";
import { randomBytes } from "crypto";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";
import { serverCache } from "@/lib/server-cache";

async function invalidateAccelerate(tags: string[]) {
  const accelerate = (
    prisma as unknown as {
      $accelerate?: {
        invalidate: (args: { tags: string[] }) => Promise<unknown>;
      };
    }
  ).$accelerate;
  if (!accelerate) return;
  try {
    await accelerate.invalidate({ tags });
  } catch {
    //
  }
}

async function invalidateRedisDashboard(branchId?: string) {
  try {
    if (branchId) {
      await redisDelByPrefix(`dashboard:stats:${branchId}:`);
      await redisDelByPrefix(`reports:`);
      return;
    }
    await redisDelByPrefix("dashboard:stats:");
    await redisDelByPrefix("reports:");
  } catch {
    //
  }
}

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
  // Installment config (for TERMIN)
  terminConfig?: {
    downPayment: number;
    installmentCount: number;
    interval: "WEEKLY" | "MONTHLY";
  };
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

function isInvoiceNumberConflict(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    code?: string;
    meta?: { target?: unknown };
    message?: string;
  };
  if (e.code === "P2002") {
    const target = e.meta?.target;
    if (Array.isArray(target) && target.includes("invoiceNumber")) return true;
  }
  return e.message?.includes("invoiceNumber") ?? false;
}

function normalizeCodePart(value: string | null | undefined, fallback: string) {
  const clean = (value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return clean || fallback;
}

function randomInvoicePart(length = 8) {
  return randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .toUpperCase()
    .slice(0, length);
}

export async function createTransaction(
  input: CreateTransactionInput,
  retryCount = 0,
) {
  await assertMenuActionAccess("pos", "create");
  const authResult = await resolveSessionUserId();
  if ("error" in authResult) {
    return { error: authResult.error };
  }
  const userId = authResult.userId;
  const companyId = await getCurrentCompanyId();
  const [company, branch] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { slug: true, name: true },
    }),
    input.branchId
      ? prisma.branch.findUnique({
          where: { id: input.branchId },
          select: { code: true, name: true },
        })
      : Promise.resolve(null),
  ]);
  const companyCode = normalizeCodePart(
    company?.slug || company?.name,
    "COMPANY",
  );
  const branchCode = normalizeCodePart(branch?.code || branch?.name, "MAIN");
  const invoiceNumber = `${companyCode}-${branchCode}-${randomInvoicePart(8)}`;

  // TERMIN validation: customer is required
  const hasTermin = input.paymentMethod === "TERMIN" || input.payments?.some((p) => p.method === "TERMIN");
  if (hasTermin && !input.customerId) {
    return { error: "Pembayaran termin memerlukan data customer. Pilih customer terlebih dahulu." };
  }

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

        if (input.branchId) {
          await tx.$executeRaw`
            select
              set_config('app.stock_note', ${`Penjualan ${invoiceNumber}`}, true),
              set_config('app.stock_reference', ${invoiceNumber}, true)
          `;
        }

        await Promise.all(
          uniqueDeductions.map(async (deduction) => {
            if (input.branchId) {
              return tx.branchStock.update({
                where: {
                  branchId_productId: {
                    branchId: input.branchId,
                    productId: deduction.productId,
                  },
                },
                data: { quantity: { decrement: deduction.quantity } },
              });
            }

            return Promise.all([
              tx.product.update({
                where: { id: deduction.productId },
                data: { stock: { decrement: deduction.quantity } },
              }),
              tx.stockMovement.create({
                data: {
                  productId: deduction.productId,
                  branchId: null,
                  type: "OUT",
                  quantity: deduction.quantity,
                  note: deduction.note,
                  reference: invoiceNumber,
                },
              }),
            ]);
          }),
        );

        return newTx;
      },
      { maxWait: 10000, timeout: 15000 },
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
      // Due date: default 30 days, or last installment due date
      const tc = input.terminConfig;
      const dueDate = new Date();
      if (tc) {
        if (tc.interval === "WEEKLY") dueDate.setDate(dueDate.getDate() + tc.installmentCount * 7);
        else dueDate.setMonth(dueDate.getMonth() + tc.installmentCount);
      } else {
        dueDate.setDate(dueDate.getDate() + 30);
      }

      const dpAmount = tc?.downPayment ?? 0;
      const initialPaid = dpAmount;
      const initialRemaining = terminPayment.amount - initialPaid;

      const debt = await prisma.debt.create({
        data: {
          type: "RECEIVABLE",
          referenceType: "TRANSACTION",
          referenceId: transaction.id,
          partyType: "CUSTOMER",
          partyId: input.customerId || null,
          partyName,
          description: `Termin pembayaran invoice ${transaction.invoiceNumber}`,
          totalAmount: terminPayment.amount,
          paidAmount: initialPaid,
          remainingAmount: Math.max(initialRemaining, 0),
          status: initialRemaining <= 0 ? "PAID" : initialPaid > 0 ? "PARTIAL" : "UNPAID",
          dueDate,
          branchId: input.branchId || null,
          companyId,
          createdBy: userId,
          downPayment: dpAmount > 0 ? dpAmount : null,
          installmentCount: tc?.installmentCount ?? null,
          installmentInterval: tc?.interval ?? null,
        },
      });

      // Create installment schedule if configured
      if (tc && tc.installmentCount > 0) {
        const remainAfterDp = terminPayment.amount - dpAmount;
        const perInst = Math.ceil(remainAfterDp / tc.installmentCount);
        const installments: { debtId: string; installmentNo: number; amount: number; dueDate: Date }[] = [];
        const now = new Date();
        for (let i = 0; i < tc.installmentCount; i++) {
          const instDue = new Date(now);
          if (tc.interval === "WEEKLY") instDue.setDate(instDue.getDate() + (i + 1) * 7);
          else instDue.setMonth(instDue.getMonth() + (i + 1));
          installments.push({
            debtId: debt.id,
            installmentNo: i + 1,
            amount: i === tc.installmentCount - 1 ? remainAfterDp - perInst * (tc.installmentCount - 1) : perInst,
            dueDate: instDue,
          });
        }
        await prisma.installment.createMany({ data: installments });

        // Record DP as payment if > 0
        if (dpAmount > 0) {
          await prisma.debtPayment.create({
            data: { debtId: debt.id, amount: dpAmount, method: "CASH", notes: "Down Payment (DP)", paidBy: userId },
          });
        }
      }
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
    serverCache.invalidate(`transactions:${companyId}`, `import-tx:${companyId}`);
    revalidatePath("/products");
    revalidatePath("/customers");
    if (terminPayment && terminPayment.amount > 0) {
      revalidatePath("/debts");
    }
    revalidateTag("dashboard-stats", "max");
    revalidateTag("accounting-dashboard", "max");
    invalidateAccelerate(["dashboard_stats", "accounting_dashboard"]).catch(
      () => {},
    );
    invalidateRedisDashboard(input.branchId).catch(() => {});

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
        }).catch((err) => console.error("[AutoJournal TRANSACTION] Failed:", err?.message ?? err));
      })
      .catch((err) => console.error("[AutoJournal import] Failed:", err));

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
    if (isInvoiceNumberConflict(err) && retryCount < 3) {
      return createTransaction(input, retryCount + 1);
    }
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
  const companyId = await getCurrentCompanyId();

  const key = `transactions:${companyId}:${JSON.stringify(params)}`;
  return serverCache.get(key, async () => {

  const esc = (v: string) => v.replace(/'/g, "''");
  const conditions: string[] = [`u."companyId" = '${esc(companyId)}'`];

  if (search) conditions.push(`t."invoiceNumber" ILIKE '%${esc(search)}%'`);
  if (dateFrom) conditions.push(`t."createdAt" >= '${esc(dateFrom)}'::date`);
  if (dateTo) conditions.push(`t."createdAt" < ('${esc(dateTo)}'::date + interval '1 day')`);
  if (status && status !== "all") conditions.push(`t.status = '${esc(status)}'`);
  if (branchId) conditions.push(`t."branchId" = '${esc(branchId)}'`);
  if (userId) conditions.push(`t."userId" = '${esc(userId)}'`);
  if (shiftId) conditions.push(`t."shiftId" = '${esc(shiftId)}'`);

  const whereClause = conditions.join(" AND ");
  const dir = sortDir === "asc" ? "ASC" : "DESC";
  const orderColumn =
    sortBy === "invoiceNumber" ? `t."invoiceNumber" ${dir}`
    : sortBy === "grandTotal" ? `t."grandTotal" ${dir}`
    : sortBy === "paymentMethod" ? `t."paymentMethod" ${dir}`
    : sortBy === "user" ? `u.name ${dir}`
    : `t."createdAt" ${dir}`;
  const offset = (page - 1) * limit;

  const dataQuery = `
    SELECT
      t.id, t."invoiceNumber", t."userId", t."branchId", t."customerId",
      t.subtotal::float8, t."discountAmount"::float8, t."taxAmount"::float8,
      t."grandTotal"::float8, t."paymentMethod", t."paymentAmount"::float8,
      t."changeAmount"::float8, t.status, t.notes, t."createdAt", t."updatedAt",
      u.name AS user_name,
      br.name AS branch_name,
      cu.name AS customer_name
    FROM transactions t
    JOIN users u ON u.id = t."userId"
    LEFT JOIN branches br ON br.id = t."branchId"
    LEFT JOIN customers cu ON cu.id = t."customerId"
    WHERE ${whereClause}
    ORDER BY ${orderColumn}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [rawRows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(dataQuery),
    prisma.$queryRawUnsafe<[{ total: number }]>(`SELECT COUNT(*)::int4 AS total FROM transactions t JOIN users u ON u.id = t."userId" WHERE ${whereClause}`),
  ]);

  const total = Number(countResult[0]?.total ?? 0);
  const txIds = rawRows.map((r) => `'${r.id}'`).join(",");

  // Fetch payments for these transactions (1 query, not N)
  const payments = txIds
    ? await prisma.$queryRawUnsafe<{ transactionId: string; id: string; method: string; amount: number }[]>(
        `SELECT id, "transactionId", method, amount::float8 FROM payments WHERE "transactionId" IN (${txIds}) ORDER BY amount DESC`
      )
    : [];
  const paymentsByTx = new Map<string, typeof payments>();
  for (const p of payments) {
    if (!paymentsByTx.has(p.transactionId)) paymentsByTx.set(p.transactionId, []);
    paymentsByTx.get(p.transactionId)!.push(p);
  }

  const transactions = rawRows.map((r) => ({
    id: r.id as string,
    invoiceNumber: r.invoiceNumber as string,
    userId: r.userId as string,
    user: { name: r.user_name as string },
    branchId: r.branchId as string | null,
    branch: r.branch_name ? { name: r.branch_name as string } : null,
    customerId: r.customerId as string | null,
    customer: r.customer_name ? { name: r.customer_name as string } : null,
    subtotal: Number(r.subtotal),
    discountAmount: Number(r.discountAmount),
    taxAmount: Number(r.taxAmount),
    grandTotal: Number(r.grandTotal),
    paymentMethod: r.paymentMethod as string,
    paymentAmount: Number(r.paymentAmount),
    changeAmount: Number(r.changeAmount),
    status: r.status as string,
    notes: r.notes as string | null,
    createdAt: r.createdAt as Date,
    updatedAt: r.updatedAt as Date,
    items: [],
    payments: paymentsByTx.get(r.id as string) ?? [],
  }));

  return {
    transactions,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };

  }, { ttl: 15, tags: [`transactions:${companyId}`] });
}

export async function getTransactionStats(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const key = `tx-stats:${companyId}:${branchId || "all"}`;
  return serverCache.get(key, async () => {
    const branchFilter = branchId ? `AND t."branchId" = '${branchId.replace(/'/g, "''")}'` : "";
    const result = await prisma.$queryRawUnsafe<[{
      total: number; completed: number; voided: number; refunded: number; revenue: number;
    }]>(`
      SELECT
        COUNT(*)::int4 AS total,
        COUNT(*) FILTER (WHERE t.status = 'COMPLETED')::int4 AS completed,
        COUNT(*) FILTER (WHERE t.status = 'VOIDED')::int4 AS voided,
        COUNT(*) FILTER (WHERE t.status = 'REFUNDED')::int4 AS refunded,
        COALESCE(SUM(t."grandTotal") FILTER (WHERE t.status = 'COMPLETED'), 0)::float8 AS revenue
      FROM transactions t
      JOIN users u ON u.id = t."userId"
      WHERE u."companyId" = '${companyId.replace(/'/g, "''")}' ${branchFilter}
    `);
    const r = result[0];
    return {
      total: Number(r.total),
      completed: Number(r.completed),
      voided: Number(r.voided),
      refunded: Number(r.refunded),
      totalRevenue: Number(r.revenue),
    };
  }, { ttl: 15, tags: [`transactions:${companyId}`] });
}

export async function getTransactionById(id: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.transaction.findFirst({
    where: { id, user: { companyId } },
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
  const companyId = await getCurrentCompanyId();

  try {
    const tx0 = await prisma.transaction.findFirst({
      where: { id, user: { companyId } },
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

      if (transaction.branchId) {
        await tx.$executeRaw`
          select
            set_config('app.stock_note', ${`Void transaksi ${transaction.invoiceNumber}`}, true),
            set_config('app.stock_reference', ${transaction.invoiceNumber}, true)
        `;
      }

      // Restore stock (use baseQty which accounts for unit conversion)
      await Promise.all(
        transaction.items.map(async (item) => {
          const restoreQty =
            item.baseQty ?? item.quantity * (item.conversionQty ?? 1);
          if (transaction.branchId) {
            return tx.branchStock.upsert({
              where: {
                branchId_productId: {
                  branchId: transaction.branchId,
                  productId: item.productId,
                },
              },
              create: {
                branchId: transaction.branchId,
                productId: item.productId,
                quantity: restoreQty,
              },
              update: {
                quantity: { increment: restoreQty },
              },
            });
          }
          return Promise.all([
            tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: restoreQty } },
            }),
            tx.stockMovement.create({
              data: {
                productId: item.productId,
                branchId: null,
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
    serverCache.invalidate(`transactions:${companyId}`, `import-tx:${companyId}`);
    revalidatePath("/dashboard");
    revalidatePath("/products");
    revalidateTag("dashboard-stats", "seconds");
    revalidateTag("accounting-dashboard", "seconds");
    if (tx0?.branchId) {
      revalidateTag(`dashboard-stats:${tx0.branchId}`, "max");
      revalidateTag(`accounting-dashboard:${tx0.branchId}`, "max");
    }
    invalidateAccelerate(["dashboard_stats", "accounting_dashboard"]).catch(
      () => {},
    );
    invalidateRedisDashboard(tx0?.branchId || undefined).catch(() => {});

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
  const companyId = await getCurrentCompanyId();

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

      if (transaction.branchId) {
        await tx.$executeRaw`
          select
            set_config('app.stock_note', ${`Refund transaksi ${transaction.invoiceNumber}`}, true),
            set_config('app.stock_reference', ${transaction.invoiceNumber}, true)
        `;
      }

      // Restore stock (use baseQty which accounts for unit conversion)
      await Promise.all(
        transaction.items.map(async (item) => {
          const restoreQty =
            item.baseQty ?? item.quantity * (item.conversionQty ?? 1);
          if (transaction.branchId) {
            return tx.branchStock.upsert({
              where: {
                branchId_productId: {
                  branchId: transaction.branchId,
                  productId: item.productId,
                },
              },
              create: {
                branchId: transaction.branchId,
                productId: item.productId,
                quantity: restoreQty,
              },
              update: {
                quantity: { increment: restoreQty },
              },
            });
          }
          return Promise.all([
            tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: restoreQty } },
            }),
            tx.stockMovement.create({
              data: {
                productId: item.productId,
                branchId: null,
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
    serverCache.invalidate(`transactions:${companyId}`, `import-tx:${companyId}`);
    revalidatePath("/dashboard");
    revalidatePath("/products");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("accounting-dashboard", "max");
    if (tx0?.branchId) {
      revalidateTag(`dashboard-stats:${tx0.branchId}`, "max");
      revalidateTag(`accounting-dashboard:${tx0.branchId}`, "max");
    }
    invalidateAccelerate(["dashboard_stats", "accounting_dashboard"]).catch(
      () => {},
    );
    invalidateRedisDashboard(tx0?.branchId || undefined).catch(() => {});

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

// ─── Import Transactions ───

interface ImportTransactionRow {
  invoiceNumber: string;
  date: string;
  cashierName: string;
  customerName: string;
  paymentMethod: string;
  items: string; // "kode:qty:harga,kode:qty:harga"
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  notes: string;
}

const VALID_PAYMENT_METHODS = ["CASH", "TRANSFER", "QRIS", "EWALLET", "DEBIT", "CREDIT_CARD", "TERMIN"] as const;

export async function importTransactions(rows: ImportTransactionRow[], branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const session = await auth();
  if (!session?.user?.id) return { results: [], successCount: 0, failedCount: rows.length };

  // Lookup — cached for 60s to avoid repeated queries across batches
  const lookupKey = `import-tx-lookup:${companyId}`;
  const lookup = await serverCache.get(lookupKey, async () => {
    await assertMenuActionAccess("transactions", "import");
    const [allProducts, allUsers, allCustomers, company] = await Promise.all([
      prisma.product.findMany({ where: { companyId }, select: { id: true, code: true, name: true, sellingPrice: true, unit: true } }),
      prisma.user.findMany({ where: { companyId }, select: { id: true, name: true } }),
      prisma.customer.findMany({ where: { companyId }, select: { id: true, name: true } }),
      prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } }),
    ]);
    return { allProducts, allUsers, allCustomers, company };
  }, { ttl: 60, tags: [`import-tx:${companyId}`] });

  const { allProducts, allUsers, allCustomers, company } = lookup;

  const productMap = new Map(allProducts.map((p) => [p.code.toLowerCase().trim(), p]));
  const userMap = new Map(allUsers.map((u) => [u.name.toLowerCase().trim(), u.id]));
  const customerMap = new Map(allCustomers.map((c) => [c.name.toLowerCase().trim(), c.id]));
  const companySlug = company?.slug?.toUpperCase() || "TRX";

  type ResultItem = { row: number; success: boolean; name: string; error?: string };
  const results: ResultItem[] = [];
  const esc = (v: string) => v.replace(/'/g, "''");

  // Phase 1: Validate all rows, prepare data
  interface ValidTx {
    rowNum: number;
    txId: string;
    invoiceNumber: string;
    userId: string;
    customerId: string | null;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    grandTotal: number;
    paymentMethod: string;
    notes: string | null;
    createdAt: string;
    items: { productId: string; productName: string; productCode: string; quantity: number; unitPrice: number; unit: string }[];
  }
  const validTxs: ValidTx[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    const label = row.invoiceNumber || `Baris ${rowNum}`;

    if (!row.items?.trim()) {
      results.push({ row: rowNum, success: false, name: label, error: "Item transaksi wajib diisi" });
      continue;
    }

    // Parse items
    const itemPairs = row.items.split(",").map((s) => s.trim()).filter(Boolean);
    const parsedItems: ValidTx["items"] = [];
    let itemError = false;
    for (const pair of itemPairs) {
      const parts = pair.split(":").map((s) => s.trim());
      const product = productMap.get((parts[0] || "").toLowerCase());
      if (!product) {
        results.push({ row: rowNum, success: false, name: label, error: `Produk "${parts[0]}" tidak ditemukan` });
        itemError = true; break;
      }
      parsedItems.push({
        productId: product.id, productName: product.name, productCode: product.code,
        quantity: Number(parts[1]) || 1, unitPrice: parts[2] ? Number(parts[2]) : product.sellingPrice, unit: product.unit,
      });
    }
    if (itemError) continue;

    const pm = (row.paymentMethod || "CASH").toUpperCase().trim();
    if (!VALID_PAYMENT_METHODS.includes(pm as typeof VALID_PAYMENT_METHODS[number])) {
      results.push({ row: rowNum, success: false, name: label, error: `Metode "${row.paymentMethod}" tidak valid` });
      continue;
    }

    const userId = row.cashierName ? (userMap.get(row.cashierName.toLowerCase().trim()) ?? session.user.id) : session.user.id;
    const customerId = row.customerName && row.customerName.toLowerCase() !== "walk-in"
      ? (customerMap.get(row.customerName.toLowerCase().trim()) ?? null) : null;
    const subtotal = parsedItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const discountAmount = Number(row.discountAmount) || 0;
    const taxAmount = Number(row.taxAmount) || 0;
    const grandTotal = row.grandTotal > 0 ? row.grandTotal : subtotal - discountAmount + taxAmount;
    const invoiceNumber = row.invoiceNumber?.trim() || `${companySlug}-IMP-${randomBytes(4).toString("hex").toUpperCase()}`;
    const createdAt = row.date ? new Date(row.date).toISOString() : new Date().toISOString();

    validTxs.push({
      rowNum, txId: crypto.randomUUID(), invoiceNumber, userId, customerId,
      subtotal, discountAmount, taxAmount, grandTotal, paymentMethod: pm,
      notes: row.notes?.trim() || null, createdAt, items: parsedItems,
    });
  }

  // Phase 2: Bulk insert via raw SQL in transaction
  if (validTxs.length > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        // INSERT transactions
        const txValues = validTxs.map((t) =>
          `('${t.txId}', '${esc(t.invoiceNumber)}', '${esc(t.userId)}', ${branchId ? `'${esc(branchId)}'` : "NULL"}, ${t.customerId ? `'${esc(t.customerId)}'` : "NULL"}, ${t.subtotal}, ${t.discountAmount}, ${t.taxAmount}, ${t.grandTotal}, '${t.paymentMethod}', ${t.grandTotal}, 0, 'COMPLETED', ${t.notes ? `'${esc(t.notes)}'` : "NULL"}, '${t.createdAt}'::timestamptz, NOW())`
        ).join(",");

        await tx.$executeRawUnsafe(`
          INSERT INTO transactions (id, "invoiceNumber", "userId", "branchId", "customerId", subtotal, "discountAmount", "taxAmount", "grandTotal", "paymentMethod", "paymentAmount", "changeAmount", status, notes, "createdAt", "updatedAt")
          VALUES ${txValues}
          ON CONFLICT ("invoiceNumber") DO NOTHING
        `);

        // INSERT transaction_items
        const itemValues = validTxs.flatMap((t) =>
          t.items.map((it) =>
            `(gen_random_uuid(), '${t.txId}', '${esc(it.productId)}', '${esc(it.productName)}', '${esc(it.productCode)}', ${it.quantity}, '${esc(it.unit)}', 1, ${it.unitPrice}, 0, ${it.unitPrice * it.quantity}, NOW())`
          )
        ).join(",");

        if (itemValues) {
          await tx.$executeRawUnsafe(`
            INSERT INTO transaction_items (id, "transactionId", "productId", "productName", "productCode", quantity, "unitName", "conversionQty", "unitPrice", discount, subtotal, "createdAt")
            VALUES ${itemValues}
          `);
        }

        // INSERT payments
        const payValues = validTxs.map((t) =>
          `(gen_random_uuid(), '${t.txId}', '${t.paymentMethod}', ${t.grandTotal}, NOW())`
        ).join(",");

        await tx.$executeRawUnsafe(`
          INSERT INTO payments (id, "transactionId", method, amount, "createdAt")
          VALUES ${payValues}
        `);
      }, { timeout: 120000 });

      for (const t of validTxs) {
        results.push({ row: t.rowNum, success: true, name: t.invoiceNumber });
      }
    } catch (err) {
      console.error("[Import Transactions] Error:", err);
      const msg = err instanceof Error ? err.message : "";
      for (const t of validTxs) {
        results.push({ row: t.rowNum, success: false, name: t.invoiceNumber, error: msg.includes("Unique") ? "Invoice duplikat" : "Gagal menyimpan" });
      }
    }
  }

  revalidatePath("/transactions");
  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  return { results, successCount, failedCount };
}

const TRANSACTION_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { header: "Invoice", width: 18, sampleValues: ["INV-001", "INV-002"] },
  { header: "Tanggal", width: 20, sampleValues: ["2026-04-14 10:30:00", "2026-04-14 11:00:00"] },
  { header: "Kasir", width: 14, sampleValues: ["Kasir A", "Kasir B"] },
  { header: "Pelanggan", width: 14, sampleValues: ["Walk-in", "Budi"] },
  { header: "Metode Pembayaran", width: 18, sampleValues: ["CASH", "QRIS"] },
  { header: "Item (kode:qty:harga) *", width: 35, sampleValues: ["PRD-00001:2:3500,PRD-00002:1:4000", "PRD-00003:5:5000"] },
  { header: "Diskon", width: 10, sampleValues: ["0", "1000"] },
  { header: "Pajak", width: 10, sampleValues: ["0", "500"] },
  { header: "Total", width: 12, sampleValues: ["11000", "24500"] },
  { header: "Catatan", width: 20, sampleValues: ["", "Pelanggan member"] },
];

export async function downloadTransactionImportTemplate(format: "csv" | "excel" | "docx") {
  const companyId = await getCurrentCompanyId();
  const products = await prisma.product.findMany({
    where: { companyId, isActive: true },
    select: { code: true, name: true },
    orderBy: { code: "asc" },
    take: 20,
  });

  const notes = [
    `Produk (kode): ${products.map((p) => `${p.code} (${p.name})`).join(", ") || "-"}`,
    "Format Item: kode_produk:jumlah:harga dipisah koma. Harga opsional (default harga jual produk)",
    "Metode: CASH, TRANSFER, QRIS, EWALLET, DEBIT, CREDIT_CARD, TERMIN",
    "Invoice otomatis jika dikosongkan",
    "Kolom dengan tanda * wajib diisi",
  ];

  const result = await generateImportTemplate(TRANSACTION_TEMPLATE_COLUMNS, 2, notes, format);
  return {
    data: result.data,
    filename: `template-import-transaksi.${format === "excel" ? "xlsx" : format}`,
    mimeType: result.mimeType,
  };
}
