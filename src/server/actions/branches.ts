"use server";

import { prisma } from "@/lib/prisma";
import { branchSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId, getCurrentCompanyIdOrNull } from "@/lib/company";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

export async function getBranches(params?: { search?: string; page?: number; perPage?: number }) {
  const companyId = await getCurrentCompanyIdOrNull();
  const { search, page = 1, perPage = 10 } = params || {};
  const where: Record<string, unknown> = companyId ? { companyId } : {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [branches, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.branch.count({ where }),
  ]);

  return { branches, total, totalPages: Math.ceil(total / perPage) };
}

export async function getAllBranches() {
  const companyId = await getCurrentCompanyIdOrNull();
  if (companyId) {
    return prisma.branch.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    });
  }
  return prisma.branch.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getBranchStats() {
  const companyId = await getCurrentCompanyId();
  const [total, active, inactive] = await Promise.all([
    prisma.branch.count({ where: { companyId } }),
    prisma.branch.count({ where: { companyId, isActive: true } }),
    prisma.branch.count({ where: { companyId, isActive: false } }),
  ]);
  return { total, active, inactive };
}

interface BranchInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
}

export async function createBranch(input: BranchInput) {
  await assertMenuActionAccess("branches", "create");
  const companyId = await getCurrentCompanyId();
  if (!input.name?.trim()) return { error: "Nama cabang wajib diisi" };

  // Auto-generate code: first 3 chars uppercase + count
  const count = await prisma.branch.count({ where: { companyId } });
  const prefix = input.name.trim().substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
  const code = `${prefix}-${String(count + 1).padStart(3, "0")}`;

  try {
    const result = await prisma.branch.create({
      data: {
        name: input.name.trim(), code, address: input.address || null, phone: input.phone || null,
        latitude: input.latitude ?? null, longitude: input.longitude ?? null, isActive: input.isActive, companyId,
      },
    });
    revalidatePath("/branches");
    createAuditLog({ action: "CREATE", entity: "Branch", entityId: result.id, details: { data: { name: input.name, code, address: input.address, phone: input.phone } } }).catch(() => {});
    return { success: true };
  } catch {
    return { error: "Cabang dengan nama tersebut sudah ada" };
  }
}

export async function updateBranch(id: string, input: BranchInput) {
  await assertMenuActionAccess("branches", "update");
  if (!input.name?.trim()) return { error: "Nama cabang wajib diisi" };

  try {
    const old = await prisma.branch.findUnique({ where: { id } });
    await prisma.branch.update({
      where: { id },
      data: {
        name: input.name.trim(), address: input.address || null, phone: input.phone || null,
        latitude: input.latitude ?? null, longitude: input.longitude ?? null, isActive: input.isActive,
      },
    });
    revalidatePath("/branches");
    if (old) {
      createAuditLog({ action: "UPDATE", entity: "Branch", entityId: id, details: { before: { name: old.name, address: old.address, phone: old.phone }, after: { name: input.name, address: input.address, phone: input.phone } } }).catch(() => {});
    }
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate cabang" };
  }
}

export async function deleteBranch(id: string) {
  await assertMenuActionAccess("branches", "delete");
  try {
    const old = await prisma.branch.findUnique({ where: { id } });
    await prisma.branch.delete({ where: { id } });
    revalidatePath("/branches");
    createAuditLog({ action: "DELETE", entity: "Branch", entityId: id, details: { deleted: { name: old?.name, address: old?.address } } }).catch(() => {});
    return { success: true };
  } catch {
    return { error: "Gagal menghapus cabang" };
  }
}

// ─── Import Branches ───

export async function importBranches(rows: { name: string; code: string; address: string; phone: string }[]) {
  await assertMenuActionAccess("branches", "create");
  const companyId = await getCurrentCompanyId();
  const existing = new Set((await prisma.branch.findMany({ where: { companyId }, select: { name: true } })).map((b) => b.name.toLowerCase()));

  type R = { row: number; success: boolean; name: string; error?: string };
  const results: R[] = [];
  const validRows: { name: string; code: string | null; address: string | null; phone: string | null; companyId: string; isActive: boolean }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    if (!row.name?.trim()) { results.push({ row: rowNum, success: false, name: `Baris ${rowNum}`, error: "Nama wajib diisi" }); continue; }
    if (existing.has(row.name.toLowerCase().trim())) { results.push({ row: rowNum, success: false, name: row.name, error: "Nama sudah ada" }); continue; }
    existing.add(row.name.toLowerCase().trim());
    validRows.push({ name: row.name.trim(), code: row.code?.trim() || null, address: row.address?.trim() || null, phone: row.phone?.trim() || null, companyId, isActive: true });
  }

  if (validRows.length > 0) {
    try {
      await prisma.branch.createMany({ data: validRows, skipDuplicates: true });
      for (const r of validRows) results.push({ row: rows.findIndex((x) => x.name === r.name) + 2, success: true, name: r.name });
    } catch { for (const r of validRows) results.push({ row: 0, success: false, name: r.name, error: "Gagal menyimpan" }); }
  }

  results.sort((a, b) => a.row - b.row);
  revalidatePath("/branches");
  return { results, successCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length };
}

const BRANCH_TEMPLATE_COLS: TemplateColumn[] = [
  { header: "Nama Cabang *", width: 22, sampleValues: ["Cabang Utama", "Cabang Bandung"] },
  { header: "Kode", width: 12, sampleValues: ["HQ", "BDG"] },
  { header: "Alamat", width: 30, sampleValues: ["Jl. Merdeka 10, Jakarta", "Jl. Asia Afrika 5, Bandung"] },
  { header: "Telepon", width: 16, sampleValues: ["021-5551234", "022-4231234"] },
];

export async function downloadBranchImportTemplate(format: "csv" | "excel" | "docx") {
  const result = await generateImportTemplate(BRANCH_TEMPLATE_COLS, 2, ["Kolom dengan tanda * wajib diisi"], format);
  return { data: result.data, filename: `template-import-cabang.${format === "excel" ? "xlsx" : format}`, mimeType: result.mimeType };
}

export async function bulkDeleteBranches(ids: string[]) {
  await assertMenuActionAccess("branches", "delete");
  const result = await prisma.branch.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/branches");
  return { count: result.count };
}
