"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productFullFormSchema, type ProductUnitFormValues, type BranchPriceFormValues, type TierPriceFormValues, type ProductFullFormValues } from "@/shared/schemas/product";
import { createProduct, updateProduct, getProductBranchPrices, generateProductCode, checkProductCodeExists, getProductTierPrices } from "@/features/products";
import { createCategory, getCategories } from "@/features/categories";
import { createBrand, getBrands } from "@/features/brands";
import { getProductUnits } from "@/features/product-units";
import { cn, formatCurrency } from "@/lib/utils";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { useDirtyFormGuard } from "@/hooks/useDirtyFormGuard";
import { FormInput, FormNumber, FormCurrency, FormTextarea, FormAsyncSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import type { Product, Category, Branch } from "@/types";
import {
    Tag, DollarSign, Layers, Building2, RefreshCw, Check,
    AlertCircle, Loader2, Plus, Trash2, ImagePlus, Box, ScanLine,
} from "lucide-react";
import { uploadProductImage, deleteProductImage } from "@/server/actions/upload";
import { toast } from "sonner";

interface ProductFormProps {
    product: Product | null;
    categories: Category[];
    brands: { id: string; name: string }[];
    branches: Branch[];
    onSuccess: () => void;
    onCancel: () => void;
}

export function ProductForm({ product, categories, brands, branches, onSuccess, onCancel }: ProductFormProps) {
    const isEditing = !!product;
    const [activeTab, setActiveTab] = useState("info");
    const [imageUrl, setImageUrl] = useState<string>(product?.imageUrl || "");
    const [imagePublicId, setImagePublicId] = useState<string>("");
    const [imageUploading, setImageUploading] = useState(false);

    // React Hook Form
    const form = useForm<ProductFullFormValues>({
        resolver: zodResolver(productFullFormSchema),
        defaultValues: {
            code: product?.code || "",
            name: product?.name || "",
            categoryId: product?.categoryId || "",
            brandId: product?.brandId || "",
            unit: product?.unit || "pcs",
            purchasePrice: product?.purchasePrice || 0,
            sellingPrice: product?.sellingPrice || 0,
            stock: product?.stock || 0,
            minStock: product?.minStock || 5,
            barcode: product?.barcode || "",
            description: product?.description || "",
            isActive: product?.isActive !== false,
            marginPercent: product ? (product.purchasePrice > 0 ? Math.round((product.sellingPrice - product.purchasePrice) / product.purchasePrice * 100) : 0) : 0,
            productUnits: [],
            branchPrices: [],
            tierPrices: [],
        },
    });

    const { control, setValue, handleSubmit: rhfHandleSubmit, formState: { isDirty, errors } } = form;
    const purchasePrice = useWatch({ control, name: "purchasePrice" });
    const sellingPrice = useWatch({ control, name: "sellingPrice" });
    const marginPercent = useWatch({ control, name: "marginPercent" }) || 0;
    const code = useWatch({ control, name: "code" });
    const baseUnitName = useWatch({ control, name: "unit" });

    // Dirty form guard
    useDirtyFormGuard(isDirty);

    // Code validation state
    const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
    const [codeGenLoading, setCodeGenLoading] = useState(false);

    // Branch prices & product units (managed separately)
    const [branchPrices, setBranchPrices] = useState<BranchPriceFormValues[]>([]);
    const [productUnits, setProductUnits] = useState<ProductUnitFormValues[]>([]);
    const [tierPrices, setTierPrices] = useState<TierPriceFormValues[]>([]);

    const applyProductUnits = useCallback((next: ProductUnitFormValues[], shouldDirty = true) => {
        setProductUnits(next);
        setValue("productUnits", next, { shouldDirty, shouldValidate: true });
    }, [setValue]);
    const applyBranchPrices = useCallback((next: BranchPriceFormValues[], shouldDirty = true) => {
        setBranchPrices(next);
        setValue("branchPrices", next, { shouldDirty, shouldValidate: true });
    }, [setValue]);
    const applyTierPrices = useCallback((next: TierPriceFormValues[], shouldDirty = true) => {
        setTierPrices(next);
        setValue("tierPrices", next, { shouldDirty, shouldValidate: true });
    }, [setValue]);

    // Auto-generate code for new product
    useEffect(() => {
        if (!isEditing && !code) {
            generateProductCode().then((c) => {
                setValue("code", c);
                setCodeStatus("available");
            });
        }
    }, [code, isEditing, setValue]);

    // Load branch prices + units for editing
    useEffect(() => {
        if (product) {
            getProductBranchPrices(product.id).then((bps) => {
                applyBranchPrices(bps.map((bp: { branchId: string; branch: { name: string }; sellingPrice: number; purchasePrice: number | null; stock?: number; minStock?: number }) => ({
                    branchId: bp.branchId,
                    branchName: bp.branch.name,
                    sellingPrice: bp.sellingPrice,
                    purchasePrice: bp.purchasePrice ?? product.purchasePrice,
                    stock: bp.stock ?? 0,
                    minStock: bp.minStock ?? 5,
                })), false);
            });
            getProductUnits(product.id).then((units) => {
                applyProductUnits(units.map((u) => ({
                    name: u.name,
                    conversionQty: u.conversionQty,
                    sellingPrice: u.sellingPrice,
                    purchasePrice: u.purchasePrice ?? 0,
                    barcode: u.barcode ?? "",
                })), false);
            });
            getProductTierPrices(product.id).then((tiers) => {
                applyTierPrices(tiers.map((tier: TierPriceFormValues) => ({
                    minQty: tier.minQty,
                    price: tier.price,
                })), false);
            });
        }
    }, [applyBranchPrices, applyProductUnits, applyTierPrices, product]);

    // ===========================
    // Code handlers
    // ===========================

    const handleGenerateCode = async () => {
        setCodeGenLoading(true);
        const c = await generateProductCode();
        setValue("code", c, { shouldDirty: true });
        setCodeStatus("available");
        setCodeGenLoading(false);
    };

    const handleCodeBlur = async () => {
        const val = form.getValues("code");
        if (!val?.trim()) { setCodeStatus("idle"); return; }
        setCodeStatus("checking");
        const exists = await checkProductCodeExists(val, product?.id);
        setCodeStatus(exists ? "taken" : "available");
    };

    // ===========================
    // Price/margin auto-calc
    // ===========================

    const handlePurchasePriceChange = (val: number) => {
        setValue("purchasePrice", val, { shouldDirty: true });
        if (val > 0 && marginPercent > 0) {
            setValue("sellingPrice", Math.round(val * (1 + marginPercent / 100)), { shouldDirty: true });
        }
    };

    const handleSellingPriceChange = (val: number) => {
        setValue("sellingPrice", val, { shouldDirty: true });
        if (purchasePrice > 0) {
            setValue("marginPercent", Math.round((val - purchasePrice) / purchasePrice * 100));
        }
    };

    const handleMarginChange = (val: number) => {
        setValue("marginPercent", val);
        if (purchasePrice > 0) {
            setValue("sellingPrice", Math.round(purchasePrice * (1 + val / 100)), { shouldDirty: true });
        }
    };

    // ===========================
    // Unit helpers
    // ===========================

    const updateUnit = (idx: number, field: keyof ProductUnitFormValues, value: string | number) => {
        const next = productUnits.map((unit, index) => index === idx ? { ...unit, [field]: value } : unit);
        applyProductUnits(next);
    };

    const addBranchPrice = (branchId: string) => {
        const branch = branches.find((b) => b.id === branchId);
        if (!branch || branchPrices.some((bp) => bp.branchId === branchId)) return;
        const stock = form.getValues("stock");
        const mStock = form.getValues("minStock");
        const next = [...branchPrices, { branchId, branchName: branch.name, sellingPrice: sellingPrice || 0, purchasePrice: purchasePrice || 0, stock: stock || 0, minStock: mStock || 5 }];
        applyBranchPrices(next);
    };

    const addAllBranches = () => {
        const stock = form.getValues("stock");
        const mStock = form.getValues("minStock");
        const newItems = branches
            .filter((b) => b.isActive && !branchPrices.some((bp) => bp.branchId === b.id))
            .map((b) => ({ branchId: b.id, branchName: b.name, sellingPrice: sellingPrice || 0, purchasePrice: purchasePrice || 0, stock: stock || 0, minStock: mStock || 5 }));
        if (newItems.length > 0) applyBranchPrices([...branchPrices, ...newItems]);
    };

    const updateBranchPrice = (branchId: string, field: "sellingPrice" | "purchasePrice" | "margin" | "stock" | "minStock", value: number) => {
        const next = branchPrices.map((bp) => {
            if (bp.branchId !== branchId) return bp;
            if (field === "purchasePrice") {
                const margin = bp.purchasePrice > 0 ? (bp.sellingPrice - bp.purchasePrice) / bp.purchasePrice * 100 : 0;
                return { ...bp, purchasePrice: value, sellingPrice: value > 0 ? Math.round(value * (1 + margin / 100)) : bp.sellingPrice };
            }
            if (field === "margin") return { ...bp, sellingPrice: bp.purchasePrice > 0 ? Math.round(bp.purchasePrice * (1 + value / 100)) : bp.sellingPrice };
            return { ...bp, [field]: value };
        });
        applyBranchPrices(next);
    };
    const addTierPrice = () => {
        applyTierPrices([...tierPrices, { minQty: 1, price: sellingPrice || 0 }]);
    };
    const updateTierPrice = (idx: number, field: "minQty" | "price", value: number) => {
        const next = tierPrices.map((tier, index) => index === idx ? { ...tier, [field]: value } : tier);
        applyTierPrices(next);
    };
    const removeTierPrice = (idx: number) => {
        applyTierPrices(tierPrices.filter((_, index) => index !== idx));
    };

    // ===========================
    // Image upload
    // ===========================

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageUploading(true);
        // Delete old image if replacing
        if (imagePublicId) {
            deleteProductImage(imagePublicId).catch(() => { });
        }
        const fd = new FormData();
        fd.set("file", file);
        const result = await uploadProductImage(fd);
        setImageUploading(false);
        if ("error" in result && result.error) {
            toast.error(result.error);
        } else if ("url" in result && result.url) {
            setImageUrl(result.url);
            setImagePublicId(result.publicId ?? "");
            toast.success("Gambar berhasil diupload");
        }
        e.target.value = "";
    };

    const handleImageRemove = () => {
        if (imagePublicId) {
            deleteProductImage(imagePublicId).catch(() => { });
            setImagePublicId("");
        }
        setImageUrl("");
    };

    // ===========================
    // Submit
    // ===========================

    const { handleSubmit: submitForm, isSubmitting } = useFormSubmit(
        async (values: ProductFullFormValues) => {
            const formData = new FormData();
            formData.set("code", values.code);
            formData.set("name", values.name);
            formData.set("categoryId", values.categoryId);
            formData.set("brandId", values.brandId || "");
            formData.set("unit", values.unit);
            formData.set("purchasePrice", String(values.purchasePrice));
            formData.set("sellingPrice", String(values.sellingPrice));
            formData.set("stock", String(values.stock));
            formData.set("minStock", String(values.minStock));
            formData.set("barcode", values.barcode || "");
            formData.set("description", values.description || "");
            formData.set("isActive", String(values.isActive));
            formData.set("imageUrl", imageUrl);
            formData.set("branchPrices", JSON.stringify(values.branchPrices));
            formData.set("productUnits", JSON.stringify(values.productUnits));
            formData.set("tierPrices", JSON.stringify(values.tierPrices));

            return isEditing ? await updateProduct(product!.id, formData) : await createProduct(formData);
        },
        {
            successMessage: isEditing ? "Produk berhasil diupdate" : "Produk berhasil ditambahkan",
            onSuccess,
        }
    );

    const onSubmit = rhfHandleSubmit(
        async (values) => {
            if (codeStatus === "taken") { setActiveTab("info"); toast.error("Kode produk sudah digunakan"); return; }
            await submitForm(values);
        },
        (formErrors) => {
            const hasInfoError = Boolean(formErrors.code || formErrors.name || formErrors.categoryId || formErrors.unit || formErrors.barcode || formErrors.description);
            if (hasInfoError) {
                setActiveTab("info");
                return;
            }
            const hasPricingError = Boolean(formErrors.purchasePrice || formErrors.sellingPrice || formErrors.stock || formErrors.minStock || formErrors.marginPercent);
            if (hasPricingError) {
                setActiveTab("pricing");
                return;
            }
            if (formErrors.productUnits) {
                setActiveTab("units");
                toast.error("Periksa kembali data satuan produk");
                return;
            }
            if (formErrors.branchPrices) {
                setActiveTab("branches");
                toast.error("Periksa kembali data harga cabang");
                return;
            }
            if (formErrors.tierPrices) {
                setActiveTab("pricing");
                toast.error("Periksa kembali data harga bertingkat");
                return;
            }
            setActiveTab("info");
        }
    );

    const profit = useMemo(() => sellingPrice - purchasePrice, [purchasePrice, sellingPrice]);
    const unitsTabHasError = Boolean(errors.productUnits);
    const branchesTabHasError = Boolean(errors.branchPrices);
    const pricingTabHasError = Boolean(errors.purchasePrice || errors.sellingPrice || errors.stock || errors.minStock || errors.marginPercent || errors.tierPrices);
    const infoTabHasError = Boolean(errors.code || errors.name || errors.categoryId || errors.unit || errors.barcode || errors.description);

    const getErrorText = (message: unknown) => typeof message === "string" ? message : null;

    // ===========================
    // Render
    // ===========================

    const branchBorderColors = ["border-l-blue-400", "border-l-indigo-400", "border-l-violet-400", "border-l-purple-400", "border-l-fuchsia-400", "border-l-pink-400", "border-l-rose-400", "border-l-amber-400", "border-l-emerald-400", "border-l-teal-400"];

    return (
        <form onSubmit={onSubmit} className="flex h-full min-h-0 flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                {/* Tab Navigation */}
                <div className="px-6 pt-1 pb-2 shrink-0">
                    <TabsList className="w-full grid grid-cols-4 rounded-xl bg-muted/50 p-1.5">
                        <TabsTrigger value="info" className={cn(
                            "relative rounded-xl h-full text-xs gap-1.5 font-medium transition-all",
                            "data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary"
                        )}>
                            <Tag className="w-3.5 h-3.5" /> Info
                            {infoTabHasError && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />}
                        </TabsTrigger>
                        <TabsTrigger value="pricing" className={cn(
                            "relative rounded-xl h-full text-xs gap-1.5 font-medium transition-all",
                            "data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary"
                        )}>
                            <DollarSign className="w-3.5 h-3.5" /> Harga
                            {pricingTabHasError && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />}
                        </TabsTrigger>
                        <TabsTrigger value="units" className={cn(
                            "relative rounded-xl h-full text-xs gap-1.5 font-medium transition-all",
                            "data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary"
                        )}>
                            <Layers className="w-3.5 h-3.5" /> Satuan
                            {productUnits.length > 0 && <Badge className="h-4 px-1.5 text-[10px] bg-primary/10 text-primary border-0">{productUnits.length}</Badge>}
                            {unitsTabHasError && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />}
                        </TabsTrigger>
                        <TabsTrigger value="branches" className={cn(
                            "relative rounded-xl h-full text-xs gap-1.5 font-medium transition-all",
                            "data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary"
                        )}>
                            <Building2 className="w-3.5 h-3.5" /> Cabang
                            {branchPrices.length > 0 && <Badge className="h-4 px-1.5 text-[10px] bg-primary/10 text-primary border-0">{branchPrices.length}</Badge>}
                            {branchesTabHasError && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />}
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ==================== INFO TAB ==================== */}
                <TabsContent value="info" className="mt-0 min-h-0 flex-1 overflow-y-auto space-y-5 px-6 py-4">
                    {/* Image upload - gradient bordered card */}
                    <div className="rounded-[11px] bg-white ">
                        <Label className="text-sm font-semibold mb-3 block text-foreground/80">Foto Produk</Label>
                        {imageUrl ? (
                            <div className="flex items-center gap-4">
                                <div className="relative group shrink-0">
                                    <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-border/30 bg-muted/10 shadow-sm">
                                        <Image src={imageUrl} alt="Product" fill className="object-cover" sizes="96px" />
                                    </div>
                                    <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                        <label className="cursor-pointer bg-white/90 rounded-lg p-1.5 hover:bg-white transition-colors shadow-sm">
                                            <ImagePlus className="w-3.5 h-3.5 text-foreground" />
                                            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" disabled={imageUploading} />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleImageRemove}
                                            className="bg-white/90 rounded-lg p-1.5 hover:bg-red-50 transition-colors shadow-sm"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    <p className="font-medium text-foreground text-sm mb-1">Foto berhasil diupload</p>
                                    <p>Hover untuk ganti atau hapus</p>
                                </div>
                            </div>
                        ) : (
                            <label className={cn(
                                "flex items-center gap-4 rounded-xl border-2 border-dashed p-4 cursor-pointer transition-all",
                                imageUploading
                                    ? "border-primary/30 bg-primary/5"
                                    : "border-border/40 hover:border-primary/40 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent"
                            )}>
                                <div className={cn(
                                    "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                                    imageUploading ? "bg-primary/10" : "bg-muted/30"
                                )}>
                                    {imageUploading ? (
                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    ) : (
                                        <ImagePlus className="w-6 h-6 text-muted-foreground/40" />
                                    )}
                                </div>
                                <div className="text-sm">
                                    {imageUploading ? (
                                        <p className="font-medium text-primary">Mengupload...</p>
                                    ) : (
                                        <>
                                            <p className="font-medium text-foreground">Klik untuk upload foto</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WebP - Maks 5MB</p>
                                        </>
                                    )}
                                </div>
                                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" disabled={imageUploading} />
                            </label>
                        )}
                    </div>

                    {/* Code with generate + validate */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Kode Produk <span className="text-red-400">*</span></Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <FormInput
                                    control={control}
                                    name="code"
                                    placeholder="PRD0001"
                                    autoFocus
                                    onBlur={handleCodeBlur}
                                    suffix={
                                        <>
                                            {codeStatus === "checking" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                                            {codeStatus === "available" && <Check className="w-3.5 h-3.5 text-green-500" />}
                                            {codeStatus === "taken" && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                                        </>
                                    }
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-full h-9 px-4 shrink-0 bg-gradient-to-r from-primary/5 to-indigo-500/5 border-primary/20 hover:from-primary/10 hover:to-indigo-500/10 text-primary hover:text-primary"
                                onClick={handleGenerateCode}
                                disabled={codeGenLoading}
                            >
                                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${codeGenLoading ? "animate-spin" : ""}`} /> Auto
                            </Button>
                        </div>
                        {codeStatus === "taken" && <p className="text-xs text-red-500">Kode sudah digunakan</p>}
                        {codeStatus === "available" && <p className="text-xs text-green-500">Kode tersedia</p>}
                    </div>

                    {/* Name - larger input */}
                    <FormInput control={control} name="name" label="Nama Produk" required placeholder="Nama produk" />

                    {/* Category + Brand in subtle card backgrounds */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-muted/20  space-y-0">
                            <FormAsyncSelect
                                control={control}
                                name="categoryId"
                                label="Kategori"
                                required
                                placeholder="Pilih Kategori"
                                initialOptions={categories.map((category) => ({ value: category.id, label: category.name }))}
                                createLabel="Tambah Kategori"
                                onCreateSubmit={async (fd) => {
                                    const r = await createCategory(fd);
                                    if (r.error) return { error: r.error };
                                    return { id: r.id ?? "", name: fd.get("name") as string };
                                }}
                                createFields={[
                                    { name: "name", label: "Nama Kategori", required: true },
                                    { name: "description", label: "Deskripsi" },
                                ]}
                                onSearch={async (q, page) => {
                                    const r = await getCategories({ search: q, page, perPage: 20 });
                                    return { items: r.categories.map((c) => ({ value: c.id, label: c.name })), hasMore: page < r.totalPages };
                                }}
                            />
                        </div>
                        <div className="rounded-xl bg-muted/20 space-y-0">
                            <FormAsyncSelect
                                control={control}
                                name="brandId"
                                label="Brand"
                                placeholder="Pilih Brand"
                                initialOptions={brands.map((brand) => ({ value: brand.id, label: brand.name }))}
                                createLabel="Tambah Brand"
                                onCreateSubmit={async (fd) => {
                                    const r = await createBrand(fd);
                                    if (r.error) return { error: r.error };
                                    return { id: r.id ?? "", name: fd.get("name") as string };
                                }}
                                createFields={[
                                    { name: "name", label: "Nama Brand", required: true },
                                ]}
                                onSearch={async (q, page) => {
                                    const r = await getBrands({ search: q, page, perPage: 20 });
                                    return { items: r.brands.map((b) => ({ value: b.id, label: b.name })), hasMore: page < r.totalPages };
                                }}
                            />
                        </div>
                    </div>

                    {/* Unit + Barcode */}
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput control={control} name="unit" label="Satuan" required placeholder="pcs, botol, kg" />
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                                <ScanLine className="w-3.5 h-3.5 text-muted-foreground" /> Barcode
                            </Label>
                            <FormInput control={control} name="barcode" placeholder="Scan atau ketik barcode" />
                        </div>
                    </div>

                    {/* Description */}
                    <FormTextarea control={control} name="description" label="Deskripsi" placeholder="Opsional" rows={2} />
                </TabsContent>

                {/* ==================== PRICING TAB ==================== */}
                <TabsContent value="pricing" className="mt-0 min-h-0 flex-1 overflow-y-auto space-y-5 px-6 py-4">
                    {/* Default price - gradient card */}
                    <div className="rounded-xl bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-violet-50/30 border border-blue-100/60 p-5 space-y-4">
                        <p className="text-xs font-semibold text-indigo-600/70 uppercase tracking-wider flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5" /> Harga Default (Semua Cabang)
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            <FormCurrency control={control} name="purchasePrice" label="Harga Beli" required onChange={handlePurchasePriceChange} />
                            <FormNumber control={control} name="marginPercent" label="Margin (%)" onChange={handleMarginChange} />
                            <FormCurrency control={control} name="sellingPrice" label="Harga Jual" required onChange={handleSellingPriceChange} />
                        </div>
                        {purchasePrice > 0 && sellingPrice > 0 && (
                            <div className="flex items-center gap-3 pt-1">
                                <span className="text-xs text-muted-foreground">Profit per item:</span>
                                <span className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                                    profit > 0
                                        ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200/60"
                                        : "bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200/60"
                                )}>
                                    {formatCurrency(profit)}
                                    <Badge className={cn(
                                        "text-[10px] border-0 ml-1",
                                        marginPercent > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                    )}>
                                        {marginPercent > 0 ? "+" : ""}{marginPercent}%
                                    </Badge>
                                </span>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Tier Prices */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Harga Bertingkat</p>
                                <p className="text-xs text-muted-foreground">Contoh: qty 1 harga 1000, qty 10 harga 800.</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" className="rounded-xl text-xs" onClick={addTierPrice}>
                                <Plus className="w-3 h-3 mr-1" /> Tambah Tier
                            </Button>
                        </div>
                        {tierPrices.length > 0 ? (
                            <div className="space-y-2">
                                {tierPrices.map((tier, idx) => {
                                    const tierError = (errors.tierPrices as Array<Record<string, { message?: string }> | undefined> | undefined)?.[idx];
                                    return (
                                        <div key={idx} className={cn(
                                            "relative group rounded-xl border p-3",
                                            tierError ? "border-red-300 bg-red-50/30" : "border-border/50"
                                        )}>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Qty Minimal *</Label>
                                                    <Input type="number" min={1} value={tier.minQty} onChange={(e) => updateTierPrice(idx, "minQty", Number(e.target.value))} className={cn("h-11 rounded-xl", tierError?.minQty ? "border-red-400" : "")} />
                                                    {getErrorText(tierError?.minQty?.message) && <p className="text-[11px] text-red-500">{getErrorText(tierError?.minQty?.message)}</p>}
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Harga Tier *</Label>
                                                    <Input type="number" min={1} value={tier.price} onChange={(e) => updateTierPrice(idx, "price", Number(e.target.value))} className={cn("h-11 rounded-xl", tierError?.price ? "border-red-400" : "")} />
                                                    {getErrorText(tierError?.price?.message) && <p className="text-[11px] text-red-500">{getErrorText(tierError?.price?.message)}</p>}
                                                </div>
                                            </div>
                                            <button type="button" onClick={() => removeTierPrice(idx)}
                                                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm hover:bg-red-600">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-xs text-muted-foreground">
                                Belum ada tier price. Sistem akan pakai harga jual default.
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Stock section with box icon */}
                    <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Box className="w-3.5 h-3.5" /> Stok
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <FormNumber control={control} name="stock" label={isEditing ? "Stok Saat Ini" : "Stok Awal"} required min={0} />
                            <FormNumber control={control} name="minStock" label="Stok Minimum" required min={0} helperText="Notifikasi jika di bawah angka ini" />
                        </div>
                    </div>
                </TabsContent>

                {/* ==================== UNITS TAB ==================== */}
                <TabsContent value="units" className="mt-0 min-h-0 flex-1 overflow-y-auto space-y-4 px-6 py-4">
                    <p className="text-sm text-muted-foreground">
                        Tambahkan satuan jual selain <strong>{baseUnitName || "pcs"}</strong>. Stok dihitung dalam satuan dasar.
                    </p>

                    <div className="bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl p-3.5 text-xs text-muted-foreground space-y-1 border border-border/30">
                        <p className="font-medium text-foreground/70">Contoh: Rokok</p>
                        <p>Satuan dasar: <strong>Batang</strong> &rarr; Bungkus = 16 Batang, Slop = 160 Batang</p>
                    </div>

                    <Button
                        type="button"
                        size="sm"
                        className="rounded-xl text-xs bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-white shadow-sm"
                        onClick={() => applyProductUnits([...productUnits, { name: "", conversionQty: 1, sellingPrice: 0, purchasePrice: 0, barcode: "" }])}
                    >
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Tambah Satuan
                    </Button>

                    {productUnits.map((unit, idx) => {
                        const unitError = (errors.productUnits as Array<Record<string, { message?: string }> | undefined> | undefined)?.[idx];
                        const uMargin = unit.purchasePrice > 0 ? Math.round((unit.sellingPrice - unit.purchasePrice) / unit.purchasePrice * 100) : 0;
                        const pricePerBase = unit.conversionQty > 0 ? Math.round(unit.sellingPrice / unit.conversionQty) : 0;
                        return (
                            <div key={idx} className={cn(
                                "relative border rounded-xl p-4 space-y-3 group transition-all",
                                unitError ? "border-red-300 bg-red-50/30" : "border-border/40 hover:border-border/60 hover:shadow-sm"
                            )}>
                                <button type="button" onClick={() => applyProductUnits(productUnits.filter((_, i) => i !== idx))}
                                    className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm hover:bg-red-600">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                                    <span className="text-xs font-semibold text-muted-foreground">Satuan</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Nama Satuan *</Label>
                                        <Input value={unit.name} onChange={(e) => updateUnit(idx, "name", e.target.value)} className={cn("h-11 rounded-xl", unitError?.name ? "border-red-400" : "")} placeholder="cth: Bungkus" />
                                        {getErrorText(unitError?.name?.message) && <p className="text-[11px] text-red-500">{getErrorText(unitError?.name?.message)}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Isi per Satuan *</Label>
                                        <div className="flex items-center gap-1.5">
                                            <Input type="number" value={unit.conversionQty} onChange={(e) => updateUnit(idx, "conversionQty", Number(e.target.value))} className={cn("h-11 rounded-xl flex-1", unitError?.conversionQty ? "border-red-400" : "")} min={1} />
                                            <span className="text-xs text-muted-foreground whitespace-nowrap px-2 py-1 bg-muted/30 rounded-lg">{baseUnitName || "pcs"}</span>
                                        </div>
                                        {getErrorText(unitError?.conversionQty?.message) && <p className="text-[11px] text-red-500">{getErrorText(unitError?.conversionQty?.message)}</p>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Harga Beli</Label>
                                        <Input type="number" value={unit.purchasePrice} onChange={(e) => updateUnit(idx, "purchasePrice", Number(e.target.value))} className={cn("h-11 rounded-xl", unitError?.purchasePrice ? "border-red-400" : "")} min={0} />
                                        {getErrorText(unitError?.purchasePrice?.message) && <p className="text-[11px] text-red-500">{getErrorText(unitError?.purchasePrice?.message)}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Harga Jual *</Label>
                                        <Input type="number" value={unit.sellingPrice} onChange={(e) => updateUnit(idx, "sellingPrice", Number(e.target.value))} className={cn("h-11 rounded-xl", unitError?.sellingPrice ? "border-red-400" : "")} min={0} />
                                        {getErrorText(unitError?.sellingPrice?.message) && <p className="text-[11px] text-red-500">{getErrorText(unitError?.sellingPrice?.message)}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Barcode</Label>
                                        <Input value={unit.barcode} onChange={(e) => updateUnit(idx, "barcode", e.target.value)} className={cn("h-11 rounded-xl", unitError?.barcode ? "border-red-400" : "")} />
                                        {getErrorText(unitError?.barcode?.message) && <p className="text-[11px] text-red-500">{getErrorText(unitError?.barcode?.message)}</p>}
                                    </div>
                                </div>
                                {unit.conversionQty > 0 && unit.sellingPrice > 0 && (
                                    <div className="flex items-center gap-3 text-xs flex-wrap pt-1 border-t border-border/20 mt-1">
                                        <span className="text-muted-foreground">1 {unit.name} = {unit.conversionQty} {baseUnitName || "pcs"}</span>
                                        <span className="text-muted-foreground">&middot; Per {baseUnitName || "pcs"}: <strong>{formatCurrency(pricePerBase)}</strong></span>
                                        {unit.purchasePrice > 0 && <Badge className={cn("text-[10px] border-0", uMargin > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{uMargin > 0 ? "+" : ""}{uMargin}%</Badge>}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {productUnits.length === 0 && (
                        <div className="text-center py-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-indigo-500/10 flex items-center justify-center mx-auto mb-3">
                                <Layers className="w-7 h-7 text-primary/40" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground/60">Dijual dalam satuan dasar</p>
                            <p className="text-xs text-muted-foreground/40 mt-0.5">({baseUnitName || "pcs"})</p>
                        </div>
                    )}
                </TabsContent>

                {/* ==================== BRANCHES TAB ==================== */}
                <TabsContent value="branches" className="mt-0 min-h-0 flex-1 overflow-y-auto space-y-4 px-6 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                            Set harga & stok per cabang. Cabang tidak terdaftar = <strong>produk tidak tersedia</strong>.
                        </p>
                        {branches.filter((b) => b.isActive && !branchPrices.some((bp) => bp.branchId === b.id)).length > 0 && (
                            <Button
                                type="button"
                                size="sm"
                                className="rounded-xl text-xs shrink-0 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-white shadow-sm"
                                onClick={addAllBranches}
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" /> Semua Cabang
                            </Button>
                        )}
                    </div>

                    {branches.filter((b) => b.isActive && !branchPrices.some((bp) => bp.branchId === b.id)).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {branches.filter((b) => b.isActive && !branchPrices.some((bp) => bp.branchId === b.id)).map((b) => (
                                <button key={b.id} type="button" onClick={() => addBranchPrice(b.id)}
                                    className="text-xs px-3.5 py-2 rounded-full border border-dashed border-border/60 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-1.5 group">
                                    <Building2 className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                    {b.name}
                                    <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    )}

                    {branchPrices.map((bp, idx) => {
                        const currentBranchError = (errors.branchPrices as Array<Record<string, { message?: string }> | undefined> | undefined)?.[idx];
                        const bMargin = bp.purchasePrice > 0 ? Math.round((bp.sellingPrice - bp.purchasePrice) / bp.purchasePrice * 100) : 0;
                        const bProfit = bp.sellingPrice - bp.purchasePrice;
                        const diff = bp.sellingPrice - sellingPrice;
                        const borderColor = branchBorderColors[idx % branchBorderColors.length];
                        return (
                            <div key={bp.branchId} className={cn(
                                "relative border rounded-xl p-4 space-y-3 group transition-all border-l-[3px]",
                                borderColor,
                                currentBranchError ? "border-t-red-300 border-r-red-300 border-b-red-300 bg-red-50/30" : "border-t-border/40 border-r-border/40 border-b-border/40 hover:shadow-sm"
                            )}>
                                <button type="button" onClick={() => applyBranchPrices(branchPrices.filter((x) => x.branchId !== bp.branchId))}
                                    className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm hover:bg-red-600 z-10">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-primary/60" />
                                    <span className="text-sm font-semibold">{bp.branchName}</span>
                                </div>
                                {getErrorText(currentBranchError?.branchId?.message) && <p className="text-[11px] text-red-500">{getErrorText(currentBranchError?.branchId?.message)}</p>}

                                {/* Price fields */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Harga Beli</Label>
                                        <Input type="number" value={bp.purchasePrice} onChange={(e) => updateBranchPrice(bp.branchId, "purchasePrice", Number(e.target.value))} className={cn("h-11 rounded-xl", currentBranchError?.purchasePrice ? "border-red-400" : "")} min={0} />
                                        {getErrorText(currentBranchError?.purchasePrice?.message) && <p className="text-[11px] text-red-500">{getErrorText(currentBranchError?.purchasePrice?.message)}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Margin (%)</Label>
                                        <Input type="number" value={bMargin} onChange={(e) => updateBranchPrice(bp.branchId, "margin", Number(e.target.value))} className="h-11 rounded-xl" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Harga Jual</Label>
                                        <Input type="number" value={bp.sellingPrice} onChange={(e) => updateBranchPrice(bp.branchId, "sellingPrice", Number(e.target.value))} className={cn("h-11 rounded-xl", currentBranchError?.sellingPrice ? "border-red-400" : "")} min={0} />
                                        {getErrorText(currentBranchError?.sellingPrice?.message) && <p className="text-[11px] text-red-500">{getErrorText(currentBranchError?.sellingPrice?.message)}</p>}
                                    </div>
                                </div>

                                {/* Stock fields in a styled sub-card */}
                                <div className="rounded-xl bg-muted/20 p-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Box className="w-3 h-3" /> Stok</Label>
                                            <Input type="number" value={bp.stock ?? 0} onChange={(e) => updateBranchPrice(bp.branchId, "stock", Number(e.target.value))} className="h-11 rounded-xl" min={0} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Stok Minimum</Label>
                                            <Input type="number" value={bp.minStock ?? 5} onChange={(e) => updateBranchPrice(bp.branchId, "minStock", Number(e.target.value))} className="h-11 rounded-xl" min={0} />
                                        </div>
                                    </div>
                                </div>

                                {/* Profit display */}
                                {bp.purchasePrice > 0 && bp.sellingPrice > 0 && (
                                    <div className="flex items-center gap-3 text-xs flex-wrap">
                                        <span className="text-muted-foreground">Profit:</span>
                                        <span className={cn(
                                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold",
                                            bProfit > 0
                                                ? "bg-green-50 text-green-700 border border-green-200/50"
                                                : "bg-red-50 text-red-700 border border-red-200/50"
                                        )}>
                                            {formatCurrency(bProfit)}
                                        </span>
                                        <Badge className={cn("text-[10px] border-0", bMargin > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{bMargin > 0 ? "+" : ""}{bMargin}%</Badge>
                                        {diff !== 0 && <span className={cn("text-[11px]", diff > 0 ? "text-blue-500" : "text-orange-500")}>({diff > 0 ? "+" : ""}{formatCurrency(diff)} vs default)</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {branchPrices.length === 0 && (
                        <div className="text-center py-10">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 via-indigo-500/10 to-violet-500/10 flex items-center justify-center mx-auto mb-3">
                                <Building2 className="w-8 h-8 text-primary/30" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground/60">Belum ada cabang ditambahkan</p>
                            <p className="text-xs text-muted-foreground/40 mt-1 max-w-[240px] mx-auto">Tambahkan cabang untuk mengatur stok & harga spesifik per lokasi</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="sticky bottom-0 z-20 shrink-0 border-t border-border/40 bg-white/95 backdrop-blur-sm px-6 py-4 shadow-[0_-6px_16px_-8px_rgba(15,23,42,0.15)]">
                <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                        {isDirty && (
                            <span className="inline-flex items-center gap-1.5 text-orange-500">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                                </span>
                                Ada perubahan belum disimpan
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">Batal</Button>
                        <Button
                            type="submit"
                            className="rounded-xl px-6 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 shadow-sm"
                            disabled={isSubmitting || codeStatus === "taken"}
                        >
                            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : isEditing ? "Update Produk" : "Simpan Produk"}
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
}
