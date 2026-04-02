import { z } from "zod";

export const createStockOpnameSchema = z.object({
    branchIds: z.array(z.string()).min(1, "Pilih minimal 1 lokasi"),
    notes: z.string().optional(),
});

export type CreateStockOpnameInput = z.infer<typeof createStockOpnameSchema>;
