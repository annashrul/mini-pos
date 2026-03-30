"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTransaction } from "@/features/transactions";
import { getCustomers } from "@/features/customers";
import { getProducts } from "@/features/products";
import { transactionFormSchema, type TransactionFormValues } from "@/shared/schemas/transaction";
import { useDirtyFormGuard, useFormSubmit } from "@/hooks";
import { FormAsyncSelect, FormCurrency, FormInput, FormNumber, FormRadio, FormTextarea } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";

interface TransactionFormProps {
    onSuccess?: (invoiceNumber: string) => void;
}

const paymentMethodOptions = [
    { value: "CASH", label: "Tunai", description: "Pembayaran cash di kasir" },
    { value: "TRANSFER", label: "Transfer", description: "Transfer bank" },
    { value: "QRIS", label: "QRIS", description: "Pembayaran QR" },
    { value: "EWALLET", label: "E-Wallet", description: "OVO, GoPay, DANA" },
    { value: "DEBIT", label: "Debit", description: "Kartu debit" },
    { value: "CREDIT_CARD", label: "Kartu Kredit", description: "Kartu kredit" },
] as const;

export function TransactionForm({ onSuccess }: TransactionFormProps) {
    const [step, setStep] = useState(1);
    const [productCatalog, setProductCatalog] = useState<Product[]>([]);
    const [sectionCollapsed, setSectionCollapsed] = useState<{ customer: boolean; summary: boolean }>({
        customer: false,
        summary: false,
    });

    const form = useForm<TransactionFormValues>({
        resolver: zodResolver(transactionFormSchema),
        mode: "onChange",
        defaultValues: {
            customer: { id: "", name: "", phone: "" },
            paymentMethod: "CASH",
            paymentAmount: 0,
            notes: "",
            items: [{ productId: "", quantity: 1, unitPrice: 0, discount: 0 }],
        },
    });

    const {
        control,
        setValue,
        handleSubmit,
        formState: { isDirty, isValid },
    } = form;
    useDirtyFormGuard(isDirty);

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const items = useWatch({ control, name: "items" });
    const paymentMethod = useWatch({ control, name: "paymentMethod" });
    const paymentAmount = useWatch({ control, name: "paymentAmount" });

    const subtotal = useMemo(
        () => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        [items]
    );
    const discountAmount = useMemo(
        () => items.reduce((sum, item) => sum + item.discount, 0),
        [items]
    );
    const grandTotal = Math.max(subtotal - discountAmount, 0);
    const changeAmount = Math.max(paymentAmount - grandTotal, 0);

    const loadProductOptions = async (query: string) => {
        const result = await getProducts({ page: 1, limit: 50, search: query });
        setProductCatalog(result.products);
        return result.products.map((product) => ({
            value: product.id,
            label: product.name,
            description: `${product.code} • ${formatCurrency(product.sellingPrice)} • stok ${product.stock}`,
        }));
    };

    const loadCustomerOptions = async (query: string) => {
        const result = await getCustomers({ search: query, page: 1, perPage: 20 });
        return result.customers.map((customer) => ({
            value: customer.id,
            label: customer.name,
            description: customer.phone ?? "-",
        }));
    };

    const { handleSubmit: submitForm, isSubmitting } = useFormSubmit(
        async (values: TransactionFormValues) => {
            const payload = {
                items: values.items.map((item) => {
                    const product = productCatalog.find((entry) => entry.id === item.productId);
                    return {
                        productId: item.productId,
                        productName: product?.name ?? "Produk",
                        productCode: product?.code ?? "",
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discount,
                        subtotal: item.quantity * item.unitPrice - item.discount,
                    };
                }),
                subtotal,
                discountAmount,
                taxAmount: 0,
                grandTotal,
                paymentMethod: values.paymentMethod,
                paymentAmount: values.paymentAmount,
                changeAmount,
                ...(values.customer.id ? { customerId: values.customer.id } : {}),
                ...(values.notes ? { notes: values.notes } : {}),
            };
            return createTransaction(payload);
        },
        {
            successMessage: "Transaksi berhasil disimpan",
            onSuccess: (result) => {
                if ("invoiceNumber" in result && typeof result.invoiceNumber === "string") {
                    onSuccess?.(result.invoiceNumber);
                }
            },
            debounceMs: 400,
        }
    );

    const canMoveNext = step === 1
        ? Boolean(items[0]?.productId)
        : step === 2
            ? items.length > 0
            : true;

    useEffect(() => {
        if (paymentMethod === "CASH" && paymentAmount < grandTotal) {
            setValue("paymentAmount", grandTotal);
        }
    }, [grandTotal, paymentAmount, paymentMethod, setValue]);

    return (
        <form onSubmit={handleSubmit((values) => submitForm(values))} className="space-y-4">
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/40 p-1">
                {[1, 2, 3].map((index) => (
                    <button
                        key={index}
                        type="button"
                        onClick={() => setStep(index)}
                        className={cn(
                            "rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                            step === index ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40"
                        )}
                    >
                        {index === 1 && "Item"}
                        {index === 2 && "Customer"}
                        {index === 3 && "Pembayaran"}
                    </button>
                ))}
            </div>

            {step === 1 && (
                <div className="space-y-3">
                    {fields.map((field, index) => (
                        <div key={field.id} className="rounded-xl border border-border/40 p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <Badge variant="outline" className="rounded-md text-[10px]">Item {index + 1}</Badge>
                                {fields.length > 1 && (
                                    <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => remove(index)}>
                                        Hapus
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-3">
                                <FormAsyncSelect
                                    control={control}
                                    name={`items.${index}.productId`}
                                    label="Produk"
                                    required
                                    placeholder="Cari produk"
                                    onSearch={loadProductOptions}
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    <FormNumber control={control} name={`items.${index}.quantity`} label="Qty" required min={1} />
                                    <FormCurrency control={control} name={`items.${index}.unitPrice`} label="Harga" required />
                                    <FormCurrency control={control} name={`items.${index}.discount`} label="Diskon" />
                                </div>
                            </div>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-lg"
                        onClick={() => append({ productId: "", quantity: 1, unitPrice: 0, discount: 0 })}
                    >
                        Tambah Item
                    </Button>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-3">
                    <button
                        type="button"
                        className="w-full rounded-lg border border-border/40 px-3 py-2 text-left text-sm font-semibold"
                        onClick={() => setSectionCollapsed((prev) => ({ ...prev, customer: !prev.customer }))}
                    >
                        Data Customer
                    </button>
                    {!sectionCollapsed.customer && (
                        <div className="space-y-3 rounded-xl border border-border/40 p-3">
                            <FormAsyncSelect control={control} name="customer.id" label="Pilih Customer" placeholder="Cari customer" onSearch={loadCustomerOptions} />
                            <FormInput control={control} name="customer.name" label="Nama Customer" />
                            <FormInput control={control} name="customer.phone" label="No. Telepon" />
                            <FormTextarea control={control} name="notes" label="Catatan Transaksi" rows={2} />
                        </div>
                    )}
                </div>
            )}

            {step === 3 && (
                <div className="space-y-3">
                    <FormRadio control={control} name="paymentMethod" label="Metode Pembayaran" required options={paymentMethodOptions.map((item) => ({ value: item.value, label: item.label, description: item.description }))} />
                    <FormCurrency control={control} name="paymentAmount" label="Nominal Bayar" required />
                    <button
                        type="button"
                        className="w-full rounded-lg border border-border/40 px-3 py-2 text-left text-sm font-semibold"
                        onClick={() => setSectionCollapsed((prev) => ({ ...prev, summary: !prev.summary }))}
                    >
                        Ringkasan Transaksi
                    </button>
                    {!sectionCollapsed.summary && (
                        <div className="rounded-xl border border-border/40 p-3 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span>{formatCurrency(discountAmount)}</span></div>
                            <div className="mt-2 flex justify-between border-t border-border/40 pt-2 font-semibold"><span>Total</span><span>{formatCurrency(grandTotal)}</span></div>
                            {paymentMethod === "CASH" && (
                                <div className="mt-2 flex justify-between"><span className="text-muted-foreground">Kembalian</span><span>{formatCurrency(changeAmount)}</span></div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between border-t border-border/40 pt-3">
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => setStep((prev) => Math.max(1, prev - 1))} disabled={step === 1}>
                    Kembali
                </Button>
                {step < 3 ? (
                    <Button type="button" className="rounded-lg px-6" disabled={!canMoveNext} onClick={() => setStep((prev) => Math.min(3, prev + 1))}>
                        Lanjut
                    </Button>
                ) : (
                    <Button type="submit" className="rounded-lg px-6" disabled={!isValid || isSubmitting}>
                        {isSubmitting ? "Menyimpan..." : "Simpan Transaksi"}
                    </Button>
                )}
            </div>
        </form>
    );
}
