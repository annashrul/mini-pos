"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { assertMenuActionAccess } from "@/lib/access-control";

function generateGiftCardCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const segments = [];
    for (let s = 0; s < 4; s++) {
        let segment = "";
        for (let i = 0; i < 4; i++) {
            segment += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        segments.push(segment);
    }
    return segments.join("-");
}

export async function issueStoreCredit(data: {
    customerId: string;
    amount: number;
    expiryDate?: string;
}) {
    await assertMenuActionAccess("customers", "create");

    if (data.amount <= 0) {
        return { error: "Jumlah store credit harus lebih dari 0" };
    }

    const customer = await prisma.customer.findUnique({
        where: { id: data.customerId },
        select: { id: true, name: true },
    });
    if (!customer) {
        return { error: "Customer tidak ditemukan" };
    }

    // Generate unique code
    let code = generateGiftCardCode();
    let exists = await prisma.storeCredit.findUnique({ where: { code } });
    while (exists) {
        code = generateGiftCardCode();
        exists = await prisma.storeCredit.findUnique({ where: { code } });
    }

    try {
        const { auth } = await import("@/lib/auth");
        const session = await auth();
        const issuerId = session?.user?.id;

        if (!issuerId) {
            return { error: "User tidak terautentikasi" };
        }

        const storeCredit = await prisma.storeCredit.create({
            data: {
                customerId: data.customerId,
                code,
                balance: data.amount,
                initialAmount: data.amount,
                isActive: true,
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
                issuedBy: issuerId,
            },
        });

        createAuditLog({
            action: "CREATE",
            entity: "StoreCredit",
            entityId: storeCredit.id,
            details: {
                data: {
                    code,
                    amount: data.amount,
                    customerId: data.customerId,
                    customerName: customer.name,
                },
            },
        }).catch(() => {});

        revalidatePath("/customers");
        return { success: true, code: storeCredit.code, id: storeCredit.id };
    } catch {
        return { error: "Gagal membuat store credit" };
    }
}

export async function getStoreCredits(customerId: string) {
    const credits = await prisma.storeCredit.findMany({
        where: { customerId },
        include: {
            issuer: { select: { name: true } },
            usages: {
                orderBy: { createdAt: "desc" },
                take: 5,
            },
        },
        orderBy: { createdAt: "desc" },
    });

    const summary = {
        totalBalance: credits.reduce((sum, c) => sum + (c.isActive ? c.balance : 0), 0),
        totalIssued: credits.reduce((sum, c) => sum + c.initialAmount, 0),
        activeCount: credits.filter((c) => c.isActive && c.balance > 0).length,
    };

    return { credits, summary };
}

export async function useStoreCredit(
    code: string,
    amount: number,
    transactionId?: string,
) {
    if (amount <= 0) {
        return { error: "Jumlah penggunaan harus lebih dari 0" };
    }

    const credit = await prisma.storeCredit.findUnique({ where: { code } });

    if (!credit) {
        return { error: "Kode store credit tidak ditemukan" };
    }

    if (!credit.isActive) {
        return { error: "Store credit sudah tidak aktif" };
    }

    if (credit.expiryDate && credit.expiryDate < new Date()) {
        // Auto-deactivate expired credit
        await prisma.storeCredit.update({
            where: { id: credit.id },
            data: { isActive: false },
        });
        return { error: "Store credit sudah kedaluwarsa" };
    }

    if (credit.balance < amount) {
        return { error: `Saldo tidak cukup. Saldo tersedia: ${credit.balance}` };
    }

    try {
        const [updatedCredit, usage] = await prisma.$transaction([
            prisma.storeCredit.update({
                where: { id: credit.id },
                data: {
                    balance: { decrement: amount },
                },
            }),
            prisma.storeCreditUsage.create({
                data: {
                    storeCreditId: credit.id,
                    amount,
                    transactionId: transactionId || null,
                    notes: transactionId
                        ? `Digunakan untuk transaksi ${transactionId}`
                        : "Penggunaan manual",
                },
            }),
        ]);

        createAuditLog({
            action: "UPDATE",
            entity: "StoreCredit",
            entityId: credit.id,
            details: {
                action: "USE",
                code: credit.code,
                amountUsed: amount,
                remainingBalance: updatedCredit.balance,
                transactionId,
            },
        }).catch(() => {});

        revalidatePath("/customers");
        return {
            success: true,
            remainingBalance: updatedCredit.balance,
            usageId: usage.id,
        };
    } catch {
        return { error: "Gagal menggunakan store credit" };
    }
}

export async function getStoreCreditByCode(code: string) {
    const credit = await prisma.storeCredit.findUnique({
        where: { code },
        include: {
            customer: { select: { id: true, name: true, phone: true } },
            issuer: { select: { name: true } },
            usages: {
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!credit) {
        return { error: "Kode store credit tidak ditemukan" };
    }

    // Check expiry
    const isExpired = credit.expiryDate ? credit.expiryDate < new Date() : false;

    return {
        credit: {
            ...credit,
            isExpired,
            isUsable: credit.isActive && !isExpired && credit.balance > 0,
        },
    };
}
