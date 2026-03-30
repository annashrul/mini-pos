import { z } from "zod";

export const reportsSchema = z.object({
  id: z.string().optional(),
});
