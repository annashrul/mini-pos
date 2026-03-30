import { z } from "zod";

export const userFormSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter").optional(),
  role: z.string().min(1, "Role wajib dipilih"),
  isActive: z.boolean(),
  profile: z.object({
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
});

export type UserFormValues = z.infer<typeof userFormSchema>;
