import { z } from "zod";

export const productSchema = z.object({
  code: z.string(), // optional — DB trigger auto-generates if empty
  name: z.string().min(1, "Nama produk wajib diisi"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  purchasePrice: z.coerce.number().min(0, "Harga beli tidak boleh negatif"),
  sellingPrice: z.coerce.number().min(0, "Harga jual tidak boleh negatif"),
  stock: z.coerce.number().int().min(0, "Stok tidak boleh negatif"),
  minStock: z.coerce.number().int().min(0, "Stok minimum tidak boleh negatif"),
  barcode: z.string().nullish(),
  unit: z.string().min(1, "Satuan wajib diisi"),
  isActive: z.boolean().default(true),
  description: z.string().nullish(),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi"),
  description: z.string().nullish(),
});

export const userSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter").optional(),
  role: z.string().min(1, "Role wajib dipilih"),
  isActive: z.boolean().default(true),
});

export const stockMovementSchema = z.object({
  productId: z.string().min(1, "Produk wajib dipilih"),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().int().min(1, "Quantity minimal 1"),
  note: z.string().nullish(),
});

export const brandSchema = z.object({
  name: z.string().min(1, "Nama brand wajib diisi"),
});

export const supplierSchema = z.object({
  name: z.string().min(1, "Nama supplier wajib diisi"),
  contact: z.string().nullish(),
  address: z.string().nullish(),
  email: z.string().email("Format email tidak valid").nullish().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const customerSchema = z.object({
  name: z.string().min(1, "Nama customer wajib diisi"),
  phone: z.string().nullish(),
  email: z.string().email("Format email tidak valid").nullish().or(z.literal("")),
  address: z.string().nullish(),
  memberLevel: z.enum(["REGULAR", "SILVER", "GOLD", "PLATINUM"]).default("REGULAR"),
  dateOfBirth: z.date().nullish(),
});

export const expenseSchema = z.object({
  category: z.string().min(1, "Kategori wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  amount: z.coerce.number().min(1, "Jumlah minimal 1"),
  date: z.coerce.date(),
});

export const shiftSchema = z.object({
  openingCash: z.coerce.number().min(0, "Kas awal tidak boleh negatif"),
});

export const closeShiftSchema = z.object({
  closingCash: z.coerce.number().min(0, "Kas akhir tidak boleh negatif"),
  notes: z.string().nullish(),
});

export const promotionSchema = z.object({
  name: z.string().min(1, "Nama promo wajib diisi"),
  type: z.enum(["DISCOUNT_PERCENT", "DISCOUNT_AMOUNT", "BUY_X_GET_Y", "VOUCHER"]),
  value: z.coerce.number().min(0, "Nilai tidak boleh negatif"),
  minPurchase: z.coerce.number().min(0).nullish(),
  categoryId: z.string().nullish(),
  productId: z.string().nullish(),
  voucherCode: z.string().nullish(),
  isActive: z.boolean().default(true),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export const branchSchema = z.object({
  name: z.string().min(1, "Nama cabang wajib diisi"),
  address: z.string().nullish(),
  phone: z.string().nullish(),
  isActive: z.boolean().default(true),
});

export const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1, "Produk wajib dipilih"),
  quantity: z.coerce.number().int().min(1, "Quantity minimal 1"),
  unitPrice: z.coerce.number().min(0, "Harga tidak boleh negatif"),
});

export type ProductFormValues = z.infer<typeof productSchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
export type UserFormValues = z.infer<typeof userSchema>;
export type StockMovementFormValues = z.infer<typeof stockMovementSchema>;
export type BrandFormValues = z.infer<typeof brandSchema>;
export type SupplierFormValues = z.infer<typeof supplierSchema>;
export type CustomerFormValues = z.infer<typeof customerSchema>;
export type ExpenseFormValues = z.infer<typeof expenseSchema>;
export type ShiftFormValues = z.infer<typeof shiftSchema>;
export type CloseShiftFormValues = z.infer<typeof closeShiftSchema>;
export type PromotionFormValues = z.infer<typeof promotionSchema>;
export type BranchFormValues = z.infer<typeof branchSchema>;
export type PurchaseOrderItemFormValues = z.infer<typeof purchaseOrderItemSchema>;
