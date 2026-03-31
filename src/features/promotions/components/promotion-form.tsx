"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createPromotion, updatePromotion } from "@/features/promotions";
import { getProducts } from "@/features/products";
import { getCategories } from "@/features/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { SmartSelect, type SmartSelectOption } from "@/components/ui/smart-select";
import { Percent, Tag, Gift, Ticket, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Promotion } from "@/types";

interface Props {
    editing: Promotion | null;
    onSuccess: () => void;
    onCancel: () => void;
}

const promoSchema = z.object({
    name: z.string().min(1, "Nama promo wajib diisi"),
    description: z.string().default(""),
    type: z.enum(["DISCOUNT_PERCENT", "DISCOUNT_AMOUNT", "BUY_X_GET_Y", "VOUCHER", "BUNDLE"]),
    scope: z.enum(["all", "product", "category"]),
    value: z.number().min(0, "Nilai tidak valid"),
    minPurchase: z.number().min(0).optional(),
    maxDiscount: z.number().min(0).optional(),
    productId: z.string().default(""),
    categoryId: z.string().default(""),
    buyQty: z.number().int().min(1).optional(),
    getQty: z.number().int().min(1).optional(),
    getProductId: z.string().default(""),
    voucherCode: z.string().default(""),
    usageLimit: z.number().int().min(1).optional(),
    startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
    endDate: z.string().min(1, "Tanggal berakhir wajib diisi"),
    isActive: z.boolean().default(true),
}).superRefine((data, ctx) => {
    if ((data.type === "DISCOUNT_PERCENT" || data.type === "DISCOUNT_AMOUNT") && data.value <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Nilai diskon harus lebih dari 0" });
    }
    if (data.type === "DISCOUNT_PERCENT" && data.value > 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Diskon persen maksimal 100%" });
    }
    if (data.scope === "product" && !data.productId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["productId"], message: "Pilih produk" });
    }
    if (data.scope === "category" && !data.categoryId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["categoryId"], message: "Pilih kategori" });
    }
    if (data.type === "VOUCHER" && !data.voucherCode) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["voucherCode"], message: "Kode voucher wajib diisi" });
    }
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "Tanggal berakhir harus setelah tanggal mulai" });
    }
});

type PromoFormInput = z.input<typeof promoSchema>;
type PromoFormOutput = z.output<typeof promoSchema>;

const typeOptions = [
    { key: "DISCOUNT_PERCENT", label: "Diskon %", icon: Percent },
    { key: "DISCOUNT_AMOUNT", label: "Diskon Rp", icon: Tag },
    { key: "BUY_X_GET_Y", label: "Beli X Gratis Y", icon: Gift },
    { key: "VOUCHER", label: "Voucher", icon: Ticket },
    { key: "BUNDLE", label: "Tebus Murah", icon: Package },
] as const;

const scopeOptions = [
    { key: "all", label: "Semua Produk" },
    { key: "product", label: "Produk Tertentu" },
    { key: "category", label: "Kategori Tertentu" },
] as const;

export function PromotionForm({ editing, onSuccess, onCancel }: Props) {
    const editExt = editing as Promotion & { scope?: string; description?: string; maxDiscount?: number; buyQty?: number; getQty?: number; getProductId?: string; usageLimit?: number };
    const productOptions: SmartSelectOption[] = useMemo(() => [], []);
    const categoryOptions: SmartSelectOption[] = useMemo(() => [], []);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>(editing?.productId ? [editing.productId] : []);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(editing?.categoryId ? [editing.categoryId] : []);
    const smartSelectPageSize = 20;
    const searchProductsApi = useCallback(async (query: string, page: number) => {
        const payload = {
            page,
            limit: smartSelectPageSize,
            sortBy: "name",
            sortDir: "asc" as const,
            ...(query.trim().length > 0 ? { search: query } : {}),
        };
        const result = await getProducts({
            ...payload,
        });
        return {
            items: result.products.map((item) => ({
                value: item.id,
                label: `${item.code} - ${item.name}`,
            })),
            hasMore: page < result.totalPages,
        };
    }, []);
    const searchCategoriesApi = useCallback(async (query: string, page: number) => {
        const payload = {
            page,
            perPage: smartSelectPageSize,
            ...(query.trim().length > 0 ? { search: query } : {}),
        };
        const result = await getCategories({
            ...payload,
        });
        return {
            items: result.categories.map((item) => ({
                value: item.id,
                label: item.name,
            })),
            hasMore: page < result.totalPages,
        };
    }, []);

    const form = useForm<PromoFormInput, unknown, PromoFormOutput>({
        resolver: zodResolver(promoSchema),
        defaultValues: {
            name: editing?.name ?? "",
            description: editExt?.description ?? "",
            type: (editing?.type as PromoFormInput["type"]) ?? "DISCOUNT_PERCENT",
            scope: (editExt?.scope as PromoFormInput["scope"]) ?? "all",
            value: editing?.value ?? 0,
            minPurchase: editing?.minPurchase ?? undefined,
            maxDiscount: editExt?.maxDiscount ?? undefined,
            productId: editing?.productId ?? "",
            categoryId: editing?.categoryId ?? "",
            buyQty: editExt?.buyQty ?? 1,
            getQty: editExt?.getQty ?? 1,
            getProductId: editExt?.getProductId ?? "",
            voucherCode: editing?.voucherCode ?? "",
            usageLimit: editExt?.usageLimit ?? undefined,
            startDate: editing ? format(new Date(editing.startDate), "yyyy-MM-dd") : "",
            endDate: editing ? format(new Date(editing.endDate), "yyyy-MM-dd") : "",
            isActive: editing?.isActive !== false,
        },
    });

    const { control, register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = form;
    const type = watch("type");
    const scope = watch("scope");
    useEffect(() => {
        const nextProducts = editing?.productId ? [editing.productId] : [];
        const nextCategories = editing?.categoryId ? [editing.categoryId] : [];
        setSelectedProductIds(nextProducts);
        setSelectedCategoryIds(nextCategories);
        setValue("productId", nextProducts[0] || "");
        setValue("categoryId", nextCategories[0] || "");
    }, [editing, setValue]);

    const onSubmit = async (values: PromoFormOutput) => {
        const fd = new FormData();
        fd.set("name", values.name);
        fd.set("description", values.description || "");
        fd.set("type", values.type);
        fd.set("scope", values.scope);
        fd.set("value", String(values.value));
        if (values.minPurchase) fd.set("minPurchase", String(values.minPurchase));
        if (values.maxDiscount) fd.set("maxDiscount", String(values.maxDiscount));
        if (values.scope === "product") fd.set("productId", values.productId);
        if (values.scope === "category") fd.set("categoryId", values.categoryId);
        if (values.type === "BUY_X_GET_Y" || values.type === "BUNDLE") {
            fd.set("buyQty", String(values.buyQty ?? 1));
            fd.set("getQty", String(values.getQty ?? 1));
            if (values.getProductId) fd.set("getProductId", values.getProductId);
        }
        if (values.type === "VOUCHER") {
            fd.set("voucherCode", values.voucherCode);
            if (values.usageLimit) fd.set("usageLimit", String(values.usageLimit));
        }
        fd.set("startDate", values.startDate);
        fd.set("endDate", values.endDate);
        fd.set("isActive", String(values.isActive));
        if (values.scope === "product" && selectedProductIds.length > 0) {
            fd.set("productIds", JSON.stringify(selectedProductIds));
            fd.set("productId", selectedProductIds[0] || "");
        }
        if (values.scope === "category" && selectedCategoryIds.length > 0) {
            fd.set("categoryIds", JSON.stringify(selectedCategoryIds));
            fd.set("categoryId", selectedCategoryIds[0] || "");
        }

        const result = editing ? await updatePromotion(editing.id, fd) : await createPromotion(fd);
        if (result.error) { toast.error(result.error); return; }
        const targetsCount = values.scope === "product"
            ? Math.max(1, selectedProductIds.length)
            : values.scope === "category"
                ? Math.max(1, selectedCategoryIds.length)
                : 1;
        toast.success(targetsCount > 1 ? `Promo berhasil disimpan untuk ${targetsCount} target` : editing ? "Promo berhasil diupdate" : "Promo berhasil ditambahkan");
        onSuccess();
    };

    const fieldError = (field: keyof PromoFormInput) => errors[field]?.message;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
            <DialogBody className="space-y-4">
                {/* Nama */}
                <div className="space-y-1.5">
                    <Label className="text-sm">Nama Promo <span className="text-red-400">*</span></Label>
                    <Input {...register("name")} className={`rounded-lg ${fieldError("name") ? "border-red-400" : ""}`} autoFocus placeholder="cth: Diskon Weekend 20%" />
                    {fieldError("name") && <p className="text-xs text-red-500">{fieldError("name")}</p>}
                </div>

                <div className="space-y-1.5">
                    <Label className="text-sm">Deskripsi</Label>
                    <Input {...register("description")} className="rounded-lg" placeholder="Opsional" />
                </div>

                {/* Tipe */}
                <div className="space-y-2">
                    <Label className="text-sm">Tipe Promo <span className="text-red-400">*</span></Label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {typeOptions.map(({ key, label, icon: Icon }) => (
                            <label key={key} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border cursor-pointer transition-all
                                ${type === key ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                                <input type="radio" value={key} {...register("type")} className="sr-only" />
                                <Icon className={`w-5 h-5 ${type === key ? "text-primary" : "text-muted-foreground"}`} />
                                <span className="text-xs font-medium text-center">{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <Separator />

                {/* Scope */}
                <div className="space-y-2">
                    <Label className="text-sm">Berlaku Untuk</Label>
                    <div className="flex gap-2">
                        {scopeOptions.map(({ key, label }) => (
                            <button key={key} type="button" onClick={() => setValue("scope", key, { shouldValidate: true })}
                                className={`flex-1 text-xs py-2 rounded-lg border font-medium transition-all
                                    ${scope === key ? "border-primary bg-primary/5 text-primary" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {scope === "product" && (
                    <div className="space-y-1.5">
                        <Label className="text-sm">Pilih Produk <span className="text-red-400">*</span></Label>
                        <Controller
                            control={control}
                            name="productId"
                            render={() => (
                                <SmartSelect
                                    multiple
                                    values={selectedProductIds}
                                    onValuesChange={(next) => {
                                        setSelectedProductIds(next);
                                        setValue("productId", next[0] || "", { shouldValidate: true });
                                    }}
                                    initialOptions={productOptions}
                                    placeholder="Pilih produk"
                                    onSearch={searchProductsApi}
                                />
                            )}
                        />
                        {fieldError("productId") && <p className="text-xs text-red-500">{fieldError("productId")}</p>}
                    </div>
                )}

                {scope === "category" && (
                    <div className="space-y-1.5">
                        <Label className="text-sm">Pilih Kategori <span className="text-red-400">*</span></Label>
                        <Controller
                            control={control}
                            name="categoryId"
                            render={() => (
                                <SmartSelect
                                    multiple
                                    values={selectedCategoryIds}
                                    onValuesChange={(next) => {
                                        setSelectedCategoryIds(next);
                                        setValue("categoryId", next[0] || "", { shouldValidate: true });
                                    }}
                                    initialOptions={categoryOptions}
                                    placeholder="Pilih kategori"
                                    onSearch={searchCategoriesApi}
                                />
                            )}
                        />
                        {fieldError("categoryId") && <p className="text-xs text-red-500">{fieldError("categoryId")}</p>}
                    </div>
                )}

                <Separator />

                {/* Type-specific fields */}
                {(type === "DISCOUNT_PERCENT" || type === "DISCOUNT_AMOUNT") && (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-sm">{type === "DISCOUNT_PERCENT" ? "Diskon (%)" : "Diskon (Rp)"} <span className="text-red-400">*</span></Label>
                            <Input type="number" {...register("value", { valueAsNumber: true })} className={`rounded-lg ${fieldError("value") ? "border-red-400" : ""}`} min={0} />
                            {fieldError("value") && <p className="text-xs text-red-500">{fieldError("value")}</p>}
                        </div>
                        {type === "DISCOUNT_PERCENT" && (
                            <div className="space-y-1.5">
                                <Label className="text-sm">Maks. Diskon (Rp)</Label>
                                <Input type="number" {...register("maxDiscount", { valueAsNumber: true })} className="rounded-lg" min={0} placeholder="Tanpa batas" />
                            </div>
                        )}
                    </div>
                )}

                {type === "BUY_X_GET_Y" && (
                    <div className="space-y-3">
                        <div className="bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">Beli X Gratis Y</p>
                            <p>Pelanggan beli sejumlah produk dan mendapat produk gratis</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-sm">Beli (qty) <span className="text-red-400">*</span></Label>
                                <Input type="number" {...register("buyQty", { valueAsNumber: true })} className="rounded-lg" min={1} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm">Gratis (qty) <span className="text-red-400">*</span></Label>
                                <Input type="number" {...register("getQty", { valueAsNumber: true })} className="rounded-lg" min={1} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Produk Gratis</Label>
                            <Controller
                                control={control}
                                name="getProductId"
                                render={({ field }) => (
                                    <SmartSelect
                                        value={field.value}
                                        onChange={field.onChange}
                                        initialOptions={productOptions}
                                        placeholder="Sama dengan produk yang dibeli"
                                        onSearch={searchProductsApi}
                                    />
                                )}
                            />
                            <p className="text-[11px] text-muted-foreground">Kosongkan jika produk gratis sama dengan produk yang dibeli</p>
                        </div>
                    </div>
                )}

                {type === "BUNDLE" && (
                    <div className="space-y-3">
                        <div className="bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">Promo Tebus Murah</p>
                            <p>Setelah syarat tercapai, pelanggan dapat menebus produk tertentu dengan harga khusus.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-sm">Syarat Qty (Beli) <span className="text-red-400">*</span></Label>
                                <Input type="number" {...register("buyQty", { valueAsNumber: true })} className="rounded-lg" min={1} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm">Qty Tebus <span className="text-red-400">*</span></Label>
                                <Input type="number" {...register("getQty", { valueAsNumber: true })} className="rounded-lg" min={1} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm">Harga Tebus (Rp) <span className="text-red-400">*</span></Label>
                                <Input type="number" {...register("value", { valueAsNumber: true })} className={`rounded-lg ${fieldError("value") ? "border-red-400" : ""}`} min={0} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm">Maks Qty Tebus / Transaksi</Label>
                                <Input type="number" {...register("maxDiscount", { valueAsNumber: true })} className="rounded-lg" min={1} placeholder="Sesuai kelipatan" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Produk Tebus <span className="text-red-400">*</span></Label>
                            <Controller
                                control={control}
                                name="getProductId"
                                render={({ field }) => (
                                    <SmartSelect
                                        value={field.value}
                                        onChange={field.onChange}
                                        initialOptions={productOptions}
                                        placeholder="Pilih produk tebus"
                                        onSearch={searchProductsApi}
                                    />
                                )}
                            />
                        </div>
                    </div>
                )}

                {type === "VOUCHER" && (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-sm">Kode Voucher <span className="text-red-400">*</span></Label>
                            <Input {...register("voucherCode")} className={`rounded-lg font-mono ${fieldError("voucherCode") ? "border-red-400" : ""}`} placeholder="HEMAT20" />
                            {fieldError("voucherCode") && <p className="text-xs text-red-500">{fieldError("voucherCode")}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Nilai Diskon (Rp) <span className="text-red-400">*</span></Label>
                            <Input type="number" {...register("value", { valueAsNumber: true })} className={`rounded-lg ${fieldError("value") ? "border-red-400" : ""}`} min={0} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Batas Penggunaan</Label>
                            <Input type="number" {...register("usageLimit", { valueAsNumber: true })} className="rounded-lg" min={1} placeholder="Tanpa batas" />
                        </div>
                    </div>
                )}

                {/* Min purchase */}
                <div className="space-y-1.5">
                    <Label className="text-sm">Min. Pembelian (Rp)</Label>
                    <Input type="number" {...register("minPurchase", { valueAsNumber: true })} className="rounded-lg" min={0} placeholder="Tanpa minimum" />
                </div>

                {/* Period */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-sm">Mulai <span className="text-red-400">*</span></Label>
                        <Controller
                            control={control}
                            name="startDate"
                            render={({ field }) => (
                                <DatePicker
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="Pilih tanggal mulai"
                                    className={fieldError("startDate") ? "border-red-400" : ""}
                                />
                            )}
                        />
                        {fieldError("startDate") && <p className="text-xs text-red-500">{fieldError("startDate")}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-sm">Berakhir <span className="text-red-400">*</span></Label>
                        <Controller
                            control={control}
                            name="endDate"
                            render={({ field }) => (
                                <DatePicker
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="Pilih tanggal berakhir"
                                    className={fieldError("endDate") ? "border-red-400" : ""}
                                />
                            )}
                        />
                        {fieldError("endDate") && <p className="text-xs text-red-500">{fieldError("endDate")}</p>}
                    </div>
                </div>
            </DialogBody>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel} className="rounded-lg">Batal</Button>
                <Button type="submit" className="rounded-lg" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</> : editing ? "Update" : "Simpan"}
                </Button>
            </DialogFooter>
        </form>
    );
}
