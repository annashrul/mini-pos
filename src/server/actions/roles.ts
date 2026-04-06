"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";

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
    // Create default permissions (all denied) for all menus — batch insert
    const menus = await prisma.appMenu.findMany({ include: { actions: true } });

    await prisma.roleMenuPermission.createMany({
      data: menus.map((menu) => ({ role: keyFormatted, menuId: menu.id, allowed: false })),
    });

    const allActionPerms = menus.flatMap((menu) =>
      menu.actions.map((action) => ({ role: keyFormatted, menuActionId: action.id, allowed: false }))
    );
    if (allActionPerms.length > 0) {
      await prisma.roleActionPermission.createMany({ data: allActionPerms });
    }
  }

  createAuditLog({ action: "CREATE", entity: "Role", entityId: role.id, details: { data: { name: data.name, key: keyFormatted, color: data.color ?? null } } }).catch(() => {});

  revalidatePath("/access-control");
  return { success: true, role };
}

export async function updateRole(id: string, data: { name?: string; description?: string; color?: string; isActive?: boolean }) {
  const role = await prisma.appRole.findUnique({ where: { id } });
  if (!role) return { error: "Role tidak ditemukan" };

  const updated = await prisma.appRole.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.color !== undefined ? { color: data.color ?? null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  createAuditLog({ action: "UPDATE", entity: "Role", entityId: id, details: { before: { name: role.name, description: role.description, color: role.color, isActive: role.isActive }, after: { name: updated.name, description: updated.description, color: updated.color, isActive: updated.isActive } } }).catch(() => {});

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

  createAuditLog({ action: "DELETE", entity: "Role", entityId: id, details: { deleted: { name: role.name, key: role.key } } }).catch(() => {});

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

  await prisma.appRole.createMany({ data: systemRoles });
}
