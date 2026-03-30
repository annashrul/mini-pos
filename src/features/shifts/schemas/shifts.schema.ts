import { z } from "zod";

export const shiftsSchema = z.object({
  id: z.string().optional(),
});
