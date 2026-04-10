"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  companyName: z.string().min(1, "Nama perusahaan wajib diisi"),
  companyPhone: z.string().optional(),
  companyAddress: z.string().optional(),
  name: z.string().min(1, "Nama lengkap wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export async function registerCompany(formData: FormData) {
  const data = {
    companyName: formData.get("companyName") as string,
    companyPhone: (formData.get("companyPhone") as string) || undefined,
    companyAddress: (formData.get("companyAddress") as string) || undefined,
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Data tidak valid" };
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existingUser) {
    return { error: "Email sudah terdaftar" };
  }

  // Generate unique slug
  let slug = generateSlug(parsed.data.companyName);
  const existingSlug = await prisma.company.findUnique({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  try {
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);

    // Create company, default branch, and admin user in one transaction
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: parsed.data.companyName,
          slug,
          phone: parsed.data.companyPhone ?? null,
          address: parsed.data.companyAddress ?? null,
          email: parsed.data.email,
        },
      });

      const branch = await tx.branch.create({
        data: {
          name: "Cabang Utama",
          code: "HQ",
          companyId: company.id,
        },
      });

      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          password: hashedPassword,
          role: "SUPER_ADMIN",
          companyId: company.id,
          branchId: branch.id,
        },
      });

      return { company, branch, user };
    });

    return { success: true, companyId: result.company.id };
  } catch {
    return { error: "Gagal membuat akun. Silakan coba lagi." };
  }
}
