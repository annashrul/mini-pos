"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatCurrency } from "@/lib/utils";
import {
    searchTransactionForReturn,
    createReturn,
    searchProductsForExchange,
} from "@/features/returns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Search,
    Loader2,
    RotateCcw,
    ArrowLeftRight,
    ArrowRight,
    ArrowLeft,
    Package,
    Receipt,
    User,
    Minus,
    Plus,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";

type TransactionData = Awaited<ReturnType<typeof searchTransactionForReturn>>;
type TransactionResult = NonNullable<TransactionData["data"]>;
type TransactionItem = TransactionResult["items"][number];

interface SelectedItem {
    productId: string;
    productName: string;
    quantity: number;
    maxQty: number;
    unitPrice: number;
    reason: string;
    exchangeProductId: string | undefined;
    exchangeProductName: string | undefined;
    exchangeQuantity: number | undefined;
    exchangeUnitPrice: number | undefined;
}

type ExchangeProduct = {
    id: string;
    name: string;
    code: string;
    sellingPrice: number;
    stock: number;
    availableStock: number;
    unit: string;
};

const returnFormSchema = z.object({
    invoiceNumber: z.string().min(1, "Nomor invoice wajib diisi"),
    type: z.enum(["RETURN", "EXCHANGE"]),
    reason: z.string().min(1, "Alasan return wajib diisi"),
    refundMethod: z.string().optional(),
    notes: z.string().optional(),
});

type ReturnFormValues = z.infer<typeof returnFormSchema>;

interface NewReturnDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    branchId?: string;
}

export function NewReturnDialog({
    open,
    onOpenChange,
    onSuccess,
    branchId,
}: NewReturnDialogProps) {
    const [step, setStep] = useState(1);
    const [transaction, setTransaction] = useState<TransactionResult | null>(null);
    const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
    const [exchangeSearch, setExchangeSearch] = useState("");
    const [exchangeProducts, setExchangeProducts] = useState<ExchangeProduct[]>([]);
    const [exchangeTargetProductId, setExchangeTargetProductId] = useState<string>("");
    const [searching, startSearch] = useTransition();
    const [submitting, startSubmit] = useTransition();
    const [searchingExchange, startExchangeSearch] = useTransition();

    const form = useForm<ReturnFormValues>({
        resolver: zodResolver(returnFormSchema),
        defaultValues: {
            invoiceNumber: "",
            type: "RETURN",
            reason: "",
            refundMethod: "CASH",
            notes: "",
        },
    });

    const returnType = form.watch("type");

    const reset = () => {
        setStep(1);
        form.reset();
        setTransaction(null);
        setSelectedItems(new Map());
        setExchangeSearch("");
        setExchangeProducts([]);
        setExchangeTargetProductId("");
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) reset();
        onOpenChange(open);
    };

    const handleSearchInvoice = () => {
        const invoice = form.getValues("invoiceNumber").trim();
        if (!invoice) {
            form.setError("invoiceNumber", { message: "Nomor invoice wajib diisi" });
            toast.error("Masukkan nomor invoice");
            return;
        }
        form.clearErrors("invoiceNumber");
        startSearch(async () => {
            const result = await searchTransactionForReturn(invoice);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            if (result.data) {
                setTransaction(result.data);
                setStep(2);
            }
        });
    };

    const toggleItem = (item: TransactionItem) => {
        const next = new Map(selectedItems);
        if (next.has(item.productId)) {
            next.delete(item.productId);
        } else {
            if (item.availableQty <= 0) {
                toast.error(`${item.productName} sudah di-return sepenuhnya`);
                return;
            }
            next.set(item.productId, {
                productId: item.productId,
                productName: item.productName,
                quantity: 1,
                maxQty: item.availableQty,
                unitPrice: item.unitPrice,
                reason: "",
                exchangeProductId: undefined,
                exchangeProductName: undefined,
                exchangeQuantity: undefined,
                exchangeUnitPrice: undefined,
            });
        }
        setSelectedItems(next);
    };

    const updateItemQty = (productId: string, delta: number) => {
        const next = new Map(selectedItems);
        const item = next.get(productId);
        if (!item) return;
        const newQty = Math.max(1, Math.min(item.maxQty, item.quantity + delta));
        next.set(productId, { ...item, quantity: newQty });
        setSelectedItems(next);
    };

    const updateItemReason = (productId: string, reason: string) => {
        const next = new Map(selectedItems);
        const item = next.get(productId);
        if (!item) return;
        next.set(productId, { ...item, reason });
        setSelectedItems(next);
    };

    const handleSearchExchangeProduct = (query: string) => {
        setExchangeSearch(query);
        if (query.length < 2) {
            setExchangeProducts([]);
            return;
        }
        startExchangeSearch(async () => {
            const result = await searchProductsForExchange(query, branchId || undefined);
            setExchangeProducts(result.products as ExchangeProduct[]);
        });
    };

    const assignExchangeProduct = (productId: string, product: ExchangeProduct) => {
        const next = new Map(selectedItems);
        const item = next.get(productId);
        if (!item) return;
        next.set(productId, {
            ...item,
            exchangeProductId: product.id,
            exchangeProductName: product.name,
            exchangeQuantity: item.quantity,
            exchangeUnitPrice: product.sellingPrice,
        });
        setSelectedItems(next);
        setExchangeSearch("");
        setExchangeProducts([]);
        setExchangeTargetProductId("");
    };

    const removeExchangeProduct = (productId: string) => {
        const next = new Map(selectedItems);
        const item = next.get(productId);
        if (!item) return;
        next.set(productId, {
            ...item,
            exchangeProductId: undefined,
            exchangeProductName: undefined,
            exchangeQuantity: undefined,
            exchangeUnitPrice: undefined,
        });
        setSelectedItems(next);
    };

    const totalRefund = Array.from(selectedItems.values()).reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
    );

    const canProceedToStep3 = selectedItems.size > 0;

    const reason = form.watch("reason");
    const canProceedToStep4 = (reason ?? "").trim().length > 0;

    const handleGoToStep4 = async () => {
        const valid = await form.trigger(["reason", "type"]);
        if (!valid) {
            toast.error("Alasan return wajib diisi");
            return;
        }
        setStep(4);
    };

    const handleSubmit = () => {
        if (!transaction) return;
        if (selectedItems.size === 0) {
            toast.error("Pilih minimal satu item");
            return;
        }

        const values = form.getValues();
        if (!values.reason.trim()) {
            toast.error("Alasan return wajib diisi");
            return;
        }

        startSubmit(async () => {
            const result = await createReturn({
                transactionId: transaction.id,
                type: values.type,
                reason: values.reason.trim(),
                notes: values.notes?.trim() || undefined,
                refundMethod: values.type === "RETURN" ? values.refundMethod : undefined,
                branchId: branchId || transaction.branch?.id || undefined,
                items: Array.from(selectedItems.values()).map((item) => ({
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    reason: item.reason || undefined,
                    exchangeProductId: item.exchangeProductId || undefined,
                    exchangeQuantity: item.exchangeQuantity || undefined,
                })),
            });

            if (result.error) {
                toast.error(result.error);
                return;
            }

            reset();
            onSuccess();
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[720px] p-0 rounded-2xl overflow-hidden gap-0 flex flex-col max-h-[90vh]">
                <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 shrink-0 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                            <RotateCcw className="h-4 w-4" />
                        </div>
                        Return & Exchange Baru
                    </DialogTitle>
                    <DialogDescription asChild>
                        {/* Step Indicator */}
                        <div className="flex items-center gap-2 pt-2">
                            {[
                                { num: 1, label: "Cari Invoice" },
                                { num: 2, label: "Pilih Item" },
                                { num: 3, label: "Detail" },
                                { num: 4, label: "Konfirmasi" },
                            ].map((s, i) => (
                                <div key={s.num} className="flex items-center gap-2 flex-1">
                                    <div
                                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                                            step >= s.num
                                                ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm"
                                                : "bg-gray-100 text-gray-400"
                                        }`}
                                    >
                                        {step > s.num ? (
                                            <CheckCircle2 className="h-4 w-4" />
                                        ) : (
                                            s.num
                                        )}
                                    </div>
                                    <span
                                        className={`text-xs font-medium hidden sm:inline ${
                                            step >= s.num ? "text-gray-900" : "text-gray-400"
                                        }`}
                                    >
                                        {s.label}
                                    </span>
                                    {i < 3 && (
                                        <div
                                            className={`flex-1 h-0.5 rounded ${
                                                step > s.num ? "bg-violet-400" : "bg-gray-200"
                                            }`}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-4">
                    {/* Step 1: Search Invoice */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-violet-50/50 rounded-xl border border-violet-100">
                                <Receipt className="h-5 w-5 text-violet-600 shrink-0" />
                                <p className="text-sm text-violet-700">
                                    Masukkan nomor invoice dari transaksi yang ingin di-return
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Controller
                                    control={form.control}
                                    name="invoiceNumber"
                                    render={({ field, fieldState }) => (
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <Input
                                                placeholder="Contoh: INV-260404-0001"
                                                {...field}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleSearchInvoice();
                                                }}
                                                className={`pl-9 rounded-xl ${fieldState.error ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                                            />
                                            {fieldState.error && (
                                                <p className="text-xs text-red-500 mt-1">{fieldState.error.message}</p>
                                            )}
                                        </div>
                                    )}
                                />
                                <Button
                                    onClick={handleSearchInvoice}
                                    disabled={searching}
                                    className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
                                >
                                    {searching ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        "Cari"
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Select Items */}
                    {step === 2 && transaction && (
                        <div className="space-y-4">
                            {/* Transaction Info */}
                            <div className="p-4 bg-gray-50 rounded-xl border border-border/30 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Receipt className="h-4 w-4 text-gray-500" />
                                        <span className="font-mono text-sm font-semibold text-gray-900">
                                            {transaction.invoiceNumber}
                                        </span>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-900">
                                        {formatCurrency(transaction.grandTotal)}
                                    </span>
                                </div>
                                {transaction.customer && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <User className="h-3.5 w-3.5" />
                                        {transaction.customer.name}
                                    </div>
                                )}
                            </div>

                            {/* Items List */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">
                                    Pilih item yang akan di-return:
                                </Label>
                                {transaction.items.map((item) => {
                                    const selected = selectedItems.has(item.productId);
                                    const sel = selectedItems.get(item.productId);
                                    const disabled = item.availableQty <= 0;

                                    return (
                                        <div
                                            key={item.id}
                                            className={`p-3 rounded-xl border transition-all ${
                                                selected
                                                    ? "border-violet-300 bg-violet-50/30 shadow-sm"
                                                    : disabled
                                                        ? "border-border/30 bg-gray-50 opacity-60"
                                                        : "border-border/30 hover:border-gray-300"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <Checkbox
                                                    checked={selected}
                                                    disabled={disabled}
                                                    onCheckedChange={() => toggleItem(item)}
                                                    className="mt-0.5"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                                {item.productName}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {item.productCode} &middot;{" "}
                                                                {formatCurrency(item.unitPrice)}/pcs
                                                            </p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-xs text-gray-500">
                                                                Dibeli: {item.quantity}
                                                            </p>
                                                            {item.returnedQty > 0 && (
                                                                <p className="text-xs text-amber-600">
                                                                    Sudah return: {item.returnedQty}
                                                                </p>
                                                            )}
                                                            <p className="text-xs font-medium text-gray-700">
                                                                Tersedia: {item.availableQty}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Quantity & Reason when selected */}
                                                    {selected && sel && (
                                                        <div className="mt-3 space-y-2">
                                                            <div className="flex items-center gap-3">
                                                                <Label className="text-xs text-gray-500 shrink-0">
                                                                    Qty:
                                                                </Label>
                                                                <div className="flex items-center gap-1">
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 rounded-lg"
                                                                        onClick={() =>
                                                                            updateItemQty(
                                                                                item.productId,
                                                                                -1
                                                                            )
                                                                        }
                                                                    >
                                                                        <Minus className="h-3 w-3" />
                                                                    </Button>
                                                                    <span className="w-8 text-center text-sm font-semibold">
                                                                        {sel.quantity}
                                                                    </span>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 rounded-lg"
                                                                        onClick={() =>
                                                                            updateItemQty(
                                                                                item.productId,
                                                                                1
                                                                            )
                                                                        }
                                                                    >
                                                                        <Plus className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                                <span className="text-xs text-gray-400">
                                                                    / {sel.maxQty}
                                                                </span>
                                                                <span className="ml-auto text-sm font-semibold text-gray-900">
                                                                    {formatCurrency(
                                                                        sel.unitPrice * sel.quantity
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <Input
                                                                placeholder="Alasan return item ini (opsional)"
                                                                value={sel.reason}
                                                                onChange={(e) =>
                                                                    updateItemReason(
                                                                        item.productId,
                                                                        e.target.value
                                                                    )
                                                                }
                                                                className="h-8 text-xs rounded-lg"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedItems.size > 0 && (
                                <div className="flex items-center justify-between p-3 bg-violet-50 rounded-xl border border-violet-100">
                                    <span className="text-sm font-medium text-violet-700">
                                        Total Refund ({selectedItems.size} item)
                                    </span>
                                    <span className="text-lg font-bold text-violet-900">
                                        {formatCurrency(totalRefund)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Detail (Type, Reason, Exchange Products) */}
                    {step === 3 && (
                        <div className="space-y-5">
                            {/* Return Type */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700">
                                    Tipe Pengembalian
                                </Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => form.setValue("type", "RETURN")}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                                            returnType === "RETURN"
                                                ? "border-violet-400 bg-violet-50 shadow-sm"
                                                : "border-border/30 hover:border-gray-300"
                                        }`}
                                    >
                                        <RotateCcw
                                            className={`h-5 w-5 mb-2 ${
                                                returnType === "RETURN"
                                                    ? "text-violet-600"
                                                    : "text-gray-400"
                                            }`}
                                        />
                                        <p className="font-semibold text-sm text-gray-900">
                                            Return (Refund)
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Kembalikan barang dan terima refund
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => form.setValue("type", "EXCHANGE")}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                                            returnType === "EXCHANGE"
                                                ? "border-sky-400 bg-sky-50 shadow-sm"
                                                : "border-border/30 hover:border-gray-300"
                                        }`}
                                    >
                                        <ArrowLeftRight
                                            className={`h-5 w-5 mb-2 ${
                                                returnType === "EXCHANGE"
                                                    ? "text-sky-600"
                                                    : "text-gray-400"
                                            }`}
                                        />
                                        <p className="font-semibold text-sm text-gray-900">
                                            Exchange (Tukar)
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Tukar barang dengan produk lain
                                        </p>
                                    </button>
                                </div>
                            </div>

                            {/* Reason */}
                            <Controller
                                control={form.control}
                                name="reason"
                                render={({ field, fieldState }) => (
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-gray-700">
                                            Alasan Return <span className="text-red-500">*</span>
                                        </Label>
                                        <Textarea
                                            placeholder="Jelaskan alasan return/exchange..."
                                            {...field}
                                            className={`rounded-xl min-h-[80px] ${fieldState.error ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                                        />
                                        {fieldState.error && (
                                            <p className="text-xs text-red-500">{fieldState.error.message}</p>
                                        )}
                                    </div>
                                )}
                            />

                            {/* Refund Method (for RETURN only) */}
                            {returnType === "RETURN" && (
                                <Controller
                                    control={form.control}
                                    name="refundMethod"
                                    render={({ field }) => (
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700">
                                                Metode Refund
                                            </Label>
                                            <Select
                                                value={field.value ?? "CASH"}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger className="rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CASH">Cash</SelectItem>
                                                    <SelectItem value="STORE_CREDIT">
                                                        Store Credit
                                                    </SelectItem>
                                                    <SelectItem value="ORIGINAL_METHOD">
                                                        Metode Pembayaran Asal
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                />
                            )}

                            {/* Exchange Products (for EXCHANGE only) */}
                            {returnType === "EXCHANGE" && (
                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold text-gray-700">
                                        Produk Pengganti
                                    </Label>
                                    <p className="text-xs text-gray-500">
                                        Pilih produk pengganti untuk setiap item yang di-return
                                    </p>

                                    {Array.from(selectedItems.entries()).map(
                                        ([productId, item]) => (
                                            <div
                                                key={productId}
                                                className="p-3 rounded-xl border border-border/30 space-y-2"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-4 w-4 text-gray-400" />
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {item.productName}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-xs"
                                                    >
                                                        x{item.quantity}
                                                    </Badge>
                                                    <ArrowRight className="h-3 w-3 text-gray-400 ml-auto" />
                                                </div>

                                                {item.exchangeProductId ? (
                                                    <div className="flex items-center gap-2 p-2 bg-sky-50 rounded-lg border border-sky-100">
                                                        <CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-sky-900 truncate">
                                                                {item.exchangeProductName}
                                                            </p>
                                                            <p className="text-xs text-sky-600">
                                                                {formatCurrency(
                                                                    item.exchangeUnitPrice ?? 0
                                                                )}{" "}
                                                                x {item.exchangeQuantity}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-xs text-sky-600 hover:text-sky-800"
                                                            onClick={() =>
                                                                removeExchangeProduct(productId)
                                                            }
                                                        >
                                                            Ganti
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {exchangeTargetProductId === productId ? (
                                                            <>
                                                                <div className="relative">
                                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                                                    <Input
                                                                        placeholder="Cari produk pengganti..."
                                                                        value={exchangeSearch}
                                                                        onChange={(e) =>
                                                                            handleSearchExchangeProduct(
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                        className="pl-8 h-8 text-xs rounded-lg"
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                                {searchingExchange && (
                                                                    <div className="flex items-center gap-2 p-2 text-xs text-gray-500">
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                        Mencari...
                                                                    </div>
                                                                )}
                                                                {exchangeProducts.length > 0 && (
                                                                    <div className="max-h-40 overflow-y-auto space-y-1 border border-border/30 rounded-lg p-1">
                                                                        {exchangeProducts.map(
                                                                            (ep) => (
                                                                                <button
                                                                                    key={ep.id}
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        assignExchangeProduct(
                                                                                            productId,
                                                                                            ep
                                                                                        )
                                                                                    }
                                                                                    className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors"
                                                                                >
                                                                                    <p className="text-xs font-medium text-gray-900 truncate">
                                                                                        {ep.name}
                                                                                    </p>
                                                                                    <p className="text-[11px] text-gray-500">
                                                                                        {ep.code}{" "}
                                                                                        &middot;{" "}
                                                                                        {formatCurrency(
                                                                                            ep.sellingPrice
                                                                                        )}{" "}
                                                                                        &middot;
                                                                                        Stok:{" "}
                                                                                        {
                                                                                            ep.availableStock
                                                                                        }
                                                                                    </p>
                                                                                </button>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 text-xs rounded-lg w-full"
                                                                onClick={() =>
                                                                    setExchangeTargetProductId(
                                                                        productId
                                                                    )
                                                                }
                                                            >
                                                                <Search className="h-3 w-3 mr-1.5" />
                                                                Pilih Produk Pengganti
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                            )}

                            {/* Notes */}
                            <Controller
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold text-gray-700">
                                            Catatan Tambahan
                                        </Label>
                                        <Textarea
                                            placeholder="Catatan tambahan (opsional)"
                                            {...field}
                                            className="rounded-xl min-h-[60px]"
                                        />
                                    </div>
                                )}
                            />
                        </div>
                    )}

                    {/* Step 4: Summary & Confirm */}
                    {step === 4 && transaction && (
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 rounded-xl border border-border/30 space-y-3">
                                <h4 className="text-sm font-semibold text-gray-900">
                                    Ringkasan Return
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-gray-500">Invoice</span>
                                    <span className="font-mono font-medium text-gray-900">
                                        {transaction.invoiceNumber}
                                    </span>
                                    <span className="text-gray-500">Tipe</span>
                                    <Badge
                                        variant="outline"
                                        className={
                                            returnType === "RETURN"
                                                ? "border-violet-200 bg-violet-50/50 text-violet-700 ring-1 ring-violet-100"
                                                : "border-sky-200 bg-sky-50/50 text-sky-700 ring-1 ring-sky-100"
                                        }
                                    >
                                        {returnType === "RETURN" ? "Return" : "Exchange"}
                                    </Badge>
                                    <span className="text-gray-500">Alasan</span>
                                    <span className="text-gray-900">{form.getValues("reason")}</span>
                                    {returnType === "RETURN" && (
                                        <>
                                            <span className="text-gray-500">Metode Refund</span>
                                            <span className="text-gray-900">
                                                {form.getValues("refundMethod") === "CASH"
                                                    ? "Cash"
                                                    : form.getValues("refundMethod") === "STORE_CREDIT"
                                                        ? "Store Credit"
                                                        : "Metode Pembayaran Asal"}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Items Summary */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-gray-900">
                                    Item Return
                                </h4>
                                {Array.from(selectedItems.values()).map((item) => (
                                    <div
                                        key={item.productId}
                                        className="flex items-center justify-between p-3 rounded-xl border border-border/30"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {item.productName}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {item.quantity} x{" "}
                                                {formatCurrency(item.unitPrice)}
                                            </p>
                                            {item.exchangeProductName && (
                                                <p className="text-xs text-sky-600 mt-0.5">
                                                    Tukar dengan: {item.exchangeProductName}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900">
                                            {formatCurrency(item.unitPrice * item.quantity)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Total */}
                            <div className="flex items-center justify-between p-4 bg-violet-50 rounded-xl border border-violet-100">
                                <span className="font-semibold text-violet-700">
                                    Total Refund
                                </span>
                                <span className="text-xl font-bold text-violet-900">
                                    {formatCurrency(totalRefund)}
                                </span>
                            </div>

                            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700">
                                    Return akan berstatus <strong>Menunggu Approval</strong>.
                                    Manager atau admin perlu menyetujui sebelum stok dan
                                    refund diproses.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t shrink-0 gap-2">
                    {step > 1 && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setStep(step - 1)}
                            className="rounded-xl gap-1"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Kembali
                        </Button>
                    )}
                    <div className="flex-1" />
                    {step === 1 && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            className="rounded-xl"
                        >
                            Batal
                        </Button>
                    )}
                    {step === 2 && (
                        <Button
                            type="button"
                            onClick={() => setStep(3)}
                            disabled={!canProceedToStep3}
                            className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white gap-1"
                        >
                            Lanjut
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    )}
                    {step === 3 && (
                        <Button
                            type="button"
                            onClick={handleGoToStep4}
                            disabled={!canProceedToStep4}
                            className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white gap-1"
                        >
                            Lanjut
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    )}
                    {step === 4 && (
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white gap-1"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Memproses...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Buat Return
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
