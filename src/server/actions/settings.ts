"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { POINT_DEFAULTS, type PointConfig } from "@/lib/point-config";
import { RECEIPT_DEFAULTS, type ReceiptConfig } from "@/lib/receipt-config";
import { assertMenuActionAccess } from "@/lib/access-control";

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

async function ensureSettingsDefaults<T extends object>(
  group: string,
  prefix: string,
  defaults: T,
) {
  const entries = Object.entries(defaults) as [string, PrimitiveSettingValue][];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key: `${prefix}.${key}` },
        update: {},
        create: {
          key: `${prefix}.${key}`,
          value: String(value),
          label: key,
          group,
        },
      }),
    ),
  );
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

export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function getSettingsByGroup(group: string) {
  return prisma.setting.findMany({
    where: { group },
    orderBy: { key: "asc" },
  });
}

export async function setSetting(
  key: string,
  value: string,
  label?: string,
  group?: string,
) {
  await assertMenuActionAccess("settings", "update");
  await prisma.setting.upsert({
    where: { key },
    update: { value, ...(label ? { label } : {}), ...(group ? { group } : {}) },
    create: { key, value, label: label ?? null, group: group ?? null },
  });
  revalidatePath("/settings");
}

export async function setSettings(
  entries: { key: string; value: string; label?: string; group?: string }[],
) {
  await assertMenuActionAccess("settings", "update");
  await prisma.$transaction(
    entries.map((e) =>
      prisma.setting.upsert({
        where: { key: e.key },
        update: {
          value: e.value,
          ...(e.label ? { label: e.label } : {}),
          ...(e.group ? { group: e.group } : {}),
        },
        create: {
          key: e.key,
          value: e.value,
          label: e.label ?? null,
          group: e.group ?? null,
        },
      }),
    ),
  );
  revalidatePath("/settings");
}

// ===========================
// Point config from DB
// ===========================

export async function getPointConfig(): Promise<PointConfig> {
  await ensureSettingsDefaults("points", "points", POINT_DEFAULTS);
  const settings = await prisma.setting.findMany({
    where: { group: "points" },
  });

  const map = new Map(settings.map((s) => [s.key, s.value]));

  return buildConfigFromDefaults("points", POINT_DEFAULTS, map);
}

export async function savePointConfig(config: PointConfig) {
  const entries = Object.entries(config).map(([key, value]) => ({
    key: `points.${key}`,
    value: String(value),
    label: getPointLabel(key),
    group: "points",
  }));

  await setSettings(entries);
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

export async function getReceiptConfig(): Promise<ReceiptConfig> {
  await ensureSettingsDefaults("receipt", "receipt", RECEIPT_DEFAULTS);
  const settings = await prisma.setting.findMany({
    where: { group: "receipt" },
  });
  const map = new Map(settings.map((s) => [s.key, s.value]));

  return buildConfigFromDefaults("receipt", RECEIPT_DEFAULTS, map);
}

export async function saveReceiptConfig(config: ReceiptConfig) {
  const entries = Object.entries(config).map(([key, value]) => ({
    key: `receipt.${key}`,
    value: String(value),
    label: key,
    group: "receipt",
  }));
  await setSettings(entries);
  return { success: true };
}

// ===========================
// Seed defaults
// ===========================

export async function seedPointSettings() {
  const existing = await prisma.setting.count({ where: { group: "points" } });
  if (existing > 0) return;
  await savePointConfig(POINT_DEFAULTS);
}
