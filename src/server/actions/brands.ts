"use server";

import { prisma } from "@/lib/prisma";
import { brandSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId, getCurrentCompanyIdOrNull } from "@/lib/company";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

export async function getBrands(params?: { search?: string; page?: number; perPage?: number }) {
  const companyId = await getCurrentCompanyIdOrNull();
  const { search, page = 1, perPage = 10 } = params || {};
  const where: Record<string, unknown> = companyId ? { companyId } : {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [brands, total] = await Promise.all([
    prisma.brand.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.brand.count({ where }),
  ]);

  return { brands, total, totalPages: Math.ceil(total / perPage) };
}

export async function getBrandStats() {
  const companyId = await getCurrentCompanyId();
  const [total, withProducts, withoutProducts] = await Promise.all([
    prisma.brand.count({ where: { companyId } }),
    prisma.brand.count({ where: { companyId, products: { some: {} } } }),
    prisma.brand.count({ where: { companyId, products: { none: {} } } }),
  ]);
  return { total, withProducts, withoutProducts };
}

export async function createBrand(data: FormData) {
  const companyId = await getCurrentCompanyId();
  await assertMenuActionAccess("brands", "create");
  const parsed = brandSchema.safeParse({ name: data.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    const brand = await prisma.brand.create({ data: { ...parsed.data, companyId } });
    createAuditLog({ action: "CREATE", entity: "Brand", entityId: brand.id, details: { data: { name: parsed.data.name } } }).catch(() => {});
    revalidatePath("/brands");
    return { success: true, id: brand.id };
  } catch {
    return { error: "Brand dengan nama tersebut sudah ada" };
  }
}

export async function updateBrand(id: string, data: FormData) {
  const companyId = await getCurrentCompanyId();
  await assertMenuActionAccess("brands", "update");
  const parsed = brandSchema.safeParse({ name: data.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };

  try {
    const oldBrand = await prisma.brand.findUniqueOrThrow({ where: { id, companyId } });
    await prisma.brand.update({ where: { id, companyId }, data: parsed.data });
    createAuditLog({ action: "UPDATE", entity: "Brand", entityId: id, details: { before: { name: oldBrand.name }, after: { name: parsed.data.name } } }).catch(() => {});
    revalidatePath("/brands");
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate brand" };
  }
}

export async function deleteBrand(id: string) {
  const companyId = await getCurrentCompanyId();
  await assertMenuActionAccess("brands", "delete");
  try {
    const productsCount = await prisma.product.count({ where: { brandId: id, companyId } });
    if (productsCount > 0) {
      return { error: `Brand masih memiliki ${productsCount} produk` };
    }
    const brand = await prisma.brand.findUniqueOrThrow({ where: { id, companyId } });
    await prisma.brand.delete({ where: { id, companyId } });
    createAuditLog({ action: "DELETE", entity: "Brand", entityId: id, details: { deleted: { name: brand.name } } }).catch(() => {});
    revalidatePath("/brands");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus brand" };
  }
}

// ─── Import Brands ───

export async function importBrands(rows: { name: string }[]) {
  await assertMenuActionAccess("brands", "create");
  const companyId = await getCurrentCompanyId();
  const existing = new Set((await prisma.brand.findMany({ where: { companyId }, select: { name: true } })).map((b) => b.name.toLowerCase()));

  type R = { row: number; success: boolean; name: string; error?: string };
  const results: R[] = [];
  const validNames: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    if (!row.name?.trim()) { results.push({ row: rowNum, success: false, name: `Baris ${rowNum}`, error: "Nama wajib diisi" }); continue; }
    if (existing.has(row.name.toLowerCase().trim())) { results.push({ row: rowNum, success: false, name: row.name, error: "Nama sudah ada" }); continue; }
    existing.add(row.name.toLowerCase().trim());
    validNames.push(row.name.trim());
  }

  if (validNames.length > 0) {
    try {
      await prisma.brand.createMany({ data: validNames.map((name) => ({ name, companyId })), skipDuplicates: true });
      for (const name of validNames) results.push({ row: rows.findIndex((x) => x.name === name) + 2, success: true, name });
    } catch { for (const name of validNames) results.push({ row: 0, success: false, name, error: "Gagal menyimpan" }); }
  }

  results.sort((a, b) => a.row - b.row);
  revalidatePath("/brands");
  return { results, successCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length };
}

const BRAND_TEMPLATE_COLS: TemplateColumn[] = [
  { header: "Nama Brand *", width: 25, sampleValues: ["Indofood", "Unilever"] },
];

export async function downloadBrandImportTemplate(format: "csv" | "excel" | "docx") {
  const result = await generateImportTemplate(BRAND_TEMPLATE_COLS, 2, ["Kolom dengan tanda * wajib diisi"], format);
  return { data: result.data, filename: `template-import-brand.${format === "excel" ? "xlsx" : format}`, mimeType: result.mimeType };
}

export async function bulkDeleteBrands(ids: string[]) {
  await assertMenuActionAccess("brands", "delete");
  const companyId = await getCurrentCompanyId();
  const result = await prisma.brand.deleteMany({ where: { id: { in: ids }, companyId } });
  revalidatePath("/brands");
  return { count: result.count };
}
