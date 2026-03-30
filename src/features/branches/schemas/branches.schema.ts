import { z } from "zod";

export const branchesSchema = z.object({
  id: z.string().optional(),
});
