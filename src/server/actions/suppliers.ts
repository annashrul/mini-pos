"use server";

import { prisma } from "@/lib/prisma";
import { supplierSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

export async function getSuppliers(params?: { search?: string; status?: string; page?: number; perPage?: number }) {
  const companyId = await getCurrentCompanyId();
  const { search, status, page = 1, perPage = 10 } = params || {};
  const where: Record<string, unknown> = { companyId };
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }
  if (status === "active") where.isActive = true;
  else if (status === "inactive") where.isActive = false;

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.supplier.count({ where }),
  ]);

  return { suppliers, total, totalPages: Math.ceil(total / perPage) };
}

export async function getAllSuppliers() {
  const companyId = await getCurrentCompanyId();
  return prisma.supplier.findMany({
    where: { companyId },
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createSupplier(data: FormData) {
  await assertMenuActionAccess("suppliers", "create");
  const parsed = supplierSchema.safeParse({
    name: data.get("name"),
    contact: data.get("contact") || null,
    address: data.get("address") || null,
    email: data.get("email") || null,
    isActive: data.get("isActive") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Data supplier tidak valid" };

  const companyId = await getCurrentCompanyId();
  try {
    const supplier = await prisma.supplier.create({
      data: {
        name: parsed.data.name,
        contact: parsed.data.contact ?? null,
        address: parsed.data.address ?? null,
        email: parsed.data.email ?? null,
        isActive: parsed.data.isActive,
        companyId,
      },
    });
    createAuditLog({ action: "CREATE", entity: "Supplier", details: { data: { name: parsed.data.name, contact: parsed.data.contact ?? null, email: parsed.data.email ?? null, address: parsed.data.address ?? null, isActive: parsed.data.isActive } } }).catch(() => {});
    revalidatePath("/suppliers");
    return { success: true, id: supplier.id };
  } catch {
    return { error: "Gagal menambahkan supplier" };
  }
}

export async function updateSupplier(id: string, data: FormData) {
  await assertMenuActionAccess("suppliers", "update");
  await getCurrentCompanyId();
  const parsed = supplierSchema.safeParse({
    name: data.get("name"),
    contact: data.get("contact") || null,
    address: data.get("address") || null,
    email: data.get("email") || null,
    isActive: data.get("isActive") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Data supplier tidak valid" };

  try {
    const oldSupplier = await prisma.supplier.findUniqueOrThrow({ where: { id } });
    await prisma.supplier.update({
      where: { id },
      data: {
        name: parsed.data.name,
        contact: parsed.data.contact ?? null,
        address: parsed.data.address ?? null,
        email: parsed.data.email ?? null,
        isActive: parsed.data.isActive,
      },
    });
    createAuditLog({ action: "UPDATE", entity: "Supplier", entityId: id, details: { before: { name: oldSupplier.name, contact: oldSupplier.contact, email: oldSupplier.email, address: oldSupplier.address, isActive: oldSupplier.isActive }, after: { name: parsed.data.name, contact: parsed.data.contact ?? null, email: parsed.data.email ?? null, address: parsed.data.address ?? null, isActive: parsed.data.isActive } } }).catch(() => {});
    revalidatePath("/suppliers");
    return { success: true };
  } catch {
    return { error: "Gagal mengupdate supplier" };
  }
}

export async function deleteSupplier(id: string) {
  await assertMenuActionAccess("suppliers", "delete");
  await getCurrentCompanyId();
  try {
    const productsCount = await prisma.product.count({ where: { supplierId: id } });
    if (productsCount > 0) {
      return { error: `Supplier masih memiliki ${productsCount} produk` };
    }
    const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id } });
    await prisma.supplier.delete({ where: { id } });
    createAuditLog({ action: "DELETE", entity: "Supplier", entityId: id, details: { deleted: { name: supplier.name, contact: supplier.contact, email: supplier.email } } }).catch(() => {});
    revalidatePath("/suppliers");
    return { success: true };
  } catch {
    return { error: "Gagal menghapus supplier" };
  }
}

// ─── Import Suppliers ───

export async function importSuppliers(rows: { name: string; contact: string; email: string; address: string }[]) {
  await assertMenuActionAccess("suppliers", "create");
  const companyId = await getCurrentCompanyId();
  const existing = new Set((await prisma.supplier.findMany({ where: { companyId }, select: { name: true } })).map((s) => s.name.toLowerCase()));

  type R = { row: number; success: boolean; name: string; error?: string };
  const results: R[] = [];
  const validRows: { name: string; contact: string | null; email: string | null; address: string | null }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    if (!row.name?.trim()) { results.push({ row: rowNum, success: false, name: `Baris ${rowNum}`, error: "Nama wajib diisi" }); continue; }
    if (existing.has(row.name.toLowerCase().trim())) { results.push({ row: rowNum, success: false, name: row.name, error: "Nama sudah ada" }); continue; }
    existing.add(row.name.toLowerCase().trim());
    validRows.push({ name: row.name.trim(), contact: row.contact?.trim() || null, email: row.email?.trim() || null, address: row.address?.trim() || null });
  }

  if (validRows.length > 0) {
    try {
      await prisma.supplier.createMany({ data: validRows.map((r) => ({ ...r, isActive: true, companyId })), skipDuplicates: true });
      for (const r of validRows) results.push({ row: rows.findIndex((x) => x.name === r.name) + 2, success: true, name: r.name });
    } catch { for (const r of validRows) results.push({ row: 0, success: false, name: r.name, error: "Gagal menyimpan" }); }
  }

  results.sort((a, b) => a.row - b.row);
  revalidatePath("/suppliers");
  return { results, successCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length };
}

const SUPPLIER_TEMPLATE_COLS: TemplateColumn[] = [
  { header: "Nama *", width: 22, sampleValues: ["PT Indofood", "CV Jaya Abadi"] },
  { header: "Kontak", width: 16, sampleValues: ["08123456789", "021-5551234"] },
  { header: "Email", width: 22, sampleValues: ["info@indofood.com", "order@jayaabadi.com"] },
  { header: "Alamat", width: 30, sampleValues: ["Jl. Industri 10, Jakarta", "Jl. Raya Bogor 25"] },
];

export async function downloadSupplierImportTemplate(format: "csv" | "excel" | "docx") {
  const result = await generateImportTemplate(SUPPLIER_TEMPLATE_COLS, 2, ["Kolom dengan tanda * wajib diisi"], format);
  return { data: result.data, filename: `template-import-supplier.${format === "excel" ? "xlsx" : format}`, mimeType: result.mimeType };
}
