import { z } from "zod";

export const productFormSchema = z.object({
  code: z.string(), // optional — DB trigger auto-generates if empty
  name: z.string().min(1, "Nama produk wajib diisi"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  brandId: z.string(),
  supplierId: z.string(),
  unit: z.string().min(1, "Satuan wajib diisi"),
  purchasePrice: z.number().min(1, "Harga beli wajib diisi"),
  sellingPrice: z.number().min(1, "Harga jual wajib diisi"),
  stock: z.number().int().min(0, "Stok tidak boleh negatif"),
  minStock: z.number().int().min(0, "Stok minimum tidak boleh negatif"),
  barcode: z.string(),
  description: z.string(),
  isActive: z.boolean(),
  marginPercent: z.number().optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const productUnitSchema = z.object({
  name: z.string().trim().min(1, "Nama satuan wajib diisi"),
  conversionQty: z.number().int().min(1, "Isi per satuan minimal 1"),
  sellingPrice: z.number().min(1, "Harga jual satuan wajib diisi"),
  purchasePrice: z.number().min(0, "Harga beli satuan tidak valid"),
  barcode: z.string(),
});

export const branchPriceSchema = z.object({
  branchId: z.string().min(1, "Cabang wajib dipilih"),
  branchName: z.string().min(1),
  sellingPrice: z.number().min(1, "Harga jual cabang wajib diisi"),
  purchasePrice: z.number().min(0, "Harga beli cabang tidak valid"),
  stock: z.number().int().min(0),
  minStock: z.number().int().min(0),
});

export const tierPriceSchema = z.object({
  minQty: z.number().int().min(1, "Minimal qty harus lebih dari 0"),
  price: z.number().min(1, "Harga tier wajib diisi"),
});

export const productFullFormSchema = productFormSchema
  .extend({
    productUnits: z.array(productUnitSchema),
    branchPrices: z.array(branchPriceSchema),
    tierPrices: z.array(tierPriceSchema),
  })
  .superRefine((data, ctx) => {
    if (data.sellingPrice < data.purchasePrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sellingPrice"],
        message: "Harga jual tidak boleh lebih kecil dari harga beli",
      });
    }

    const unitNameSet = new Set<string>();
    const unitBarcodeSet = new Set<string>();
    data.productUnits.forEach((unit, index) => {
      const normalizedName = unit.name.trim().toLowerCase();
      if (unitNameSet.has(normalizedName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["productUnits", index, "name"],
          message: "Nama satuan tidak boleh duplikat",
        });
      } else {
        unitNameSet.add(normalizedName);
      }

      const normalizedBarcode = unit.barcode.trim().toLowerCase();
      if (!normalizedBarcode) return;
      if (unitBarcodeSet.has(normalizedBarcode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["productUnits", index, "barcode"],
          message: "Barcode satuan tidak boleh duplikat",
        });
      } else {
        unitBarcodeSet.add(normalizedBarcode);
      }
    });

    const branchSet = new Set<string>();
    data.branchPrices.forEach((branchPrice, index) => {
      if (branchSet.has(branchPrice.branchId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["branchPrices", index, "branchId"],
          message: "Cabang tidak boleh duplikat",
        });
      } else {
        branchSet.add(branchPrice.branchId);
      }

      if (branchPrice.sellingPrice < branchPrice.purchasePrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["branchPrices", index, "sellingPrice"],
          message: "Harga jual cabang tidak boleh lebih kecil dari harga beli",
        });
      }
    });

    const tierSet = new Set<number>();
    data.tierPrices.forEach((tier, index) => {
      if (tierSet.has(tier.minQty)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tierPrices", index, "minQty"],
          message: "Qty minimal tier tidak boleh duplikat",
        });
      } else {
        tierSet.add(tier.minQty);
      }
    });
  });

export type ProductUnitFormValues = z.infer<typeof productUnitSchema>;
export type BranchPriceFormValues = z.infer<typeof branchPriceSchema>;
export type TierPriceFormValues = z.infer<typeof tierPriceSchema>;
export type ProductFullFormValues = z.infer<typeof productFullFormSchema>;
