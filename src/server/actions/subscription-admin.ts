"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PLANS, type PlanKey } from "@/lib/plan-config";
import { emitEvent, EVENTS } from "@/lib/socket-emit";

async function assertPlatformOwner() {
  const session = await auth();
  const role = (session?.user as Record<string, unknown> | undefined)?.role;
  if (role !== "PLATFORM_OWNER") throw new Error("Unauthorized: Only Platform Owner can access this");
  return session!.user!.id;
}

export async function getAllCompanies() {
  await assertPlatformOwner();
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      plan: true,
      planExpiresAt: true,
      isActive: true,
      createdAt: true,
      _count: { select: { users: true, branches: true, products: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return companies;
}

export async function updateCompanyPlan(params: {
  companyId: string;
  plan: PlanKey;
  durationMonths?: number | undefined;
  amount?: number | undefined;
  billingType?: "MONTHLY" | "YEARLY" | undefined;
  notes?: string | undefined;
}) {
  const userId = await assertPlatformOwner();
  const { companyId, plan, durationMonths, billingType = "MONTHLY", notes } = params;

  const planStartDate = new Date();
  let planExpiresAt: Date | null = null;
  if (plan !== "FREE" && durationMonths && durationMonths > 0) {
    planExpiresAt = new Date();
    planExpiresAt.setMonth(planExpiresAt.getMonth() + durationMonths);
  }

  const planDef = PLANS[plan];
  const amount = params.amount ?? (billingType === "YEARLY" ? planDef.yearlyPrice : planDef.price * (durationMonths || 1));

  const company = await prisma.company.update({
    where: { id: companyId },
    data: { plan, planExpiresAt },
    select: { id: true, name: true, plan: true, planExpiresAt: true },
  });

  // Record payment history
  if (plan !== "FREE" && durationMonths) {
    await prisma.subscriptionPayment.create({
      data: {
        companyId,
        plan,
        amount,
        durationMonths,
        billingType,
        status: "PAID",
        planStartDate,
        planEndDate: planExpiresAt!,
        notes: notes || null,
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: "UPDATE_PLAN",
      entity: "Subscription",
      entityId: companyId,
      details: JSON.stringify({
        companyName: company.name, plan, durationMonths,
        amount, billingType, expiresAt: planExpiresAt?.toISOString(),
      }),
    },
  });

  emitEvent(EVENTS.SUBSCRIPTION_UPDATED, { companyId, companyName: company.name, plan, action: "upgrade" });
  return company;
}

export async function extendCompanyPlan(params: {
  companyId: string;
  additionalMonths: number;
  amount?: number | undefined;
  billingType?: "MONTHLY" | "YEARLY" | undefined;
  notes?: string | undefined;
}) {
  const userId = await assertPlatformOwner();
  const { companyId, additionalMonths, billingType = "MONTHLY", notes } = params;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true, planExpiresAt: true, name: true },
  });
  if (!company) throw new Error("Company not found");

  const planStartDate = company.planExpiresAt && company.planExpiresAt > new Date()
    ? company.planExpiresAt
    : new Date();

  const newExpiry = new Date(planStartDate);
  newExpiry.setMonth(newExpiry.getMonth() + additionalMonths);

  const planDef = PLANS[(company.plan as PlanKey) || "PRO"];
  const amount = params.amount ?? (billingType === "YEARLY" ? planDef.yearlyPrice : planDef.price * additionalMonths);

  await prisma.company.update({
    where: { id: companyId },
    data: { planExpiresAt: newExpiry },
  });

  // Record payment
  await prisma.subscriptionPayment.create({
    data: {
      companyId,
      plan: company.plan,
      amount,
      durationMonths: additionalMonths,
      billingType,
      status: "PAID",
      planStartDate,
      planEndDate: newExpiry,
      notes: notes || null,
      approvedBy: userId,
      approvedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "EXTEND_PLAN",
      entity: "Subscription",
      entityId: companyId,
      details: JSON.stringify({
        companyName: company.name, additionalMonths, amount,
        newExpiresAt: newExpiry.toISOString(),
      }),
    },
  });

  emitEvent(EVENTS.SUBSCRIPTION_UPDATED, { companyId, companyName: company.name, plan: company.plan, action: "extend" });
  return { expiresAt: newExpiry };
}

export async function revokeCompanyPlan(companyId: string) {
  const userId = await assertPlatformOwner();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, plan: true },
  });

  await prisma.company.update({
    where: { id: companyId },
    data: { plan: "FREE", planExpiresAt: null },
  });

  // Record as cancelled
  await prisma.subscriptionPayment.create({
    data: {
      companyId,
      plan: company?.plan || "PRO",
      amount: 0,
      durationMonths: 0,
      billingType: "MONTHLY",
      status: "CANCELLED",
      planStartDate: new Date(),
      planEndDate: new Date(),
      notes: "Plan revoked by platform owner",
      approvedBy: userId,
      approvedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "REVOKE_PLAN",
      entity: "Subscription",
      entityId: companyId,
      details: JSON.stringify({ companyName: company?.name }),
    },
  });

  emitEvent(EVENTS.SUBSCRIPTION_UPDATED, { companyId, companyName: company?.name, action: "revoke" });
  return { success: true };
}

export async function getSubscriptionHistory(companyId?: string | undefined) {
  await assertPlatformOwner();

  const payments = await prisma.subscriptionPayment.findMany({
    where: companyId ? { companyId } : {},
    include: {
      company: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return payments.map((p) => ({
    id: p.id,
    companyId: p.companyId,
    companyName: p.company.name,
    companySlug: p.company.slug,
    plan: p.plan,
    amount: p.amount,
    durationMonths: p.durationMonths,
    billingType: p.billingType,
    status: p.status,
    planStartDate: p.planStartDate.toISOString(),
    planEndDate: p.planEndDate.toISOString(),
    notes: p.notes,
    approvedBy: p.approvedBy,
    approvedAt: p.approvedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));
}
