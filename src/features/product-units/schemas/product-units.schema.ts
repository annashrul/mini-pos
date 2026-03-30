import { z } from "zod";

export const productUnitsSchema = z.object({
  id: z.string().optional(),
});
