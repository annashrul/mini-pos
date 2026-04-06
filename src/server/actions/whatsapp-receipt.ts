"use server";

import { prisma } from "@/lib/prisma";

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatReceiptDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    CASH: "CASH",
    TRANSFER: "TRANSFER",
    QRIS: "QRIS",
    EWALLET: "E-WALLET",
    DEBIT: "DEBIT",
    CREDIT_CARD: "KARTU KREDIT",
    TERMIN: "TERMIN",
  };
  return labels[method] || method;
}

/**
 * Normalize Indonesian phone number to international format (62xxx).
 * - Removes spaces, dashes, parentheses
 * - 08xxx -> 628xxx
 * - +62xxx -> 62xxx
 * - 62xxx -> 62xxx (unchanged)
 */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]+/g, "");

  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }

  return cleaned;
}

export async function generateReceiptText(
  transactionId: string
): Promise<{ data?: string; error?: string }> {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
        },
        payments: {
          orderBy: { createdAt: "asc" },
        },
        user: {
          select: { name: true },
        },
        customer: {
          select: { name: true, phone: true },
        },
        branch: {
          select: { name: true },
        },
      },
    });

    if (!transaction) {
      return { error: "Transaksi tidak ditemukan" };
    }

    const lines: string[] = [];
    const sep = "\u2501".repeat(20);

    lines.push("\uD83E\uDDFE *NusaPOS - Struk Digital*");
    lines.push(sep);
    lines.push(`Invoice: ${transaction.invoiceNumber}`);
    lines.push(`Tanggal: ${formatReceiptDate(transaction.createdAt)}`);
    lines.push(`Kasir: ${transaction.user.name}`);
    if (transaction.branch) {
      lines.push(`Cabang: ${transaction.branch.name}`);
    }
    if (transaction.customer) {
      lines.push(`Customer: ${transaction.customer.name}`);
    }
    lines.push("");

    lines.push("*Detail Belanja:*");
    transaction.items.forEach((item, idx) => {
      const qtyLabel =
        item.unitName && item.unitName !== "PCS"
          ? `${item.quantity} ${item.unitName}`
          : `x${item.quantity}`;
      let line = `${idx + 1}. ${item.productName} ${qtyLabel}  ${formatRupiah(item.subtotal)}`;
      if (item.discount > 0) {
        line += ` (disc ${formatRupiah(item.discount)})`;
      }
      lines.push(line);
    });

    lines.push(sep);
    lines.push(`Subtotal:    ${formatRupiah(transaction.subtotal)}`);

    if (transaction.discountAmount > 0) {
      lines.push(`Diskon:      -${formatRupiah(transaction.discountAmount)}`);
    }
    if (transaction.taxAmount > 0) {
      lines.push(`Pajak:       ${formatRupiah(transaction.taxAmount)}`);
    }

    lines.push(`*TOTAL:      ${formatRupiah(transaction.grandTotal)}*`);
    lines.push("");

    // Payment details
    if (transaction.payments.length > 1) {
      lines.push("*Pembayaran:*");
      transaction.payments.forEach((p) => {
        lines.push(
          `  ${paymentMethodLabel(p.method)}: ${formatRupiah(p.amount)}`
        );
      });
    } else {
      lines.push(
        `Bayar (${paymentMethodLabel(transaction.paymentMethod)}): ${formatRupiah(transaction.paymentAmount)}`
      );
    }

    if (transaction.changeAmount > 0) {
      lines.push(`Kembali:      ${formatRupiah(transaction.changeAmount)}`);
    }

    lines.push("");
    lines.push("Terima kasih! \uD83D\uDE4F");

    return { data: lines.join("\n") };
  } catch (error) {
    console.error("Failed to generate receipt text:", error);
    return { error: "Gagal membuat struk digital" };
  }
}

export async function getWhatsAppLink(
  phone: string,
  transactionId: string
): Promise<{ data?: string; error?: string }> {
  const result = await generateReceiptText(transactionId);
  if (result.error || !result.data) {
    return { error: result.error || "Gagal membuat struk" };
  }

  const normalizedPhone = normalizePhone(phone);
  const encodedText = encodeURIComponent(result.data);
  const url = `https://wa.me/${normalizedPhone}?text=${encodedText}`;

  return { data: url };
}
