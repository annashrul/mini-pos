import { z } from "zod";

export const brandsSchema = z.object({
  id: z.string().optional(),
});
