import { z } from "zod";

export const categoriesSchema = z.object({
  id: z.string().optional(),
});
