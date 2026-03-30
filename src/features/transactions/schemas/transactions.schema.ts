import { z } from "zod";

export const transactionsSchema = z.object({
  id: z.string().optional(),
});
