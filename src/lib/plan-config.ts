/**
 * Plan configuration
 */

export type PlanKey = "FREE" | "PRO" | "ENTERPRISE";

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  description: string;
  price: number;
  yearlyPrice: number;
  features: string[];
}

export const PLANS: Record<PlanKey, PlanDefinition> = {
  FREE: {
    key: "FREE",
    name: "Free",
    description: "Cocok untuk usaha kecil yang baru mulai",
    price: 0,
    yearlyPrice: 0,
    features: [
      "POS Kasir",
      "Manajemen Produk",
      "Manajemen Stok Dasar",
      "Laporan Penjualan Dasar",
      "1 Cabang",
      "Maks 500 Produk",
      "Maks 3 Pengguna",
    ],
  },
  PRO: {
    key: "PRO",
    name: "Pro",
    description: "Untuk bisnis yang ingin berkembang",
    price: 199000,
    yearlyPrice: 1990000,
    features: [
      "Semua fitur Free",
      "Multi Cabang",
      "Fitur Lanjutan",
      "Produk & Pengguna Tak Terbatas",
      "Export Data",
    ],
  },
  ENTERPRISE: {
    key: "ENTERPRISE",
    name: "Enterprise",
    description: "Untuk jaringan bisnis besar",
    price: 499000,
    yearlyPrice: 4990000,
    features: [
      "Semua fitur Pro",
      "API Access",
      "Dedicated Support",
      "Custom Branding",
    ],
  },
};

/**
 * Check if a menu is available for a given plan.
 * Uses database lookup with in-memory cache.
 */
let _menuCache: Map<string, boolean> | null = null;
let _actionCache: Map<string, boolean> | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

async function ensurePlanCache() {
  if (_menuCache && _actionCache && Date.now() - _cacheTime < CACHE_TTL) return;

  const { prisma } = await import("@/lib/prisma");
  const [menuAccess, actionAccess] = await Promise.all([
    prisma.planMenuAccess.findMany(),
    prisma.planActionAccess.findMany(),
  ]);

  _menuCache = new Map();
  for (const m of menuAccess) {
    _menuCache.set(`${m.plan}:${m.menuKey}`, m.allowed);
  }

  _actionCache = new Map();
  for (const a of actionAccess) {
    _actionCache.set(`${a.plan}:${a.menuKey}:${a.actionKey}`, a.allowed);
  }

  _cacheTime = Date.now();
}

export async function isMenuAvailableAsync(menuKey: string, plan: PlanKey): Promise<boolean> {
  await ensurePlanCache();
  return _menuCache?.get(`${plan}:${menuKey}`) ?? false;
}

export async function isActionAvailableAsync(menuKey: string, actionKey: string, plan: PlanKey): Promise<boolean> {
  await ensurePlanCache();
  return _actionCache?.get(`${plan}:${menuKey}:${actionKey}`) ?? false;
}

/**
 * Synchronous check (for sidebar, uses fallback if cache not loaded)
 */
export function isMenuAvailable(menuKey: string, plan: PlanKey): boolean {
  if (_menuCache) return _menuCache.get(`${plan}:${menuKey}`) ?? false;
  // Fallback: ENTERPRISE/PRO get everything, used before cache loads
  if (plan === "ENTERPRISE" || plan === "PRO") return true;
  return false;
}

export function isActionAvailable(menuKey: string, actionKey: string, plan: PlanKey): boolean {
  if (_actionCache) return _actionCache.get(`${plan}:${menuKey}:${actionKey}`) ?? false;
  if (plan === "ENTERPRISE" || plan === "PRO") return true;
  return false;
}

export function invalidatePlanCache() {
  _menuCache = null;
  _actionCache = null;
  _cacheTime = 0;
}

export function getPlanLimits(plan: PlanKey) {
  switch (plan) {
    case "FREE":
      return { maxProducts: 500, maxUsers: 3, maxBranches: 1 };
    case "PRO":
      return { maxProducts: Infinity, maxUsers: Infinity, maxBranches: Infinity };
    case "ENTERPRISE":
      return { maxProducts: Infinity, maxUsers: Infinity, maxBranches: Infinity };
  }
}
