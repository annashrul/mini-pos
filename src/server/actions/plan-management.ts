"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { invalidatePlanCache, type PlanKey } from "@/lib/plan-config";

async function assertPlatformOwner() {
  const session = await auth();
  const role = (session?.user as Record<string, unknown> | undefined)?.role;
  if (role !== "PLATFORM_OWNER") throw new Error("Unauthorized");
}

export async function getPlanAccessMatrix() {
  await assertPlatformOwner();

  const [menus, menuAccess, actionAccess] = await Promise.all([
    prisma.appMenu.findMany({
      where: { isActive: true },
      include: { actions: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.planMenuAccess.findMany(),
    prisma.planActionAccess.findMany(),
  ]);

  const menuMap = new Map<string, Record<string, boolean>>();
  for (const m of menuAccess) {
    const key = m.menuKey;
    if (!menuMap.has(key)) menuMap.set(key, {});
    menuMap.get(key)![m.plan] = m.allowed;
  }

  const actionMap = new Map<string, Record<string, boolean>>();
  for (const a of actionAccess) {
    const key = `${a.menuKey}:${a.actionKey}`;
    if (!actionMap.has(key)) actionMap.set(key, {});
    actionMap.get(key)![a.plan] = a.allowed;
  }

  return menus
    .filter((m) => !["subscription-admin", "tenants", "platform-activity"].includes(m.key))
    .map((menu) => ({
      key: menu.key,
      name: menu.name,
      group: menu.group,
      plans: {
        FREE: menuMap.get(menu.key)?.FREE ?? false,
        PRO: menuMap.get(menu.key)?.PRO ?? false,
        ENTERPRISE: menuMap.get(menu.key)?.ENTERPRISE ?? false,
      },
      actions: menu.actions.map((a) => ({
        key: a.key,
        name: a.name,
        plans: {
          FREE: actionMap.get(`${menu.key}:${a.key}`)?.FREE ?? false,
          PRO: actionMap.get(`${menu.key}:${a.key}`)?.PRO ?? false,
          ENTERPRISE: actionMap.get(`${menu.key}:${a.key}`)?.ENTERPRISE ?? false,
        },
      })),
    }));
}

export async function updatePlanMenuAccess(menuKey: string, plan: PlanKey, allowed: boolean) {
  await assertPlatformOwner();

  await prisma.planMenuAccess.upsert({
    where: { plan_menuKey: { plan, menuKey } },
    create: { plan, menuKey, allowed },
    update: { allowed },
  });

  // If menu is disabled, also disable all its actions
  if (!allowed) {
    await prisma.planActionAccess.updateMany({
      where: { plan, menuKey },
      data: { allowed: false },
    });
  }

  invalidatePlanCache();
  return { success: true };
}

export async function updatePlanActionAccess(menuKey: string, actionKey: string, plan: PlanKey, allowed: boolean) {
  await assertPlatformOwner();

  await prisma.planActionAccess.upsert({
    where: { plan_menuKey_actionKey: { plan, menuKey, actionKey } },
    create: { plan, menuKey, actionKey, allowed },
    update: { allowed },
  });

  invalidatePlanCache();
  return { success: true };
}
