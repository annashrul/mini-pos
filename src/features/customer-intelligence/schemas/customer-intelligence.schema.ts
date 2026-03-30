import { z } from "zod";

export const customerIntelligenceSchema = z.object({
  id: z.string().optional(),
});
