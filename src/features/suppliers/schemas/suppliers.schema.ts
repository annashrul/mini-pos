import { z } from "zod";

export const suppliersSchema = z.object({
  id: z.string().optional(),
});
