import { z } from "zod";

export const usersSchema = z.object({
  id: z.string().optional(),
});
