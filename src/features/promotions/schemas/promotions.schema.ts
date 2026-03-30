import { z } from "zod";

export const promotionsSchema = z.object({
  id: z.string().optional(),
});
