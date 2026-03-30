"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getRoles() {
  return prisma.appRole.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

export async function getActiveRoles() {
  return prisma.appRole.findMany({
    where: { isActive: true },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

export async function createRole(data: { key: string; name: string; description?: string; color?: string; copyFromRole?: string }) {
  if (!data.key || !data.name) return { error: "Key dan nama wajib diisi" };

  // Validate key format
  const keyFormatted = data.key.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
  if (!keyFormatted) return { error: "Key tidak valid" };

  // Check duplicate
  const existing = await prisma.appRole.findUnique({ where: { key: keyFormatted } });
  if (existing) return { error: "Key role sudah digunakan" };

  const role = await prisma.appRole.create({
    data: {
      key: keyFormatted,
      name: data.name,
      description: data.description ?? null,
      color: data.color ?? null,
      isSystem: false,
    },
  });

  // Copy permissions from another role if specified
  if (data.copyFromRole) {
    const menuPerms = await prisma.roleMenuPermission.findMany({ where: { role: data.copyFromRole } });
    if (menuPerms.length > 0) {
      await prisma.roleMenuPermission.createMany({
        data: menuPerms.map((p) => ({ role: keyFormatted, menuId: p.menuId, allowed: p.allowed })),
      });
    }

    const actionPerms = await prisma.roleActionPermission.findMany({ where: { role: data.copyFromRole } });
    if (actionPerms.length > 0) {
      await prisma.roleActionPermission.createMany({
        data: actionPerms.map((p) => ({ role: keyFormatted, menuActionId: p.menuActionId, allowed: p.allowed })),
      });
    }
  } else {
    // Create default permissions (all denied) for all menus
    const menus = await prisma.appMenu.findMany({ include: { actions: true } });
    for (const menu of menus) {
      await prisma.roleMenuPermission.create({
        data: { role: keyFormatted, menuId: menu.id, allowed: false },
      });
      for (const action of menu.actions) {
        await prisma.roleActionPermission.create({
          data: { role: keyFormatted, menuActionId: action.id, allowed: false },
        });
      }
    }
  }

  revalidatePath("/access-control");
  return { success: true, role };
}

export async function updateRole(id: string, data: { name?: string; description?: string; color?: string; isActive?: boolean }) {
  const role = await prisma.appRole.findUnique({ where: { id } });
  if (!role) return { error: "Role tidak ditemukan" };

  await prisma.appRole.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.color !== undefined ? { color: data.color ?? null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  revalidatePath("/access-control");
  return { success: true };
}

export async function deleteRole(id: string) {
  const role = await prisma.appRole.findUnique({ where: { id } });
  if (!role) return { error: "Role tidak ditemukan" };
  if (role.isSystem) return { error: "Role sistem tidak bisa dihapus" };

  // Check if any user uses this role
  const userCount = await prisma.user.count({ where: { role: role.key } });
  if (userCount > 0) return { error: `Role masih digunakan oleh ${userCount} user` };

  // Delete permissions
  await prisma.roleMenuPermission.deleteMany({ where: { role: role.key } });
  await prisma.roleActionPermission.deleteMany({ where: { role: role.key } });
  await prisma.appRole.delete({ where: { id } });

  revalidatePath("/access-control");
  return { success: true };
}

export async function seedSystemRoles() {
  const existing = await prisma.appRole.count();
  if (existing > 0) return;

  const systemRoles = [
    { key: "SUPER_ADMIN", name: "Super Admin", description: "Akses penuh ke seluruh sistem", color: "bg-red-100 text-red-700", isSystem: true },
    { key: "ADMIN", name: "Admin", description: "Mengelola operasional & konfigurasi", color: "bg-blue-100 text-blue-700", isSystem: true },
    { key: "MANAGER", name: "Manager", description: "Mengelola produk, stok & laporan", color: "bg-purple-100 text-purple-700", isSystem: true },
    { key: "CASHIER", name: "Kasir", description: "Transaksi POS & shift kasir", color: "bg-green-100 text-green-700", isSystem: true },
  ];

  for (const role of systemRoles) {
    await prisma.appRole.create({ data: role });
  }
}
