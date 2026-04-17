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
      "split_bill",
      "table_select",
    ],
  },
  {
    key: "transactions",
    name: "Riwayat Transaksi",
    path: "/transactions",
    group: "Utama",
    sortOrder: 3,
    actions: ["view", "export", "import", "void", "refund", "reprint"],
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
    actions: ["view", "create", "update", "delete", "export", "import", "upload_image", "branch_prices", "multi_unit", "tier_prices"],
  },
  {
    key: "bundles",
    name: "Paket Produk",
    path: "/bundles",
    group: "Master Data",
    sortOrder: 2,
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "categories",
    name: "Kategori",
    path: "/categories",
    group: "Master Data",
    sortOrder: 3,
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
    actions: ["view", "create", "update", "delete", "export", "import", "points"],
  },
  {
    key: "stock",
    name: "Manajemen Stok",
    path: "/stock",
    group: "Inventori",
    sortOrder: 1,
    actions: ["view", "create", "update", "export", "import"],
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
    key: "goods-receipts",
    name: "Bukti Penerimaan",
    path: "/goods-receipts",
    group: "Inventori",
    sortOrder: 2.5,
    actions: ["view", "delete"],
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
    key: "debts",
    name: "Hutang Piutang",
    path: "/debts",
    group: "Keuangan",
    sortOrder: 3,
    actions: ["view", "create", "update", "delete", "payment"],
  },
  {
    key: "price-schedules",
    name: "Jadwal Harga",
    path: "/price-schedules",
    group: "Keuangan",
    sortOrder: 4,
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "gift-cards",
    name: "Gift Card",
    path: "/gift-cards",
    group: "Keuangan",
    sortOrder: 5,
    actions: ["view", "create", "update", "disable"],
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
    actions: ["view", "copy", "update", "delete"],
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
    actions: ["view", "update", "settings_store", "settings_earn", "settings_redeem", "settings_levels"],
  },
  {
    key: "returns",
    name: "Return & Exchange",
    path: "/returns",
    group: "Utama",
    sortOrder: 6,
    actions: ["view", "create", "approve", "reject"],
  },
  {
    key: "access-control",
    name: "Hak Akses",
    path: "/access-control",
    group: "Admin",
    sortOrder: 6,
    actions: ["view", "create_role", "update_role", "delete_role", "manage_menu", "manage_action"],
  },
  {
    key: "tables",
    name: "Manajemen Meja",
    path: "/tables",
    group: "Admin",
    sortOrder: 7,
    actions: ["view", "create", "update", "delete", "update_status"],
  },
  {
    key: "kitchen-display",
    name: "Kitchen Display",
    path: "/kitchen-display",
    group: "Utama",
    sortOrder: 7,
    actions: ["view", "update_status", "reset"],
  },
  {
    key: "employee-schedules",
    name: "Jadwal Karyawan",
    path: "/employee-schedules",
    group: "Admin",
    sortOrder: 7,
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "sales-targets",
    name: "Sales Target & Gamification",
    path: "/sales-targets",
    group: "Analitik",
    sortOrder: 4,
    actions: ["view", "create", "delete", "export"],
  },
  {
    key: "inventory-forecast",
    name: "Prediksi Stok",
    path: "/inventory-forecast",
    group: "Inventori",
    sortOrder: 5,
    actions: ["view", "export"],
  },
  {
    key: "profit-dashboard",
    name: "Dashboard Profit",
    path: "/profit-dashboard",
    group: "Analitik",
    sortOrder: 5,
    actions: ["view", "export"],
  },
  // Accounting Module
  {
    key: "accounting",
    name: "Dashboard Akuntansi",
    path: "/accounting",
    group: "Akuntansi",
    sortOrder: 1,
    actions: ["view"],
  },
  {
    key: "accounting-coa",
    name: "Chart of Accounts",
    path: "/accounting/coa",
    group: "Akuntansi",
    sortOrder: 2,
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "accounting-journals",
    name: "Jurnal Umum",
    path: "/accounting/journals",
    group: "Akuntansi",
    sortOrder: 3,
    actions: ["view", "create", "approve", "void"],
  },
  {
    key: "accounting-ledger",
    name: "Buku Besar",
    path: "/accounting/ledger",
    group: "Akuntansi",
    sortOrder: 4,
    actions: ["view", "export"],
  },
  {
    key: "accounting-reports",
    name: "Laporan Keuangan",
    path: "/accounting/reports",
    group: "Akuntansi",
    sortOrder: 5,
    actions: ["view", "export"],
  },
  {
    key: "accounting-periods",
    name: "Tutup Buku",
    path: "/accounting/periods",
    group: "Akuntansi",
    sortOrder: 6,
    actions: ["view", "create", "update", "close", "reopen", "lock"],
  },
  {
    key: "accounting-tax",
    name: "Laporan Pajak",
    path: "/accounting/tax",
    group: "Akuntansi",
    sortOrder: 7,
    actions: ["view"],
  },
  {
    key: "accounting-aging",
    name: "Aging AP/AR",
    path: "/accounting/aging",
    group: "Akuntansi",
    sortOrder: 8,
    actions: ["view"],
  },
  {
    key: "accounting-recurring",
    name: "Jurnal Berulang",
    path: "/accounting/recurring",
    group: "Akuntansi",
    sortOrder: 9,
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "accounting-bank-recon",
    name: "Rekonsiliasi Bank",
    path: "/accounting/bank-recon",
    group: "Akuntansi",
    sortOrder: 10,
    actions: ["view", "create", "update"],
  },
  // Platform
  {
    key: "subscription-admin",
    name: "Manajemen Subscription",
    path: "/subscription-admin",
    group: "Platform",
    sortOrder: 1,
    actions: ["view", "create", "update"],
  },
  {
    key: "tenants",
    name: "Daftar Tenant",
    path: "/tenants",
    group: "Platform",
    sortOrder: 2,
    actions: ["view"],
  },
  {
    key: "platform-activity",
    name: "Activity Log",
    path: "/platform-activity",
    group: "Platform",
    sortOrder: 3,
    actions: ["view"],
  },
  {
    key: "plan-management",
    name: "Kelola Fitur Plan",
    path: "/plan-management",
    group: "Platform",
    sortOrder: 4,
    actions: ["view", "update"],
  },
] as const;
const PLATFORM_ONLY_MENUS = new Set(["subscription-admin", "tenants", "platform-activity", "plan-management"]);
const tenantMenus = menuDefinitions.map((m) => m.key).filter((k) => !PLATFORM_ONLY_MENUS.has(k));

const menuAccessByRole: Record<Role, string[]> = {
  PLATFORM_OWNER: ["dashboard", "subscription-admin", "tenants", "platform-activity", "plan-management"],
  SUPER_ADMIN: tenantMenus,
  ADMIN: tenantMenus.filter((key) => key !== "audit-logs"),
  MANAGER: [
    "dashboard",
    "pos",
    "transactions",
    "returns",
    "shifts",
    "closing-reports",
    "products",
    "bundles",
    "categories",
    "brands",
    "suppliers",
    "customers",
    "stock",
    "purchases",
    "goods-receipts",
    "stock-opname",
    "stock-transfers",
    "expenses",
    "promotions",
    "debts",
    "gift-cards",
    "reports",
    "analytics",
    "customer-intelligence",
    "kitchen-display",
    "employee-schedules",
    "sales-targets",
    "inventory-forecast",
    "profit-dashboard",
    "price-schedules",
    "accounting",
    "accounting-coa",
    "accounting-journals",
    "accounting-ledger",
    "accounting-reports",
    "accounting-periods",
    "accounting-tax",
    "accounting-aging",
    "accounting-recurring",
    "accounting-bank-recon",
    "tables",
  ],
  CASHIER: ["dashboard", "pos", "transactions", "returns", "shifts", "kitchen-display", "sales-targets"],
};

/**
 * Find the menu key for a given pathname.
 */
export async function findMenuKeyByPath(pathname: string): Promise<string | null> {
  const normalized = normalizePath(pathname);
  const menu = menuDefinitions.find((m) => m.path === normalized);
  return menu?.key ?? null;
}

function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") return "/dashboard";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/dashboard";
  // Try full path first (for nested routes like /accounting/coa)
  const fullPath = `/${segments.join("/")}`;
  const hasExactMatch = menuDefinitions.some((m) => m.path === fullPath);
  if (hasExactMatch) return fullPath;
  // Try 2 segments (e.g. /accounting/coa)
  if (segments.length >= 2) {
    const twoSegPath = `/${segments[0]}/${segments[1]}`;
    const hasTwoSeg = menuDefinitions.some((m) => m.path === twoSegPath);
    if (hasTwoSeg) return twoSegPath;
  }
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
  const existingMenus = await prisma.appMenu.findMany({
    select: { key: true, id: true, actions: { select: { key: true } } },
  });
  const existingKeySet = new Set(existingMenus.map((m) => m.key));

  // Seed missing menus
  const missingMenus = menuDefinitions.filter((m) => !existingKeySet.has(m.key));
  if (missingMenus.length > 0) {
    await seedMenus(missingMenus);
  }

  // Seed missing actions for existing menus
  const existingMap = new Map(existingMenus.map((m) => [m.key, new Set(m.actions.map((a) => a.key))]));
  const menusWithNewActions = menuDefinitions.filter((m) => {
    const existing = existingMap.get(m.key);
    return existing && m.actions.some((a) => !existing.has(a));
  });
  if (menusWithNewActions.length > 0) {
    await seedMenus(menusWithNewActions);
  }
}

/** Human-readable Indonesian action labels for display in plan management UI */
const ACTION_LABELS: Record<string, Record<string, string>> = {
  _default: {
    view: "Lihat",
    create: "Tambah",
    update: "Ubah",
    delete: "Hapus",
    export: "Ekspor",
    import: "Impor",
  },
  products: {
    upload_image: "Upload Gambar",
    branch_prices: "Harga per Cabang",
    multi_unit: "Multi Satuan",
    tier_prices: "Harga Bertingkat",
  },
  customers: {
    points: "Kelola Poin",
  },
  transactions: {
    void: "Void Transaksi",
    refund: "Refund Transaksi",
    reprint: "Cetak Ulang Struk",
  },
  shifts: {
    close_shift: "Tutup Shift",
  },
  "closing-reports": {
    reclosing: "Reclosing",
  },
  returns: {
    approve: "Setujui Return",
    reject: "Tolak Return",
  },
  purchases: {
    approve: "Setujui PO",
    receive: "Terima Barang",
  },
  "stock-opname": {
    approve: "Setujui Opname",
  },
  "stock-transfers": {
    approve: "Setujui Transfer",
    receive: "Terima Transfer",
  },
  stock: {
    create: "Penyesuaian Stok",
  },
  debts: {
    payment: "Bayar Hutang/Piutang",
  },
  "gift-cards": {
    create: "Terbitkan Gift Card",
    update: "Top Up Saldo",
    disable: "Nonaktifkan",
  },
  "branch-prices": {
    copy: "Salin Harga",
  },
  "access-control": {
    create_role: "Buat Role",
    update_role: "Ubah Role",
    delete_role: "Hapus Role",
    manage_menu: "Kelola Menu",
    manage_action: "Kelola Aksi",
  },
  tables: {
    update_status: "Ubah Status Meja",
  },
  "kitchen-display": {
    update_status: "Ubah Status Order",
    reset: "Reset Antrian",
  },
  settings: {
    settings_store: "Pengaturan Toko",
    settings_earn: "Aturan Poin Earn",
    settings_redeem: "Aturan Poin Redeem",
    settings_levels: "Level Member",
  },
  expenses: {
    create: "Tambah Pengeluaran",
    update: "Ubah Pengeluaran",
    delete: "Hapus Pengeluaran",
  },
  promotions: {
    create: "Tambah Promo",
    update: "Ubah Promo",
    delete: "Hapus Promo",
  },
};

function getActionLabel(menuKey: string, actionKey: string): string {
  return ACTION_LABELS[menuKey]?.[actionKey]
    ?? ACTION_LABELS["_default"]?.[actionKey]
    ?? actionKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function seedMenus(menus: readonly { key: string; name: string; path: string; group: string; sortOrder: number; actions: readonly string[] }[]) {
  for (const menu of menus) {
    const appMenu = await prisma.appMenu.upsert({
      where: { key: menu.key },
      create: {
        key: menu.key,
        name: menu.name,
        path: menu.path,
        group: menu.group,
        sortOrder: menu.sortOrder,
      },
      update: {
        name: menu.name,
        path: menu.path,
        group: menu.group,
        sortOrder: menu.sortOrder,
        isActive: true,
      },
    });

    // Batch role menu permissions
    await Promise.all(
      Object.values(Role).map((role) =>
        prisma.roleMenuPermission.upsert({
          where: { role_menuId: { role, menuId: appMenu.id } },
          create: { role, menuId: appMenu.id, allowed: menuAccessByRole[role].includes(menu.key) },
          update: { allowed: menuAccessByRole[role].includes(menu.key) },
        })
      )
    );

    // Batch action permissions
    await Promise.all(
      menu.actions.map(async (actionKey, index) => {
        const action = await prisma.menuAction.upsert({
          where: { menuId_key: { menuId: appMenu.id, key: actionKey } },
          create: { menuId: appMenu.id, key: actionKey, name: getActionLabel(menu.key, actionKey), sortOrder: index + 1, isActive: true },
          update: { name: getActionLabel(menu.key, actionKey), sortOrder: index + 1, isActive: true },
        });
        await Promise.all(
          Object.values(Role).map((role) =>
            prisma.roleActionPermission.upsert({
              where: { role_menuActionId: { role, menuActionId: action.id } },
              create: { role, menuActionId: action.id, allowed: menuAccessByRole[role].includes(menu.key) },
              update: { allowed: menuAccessByRole[role].includes(menu.key) },
            })
          )
        );
      })
    );
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

export async function getAccessMatrix(search?: string): Promise<{
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
    where: { 
      isActive: true,
      ...(search ? { name: { contains: search } } : {})
    },
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
