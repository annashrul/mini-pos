import { z } from "zod";

export const purchasesSchema = z.object({
  id: z.string().optional(),
});
