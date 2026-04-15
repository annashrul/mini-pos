"use server";

import { prisma } from "@/lib/prisma";
import { userSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { assertMenuActionAccess } from "@/lib/access-control";
import { createAuditLog } from "@/lib/audit";
import { getCurrentCompanyId } from "@/lib/company";
import { generateImportTemplate, type TemplateColumn } from "@/lib/import-parser";

export async function getUsers(params?: { search?: string; role?: string; branchId?: string; page?: number; perPage?: number }) {
  const companyId = await getCurrentCompanyId();
  const { search, role, branchId, page = 1, perPage = 10 } = params || {};
  const where: Record<string, unknown> = { companyId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (role && role !== "all") {
    where.role = role;
  }
  if (branchId && branchId !== "ALL") {
    where.branchId = branchId;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
        isActive: true,
        createdAt: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, totalPages: Math.ceil(total / perPage) };
}

export async function createUser(formData: FormData) {
  await assertMenuActionAccess("users", "create");
  const companyId = await getCurrentCompanyId();
  const branchId = (formData.get("branchId") as string) || null;
  const data = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    role: formData.get("role") as string,
    isActive: true,
  };

  const parsed = userSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Data user tidak valid" };
  }

  if (!parsed.data.password) {
    return { error: "Password wajib diisi" };
  }

  try {
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
        role: parsed.data.role,
        isActive: parsed.data.isActive,
        emailVerified: true,
        companyId,
        branchId,
      },
    });
    revalidatePath("/users");

    createAuditLog({ action: "CREATE", entity: "User", details: { data: { name: parsed.data.name, email: parsed.data.email, role: parsed.data.role, branchId } } }).catch(() => {});

    return { success: true };
  } catch {
    return { error: "Email sudah digunakan" };
  }
}

export async function updateUser(id: string, formData: FormData) {
  await assertMenuActionAccess("users", "update");
  const branchId = (formData.get("branchId") as string) || null;
  const data: Record<string, unknown> = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    role: formData.get("role") as string,
    isActive: formData.get("isActive") === "true",
    branchId,
  };

  const password = formData.get("password") as string;
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  try {
    const oldUser = await prisma.user.findUnique({
      where: { id },
      select: { name: true, email: true, role: true, isActive: true, branchId: true, branch: { select: { name: true } } },
    });

    await prisma.user.update({ where: { id }, data });
    revalidatePath("/users");

    if (oldUser) {
      createAuditLog({ action: "UPDATE", entity: "User", entityId: id, details: { before: { name: oldUser.name, email: oldUser.email, role: oldUser.role, isActive: oldUser.isActive, branchId: oldUser.branchId, branchName: oldUser.branch?.name ?? null }, after: { name: data.name as string, email: data.email as string, role: data.role as string, isActive: data.isActive as boolean, branchId } } }).catch(() => {});
    }

    return { success: true };
  } catch {
    return { error: "Gagal mengupdate user" };
  }
}

export async function deleteUser(id: string) {
  await assertMenuActionAccess("users", "delete");
  try {
    const txCount = await prisma.transaction.count({ where: { userId: id } });
    if (txCount > 0) {
      return { error: `User memiliki ${txCount} transaksi dan tidak bisa dihapus` };
    }
    const oldUser = await prisma.user.findUnique({
      where: { id },
      select: { name: true, email: true, role: true, isActive: true, branchId: true, branch: { select: { name: true } } },
    });

    await prisma.user.delete({ where: { id } });
    revalidatePath("/users");

    createAuditLog({ action: "DELETE", entity: "User", entityId: id, details: { deleted: oldUser ? { name: oldUser.name, email: oldUser.email, role: oldUser.role, isActive: oldUser.isActive, branchId: oldUser.branchId, branchName: oldUser.branch?.name ?? null } : null } }).catch(() => {});

    return { success: true };
  } catch {
    return { error: "Gagal menghapus user" };
  }
}

// ─── User Stats ───

export async function getUserStats(branchId?: string) {
  const companyId = await getCurrentCompanyId();
  const esc = (v: string) => v.replace(/'/g, "''");
  const branchFilter = branchId ? `AND "branchId" = '${esc(branchId)}'` : "";
  const result = await prisma.$queryRawUnsafe<{ total: number; active: number; role: string; role_count: number }[]>(`
    SELECT
      (SELECT COUNT(*)::int4 FROM users WHERE "companyId" = '${esc(companyId)}' AND "deletedAt" IS NULL ${branchFilter}) AS total,
      (SELECT COUNT(*)::int4 FROM users WHERE "companyId" = '${esc(companyId)}' AND "deletedAt" IS NULL AND "isActive" = true ${branchFilter}) AS active,
      role, COUNT(*)::int4 AS role_count
    FROM users
    WHERE "companyId" = '${esc(companyId)}' AND "deletedAt" IS NULL ${branchFilter}
    GROUP BY role
    ORDER BY role_count DESC
    LIMIT 5
  `);
  const total = Number(result[0]?.total ?? 0);
  const active = Number(result[0]?.active ?? 0);
  const topRoles = result.map((r) => [r.role, Number(r.role_count)] as [string, number]);
  return { total, active, topRoles };
}

// ─── Import Users ───

type ImportRole = "ADMIN" | "MANAGER" | "CASHIER";
const VALID_ROLES: ImportRole[] = ["ADMIN", "MANAGER", "CASHIER"];

export async function importUsers(rows: { name: string; email: string; password: string; role: string; branchName: string }[]) {
  await assertMenuActionAccess("users", "create");
  const companyId = await getCurrentCompanyId();
  const [existingEmails, branches] = await Promise.all([
    prisma.user.findMany({ select: { email: true } }),
    prisma.branch.findMany({ where: { companyId }, select: { id: true, name: true } }),
  ]);
  const emailSet = new Set(existingEmails.map((u) => u.email.toLowerCase()));
  const branchMap = new Map(branches.map((b) => [b.name.toLowerCase(), b.id]));

  type R = { row: number; success: boolean; name: string; error?: string };
  const results: R[] = [];
  const validRows: { rowNum: number; name: string; email: string; password: string; role: ImportRole; branchId: string | null }[] = [];

  // Phase 1: Validate
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;
    if (!row.name?.trim()) { results.push({ row: rowNum, success: false, name: `Baris ${rowNum}`, error: "Nama wajib diisi" }); continue; }
    if (!row.email?.trim()) { results.push({ row: rowNum, success: false, name: row.name, error: "Email wajib diisi" }); continue; }
    if (emailSet.has(row.email.toLowerCase().trim())) { results.push({ row: rowNum, success: false, name: row.name, error: "Email sudah terdaftar" }); continue; }
    emailSet.add(row.email.toLowerCase().trim());

    const role = (row.role?.trim().toUpperCase() || "CASHIER") as ImportRole;
    validRows.push({
      rowNum, name: row.name.trim(), email: row.email.trim().toLowerCase(),
      password: row.password?.trim() || "12345678",
      role: VALID_ROLES.includes(role) ? role : "CASHIER",
      branchId: row.branchName?.trim() ? (branchMap.get(row.branchName.toLowerCase().trim()) ?? null) : null,
    });
  }

  // Phase 2: Hash all passwords in parallel (huge speedup vs sequential)
  if (validRows.length > 0) {
    const hashes = await Promise.all(validRows.map((r) => bcrypt.hash(r.password, 10)));

    // Phase 3: Bulk insert via createMany
    try {
      await prisma.user.createMany({
        data: validRows.map((r, i) => ({
          name: r.name, email: r.email, password: hashes[i]!,
          role: r.role, companyId, branchId: r.branchId, isActive: true,
        })),
        skipDuplicates: true,
      });
      for (const r of validRows) results.push({ row: r.rowNum, success: true, name: r.name });
    } catch {
      for (const r of validRows) results.push({ row: r.rowNum, success: false, name: r.name, error: "Gagal menyimpan" });
    }
  }

  results.sort((a, b) => a.row - b.row);
  revalidatePath("/users");
  return { results, successCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length };
}

const USER_TEMPLATE_COLS: TemplateColumn[] = [
  { header: "Nama *", width: 20, sampleValues: ["Budi Santoso", "Siti Rahayu"] },
  { header: "Email *", width: 24, sampleValues: ["budi@toko.com", "siti@toko.com"] },
  { header: "Password", width: 14, sampleValues: ["12345678", "12345678"] },
  { header: "Role", width: 12, sampleValues: ["CASHIER", "MANAGER"] },
  { header: "Cabang", width: 18, sampleValues: ["Cabang Utama", "Cabang Bandung"] },
];

export async function downloadUserImportTemplate(format: "csv" | "excel" | "docx") {
  const companyId = await getCurrentCompanyId();
  const branches = await prisma.branch.findMany({ where: { companyId, isActive: true }, select: { name: true }, orderBy: { name: "asc" } });
  const notes = [`Cabang: ${branches.map((b) => b.name).join(", ") || "-"}`, "Role: ADMIN, MANAGER, CASHIER (default: CASHIER)", "Password default: 12345678 jika dikosongkan", "Kolom dengan tanda * wajib diisi"];
  const result = await generateImportTemplate(USER_TEMPLATE_COLS, 2, notes, format);
  return { data: result.data, filename: `template-import-user.${format === "excel" ? "xlsx" : format}`, mimeType: result.mimeType };
}

export async function bulkDeleteUsers(ids: string[]) {
  await assertMenuActionAccess("users", "delete");
  const result = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/users");
  return { count: result.count };
}
