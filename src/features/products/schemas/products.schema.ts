import { z } from "zod";

export const productsSchema = z.object({
  id: z.string().optional(),
});
