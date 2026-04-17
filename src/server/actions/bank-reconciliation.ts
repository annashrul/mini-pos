"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { getCurrentCompanyId } from "@/lib/company";
import { auth } from "@/lib/auth";

export async function getReconciliations(params?: { page?: number; perPage?: number }) {
  const companyId = await getCurrentCompanyId();
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;
  const [items, total] = await Promise.all([
    prisma.bankReconciliation.findMany({
      where: { companyId },
      include: { account: { select: { code: true, name: true } } },
      orderBy: { statementDate: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.bankReconciliation.count({ where: { companyId } }),
  ]);
  return { items, total, totalPages: Math.ceil(total / perPage) };
}

export async function getReconciliationById(id: string) {
  const companyId = await getCurrentCompanyId();
  return prisma.bankReconciliation.findFirst({
    where: { id, companyId },
    include: {
      account: { select: { code: true, name: true } },
      items: { orderBy: { date: "asc" } },
    },
  });
}

export async function createReconciliation(data: {
  accountId: string;
  statementDate: string;
  statementBalance: number;
}) {
  await assertMenuActionAccess("accounting-bank-recon", "create");
  const companyId = await getCurrentCompanyId();

  // Calculate book balance from journal entries
  const bookResult = await prisma.$queryRawUnsafe<[{ balance: number }]>(`
    SELECT COALESCE(SUM(jel.debit) - SUM(jel.credit), 0)::float AS balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel."journalId"
    WHERE jel."accountId" = '${data.accountId}'
      AND je.status = 'POSTED'
      AND je.date <= '${data.statementDate}'
  `);

  const recon = await prisma.bankReconciliation.create({
    data: {
      accountId: data.accountId,
      statementDate: new Date(data.statementDate),
      statementBalance: data.statementBalance,
      bookBalance: bookResult[0]?.balance ?? 0,
      companyId,
    },
  });

  revalidatePath("/accounting/bank-recon");
  return { success: true, id: recon.id };
}

export async function importBankStatement(reconciliationId: string, rows: { date: string; description: string; amount: number; reference?: string }[]) {
  const companyId = await getCurrentCompanyId();
  const recon = await prisma.bankReconciliation.findFirst({ where: { id: reconciliationId, companyId } });
  if (!recon) return { error: "Rekonsiliasi tidak ditemukan" };

  await prisma.bankReconciliationItem.createMany({
    data: rows.map((r) => ({
      reconciliationId,
      source: "BANK_STATEMENT",
      date: new Date(r.date),
      description: r.description,
      amount: r.amount,
      referenceNumber: r.reference ?? null,
    })),
  });

  revalidatePath("/accounting/bank-recon");
  return { success: true, imported: rows.length };
}

export async function loadBookEntries(reconciliationId: string) {
  const companyId = await getCurrentCompanyId();
  const recon = await prisma.bankReconciliation.findFirst({ where: { id: reconciliationId, companyId } });
  if (!recon) return { error: "Rekonsiliasi tidak ditemukan" };

  // Get journal entries for the bank account up to statement date
  const entries = await prisma.$queryRawUnsafe<Array<{
    journal_id: string; entry_number: string; date: string; description: string; amount: number;
  }>>(`
    SELECT je.id AS journal_id, je."entryNumber" AS entry_number, je.date::text,
      je.description,
      (jel.debit - jel.credit)::float AS amount
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel."journalId"
    JOIN accounts a ON a.id = jel."accountId"
    JOIN account_categories ac ON ac.id = a."categoryId"
    WHERE jel."accountId" = '${recon.accountId}'
      AND je.status = 'POSTED'
      AND je.date <= '${recon.statementDate.toISOString().slice(0, 10)}'
      AND ac."companyId" = '${companyId}'
    ORDER BY je.date ASC
  `);

  // Create book items (skip already loaded)
  const existing = await prisma.bankReconciliationItem.findMany({
    where: { reconciliationId, source: "JOURNAL" },
    select: { journalEntryId: true },
  });
  const existingIds = new Set(existing.map((e) => e.journalEntryId));

  const newItems = entries.filter((e) => !existingIds.has(e.journal_id));
  if (newItems.length > 0) {
    await prisma.bankReconciliationItem.createMany({
      data: newItems.map((e) => ({
        reconciliationId,
        source: "JOURNAL",
        date: new Date(e.date),
        description: e.description,
        amount: e.amount,
        referenceNumber: e.entry_number,
        journalEntryId: e.journal_id,
      })),
    });
  }

  revalidatePath("/accounting/bank-recon");
  return { success: true, loaded: newItems.length };
}

export async function matchItems(reconciliationId: string, bankItemId: string, journalItemId: string) {
  const companyId = await getCurrentCompanyId();
  const recon = await prisma.bankReconciliation.findFirst({ where: { id: reconciliationId, companyId } });
  if (!recon) return { error: "Rekonsiliasi tidak ditemukan" };

  await prisma.$transaction([
    prisma.bankReconciliationItem.update({ where: { id: bankItemId }, data: { matchedItemId: journalItemId, matchStatus: "MATCHED" } }),
    prisma.bankReconciliationItem.update({ where: { id: journalItemId }, data: { matchedItemId: bankItemId, matchStatus: "MATCHED" } }),
  ]);

  revalidatePath("/accounting/bank-recon");
  return { success: true };
}

export async function autoMatchItems(reconciliationId: string) {
  const companyId = await getCurrentCompanyId();
  const recon = await prisma.bankReconciliation.findFirst({ where: { id: reconciliationId, companyId } });
  if (!recon) return { error: "Rekonsiliasi tidak ditemukan" };

  const items = await prisma.bankReconciliationItem.findMany({
    where: { reconciliationId, matchStatus: "UNMATCHED" },
  });

  const bankItems = items.filter((i) => i.source === "BANK_STATEMENT");
  const journalItems = items.filter((i) => i.source === "JOURNAL");

  let matched = 0;
  for (const bank of bankItems) {
    // Find journal item with same amount and date within 3 days
    const match = journalItems.find((j) =>
      j.matchStatus === "UNMATCHED" &&
      Math.abs(bank.amount - j.amount) < 0.01 &&
      Math.abs(new Date(bank.date).getTime() - new Date(j.date).getTime()) <= 3 * 86400000
    );
    if (match) {
      await prisma.$transaction([
        prisma.bankReconciliationItem.update({ where: { id: bank.id }, data: { matchedItemId: match.id, matchStatus: "MATCHED" } }),
        prisma.bankReconciliationItem.update({ where: { id: match.id }, data: { matchedItemId: bank.id, matchStatus: "MATCHED" } }),
      ]);
      match.matchStatus = "MATCHED"; // prevent double match
      matched++;
    }
  }

  revalidatePath("/accounting/bank-recon");
  return { success: true, matched };
}

export async function completeReconciliation(id: string) {
  await assertMenuActionAccess("accounting-bank-recon", "update");
  const companyId = await getCurrentCompanyId();
  const session = await auth();

  const recon = await prisma.bankReconciliation.findFirst({ where: { id, companyId } });
  if (!recon) return { error: "Rekonsiliasi tidak ditemukan" };

  await prisma.bankReconciliation.update({
    where: { id },
    data: { status: "COMPLETED", completedBy: session?.user?.id ?? null, completedAt: new Date() },
  });

  revalidatePath("/accounting/bank-recon");
  return { success: true };
}
