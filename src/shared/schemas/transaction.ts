import { z } from "zod";

export const transactionLineSchema = z.object({
  productId: z.string().min(1, "Produk wajib dipilih"),
  quantity: z.number().min(1, "Qty minimal 1"),
  unitPrice: z.number().min(0, "Harga tidak valid"),
  discount: z.number().min(0, "Diskon tidak valid"),
});

export const transactionFormSchema = z.object({
  customer: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
  }),
  paymentMethod: z.enum(["CASH", "TRANSFER", "QRIS", "EWALLET", "DEBIT", "CREDIT_CARD"]),
  paymentAmount: z.number().min(0),
  notes: z.string().optional(),
  items: z.array(transactionLineSchema).min(1, "Minimal ada 1 item"),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
