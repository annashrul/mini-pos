import { z } from "zod";

export const auditLogsSchema = z.object({
  id: z.string().optional(),
});
