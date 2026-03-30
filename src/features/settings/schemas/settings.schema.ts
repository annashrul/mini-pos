import { z } from "zod";

export const settingsSchema = z.object({
  id: z.string().optional(),
});
