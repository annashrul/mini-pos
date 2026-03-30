"use server";

import { revalidatePath } from "next/cache";
import {
  ensureAccessSeeded,
  getAccessMatrix,
  getCurrentRole,
  getMenusForRole,
  hasMenuActionAccess,
} from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

async function ensureManageAccess() {
  const allowed = await hasMenuActionAccess("access-control", "manage");
  if (!allowed) {
    return { error: "Anda tidak memiliki hak akses mengelola permission" };
  }
  return null;
}

export async function getAccessControlMatrix() {
  await ensureAccessSeeded();
  const denied = await ensureManageAccess();
  if (denied) return { error: denied.error, roles: [] as string[], menus: [] };
  return getAccessMatrix();
}

export async function updateRoleMenuPermission(input: {
  menuId: string;
  role: string;
  allowed: boolean;
}) {
  const denied = await ensureManageAccess();
  if (denied) return denied;

  await prisma.roleMenuPermission.upsert({
    where: { role_menuId: { role: input.role, menuId: input.menuId } },
    update: { allowed: input.allowed },
    create: { role: input.role, menuId: input.menuId, allowed: input.allowed },
  });

  revalidatePath("/access-control");
  return { success: true, error: null };
}

export async function updateRoleActionPermission(input: {
  actionId: string;
  role: string;
  allowed: boolean;
}) {
  const denied = await ensureManageAccess();
  if (denied) return denied;

  await prisma.roleActionPermission.upsert({
    where: {
      role_menuActionId: { role: input.role, menuActionId: input.actionId },
    },
    update: { allowed: input.allowed },
    create: {
      role: input.role,
      menuActionId: input.actionId,
      allowed: input.allowed,
    },
  });

  revalidatePath("/access-control");
  return { success: true, error: null };
}

export async function getSidebarMenuAccess() {
  await ensureAccessSeeded();
  const role = await getCurrentRole();
  const [menus, appRole] = await Promise.all([
    getMenusForRole(role),
    prisma.appRole.findUnique({ where: { key: role }, select: { color: true } }),
  ]);
  return { role, menus, roleColor: appRole?.color ?? null };
}

export async function getDefaultRouteForRole(role: string): Promise<string> {
  // Check if role has dashboard access, otherwise go to POS
  const dashboardPerm = await prisma.roleMenuPermission.findFirst({
    where: { role, menu: { key: "dashboard" }, allowed: true },
  });
  return dashboardPerm ? "/dashboard" : "/pos";
}
