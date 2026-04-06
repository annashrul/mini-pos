"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { POINT_DEFAULTS, type PointConfig } from "@/lib/point-config";
import { RECEIPT_DEFAULTS, type ReceiptConfig } from "@/lib/receipt-config";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { emitEvent, EVENTS } from "@/lib/socket-emit";

type PrimitiveSettingValue = string | number | boolean;

function parseSettingValue(
  rawValue: string | undefined,
  fallback: PrimitiveSettingValue,
): PrimitiveSettingValue {
  if (rawValue === undefined) return fallback;
  if (typeof fallback === "boolean") return rawValue !== "false";
  if (typeof fallback === "number") {
    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return rawValue;
}

type SettingRow = {
  id?: string;
  key: string;
  value: string;
  label?: string | null;
  group?: string | null;
  branchId?: string | null;
};

const settingsStore = prisma.setting as unknown as {
  findFirst: (args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
  }) => Promise<SettingRow | null>;
  findMany: (args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
  }) => Promise<SettingRow[]>;
  create: (args: { data: Record<string, unknown> }) => Promise<SettingRow>;
  update: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<SettingRow>;
  count: (args: { where?: Record<string, unknown> }) => Promise<number>;
};

// Track which groups have been ensured this process lifetime
const _ensuredGroups = new Set<string>();

async function ensureSettingsDefaults<T extends object>(
  group: string,
  prefix: string,
  defaults: T,
) {
  // Skip if already ensured in this process
  if (_ensuredGroups.has(group)) return;

  // Single query: get all existing global keys for this group
  const existing = await settingsStore.findMany({ where: { group } });
  const existingGlobalKeys = new Set(
    existing.filter((s) => (s as Record<string, unknown>).branchId == null).map((s) => s.key)
  );

  // Only insert missing defaults
  const entries = Object.entries(defaults) as [string, PrimitiveSettingValue][];
  const missing = entries.filter(([key]) => !existingGlobalKeys.has(`${prefix}.${key}`));

  if (missing.length > 0) {
    await Promise.all(
      missing.map(([key, value]) =>
        settingsStore.create({
          data: { key: `${prefix}.${key}`, value: String(value), label: key, group },
        })
      )
    );
  }

  _ensuredGroups.add(group);
}

function buildConfigFromDefaults<T extends object>(
  prefix: string,
  defaults: T,
  map: Map<string, string>,
): T {
  const entries = Object.entries(defaults) as [string, PrimitiveSettingValue][];
  return Object.fromEntries(
    entries.map(([key, fallback]) => [
      key,
      parseSettingValue(map.get(`${prefix}.${key}`), fallback),
    ]),
  ) as T;
}

// ===========================

// ===========================
// Generic settings CRUD
// ===========================

export async function getSetting(
  key: string,
  branchId?: string | null,
): Promise<string | null> {
  // Try branch-specific first, then global fallback
  if (branchId) {
    const scoped = await settingsStore.findMany({ where: { key } });
    const branchSetting = scoped.find(
      (setting) =>
        (setting as { branchId?: string | null }).branchId === branchId,
    );
    if (branchSetting) return branchSetting.value;
  }
  const globalCandidates = await settingsStore.findMany({ where: { key } });
  const global = globalCandidates.find(
    (setting) => (setting as { branchId?: string | null }).branchId == null,
  );
  return global?.value ?? null;
}

export async function getSettingsByGroup(
  group: string,
  branchId?: string | null,
) {
  const scoped = await settingsStore.findMany({
    where: { group },
    orderBy: { key: "asc" },
  });
  const globalMap = new Map(
    scoped
      .filter((setting) => setting.branchId == null)
      .map((setting) => [setting.key, setting]),
  );
  if (branchId) {
    scoped
      .filter((setting) => setting.branchId === branchId)
      .forEach((setting) => globalMap.set(setting.key, setting));
  }
  return Array.from(globalMap.values());
}

export async function setSetting(
  key: string,
  value: string,
  label?: string,
  group?: string,
  branchId?: string | null,
) {
  await assertMenuActionAccess("settings", "update");
  const scoped = await settingsStore.findMany({ where: { key } });
  const existing = scoped.find((setting) =>
    branchId ? setting.branchId === branchId : setting.branchId == null,
  );
  if (existing?.id) {
    await settingsStore.update({
      where: { id: existing.id },
      data: { value, ...(label ? { label } : {}), ...(group ? { group } : {}) },
    });
  } else {
    await settingsStore.create({
      data: {
        key,
        value,
        label: label ?? null,
        group: group ?? null,
        branchId: branchId ?? null,
      },
    });
  }
  createAuditLog({
    action: "UPDATE",
    entity: "Setting",
    details: { data: { key, value, branchId: branchId ?? null } }, ...(branchId ? { branchId } : {}),
  }).catch(() => {});
  revalidatePath("/settings");
}

export async function setSettings(
  entries: { key: string; value: string; label?: string; group?: string }[],
  branchId?: string | null,
) {
  await assertMenuActionAccess("settings", "update");
  for (const e of entries) {
    const scoped = await settingsStore.findMany({ where: { key: e.key } });
    const existing = scoped.find((setting) =>
      branchId ? setting.branchId === branchId : setting.branchId == null,
    );
    if (existing?.id) {
      await settingsStore.update({
        where: { id: existing.id },
        data: {
          value: e.value,
          ...(e.label ? { label: e.label } : {}),
          ...(e.group ? { group: e.group } : {}),
        },
      });
    } else {
      await settingsStore.create({
        data: {
          key: e.key,
          value: e.value,
          label: e.label ?? null,
          group: e.group ?? null,
          branchId: branchId ?? null,
        },
      });
    }
    createAuditLog({
      action: "UPDATE",
      entity: "Setting",
      details: { data: { key: e.key, value: e.value, branchId: branchId ?? null } }, ...(branchId ? { branchId } : {}),
    }).catch(() => {});
  }
  revalidatePath("/settings");
}

// ===========================
// Point config from DB
// ===========================

export async function getPointConfig(branchId?: string): Promise<PointConfig> {
  await ensureSettingsDefaults("points", "points", POINT_DEFAULTS);
  const settings = await getSettingsByGroup("points", branchId);
  const map = new Map(settings.map((s) => [s.key, s.value]));
  return buildConfigFromDefaults("points", POINT_DEFAULTS, map);
}

export async function savePointConfig(config: PointConfig, branchId?: string) {
  const entries = Object.entries(config).map(([key, value]) => ({
    key: `points.${key}`,
    value: String(value),
    label: getPointLabel(key),
    group: "points",
  }));
  await setSettings(entries, branchId);
  return { success: true };
}

function getPointLabel(key: string): string {
  const labels: Record<string, string> = {
    earnRate: "Rupiah per 1 poin",
    redeemValue: "Nilai tukar 1 poin (Rp)",
    redeemMin: "Minimum poin redeem",
    multiplierRegular: "Multiplier Regular",
    multiplierSilver: "Multiplier Silver",
    multiplierGold: "Multiplier Gold",
    multiplierPlatinum: "Multiplier Platinum",
    levelSilver: "Threshold Silver (Rp)",
    levelGold: "Threshold Gold (Rp)",
    levelPlatinum: "Threshold Platinum (Rp)",
    pointsEnabled: "Sistem poin aktif",
  };
  return labels[key] || key;
}

// ===========================
// Receipt / Printer config
// ===========================

export async function getReceiptConfig(
  branchId?: string,
): Promise<ReceiptConfig> {
  await ensureSettingsDefaults("receipt", "receipt", RECEIPT_DEFAULTS);
  const settings = await getSettingsByGroup("receipt", branchId);
  const map = new Map(settings.map((s) => [s.key, s.value]));
  return buildConfigFromDefaults("receipt", RECEIPT_DEFAULTS, map);
}

export async function saveReceiptConfig(
  config: ReceiptConfig,
  branchId?: string,
) {
  const entries = Object.entries(config).map(([key, value]) => ({
    key: `receipt.${key}`,
    value: String(value),
    label: key,
    group: "receipt",
  }));
  await setSettings(entries, branchId);
  emitEvent(EVENTS.CONFIG_RECEIPT_UPDATED, { config }, branchId);
  return { success: true };
}

// ===========================
// POS config from DB
// ===========================

const POS_DEFAULTS = {
  validateStock: true,
  allowNegativeStock: false,
  defaultTaxPercent: 11,
  requireCustomer: false,
  autoOpenCashDrawer: false,
  businessMode: "retail" as string,
  showTableNumber: false,
  autoSendKitchen: false,
};

export type PosConfig = typeof POS_DEFAULTS;

export async function getPosConfig(branchId?: string): Promise<PosConfig> {
  await ensureSettingsDefaults("pos", "pos", POS_DEFAULTS);
  const settings = await getSettingsByGroup("pos", branchId);
  const map = new Map(settings.map((s) => [s.key, s.value]));
  return buildConfigFromDefaults("pos", POS_DEFAULTS, map);
}

export async function savePosConfig(config: PosConfig, branchId?: string) {
  const entries = Object.entries(config).map(([key, value]) => ({
    key: `pos.${key}`,
    value: String(value),
    label: key,
    group: "pos",
  }));
  await setSettings(entries, branchId);
  emitEvent(EVENTS.CONFIG_POS_UPDATED, { config }, branchId);
  return { success: true };
}

// ===========================
// Kitchen Display config from DB
// ===========================

const KITCHEN_DEFAULTS = {
  enabled: false,
  autoAdvance: false,
  notificationSound: true,
};

export type KitchenConfig = typeof KITCHEN_DEFAULTS;

export async function getKitchenConfig(branchId?: string): Promise<KitchenConfig> {
  await ensureSettingsDefaults("kitchen", "kitchen", KITCHEN_DEFAULTS);
  const settings = await getSettingsByGroup("kitchen", branchId);
  const map = new Map(settings.map((s) => [s.key, s.value]));
  return buildConfigFromDefaults("kitchen", KITCHEN_DEFAULTS, map);
}

export async function saveKitchenConfig(config: KitchenConfig, branchId?: string) {
  const entries = Object.entries(config).map(([key, value]) => ({
    key: `kitchen.${key}`,
    value: String(value),
    label: key,

    group: "kitchen",
  }));
  await setSettings(entries, branchId);
  emitEvent(EVENTS.CONFIG_KITCHEN_UPDATED, { config }, branchId);
  return { success: true };
}

// ===========================
// Seed defaults
// ===========================

export async function seedPointSettings() {
  const existing = await settingsStore.count({ where: { group: "points" } });
  if (existing > 0) return;
  await savePointConfig(POINT_DEFAULTS);
}
