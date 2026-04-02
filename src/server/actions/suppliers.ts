"use server";

import { prisma } from "@/lib/prisma";
import { supplierSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";

export async function getSuppliers(params?: { search?: string; status?: string; page?: number; perPage?: number }) {
  const { search, status, page = 1, perPage = 10 } = params || {};
  const where: Record<string, unknown> = {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }
  if (status === "active") where.isActive = true;
  else if (status === "inactive") where.isActive = false;

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.supplier.count({ where }),
  ]);

  return { suppliers, total, totalPages: Math.ceil(total / perPage) };
}

export async function getAllSuppliers() {
  return prisma.supplier.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createSupplier(data: FormData) {
  await assertMenuActionAccess("suppliers", "create");
  const parsed = supplierSchema.safeParse({
    name: data.get("name"),
    contact: data.get("contact") || null,
    address: data.get("address") || null,
    email: data.get("email") || null,
    isActive: data.get("isActive") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Data supplier tidak valid" };

  try {
    await prisma.supplier.create({
      data: {
        name: parsed.data.name,
        contact: parsed.data.contact ?? null,
        address: parsed.data.address ?? null,
        email: parsed.data.email ?? null,
        isActive: parsed.data.isActive,
      },
    });
    createAuditLog({ action: "CREATE", entity: "Supplier", details: { data: { name: parsed.data.name, contact: parsed.data.contact ?? null, email: parsed.data.email ?? null, address: parsed.data.address ?? null, isActive: parsed.data.isActive } } }).catch(() => {});
    revalidatePath("/suppliers");
    return { success: true };
  } catch {
    return { error: "Gagal menambahkan supplier" };
  }
}

export async function updateSupplier(id: string, data: FormData) {
  await assertMenuActionAccess("suppliers", "update");
  const parsed = supplierSchema.safeParse({
    name: data.get("name"),
    contact: data.get("contact") || null,
    address: data.get("address") || null,
    email: data.get("email") || null,
    isActive: data.get("isActive") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Data supplier tidak valid" };

  try {
    const oldSupplier = await prisma.supplier.findUniqueOrThrow({ where: { id } });
    await prisma.supplier.update({
      where: { id },
      data: {
        name: parsed.data.name,
        contact: parsed.data.contact ?? null,
        address: parsed.data.address ?? null,
        email: parsed.data.email ?? null,
        isActive: parsed.data.isActive,
      },
    });
    createAuditLog({ action: "UPDATE", entity: "Supplier", entityId: id, details: { before: { name: oldSupplier.name, contact: oldSupplier.contact, email: oldSupplier.email, address: oldSupplier.address, isActive: oldSupplier.isActive }, after: { name: parsed.data.name, contact: parsed.data.contact ?? null, email: parsed.data.email ?? null, address: parsed.data.address ?? null, isActive: parsed.data.isActive } } }).catch(() => {});
    revalidatePath("/suppliers");
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate supplier" };
  }
}

export async function deleteSupplier(id: string) {
  await assertMenuActionAccess("suppliers", "delete");
  try {
    const productsCount = await prisma.product.count({ where: { supplierId: id } });
    if (productsCount > 0) {
      return { error: `Supplier masih memiliki ${productsCount} produk` };
    }
    const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id } });
    await prisma.supplier.delete({ where: { id } });
    createAuditLog({ action: "DELETE", entity: "Supplier", entityId: id, details: { deleted: { name: supplier.name, contact: supplier.contact, email: supplier.email } } }).catch(() => {});
    revalidatePath("/suppliers");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus supplier" };
  }
}
