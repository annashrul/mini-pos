"use server";

import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId, getCurrentCompanyIdOrNull } from "@/lib/company";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

export async function getCategories(params?: {
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const companyId = await getCurrentCompanyIdOrNull();
  const { search, page = 1, perPage = 10 } = params || {};
  const where: Record<string, unknown> = companyId ? { companyId } : {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.category.count({ where }),
  ]);

  return { categories, total, totalPages: Math.ceil(total / perPage) };
}

export async function getAllCategories() {
  const companyId = await getCurrentCompanyIdOrNull();
  if (companyId) {
    return prisma.category.findMany({
      where: { companyId },
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    });
  }
  return prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(data: FormData) {
  await assertMenuActionAccess("categories", "create");
  const parsed = categorySchema.safeParse({
    name: data.get("name"),
    description: data.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const companyId = await getCurrentCompanyId();
  try {
    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        companyId,
      },
    });
    revalidatePath("/categories");
    createAuditLog({
      action: "CREATE",
      entity: "Category",
      entityId: category.id,
      details: {
        data: {
          name: parsed.data.name,
          description: parsed.data.description ?? null,
        },
      },
    }).catch(() => {});
    return { success: true, id: category.id, name: category.name };
  } catch {
    return { error: "Kategori dengan nama tersebut sudah ada" };
  }
}

export async function updateCategory(id: string, data: FormData) {
  await assertMenuActionAccess("categories", "update");
  const companyId = await getCurrentCompanyId();
  const parsed = categorySchema.safeParse({
    name: data.get("name"),
    description: data.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  try {
    const oldCategory = await prisma.category.findUniqueOrThrow({
      where: { id, companyId },
    });
    await prisma.category.update({
      where: { id, companyId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
    });
    revalidatePath("/categories");
    createAuditLog({
      action: "UPDATE",
      entity: "Category",
      entityId: id,
      details: {
        before: {
          name: oldCategory.name,
          description: oldCategory.description,
        },
        after: {
          name: parsed.data.name,
          description: parsed.data.description ?? null,
        },
      },
    }).catch(() => {});
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate kategori" };
  }
}

export async function deleteCategory(id: string) {
  await assertMenuActionAccess("categories", "delete");
  const companyId = await getCurrentCompanyId();
  try {
    const productsCount = await prisma.product.count({
      where: { categoryId: id, companyId },
    });
    if (productsCount > 0) {
      return { error: `Kategori masih memiliki ${productsCount} produk` };
    }
    const category = await prisma.category.findUniqueOrThrow({
      where: { id, companyId },
    });
    await prisma.category.delete({ where: { id, companyId } });
    revalidatePath("/categories");
    createAuditLog({
      action: "DELETE",
      entity: "Category",
      entityId: id,
      details: { deleted: { name: category.name } },
    }).catch(() => {});
    return { success: true };
  } catch {
    return { error: "Gagal menghapus kategori" };
  }
}

// ─── Import Categories ───

export async function importCategories(rows: { name: string; description: string }[]) {
  await assertMenuActionAccess("categories", "create");
  const companyId = await getCurrentCompanyId();
  const existing = new Set((await prisma.category.findMany({ where: { companyId }, select: { name: true } })).map((c) => c.name.toLowerCase()));

  type R = { row: number; success: boolean; name: string; error?: string };
  const results: R[] = [];
  const validRows: { name: string; description: string | null }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    if (!row.name?.trim()) { results.push({ row: rowNum, success: false, name: `Baris ${rowNum}`, error: "Nama wajib diisi" }); continue; }
    if (existing.has(row.name.toLowerCase().trim())) { results.push({ row: rowNum, success: false, name: row.name, error: "Nama sudah ada" }); continue; }
    existing.add(row.name.toLowerCase().trim());
    validRows.push({ name: row.name.trim(), description: row.description?.trim() || null });
  }

  if (validRows.length > 0) {
    try {
      await prisma.category.createMany({ data: validRows.map((r) => ({ ...r, companyId })), skipDuplicates: true });
      for (const r of validRows) results.push({ row: rows.findIndex((x) => x.name === r.name) + 2, success: true, name: r.name });
    } catch { for (const r of validRows) results.push({ row: 0, success: false, name: r.name, error: "Gagal menyimpan" }); }
  }

  results.sort((a, b) => a.row - b.row);
  revalidatePath("/categories");
  return { results, successCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length };
}

const CATEGORY_TEMPLATE_COLS: TemplateColumn[] = [
  { header: "Nama Kategori *", width: 25, sampleValues: ["Makanan", "Minuman"] },
  { header: "Deskripsi", width: 35, sampleValues: ["Produk makanan ringan dan berat", "Minuman dingin dan panas"] },
];

export async function downloadCategoryImportTemplate(format: "csv" | "excel" | "docx") {
  const result = await generateImportTemplate(CATEGORY_TEMPLATE_COLS, 2, ["Kolom dengan tanda * wajib diisi"], format);
  return { data: result.data, filename: `template-import-kategori.${format === "excel" ? "xlsx" : format}`, mimeType: result.mimeType };
}
