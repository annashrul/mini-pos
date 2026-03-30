import { z } from "zod";

export const customersSchema = z.object({
  id: z.string().optional(),
});
