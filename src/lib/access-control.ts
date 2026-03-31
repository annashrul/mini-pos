"use server";

import { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AccessMenu } from "@/types";

const menuDefinitions = [
  {
    key: "dashboard",
    name: "Dashboard",
    path: "/dashboard",
    group: "Utama",
    sortOrder: 1,
    actions: ["view", "export"],
  },
  {
    key: "pos",
    name: "Kasir (POS)",
    path: "/pos",
    group: "Utama",
    sortOrder: 2,
    actions: [
      "view",
      "create",
      "void",
      "refund",
      "open_shift",
      "close_shift",
      "hold",
      "discount",
      "history",
      "reprint",
      "voucher",
      "redeem_points",
    ],
  },
  {
    key: "transactions",
    name: "Riwayat Transaksi",
    path: "/transactions",
    group: "Utama",
    sortOrder: 3,
    actions: ["view", "export", "void", "refund"],
  },
  {
    key: "shifts",
    name: "Shift Kasir",
    path: "/shifts",
    group: "Utama",
    sortOrder: 4,
    actions: ["view", "create", "update", "close_shift"],
  },
  {
    key: "closing-reports",
    name: "Laporan Closing",
    path: "/closing-reports",
    group: "Utama",
    sortOrder: 5,
    actions: ["view", "reclosing", "export"],
  },
  {
    key: "products",
    name: "Produk",
    path: "/products",
    group: "Master Data",
    sortOrder: 1,
    actions: ["view", "create", "update", "delete", "export"],
  },
  {
    key: "categories",
    name: "Kategori",
    path: "/categories",
    group: "Master Data",
    sortOrder: 2,
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "brands",
    name: "Brand",
    path: "/brands",
    group: "Master Data",
    sortOrder: 3,
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "suppliers",
    name: "Supplier",
    path: "/suppliers",
    group: "Master Data",
    sortOrder: 4,
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "customers",
    name: "Customer",
    path: "/customers",
    group: "Master Data",
    sortOrder: 5,
    actions: ["view", "create", "update", "delete", "export"],
  },
  {
    key: "stock",
    name: "Manajemen Stok",
    path: "/stock",
    group: "Inventori",
    sortOrder: 1,
    actions: ["view", "create", "update", "export"],
  },
  {
    key: "purchases",
    name: "Purchase Order",
    path: "/purchases",
    group: "Inventori",
    sortOrder: 2,
    actions: ["view", "create", "update", "approve", "receive"],
  },
  {
    key: "stock-opname",
    name: "Stock Opname",
    path: "/stock-opname",
    group: "Inventori",
    sortOrder: 3,
    actions: ["view", "create", "update", "approve"],
  },
  {
    key: "stock-transfers",
    name: "Transfer Stok",
    path: "/stock-transfers",
    group: "Inventori",
    sortOrder: 4,
    actions: ["view", "create", "update", "approve", "receive"],
  },
  {
    key: "expenses",
    name: "Pengeluaran",
    path: "/expenses",
    group: "Keuangan",
    sortOrder: 1,
    actions: ["view", "create", "update", "delete", "export"],
  },
  {
    key: "promotions",
    name: "Promo",
    path: "/promotions",
    group: "Keuangan",
    sortOrder: 2,
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "reports",
    name: "Laporan",
    path: "/reports",
    group: "Analitik",
    sortOrder: 1,
    actions: ["view", "export"],
  },
  {
    key: "analytics",
    name: "Business Intelligence",
    path: "/analytics",
    group: "Analitik",
    sortOrder: 2,
    actions: ["view", "export"],
  },
  {
    key: "customer-intelligence",
    name: "Customer Intel",
    path: "/customer-intelligence",
    group: "Analitik",
    sortOrder: 3,
    actions: ["view", "export"],
  },
  {
    key: "branches",
    name: "Cabang",
    path: "/branches",
    group: "Admin",
    sortOrder: 1,
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "branch-prices",
    name: "Harga Cabang",
    path: "/branch-prices",
    group: "Admin",
    sortOrder: 2,
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "audit-logs",
    name: "Audit Log",
    path: "/audit-logs",
    group: "Admin",
    sortOrder: 3,
    actions: ["view", "export"],
  },
  {
    key: "users",
    name: "Pengguna",
    path: "/users",
    group: "Admin",
    sortOrder: 4,
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "settings",
    name: "Pengaturan",
    path: "/settings",
    group: "Admin",
    sortOrder: 5,
    actions: ["view", "update"],
  },
  {
    key: "access-control",
    name: "Hak Akses",
    path: "/access-control",
    group: "Admin",
    sortOrder: 6,
    actions: ["view", "manage"],
  },
] as const;
const menuAccessByRole: Record<Role, string[]> = {
  SUPER_ADMIN: menuDefinitions.map((menu) => menu.key),
  ADMIN: menuDefinitions
    .map((menu) => menu.key)
    .filter((key) => key !== "audit-logs"),
  MANAGER: [
    "dashboard",
    "pos",
    "transactions",
    "shifts",
    "closing-reports",
    "products",
    "categories",
    "brands",
    "suppliers",
    "customers",
    "stock",
    "purchases",
    "stock-opname",
    "stock-transfers",
    "expenses",
    "promotions",
    "reports",
    "analytics",
    "customer-intelligence",
  ],
  CASHIER: ["dashboard", "pos", "transactions", "shifts"],
};

function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") return "/dashboard";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/dashboard";
  return `/${segments[0]}`;
}

function roleFromSession(session: Session | null) {
  const rawRole = (session?.user as { role?: string } | undefined)?.role;
  if (rawRole && rawRole.trim().length > 0) return rawRole;
  return "CASHIER";
}

export async function getCurrentRole() {
  const session = await auth();
  return roleFromSession(session);
}

export async function ensureAccessSeeded() {
  // Sync menus + actions (handles additions without full reseed)
  for (const menu of menuDefinitions) {
    const existing = await prisma.appMenu.findFirst({
      where: { key: menu.key },
      include: { actions: true },
    });
    const appMenu = existing
      ? await prisma.appMenu.update({
          where: { id: existing.id },
          data: {
            name: menu.name,
            path: menu.path,
            group: menu.group,
            sortOrder: menu.sortOrder,
            isActive: true,
          },
          include: { actions: true },
        })
      : await prisma.appMenu.create({
          data: {
            key: menu.key,
            name: menu.name,
            path: menu.path,
            group: menu.group,
            sortOrder: menu.sortOrder,
          },
          include: { actions: true },
        });

    for (const role of Object.values(Role)) {
      await prisma.roleMenuPermission.upsert({
        where: { role_menuId: { role, menuId: appMenu.id } },
        create: {
          role,
          menuId: appMenu.id,
          allowed: menuAccessByRole[role].includes(menu.key),
        },
        update: {},
      });
    }

    for (let index = 0; index < menu.actions.length; index += 1) {
      const actionKey = menu.actions[index];
      if (!actionKey) continue;
      const action = await prisma.menuAction.upsert({
        where: { menuId_key: { menuId: appMenu.id, key: actionKey } },
        create: {
          menuId: appMenu.id,
          key: actionKey,
          name: actionKey.toUpperCase(),
          sortOrder: index + 1,
          isActive: true,
        },
        update: {
          name: actionKey.toUpperCase(),
          sortOrder: index + 1,
          isActive: true,
        },
      });
      for (const role of Object.values(Role)) {
        await prisma.roleActionPermission.upsert({
          where: { role_menuActionId: { role, menuActionId: action.id } },
          create: {
            role,
            menuActionId: action.id,
            allowed: menuAccessByRole[role].includes(menu.key),
          },
          update: {},
        });
      }
    }
  }
}

export async function getMenusForRole(role: string): Promise<AccessMenu[]> {
  if (!_seeded) { await ensureAccessSeeded(); _seeded = true; }
  const menus = await prisma.appMenu.findMany({
    where: { isActive: true },
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
    include: {
      actions: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          roleActions: {
            where: { role },
            select: { allowed: true },
          },
        },
      },
      roleMenus: {
        where: { role },
        select: { allowed: true },
      },
    },
  });

  return menus.map((menu) => ({
    id: menu.id,
    key: menu.key,
    name: menu.name,
    path: menu.path,
    group: menu.group,
    sortOrder: menu.sortOrder,
    isActive: menu.isActive,
    permissions: { [role]: menu.roleMenus[0]?.allowed ?? false },
    actions: menu.actions.map((action) => ({
      id: action.id,
      key: action.key,
      name: action.name,
      sortOrder: action.sortOrder,
      isActive: action.isActive,
      permissions: { [role]: action.roleActions[0]?.allowed ?? false },
    })),
  }));
}

export async function getAccessMatrix(): Promise<{
  role: string;
  menus: AccessMenu[];
  roles: string[];
}> {
  if (!_seeded) { await ensureAccessSeeded(); _seeded = true; }
  const role = await getCurrentRole();
  const roles = await prisma.appRole.findMany({
    where: { isActive: true },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: { key: true },
  });
  const menus = await prisma.appMenu.findMany({
    where: { isActive: true },
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
    include: {
      roleMenus: true,
      actions: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          roleActions: true,
        },
      },
    },
  });

  return {
    role,
    roles: roles.map((item) => item.key),
    menus: menus.map((menu) => ({
      id: menu.id,
      key: menu.key,
      name: menu.name,
      path: menu.path,
      group: menu.group,
      sortOrder: menu.sortOrder,
      isActive: menu.isActive,
      permissions: Object.fromEntries(
        roles.map((itemRole) => [
          itemRole.key,
          menu.roleMenus.find((permission) => permission.role === itemRole.key)
            ?.allowed ?? false,
        ]),
      ),
      actions: menu.actions.map((action) => ({
        id: action.id,
        key: action.key,
        name: action.name,
        sortOrder: action.sortOrder,
        isActive: action.isActive,
        permissions: Object.fromEntries(
          roles.map((itemRole) => [
            itemRole.key,
            action.roleActions.find(
              (permission) => permission.role === itemRole.key,
            )?.allowed ?? false,
          ]),
        ),
      })),
    })),
  };
}

let _seeded = false;
export async function hasMenuAccessByPath(
  pathname: string,
  requiredAction = "view",
) {
  if (!_seeded) { await ensureAccessSeeded(); _seeded = true; }
  const role = await getCurrentRole();
  const targetPath = normalizePath(pathname);
  const menu = await prisma.appMenu.findFirst({
    where: { path: targetPath, isActive: true },
    include: {
      roleMenus: {
        where: { role },
        select: { allowed: true },
      },
      actions: {
        where: { key: requiredAction, isActive: true },
        include: {
          roleActions: {
            where: { role },
            select: { allowed: true },
          },
        },
      },
    },
  });

  if (!menu) return true;
  const menuAllowed = menu.roleMenus[0]?.allowed ?? false;
  if (!menuAllowed) return false;
  if (requiredAction === "view") return true;
  const actionAllowed = menu.actions[0]?.roleActions[0]?.allowed;
  return actionAllowed ?? false;
}

export async function hasMenuActionAccess(menuKey: string, actionKey = "view") {
  if (!_seeded) { await ensureAccessSeeded(); _seeded = true; }
  const role = await getCurrentRole();
  const menu = await prisma.appMenu.findFirst({
    where: { key: menuKey, isActive: true },
    include: {
      roleMenus: {
        where: { role },
        select: { allowed: true },
      },
      actions: {
        where: { key: actionKey, isActive: true },
        include: {
          roleActions: {
            where: { role },
            select: { allowed: true },
          },
        },
      },
    },
  });
  if (!menu) return true;
  if (!(menu.roleMenus[0]?.allowed ?? false)) return false;
  if (actionKey === "view") return true;
  return menu.actions[0]?.roleActions[0]?.allowed ?? false;
}

export async function assertMenuActionAccess(
  menuKey: string,
  actionKey = "view",
) {
  const allowed = await hasMenuActionAccess(menuKey, actionKey);
  if (!allowed) {
    throw new Error("Anda tidak memiliki hak akses untuk aksi ini");
  }
}
