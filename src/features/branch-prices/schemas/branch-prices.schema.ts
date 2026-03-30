import { z } from "zod";

export const branchPricesSchema = z.object({
  id: z.string().optional(),
});
