"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createPromotion, updatePromotion } from "@/features/promotions";
import { getCategories } from "@/features/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { SmartSelect, type SmartSelectOption } from "@/components/ui/smart-select";
import { ProductPicker, type ProductPickerItem } from "@/components/ui/product-picker";
import { Percent, Tag, Gift, Ticket, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Promotion } from "@/types";

interface Props {
    editing: Promotion | null;
    branchId?: string | undefined;
    onSuccess: () => void;
    onCancel: () => void;
}

const promoSchema = z.object({
    name: z.string().min(1, "Nama promo wajib diisi"),
    description: z.string().default(""),
    type: z.enum(["DISCOUNT_PERCENT", "DISCOUNT_AMOUNT", "BUY_X_GET_Y", "VOUCHER", "BUNDLE"]),
    scope: z.enum(["all", "product", "category"]),
    value: z.number().min(0, "Nilai tidak valid").default(0),
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
    // -- Diskon Persen --
    if (data.type === "DISCOUNT_PERCENT") {
        if (data.value <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Nilai diskon harus lebih dari 0" });
        if (data.value > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Diskon persen maksimal 100%" });
    }
    // -- Diskon Nominal --
    if (data.type === "DISCOUNT_AMOUNT") {
        if (data.value <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Nilai diskon harus lebih dari 0" });
    }
    // -- Voucher --
    if (data.type === "VOUCHER") {
        if (!data.voucherCode) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["voucherCode"], message: "Kode voucher wajib diisi" });
        if (data.value <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Nilai diskon voucher harus lebih dari 0" });
    }
    // -- Beli X Gratis Y --
    if (data.type === "BUY_X_GET_Y") {
        if (!data.buyQty || data.buyQty < 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["buyQty"], message: "Jumlah beli wajib diisi (min. 1)" });
        if (!data.getQty || data.getQty < 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["getQty"], message: "Jumlah gratis wajib diisi (min. 1)" });
    }
    // -- Tebus Murah (Bundle) --
    if (data.type === "BUNDLE") {
        if (!data.buyQty || data.buyQty < 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["buyQty"], message: "Syarat qty beli wajib diisi (min. 1)" });
        if (!data.getQty || data.getQty < 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["getQty"], message: "Qty tebus wajib diisi (min. 1)" });
        if (data.value <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Harga tebus harus lebih dari 0" });
        if (!data.getProductId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["getProductId"], message: "Produk tebus wajib dipilih" });
    }
    // -- Scope --
    if (data.scope === "product" && !data.productId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["productId"], message: "Pilih produk" });
    }
    if (data.scope === "category" && !data.categoryId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["categoryId"], message: "Pilih kategori" });
    }
    // -- Periode --
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

export function PromotionForm({ editing, branchId, onSuccess, onCancel }: Props) {
    const editExt = editing as Promotion & { scope?: string; description?: string; maxDiscount?: number; buyQty?: number; getQty?: number; getProductId?: string; usageLimit?: number };
    const categoryOptions: SmartSelectOption[] = useMemo(() => [], []);
    // Product picker states
    const [selectedProducts, setSelectedProducts] = useState<ProductPickerItem[]>(() =>
        editing?.productId ? [{ productId: editing.productId, productName: editing.product?.name ?? "", productCode: "", productPrice: 0, quantity: 1 }] : []
    );
    const [getProduct, setGetProduct] = useState<ProductPickerItem | null>(() =>
        editExt?.getProductId ? { productId: editExt.getProductId, productName: "", productCode: "", productPrice: 0, quantity: 1 } : null
    );
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(editing?.categoryId ? [editing.categoryId] : []);
    const searchCategoriesApi = useCallback(async (query: string, page: number) => {
        const payload = {
            page,
            perPage: 20,
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
    // Register helper for optional number fields — NaN becomes undefined
    const registerOptNum = (name: keyof PromoFormInput) => register(name, { setValueAs: (v: string) => { const n = Number(v); return v === "" || Number.isNaN(n) ? undefined : n; } });
    const registerNum = (name: keyof PromoFormInput) => register(name, { setValueAs: (v: string) => { const n = Number(v); return Number.isNaN(n) ? 0 : n; } });
    const type = watch("type");
    const scope = watch("scope");
    useEffect(() => {
        const nextCategories = editing?.categoryId ? [editing.categoryId] : [];
        setSelectedCategoryIds(nextCategories);
        setValue("productId", editing?.productId || "");
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
        // Send branchId from active location filter
        const targetBranchId = editing?.branchId ?? branchId;
        if (targetBranchId) fd.set("branchId", targetBranchId);
        if (values.scope === "product" && selectedProducts.length > 0) {
            fd.set("productIds", JSON.stringify(selectedProducts.map((p) => p.productId)));
            fd.set("productId", selectedProducts[0]?.productId || "");
        }
        if (values.scope === "category" && selectedCategoryIds.length > 0) {
            fd.set("categoryIds", JSON.stringify(selectedCategoryIds));
            fd.set("categoryId", selectedCategoryIds[0] || "");
        }

        const result = editing ? await updatePromotion(editing.id, fd) : await createPromotion(fd);
        if (result.error) { toast.error(result.error); return; }
        const targetsCount = values.scope === "product"
            ? Math.max(1, selectedProducts.length)
            : values.scope === "category"
                ? Math.max(1, selectedCategoryIds.length)
                : 1;
        toast.success(targetsCount > 1 ? `Promo berhasil disimpan untuk ${targetsCount} target` : editing ? "Promo berhasil diupdate" : "Promo berhasil ditambahkan");
        onSuccess();
    };

    const fieldError = (field: keyof PromoFormInput) => errors[field]?.message;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
            <DialogBody className="space-y-3 sm:space-y-5 px-4 sm:px-6">
                {/* Nama */}
                <div className="space-y-2 sm:space-y-3 ">
                    <div className="space-y-1 sm:space-y-1.5">
                        <Label className="text-xs sm:text-sm font-semibold text-slate-700">Nama Promo <span className="text-red-400">*</span></Label>
                        <Input {...register("name")} className={`rounded-xl ${fieldError("name") ? "border-red-400" : "border-slate-200"}`} autoFocus placeholder="cth: Diskon Weekend 20%" />
                        {fieldError("name") && <p className="text-xs text-red-500">{fieldError("name")}</p>}
                    </div>
                    <div className="space-y-1 sm:space-y-1.5">
                        <Label className="text-xs sm:text-sm font-semibold text-slate-700">Deskripsi</Label>
                        <Input {...register("description")} className="rounded-xl border-slate-200" placeholder="Opsional" />
                    </div>
                </div>

                {/* Tipe */}
                <div className="space-y-2 sm:space-y-3 ">
                    <Label className="text-xs sm:text-sm font-semibold text-slate-700">Tipe Promo <span className="text-red-400">*</span></Label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
                        {typeOptions.map(({ key, label, icon: Icon }) => (
                            <label key={key} className={`flex flex-col items-center gap-1 p-2 sm:p-3 rounded-lg sm:rounded-xl border cursor-pointer transition-all
                                ${type === key ? "border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm" : "border-border/50 hover:border-slate-300"}`}>
                                <input type="radio" value={key} {...register("type")} className="sr-only" />
                                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${type === key ? "text-blue-600" : "text-muted-foreground"}`} />
                                <span className={`text-[10px] sm:text-xs font-medium text-center leading-tight ${type === key ? "text-blue-700" : "text-slate-600"}`}>{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Scope */}
                <div className="space-y-2 sm:space-y-3 ">
                    <Label className="text-xs sm:text-sm font-semibold text-slate-700">Berlaku Untuk <span className="text-red-400">*</span></Label>
                    <div className="flex gap-1.5 sm:gap-2">
                        {scopeOptions.map(({ key, label }) => (
                            <button key={key} type="button" onClick={() => setValue("scope", key, { shouldValidate: true })}
                                className={`flex-1 text-[10px] sm:text-xs py-1.5 sm:py-2 rounded-lg border font-medium transition-all
                                    ${scope === key ? "border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700" : "border-border/50 text-muted-foreground hover:border-slate-300"}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {scope === "product" && (
                    <ProductPicker
                        items={selectedProducts}
                        onChange={(items) => {
                            setSelectedProducts(items);
                            setValue("productId", items[0]?.productId || "", { shouldValidate: true });
                        }}
                        branchId={branchId}
                        label="Pilih Produk"
                        required
                        showQuantity={false}
                        showSubtotal={false}
                        showPrice={false}
                        error={fieldError("productId")}
                    />
                )}

                {scope === "category" && (
                    <div className="space-y-1.5 ">
                        <Label className="text-xs sm:text-sm font-semibold text-slate-700">Pilih Kategori <span className="text-red-400">*</span></Label>
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
                        {fieldError("categoryId") && <p className="text-xs sm:text-sm text-red-500">{fieldError("categoryId")}</p>}
                    </div>
                )}

                <Separator />

                {/* Type-specific fields */}
                {(type === "DISCOUNT_PERCENT" || type === "DISCOUNT_AMOUNT") && (
                    <div className="grid grid-cols-2 gap-3 ">
                        <div className="space-y-1.5">
                            <Label className="text-xs sm:text-sm font-semibold text-slate-700">{type === "DISCOUNT_PERCENT" ? "Diskon (%)" : "Diskon (Rp)"} <span className="text-red-400">*</span></Label>
                            <Input type="number" {...registerNum("value")} className={`rounded-xl h-10 ${fieldError("value") ? "border-red-400" : "border-slate-200"}`} min={0} />
                            {fieldError("value") && <p className="text-xs sm:text-sm text-red-500">{fieldError("value")}</p>}
                        </div>
                        {type === "DISCOUNT_PERCENT" && (
                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm font-semibold text-slate-700">Maks. Diskon (Rp)</Label>
                                <Input type="number" {...registerOptNum("maxDiscount")} className="rounded-xl h-10 border-slate-200" min={0} placeholder="Tanpa batas" />
                            </div>
                        )}
                    </div>
                )}

                {type === "BUY_X_GET_Y" && (
                    <div className="space-y-3 ">
                        <div className="bg-emerald-50 rounded-xl p-3 text-xs sm:text-sm text-emerald-700">
                            <p className="font-medium text-foreground mb-1">Beli X Gratis Y</p>
                            <p>Pelanggan beli sejumlah produk dan mendapat produk gratis</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm font-semibold text-slate-700">Beli (qty) <span className="text-red-400">*</span></Label>
                                <Input type="number" {...registerOptNum("buyQty")} className={`rounded-xl h-10 ${fieldError("buyQty") ? "border-red-400" : "border-slate-200"}`} min={1} />
                                {fieldError("buyQty") && <p className="text-xs text-red-500">{fieldError("buyQty")}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm font-semibold text-slate-700">Gratis (qty) <span className="text-red-400">*</span></Label>
                                <Input type="number" {...registerOptNum("getQty")} className={`rounded-xl h-10 ${fieldError("getQty") ? "border-red-400" : "border-slate-200"}`} min={1} />
                                {fieldError("getQty") && <p className="text-xs text-red-500">{fieldError("getQty")}</p>}
                            </div>
                        </div>
                        <ProductPicker
                            items={getProduct ? [getProduct] : []}
                            onChange={(items) => {
                                const item = items[0] ?? null;
                                setGetProduct(item);
                                setValue("getProductId", item?.productId || "", { shouldValidate: true });
                            }}
                            branchId={branchId}
                            single
                            label="Produk Gratis"
                            showQuantity={false}
                            showSubtotal={false}
                            emptyText="Kosongkan jika sama dengan produk yang dibeli"
                        />
                    </div>
                )}

                {type === "BUNDLE" && (
                    <div className="space-y-3 ">
                        <div className="bg-pink-50 rounded-xl p-3 text-xs sm:text-sm text-pink-700">
                            <p className="font-medium text-foreground mb-1">Promo Tebus Murah</p>
                            <p>Setelah syarat tercapai, pelanggan dapat menebus produk tertentu dengan harga khusus.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm font-semibold text-slate-700">Syarat Qty (Beli) <span className="text-red-400">*</span></Label>
                                <Input type="number" {...registerOptNum("buyQty")} className={`rounded-xl h-10 ${fieldError("buyQty") ? "border-red-400" : "border-slate-200"}`} min={1} />
                                {fieldError("buyQty") && <p className="text-xs text-red-500">{fieldError("buyQty")}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm font-semibold text-slate-700">Qty Tebus <span className="text-red-400">*</span></Label>
                                <Input type="number" {...registerOptNum("getQty")} className={`rounded-xl h-10 ${fieldError("getQty") ? "border-red-400" : "border-slate-200"}`} min={1} />
                                {fieldError("getQty") && <p className="text-xs text-red-500">{fieldError("getQty")}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm font-semibold text-slate-700">Harga Tebus (Rp) <span className="text-red-400">*</span></Label>
                                <Input type="number" {...registerNum("value")} className={`rounded-xl h-10 ${fieldError("value") ? "border-red-400" : "border-slate-200"}`} min={0} />
                                {fieldError("value") && <p className="text-xs text-red-500">{fieldError("value")}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs sm:text-sm font-semibold text-slate-700">Maks Qty Tebus / Transaksi</Label>
                                <Input type="number" {...registerOptNum("maxDiscount")} className="rounded-xl h-10 border-slate-200" min={1} placeholder="Sesuai kelipatan" />
                            </div>
                        </div>
                        <ProductPicker
                            items={getProduct ? [getProduct] : []}
                            onChange={(items) => {
                                const item = items[0] ?? null;
                                setGetProduct(item);
                                setValue("getProductId", item?.productId || "", { shouldValidate: true });
                            }}
                            branchId={branchId}
                            single
                            label="Produk Tebus"
                            required
                            showQuantity={false}
                            showSubtotal={false}
                            error={fieldError("getProductId")}
                        />
                    </div>
                )}

                {type === "VOUCHER" && (
                    <div className="grid grid-cols-2 gap-3 ">
                        <div className="space-y-1.5">
                            <Label className="text-xs sm:text-sm font-semibold text-slate-700">Kode Voucher <span className="text-red-400">*</span></Label>
                            <Input {...register("voucherCode")} className={`rounded-xl h-10 font-mono ${fieldError("voucherCode") ? "border-red-400" : "border-slate-200"}`} placeholder="HEMAT20" />
                            {fieldError("voucherCode") && <p className="text-xs sm:text-sm text-red-500">{fieldError("voucherCode")}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs sm:text-sm font-semibold text-slate-700">Nilai Diskon (Rp) <span className="text-red-400">*</span></Label>
                            <Input type="number" {...registerNum("value")} className={`rounded-xl h-10 ${fieldError("value") ? "border-red-400" : "border-slate-200"}`} min={0} />
                            {fieldError("value") && <p className="text-xs sm:text-sm text-red-500">{fieldError("value")}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs sm:text-sm font-semibold text-slate-700">Batas Penggunaan</Label>
                            <Input type="number" {...registerOptNum("usageLimit")} className="rounded-xl h-10 border-slate-200" min={1} placeholder="Tanpa batas" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs sm:text-sm font-semibold text-slate-700">Min. Pembelian (Rp)</Label>
                            <Input type="number" {...registerOptNum("minPurchase")} className="rounded-xl h-10 border-slate-200" min={0} placeholder="Tanpa minimum" />
                        </div>
                    </div>
                )}

                {/* Min purchase - only for discount types */}
                {(type === "DISCOUNT_PERCENT" || type === "DISCOUNT_AMOUNT") && (
                    <div className="space-y-1.5 ">
                        <Label className="text-xs sm:text-sm font-semibold text-slate-700">Min. Pembelian (Rp)</Label>
                        <Input type="number" {...registerOptNum("minPurchase")} className="rounded-xl h-10 border-slate-200" min={0} placeholder="Tanpa minimum" />
                    </div>
                )}

                {/* Period */}
                <div className="grid grid-cols-2 gap-3 ">
                    <div className="space-y-1.5">
                        <Label className="text-xs sm:text-sm font-semibold text-slate-700">Mulai <span className="text-red-400">*</span></Label>
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
                        {fieldError("startDate") && <p className="text-xs sm:text-sm text-red-500">{fieldError("startDate")}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs sm:text-sm font-semibold text-slate-700">Berakhir <span className="text-red-400">*</span></Label>
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
                        {fieldError("endDate") && <p className="text-xs sm:text-sm text-red-500">{fieldError("endDate")}</p>}
                    </div>
                </div>
                {/* Global validation errors for hidden fields */}
                {Object.keys(errors).length > 0 && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600 space-y-0.5">
                        {Object.entries(errors).map(([key, err]) => (
                            <p key={key}>• {err?.message || `Field ${key} tidak valid`}</p>
                        ))}
                    </div>
                )}
            </DialogBody>

            <DialogFooter className="border-t border-border/40 pt-4 px-4 sm:px-6 pb-4 sm:pb-6 shrink-0">
                <Button type="button" variant="outline" onClick={onCancel} className="rounded-full px-5">Batal</Button>
                <Button type="submit" className="rounded-full px-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Menyimpan...</> : editing ? "Update" : "Simpan"}
                </Button>
            </DialogFooter>
        </form>
    );
}
