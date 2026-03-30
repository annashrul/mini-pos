import { z } from "zod";

export const stockTransfersSchema = z.object({
  id: z.string().optional(),
});
