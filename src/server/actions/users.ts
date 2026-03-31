"use server";

import { prisma } from "@/lib/prisma";
import { userSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { assertMenuActionAccess } from "@/lib/access-control";

export async function getUsers(params?: { search?: string; role?: string; branchId?: string; page?: number; perPage?: number }) {
  const { search, role, branchId, page = 1, perPage = 10 } = params || {};
  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (role && role !== "all") {
    where.role = role;
  }
  if (branchId && branchId !== "ALL") {
    where.branchId = branchId;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
        isActive: true,
        createdAt: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, totalPages: Math.ceil(total / perPage) };
}

export async function createUser(formData: FormData) {
  await assertMenuActionAccess("users", "create");
  const branchId = (formData.get("branchId") as string) || null;
  const data = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    role: formData.get("role") as string,
    isActive: true,
  };

  const parsed = userSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Data user tidak valid" };
  }

  if (!parsed.data.password) {
    return { error: "Password wajib diisi" };
  }

  try {
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
        role: parsed.data.role,
        isActive: parsed.data.isActive,
        branchId,
      },
    });
    revalidatePath("/users");
    return { success: true };
  } catch {
    return { error: "Email sudah digunakan" };
  }
}

export async function updateUser(id: string, formData: FormData) {
  await assertMenuActionAccess("users", "update");
  const branchId = (formData.get("branchId") as string) || null;
  const data: Record<string, unknown> = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    role: formData.get("role") as string,
    isActive: formData.get("isActive") === "true",
    branchId,
  };

  const password = formData.get("password") as string;
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  try {
    await prisma.user.update({ where: { id }, data });
    revalidatePath("/users");
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate user" };
  }
}

export async function deleteUser(id: string) {
  await assertMenuActionAccess("users", "delete");
  try {
    const txCount = await prisma.transaction.count({ where: { userId: id } });
    if (txCount > 0) {
      return { error: `User memiliki ${txCount} transaksi dan tidak bisa dihapus` };
    }
    await prisma.user.delete({ where: { id } });
    revalidatePath("/users");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus user" };
  }
}
