"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { customerSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";

export async function getCustomers(params?: {
  search?: string;
  memberLevel?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const { search, memberLevel, page = 1, perPage = 10, sortBy, sortDir = "desc" } = params || {};
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (memberLevel && memberLevel !== "ALL") {
    where.memberLevel = memberLevel;
  }

  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy =
    sortBy === "name"
      ? { name: direction }
      : sortBy === "phone"
        ? { phone: direction }
        : sortBy === "email"
          ? { email: direction }
          : sortBy === "memberLevel"
            ? { memberLevel: direction }
            : sortBy === "totalSpending"
              ? { totalSpending: direction }
              : sortBy === "points"
                ? { points: direction }
                : { createdAt: direction };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: { _count: { select: { transactions: true } } },
    }),
    prisma.customer.count({ where }),
  ]);

  return { customers, total, totalPages: Math.ceil(total / perPage) };
}

export async function createCustomer(data: FormData) {
  await assertMenuActionAccess("customers", "create");
  const rawDob = data.get("dateOfBirth");
  const parsed = customerSchema.safeParse({
    name: data.get("name"),
    phone: data.get("phone") || null,
    email: data.get("email") || null,
    address: data.get("address") || null,
    memberLevel: data.get("memberLevel") || "REGULAR",
    dateOfBirth: rawDob ? new Date(rawDob as string) : null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    await prisma.customer.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        address: parsed.data.address ?? null,
        memberLevel: parsed.data.memberLevel,
        dateOfBirth: parsed.data.dateOfBirth ?? null,
      },
    });
    createAuditLog({ action: "CREATE", entity: "Customer", details: { data: { name: parsed.data.name, phone: parsed.data.phone ?? null, email: parsed.data.email ?? null, address: parsed.data.address ?? null, memberLevel: parsed.data.memberLevel } } }).catch(() => {});
    revalidatePath("/customers");
    return { success: true };
  } catch {
    return { error: "Gagal menambahkan customer" };
  }
}

export async function updateCustomer(id: string, data: FormData) {
  await assertMenuActionAccess("customers", "update");
  const rawDob = data.get("dateOfBirth");
  const parsed = customerSchema.safeParse({
    name: data.get("name"),
    phone: data.get("phone") || null,
    email: data.get("email") || null,
    address: data.get("address") || null,
    memberLevel: data.get("memberLevel") || "REGULAR",
    dateOfBirth: rawDob ? new Date(rawDob as string) : null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    const old = await prisma.customer.findUnique({ where: { id }, select: { name: true, phone: true, email: true, address: true, memberLevel: true } });
    await prisma.customer.update({
      where: { id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        address: parsed.data.address ?? null,
        memberLevel: parsed.data.memberLevel,
        dateOfBirth: parsed.data.dateOfBirth ?? null,
      },
    });
    if (old) {
      createAuditLog({ action: "UPDATE", entity: "Customer", entityId: id, details: { before: { name: old.name, phone: old.phone, email: old.email, address: old.address, memberLevel: old.memberLevel }, after: { name: parsed.data.name, phone: parsed.data.phone ?? null, email: parsed.data.email ?? null, address: parsed.data.address ?? null, memberLevel: parsed.data.memberLevel } } }).catch(() => {});
    }
    revalidatePath("/customers");
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate customer" };
  }
}

export async function getUpcomingBirthdays() {
  const customers = await prisma.customer.findMany({
    where: { dateOfBirth: { not: null } },
    select: { id: true, name: true, phone: true, dateOfBirth: true, memberLevel: true },
  });

  const today = new Date();
  const upcoming = customers.filter((c) => {
    if (!c.dateOfBirth) return false;
    const bday = new Date(c.dateOfBirth);
    const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    const diff = (thisYearBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  return upcoming;
}

export async function deleteCustomer(id: string) {
  await assertMenuActionAccess("customers", "delete");
  try {
    const txCount = await prisma.transaction.count({ where: { customerId: id } });
    if (txCount > 0) {
      return { error: `Customer masih memiliki ${txCount} transaksi` };
    }
    const old = await prisma.customer.findUnique({ where: { id } });
    await prisma.customer.delete({ where: { id } });
    createAuditLog({ action: "DELETE", entity: "Customer", entityId: id, details: { deleted: { name: old?.name, email: old?.email } } }).catch(() => {});
    revalidatePath("/customers");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus customer" };
  }
}

export async function getCustomerPurchaseHistory(customerId: string, page: number = 1, perPage: number = 10) {
    const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
            where: { customerId, status: "COMPLETED" },
            include: {
                items: { select: { productName: true, quantity: true, unitPrice: true, subtotal: true, unitName: true } },
                payments: { select: { method: true, amount: true } },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * perPage,
            take: perPage,
        }),
        prisma.transaction.count({ where: { customerId, status: "COMPLETED" } }),
    ]);

    // Also get customer stats
    const stats = await prisma.transaction.aggregate({
        where: { customerId, status: "COMPLETED" },
        _sum: { grandTotal: true },
        _count: true,
        _avg: { grandTotal: true },
    });

    return {
        transactions,
        total,
        totalPages: Math.ceil(total / perPage),
        stats: {
            totalSpent: stats._sum.grandTotal || 0,
            totalTransactions: stats._count,
            averageSpent: Math.round(stats._avg.grandTotal || 0),
        },
    };
}

export async function getCustomerFavoriteProducts(customerId: string) {
    const items = await prisma.transactionItem.groupBy({
        by: ["productName"],
        _sum: { quantity: true, subtotal: true },
        where: { transaction: { customerId, status: "COMPLETED" } },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
    });
    return items.map((i, idx) => ({
        rank: idx + 1,
        productName: i.productName,
        totalQty: i._sum.quantity || 0,
        totalSpent: i._sum.subtotal || 0,
    }));
}
