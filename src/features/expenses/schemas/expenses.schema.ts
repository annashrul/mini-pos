import { z } from "zod";

export const expensesSchema = z.object({
  id: z.string().optional(),
});
