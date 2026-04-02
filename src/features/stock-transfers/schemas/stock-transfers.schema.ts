import { z } from "zod";

export const createStockTransferSchema = z.object({
    fromBranchId: z.string().min(1, "Pilih cabang asal"),
    toBranchId: z.string().min(1, "Pilih cabang tujuan"),
    notes: z.string().optional(),
    items: z.array(z.object({
        productId: z.string(),
        productName: z.string(),
        quantity: z.number().min(1),
    })).min(1, "Tambahkan minimal 1 item"),
}).refine((data) => data.fromBranchId !== data.toBranchId, {
    message: "Cabang asal dan tujuan tidak boleh sama",
    path: ["toBranchId"],
});

export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;
