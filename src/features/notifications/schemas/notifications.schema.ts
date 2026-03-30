import { z } from "zod";

export const notificationsSchema = z.object({
  id: z.string().optional(),
});
