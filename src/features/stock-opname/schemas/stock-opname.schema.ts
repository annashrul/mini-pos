import { z } from "zod";

export const stockOpnameSchema = z.object({
  id: z.string().optional(),
});
