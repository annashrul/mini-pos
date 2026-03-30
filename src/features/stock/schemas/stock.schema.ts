import { z } from "zod";

export const stockSchema = z.object({
  id: z.string().optional(),
});
