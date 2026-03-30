import { z } from "zod";

export const posSchema = z.object({
  id: z.string().optional(),
});
