import { z } from "zod";

export const posSessionSetupSchema = z.object({
  branchId: z.string().min(1, "Pilih lokasi terlebih dahulu"),
  register: z.string().trim().min(1, "Isi nama kassa terlebih dahulu"),
  openingCash: z.string().refine((value) => {
    const parsed = Number(value || 0);
    return !Number.isNaN(parsed) && parsed >= 0;
  }, "Saldo awal tidak valid"),
});
