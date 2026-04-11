"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentCompanyId } from "@/lib/company";
import { type PlanKey, PLANS, getPlanLimits } from "@/lib/plan-config";

export async function getCompanyPlan() {
  const companyId = await getCurrentCompanyId();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true, planExpiresAt: true },
  });

  const plan = (company?.plan as PlanKey) || "FREE";
  const expired = company?.planExpiresAt ? company.planExpiresAt < new Date() : false;
  const effectivePlan: PlanKey = expired ? "FREE" : plan;

  return {
    plan: effectivePlan,
    planName: PLANS[effectivePlan].name,
    expired,
    expiresAt: company?.planExpiresAt?.toISOString() ?? null,
  };
}

export async function getCurrentCompanyInfo() {
  const companyId = await getCurrentCompanyId();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, slug: true },
  });
  return {
    id: company?.id ?? companyId,
    name: company?.name ?? "-",
    slug: company?.slug ?? "",
  };
}

export async function checkMenuAccess(menuKey: string) {
  const { plan } = await getCompanyPlan();
  const access = await prisma.planMenuAccess.findFirst({
    where: { plan, menuKey },
    select: { allowed: true },
  });
  return access?.allowed ?? false;
}

export async function checkActionAccess(menuKey: string, actionKey: string) {
  const { plan } = await getCompanyPlan();
  // Check menu first
  const menuAccess = await prisma.planMenuAccess.findFirst({
    where: { plan, menuKey },
    select: { allowed: true },
  });
  if (menuAccess && !menuAccess.allowed) return false;
  // Check action
  const actionAccess = await prisma.planActionAccess.findFirst({
    where: { plan, menuKey, actionKey },
    select: { allowed: true },
  });
  return actionAccess?.allowed ?? false;
}

/**
 * Assert action access — throws if not allowed by plan.
 */
export async function assertPlanAction(menuKey: string, actionKey: string) {
  const allowed = await checkActionAccess(menuKey, actionKey);
  if (!allowed) {
    throw new Error(`Fitur ini memerlukan upgrade plan. (${menuKey}:${actionKey})`);
  }
}

export async function getCompanyPlanWithLimits() {
  const companyId = await getCurrentCompanyId();
  const [company, productCount, userCount, branchCount] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { plan: true, planExpiresAt: true } }),
    prisma.product.count({ where: { companyId } }),
    prisma.user.count({ where: { companyId } }),
    prisma.branch.count({ where: { companyId } }),
  ]);

  const plan = (company?.plan as PlanKey) || "FREE";
  const expired = company?.planExpiresAt ? company.planExpiresAt < new Date() : false;
  const effectivePlan: PlanKey = expired ? "FREE" : plan;
  const limits = getPlanLimits(effectivePlan);

  return {
    plan: effectivePlan,
    planDetails: PLANS[effectivePlan],
    expired,
    expiresAt: company?.planExpiresAt?.toISOString() ?? null,
    usage: { products: productCount, users: userCount, branches: branchCount },
    limits,
    allPlans: Object.values(PLANS),
  };
}
