import { z } from "zod";

export const createPurchaseOrderSchema = z.object({
    supplierId: z.string().min(1, "Pilih supplier"),
    branchIds: z.array(z.string()).min(1, "Pilih minimal 1 lokasi"),
    expectedDate: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        productId: z.string(),
        productName: z.string(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
    })).min(1, "Tambahkan minimal 1 item"),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
