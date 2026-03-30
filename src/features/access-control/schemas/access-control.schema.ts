import { z } from "zod";

export const accessControlSchema = z.object({
  id: z.string().optional(),
});
