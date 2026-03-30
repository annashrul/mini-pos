import { z } from "zod";

export const analyticsSchema = z.object({
  id: z.string().optional(),
});
