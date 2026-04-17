"use server";

import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { emitEvent, EVENTS } from "@/lib/socket-emit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
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

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existingUser) {
    if (!existingUser.emailVerified) {
      // Resend verification email
      await sendNewVerificationToken(parsed.data.email);
      return { needsVerification: true, email: parsed.data.email };
    }
    return { error: "Email sudah terdaftar" };
  }

  let slug = generateSlug(parsed.data.companyName);
  const existingSlug = await prisma.company.findUnique({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  try {
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);

    await prisma.$transaction(async (tx) => {
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

      await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          password: hashedPassword,
          role: "SUPER_ADMIN",
          companyId: company.id,
          branchId: branch.id,
          emailVerified: true,
        },
      });

      // Default categories
      await tx.category.createMany({
        data: [
          { name: "Makanan", description: "Menu makanan", companyId: company.id },
          { name: "Minuman", description: "Menu minuman", companyId: company.id },
          { name: "Snack", description: "Makanan ringan dan cemilan", companyId: company.id },
          { name: "Dessert", description: "Menu penutup dan kue", companyId: company.id },
          { name: "Lainnya", description: "Produk lainnya", companyId: company.id },
        ],
      });

      // Default brands
      await tx.brand.createMany({
        data: [
          { name: "Tanpa Brand", companyId: company.id },
          { name: "House Brand", companyId: company.id },
        ],
      });

      // Default chart of accounts
      const acAsset = await tx.accountCategory.create({ data: { name: "Aset", type: "ASSET", normalSide: "DEBIT", sortOrder: 1, companyId: company.id } });
      const acLiability = await tx.accountCategory.create({ data: { name: "Kewajiban", type: "LIABILITY", normalSide: "CREDIT", sortOrder: 2, companyId: company.id } });
      const acEquity = await tx.accountCategory.create({ data: { name: "Modal", type: "EQUITY", normalSide: "CREDIT", sortOrder: 3, companyId: company.id } });
      const acRevenue = await tx.accountCategory.create({ data: { name: "Pendapatan", type: "REVENUE", normalSide: "CREDIT", sortOrder: 4, companyId: company.id } });
      const acExpense = await tx.accountCategory.create({ data: { name: "Beban", type: "EXPENSE", normalSide: "DEBIT", sortOrder: 5, companyId: company.id } });
      const withCompanyCode = (baseCode: string) =>
        `${baseCode}-${company.id.slice(0, 4).toUpperCase()}`;

      await tx.account.createMany({
        data: [
          // Aset
          { code: withCompanyCode("1-1001"), name: "Kas", categoryId: acAsset.id, isActive: true, isSystem: true, openingBalance: 0 },
          { code: withCompanyCode("1-1002"), name: "Bank", categoryId: acAsset.id, isActive: true, isSystem: true, openingBalance: 0 },
          { code: withCompanyCode("1-1003"), name: "Piutang Dagang", categoryId: acAsset.id, isActive: true, isSystem: true, openingBalance: 0 },
          { code: withCompanyCode("1-1004"), name: "Persediaan Barang", categoryId: acAsset.id, isActive: true, isSystem: true, openingBalance: 0 },
          { code: withCompanyCode("1-1005"), name: "Perlengkapan Toko", categoryId: acAsset.id, isActive: true, isSystem: false, openingBalance: 0 },
          { code: withCompanyCode("1-2001"), name: "Peralatan Toko", categoryId: acAsset.id, isActive: true, isSystem: false, openingBalance: 0 },
          // Kewajiban
          { code: withCompanyCode("2-1001"), name: "Hutang Dagang", categoryId: acLiability.id, isActive: true, isSystem: true, openingBalance: 0 },
          { code: withCompanyCode("2-1002"), name: "Hutang Pajak", categoryId: acLiability.id, isActive: true, isSystem: true, openingBalance: 0 },
          { code: withCompanyCode("2-1003"), name: "Hutang Gaji", categoryId: acLiability.id, isActive: true, isSystem: false, openingBalance: 0 },
          // Modal
          { code: withCompanyCode("3-1001"), name: "Modal Pemilik", categoryId: acEquity.id, isActive: true, isSystem: true, openingBalance: 0 },
          { code: withCompanyCode("3-1002"), name: "Laba Ditahan", categoryId: acEquity.id, isActive: true, isSystem: true, openingBalance: 0 },
          // Pendapatan
          { code: withCompanyCode("4-1001"), name: "Pendapatan Penjualan", categoryId: acRevenue.id, isActive: true, isSystem: true, openingBalance: 0 },
          { code: withCompanyCode("4-1002"), name: "Retur Penjualan", categoryId: acRevenue.id, isActive: true, isSystem: false, openingBalance: 0 },
          { code: withCompanyCode("4-2001"), name: "Pendapatan Lain-lain", categoryId: acRevenue.id, isActive: true, isSystem: false, openingBalance: 0 },
          // Beban
          { code: withCompanyCode("5-1001"), name: "Harga Pokok Penjualan", categoryId: acExpense.id, isActive: true, isSystem: true, openingBalance: 0 },
          { code: withCompanyCode("5-1002"), name: "Beban Operasional", categoryId: acExpense.id, isActive: true, isSystem: false, openingBalance: 0 },
          { code: withCompanyCode("5-1003"), name: "Beban Gaji", categoryId: acExpense.id, isActive: true, isSystem: false, openingBalance: 0 },
          { code: withCompanyCode("5-1004"), name: "Beban Listrik & Air", categoryId: acExpense.id, isActive: true, isSystem: false, openingBalance: 0 },
          { code: withCompanyCode("5-1005"), name: "Beban Sewa", categoryId: acExpense.id, isActive: true, isSystem: false, openingBalance: 0 },
          { code: withCompanyCode("5-1010"), name: "Beban PPh 23", categoryId: acExpense.id, isActive: true, isSystem: true, openingBalance: 0 },
          // Tax accounts
          { code: withCompanyCode("2-1100"), name: "PPN Keluaran", categoryId: acLiability.id, isActive: true, isSystem: true, openingBalance: 0 },
          { code: withCompanyCode("1-1100"), name: "PPN Masukan", categoryId: acAsset.id, isActive: true, isSystem: true, openingBalance: 0 },
          { code: withCompanyCode("2-1200"), name: "Hutang PPh 21", categoryId: acLiability.id, isActive: true, isSystem: true, openingBalance: 0 },
          { code: withCompanyCode("2-1201"), name: "Hutang PPh 23", categoryId: acLiability.id, isActive: true, isSystem: true, openingBalance: 0 },
        ],
      });

      // Default tables (10 meja)
      await tx.restaurantTable.createMany({
        data: Array.from({ length: 10 }, (_, i) => ({
          number: i + 1,
          name: `Meja ${i + 1}`,
          capacity: 4,
          branchId: branch.id,
          section: i < 6 ? "Indoor" : "Outdoor",
          sortOrder: i + 1,
        })),
      });
    });
    emitEvent(EVENTS.COMPANY_REGISTERED, { companyName: parsed.data.companyName, email: parsed.data.email });

    return { success: true };
  } catch (err) {
    console.error("[registerCompany] Error:", err);
    return { error: "Gagal membuat akun. Silakan coba lagi." };
  }
}

async function sendNewVerificationToken(email: string) {
  // Delete old tokens
  await prisma.emailVerificationToken.deleteMany({ where: { email } });

  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const token = `${otp}-${crypto.randomBytes(3).toString("hex")}`;
  await prisma.emailVerificationToken.create({
    data: {
      email,
      token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  await sendVerificationEmail(email, otp);
}

export async function verifyEmailOtp(email: string, otp: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOtp = otp.trim().replace(/\s+/g, "");

  if (!normalizedEmail || !normalizedOtp) {
    return { error: "Email dan OTP wajib diisi" };
  }

  const record = await prisma.emailVerificationToken.findFirst({
    where: {
      email: normalizedEmail,
      token: { startsWith: `${normalizedOtp}-` },
    },
  });

  if (!record) {
    return { error: "Kode OTP tidak valid" };
  }

  if (record.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    return { error: "Kode OTP sudah kedaluwarsa. Silakan kirim ulang." };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user) return { error: "User tidak ditemukan" };

  if (!user.emailVerified) {
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { emailVerified: true },
    });
  }

  await prisma.emailVerificationToken.deleteMany({ where: { email: normalizedEmail } });

  const loginToken = `login_${crypto.randomBytes(24).toString("hex")}`;
  await prisma.emailVerificationToken.create({
    data: {
      email: normalizedEmail,
      token: loginToken,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return { success: true, loginToken };
}

export async function resendVerificationEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) return { error: "Email tidak ditemukan" };
  if (user.emailVerified) return { error: "Email sudah terverifikasi" };

  await sendNewVerificationToken(normalizedEmail);
  return { success: true };
}
