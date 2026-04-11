"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyPlan } from "@/server/actions/plan";

/**
 * Returns a map of menuKey -> allowed for the current company's plan.
 */
export async function getPlanMenuAccessMap(): Promise<Record<string, boolean>> {
  let plan: string;
  try {
    const result = await getCompanyPlan();
    plan = result.plan;
  } catch {
    return {};
  }

  const access = await prisma.planMenuAccess.findMany({
    where: { plan },
    select: { menuKey: true, allowed: true },
  });

  const map: Record<string, boolean> = {};
  for (const a of access) {
    map[a.menuKey] = a.allowed;
  }
  return map;
}

/**
 * Returns a map of menuKey:actionKey -> allowed for current plan.
 */
export async function getPlanActionAccessMap(): Promise<Record<string, boolean>> {
  let plan: string;
  try {
    const result = await getCompanyPlan();
    plan = result.plan;
  } catch {
    return {};
  }

  const access = await prisma.planActionAccess.findMany({
    where: { plan },
    select: { menuKey: true, actionKey: true, allowed: true },
  });

  const map: Record<string, boolean> = {};
  for (const a of access) {
    map[`${a.menuKey}:${a.actionKey}`] = a.allowed;
  }
  return map;
}

/**
 * Returns ALL plan access data (for all plans).
 * Used by ProGate to determine which plan enables a feature.
 */
export async function getAllPlanAccessData(): Promise<{
  menus: Record<string, Record<string, boolean>>;
  actions: Record<string, Record<string, boolean>>;
}> {
  const [menuAccess, actionAccess] = await Promise.all([
    prisma.planMenuAccess.findMany({ select: { plan: true, menuKey: true, allowed: true } }),
    prisma.planActionAccess.findMany({ select: { plan: true, menuKey: true, actionKey: true, allowed: true } }),
  ]);

  // menus: { "products": { "FREE": true, "PRO": true, "ENTERPRISE": true } }
  const menus: Record<string, Record<string, boolean>> = {};
  for (const m of menuAccess) {
    if (!menus[m.menuKey]) menus[m.menuKey] = {};
    menus[m.menuKey]![m.plan] = m.allowed;
  }

  // actions: { "products:export": { "FREE": false, "PRO": true, "ENTERPRISE": true } }
  const actions: Record<string, Record<string, boolean>> = {};
  for (const a of actionAccess) {
    const key = `${a.menuKey}:${a.actionKey}`;
    if (!actions[key]) actions[key] = {};
    actions[key]![a.plan] = a.allowed;
  }

  return { menus, actions };
}

/**
 * Check if a specific menu is allowed for current company plan.
 */
export async function isPlanMenuAllowed(menuKey: string): Promise<boolean> {
  let plan: string;
  try {
    const result = await getCompanyPlan();
    plan = result.plan;
  } catch {
    return true;
  }

  const access = await prisma.planMenuAccess.findFirst({
    where: { plan, menuKey },
    select: { allowed: true },
  });

  return access?.allowed ?? false;
}

/**
 * Check if a specific action is allowed for current company plan.
 */
export async function isPlanActionAllowed(menuKey: string, actionKey: string): Promise<boolean> {
  let plan: string;
  try {
    const result = await getCompanyPlan();
    plan = result.plan;
  } catch {
    return true;
  }

  const access = await prisma.planActionAccess.findFirst({
    where: { plan, menuKey, actionKey },
    select: { allowed: true },
  });

  return access?.allowed ?? false;
}
