"use client";

import { useState, useTransition, useEffect } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
    getReturnById,
    approveReturn,
    rejectReturn,
} from "@/features/returns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogBody,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    RotateCcw,
    ArrowLeftRight,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    User,
    MapPin,
    Package,
    ArrowRight,
    Banknote,
    Calendar,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ReturnDetailItem {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    reason: string | null;
    exchangeQuantity: number | null;
    restocked: boolean;
    product: { id: string; name: string; code: string; sellingPrice: number; imageUrl: string | null };
    exchangeProduct: { id: string; name: string; code: string; sellingPrice: number; imageUrl: string | null } | null;
}

interface ReturnDetail {
    id: string;
    returnNumber: string;
    type: string;
    status: string;
    reason: string;
    notes: string | null;
    totalRefund: number;
    refundMethod: string | null;
    approvedBy: string | null;
    approvedAt: string | Date | null;
    createdAt: string | Date;
    transaction: {
        id: string;
        invoiceNumber: string;
        grandTotal: number;
    };
    customer: { id: string; name: string; phone: string | null; email: string | null } | null;
    branch: { id: string; name: string } | null;
    processedByUser: { id: string; name: string };
    items: ReturnDetailItem[];
}

const statusConfig: Record<
    string,
    { label: string; icon: typeof CheckCircle2; color: string; bg: string }
> = {
    PENDING: {
        label: "Menunggu Approval",
        icon: Clock,
        color: "text-amber-700",
        bg: "bg-amber-50 border-amber-200",
    },
    APPROVED: {
        label: "Disetujui",
        icon: CheckCircle2,
        color: "text-blue-700",
        bg: "bg-blue-50 border-blue-200",
    },
    COMPLETED: {
        label: "Selesai",
        icon: CheckCircle2,
        color: "text-emerald-700",
        bg: "bg-emerald-50 border-emerald-200",
    },
    REJECTED: {
        label: "Ditolak",
        icon: XCircle,
        color: "text-red-700",
        bg: "bg-red-50 border-red-200",
    },
};

interface ReturnDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    returnId: string;
    canApprove: boolean;
    onUpdated: () => void;
}

export function ReturnDetailDialog({
    open,
    onOpenChange,
    returnId,
    canApprove,
    onUpdated,
}: ReturnDetailDialogProps) {
    const [data, setData] = useState<ReturnDetail | null>(null);
    const [loadingData, startLoadData] = useTransition();
    const [processing, startProcessing] = useTransition();
    const [rejectMode, setRejectMode] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    useEffect(() => {
        if (open && returnId) {
            setRejectMode(false);
            setRejectReason("");
            startLoadData(async () => {
                const result = await getReturnById(returnId);
                if (result.error) {
                    toast.error(result.error);
                    return;
                }
                if (result.data) {
                    setData(result.data as ReturnDetail);
                }
            });
        } else {
            setData(null);
        }
    }, [open, returnId]);

    const handleApprove = () => {
        startProcessing(async () => {
            const result = await approveReturn(returnId);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success("Return berhasil disetujui dan diproses");
            onUpdated();
        });
    };

    const handleReject = () => {
        if (!rejectReason.trim()) {
            toast.error("Alasan penolakan wajib diisi");
            return;
        }
        startProcessing(async () => {
            const result = await rejectReturn(returnId, rejectReason.trim());
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success("Return ditolak");
            onUpdated();
        });
    };

    const sc = data ? (statusConfig[data.status] ?? statusConfig.PENDING)! : statusConfig.PENDING!;
    const StatusIcon = sc!.icon;
    const isPending = data?.status === "PENDING";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                            {data?.type === "EXCHANGE" ? (
                                <ArrowLeftRight className="h-4 w-4" />
                            ) : (
                                <RotateCcw className="h-4 w-4" />
                            )}
                        </div>
                        Detail Return
                    </DialogTitle>
                </DialogHeader>

                <DialogBody className="flex-1 overflow-y-auto space-y-4 py-4">
                    {loadingData || !data ? (
                        <div className="space-y-4">
                            <Skeleton className="h-20 w-full rounded-xl" />
                            <Skeleton className="h-32 w-full rounded-xl" />
                            <Skeleton className="h-40 w-full rounded-xl" />
                        </div>
                    ) : (
                        <>
                            {/* Status Banner */}
                            <div
                                className={`flex items-center gap-3 p-4 rounded-xl border ${sc!.bg}`}
                            >
                                <StatusIcon className={`h-5 w-5 ${sc!.color}`} />
                                <div>
                                    <p className={`text-sm font-semibold ${sc!.color}`}>
                                        {sc!.label}
                                    </p>
                                    {data.approvedAt && (
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {formatDateTime(data.approvedAt)}
                                        </p>
                                    )}
                                </div>
                                <div className="ml-auto">
                                    <Badge
                                        variant="outline"
                                        className={
                                            data.type === "RETURN"
                                                ? "border-violet-200 bg-violet-50 text-violet-700"
                                                : "border-sky-200 bg-sky-50 text-sky-700"
                                        }
                                    >
                                        {data.type === "RETURN" ? (
                                            <RotateCcw className="h-3 w-3 mr-1" />
                                        ) : (
                                            <ArrowLeftRight className="h-3 w-3 mr-1" />
                                        )}
                                        {data.type === "RETURN" ? "Return" : "Exchange"}
                                    </Badge>
                                </div>
                            </div>

                            {/* Return Info */}
                            <div className="p-4 bg-gray-50 rounded-xl border border-border/30 space-y-3">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-0.5">
                                            Nomor Return
                                        </p>
                                        <p className="font-mono font-semibold text-gray-900">
                                            {data.returnNumber}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-0.5">
                                            Invoice Asli
                                        </p>
                                        <p className="font-mono font-medium text-gray-700">
                                            {data.transaction.invoiceNumber}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-0.5">
                                            Tanggal
                                        </p>
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                            <p className="text-gray-700">
                                                {formatDateTime(data.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-0.5">
                                            Diproses Oleh
                                        </p>
                                        <div className="flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5 text-gray-400" />
                                            <p className="text-gray-700">
                                                {data.processedByUser.name}
                                            </p>
                                        </div>
                                    </div>
                                    {data.customer && (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">
                                                Customer
                                            </p>
                                            <div className="flex items-center gap-1.5">
                                                <User className="h-3.5 w-3.5 text-gray-400" />
                                                <p className="text-gray-700">
                                                    {data.customer.name}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {data.branch && (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">
                                                Cabang
                                            </p>
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                                <p className="text-gray-700">
                                                    {data.branch.name}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <Separator className="my-2" />

                                <div>
                                    <p className="text-xs text-gray-500 mb-1">
                                        Alasan
                                    </p>
                                    <p className="text-sm text-gray-800">{data.reason}</p>
                                </div>
                                {data.notes && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">
                                            Catatan
                                        </p>
                                        <p className="text-sm text-gray-700">{data.notes}</p>
                                    </div>
                                )}
                                {data.refundMethod && (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">
                                            Metode Refund
                                        </p>
                                        <div className="flex items-center gap-1.5">
                                            <Banknote className="h-3.5 w-3.5 text-gray-400" />
                                            <p className="text-sm text-gray-700">
                                                {data.refundMethod === "CASH"
                                                    ? "Cash"
                                                    : data.refundMethod === "STORE_CREDIT"
                                                        ? "Store Credit"
                                                        : "Metode Pembayaran Asal"}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Items */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                    <Package className="h-4 w-4 text-gray-500" />
                                    Item Return ({data.items.length})
                                </h4>
                                <div className="space-y-2">
                                    {data.items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="p-3 rounded-xl border border-border/30 hover:border-gray-300 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {item.productName}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {item.product.code} &middot;{" "}
                                                        {item.quantity} x{" "}
                                                        {formatCurrency(item.unitPrice)}
                                                    </p>
                                                    {item.reason && (
                                                        <p className="text-xs text-gray-500 mt-1 italic">
                                                            Alasan: {item.reason}
                                                        </p>
                                                    )}
                                                    {item.restocked && (
                                                        <Badge
                                                            variant="outline"
                                                            className="mt-1 border-emerald-200 bg-emerald-50 text-emerald-600 text-[10px]"
                                                        >
                                                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                                            Restocked
                                                        </Badge>
                                                    )}
                                                </div>
                                                <span className="text-sm font-semibold text-gray-900 shrink-0">
                                                    {formatCurrency(item.subtotal)}
                                                </span>
                                            </div>

                                            {/* Exchange replacement */}
                                            {item.exchangeProduct && (
                                                <div className="mt-2 flex items-center gap-2 p-2 bg-sky-50/50 rounded-lg border border-sky-100">
                                                    <ArrowRight className="h-3 w-3 text-sky-500 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium text-sky-800 truncate">
                                                            Ditukar: {item.exchangeProduct.name}
                                                        </p>
                                                        <p className="text-[11px] text-sky-600">
                                                            {item.exchangeProduct.code}{" "}
                                                            {item.exchangeQuantity
                                                                ? `x${item.exchangeQuantity}`
                                                                : ""}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Total */}
                            <div className="flex items-center justify-between p-4 bg-violet-50 rounded-xl border border-violet-100">
                                <span className="font-semibold text-violet-700">
                                    Total Refund
                                </span>
                                <span className="text-xl font-bold text-violet-900">
                                    {formatCurrency(data.totalRefund)}
                                </span>
                            </div>

                            {/* Reject Reason Input */}
                            {rejectMode && (
                                <div className="space-y-2 p-4 bg-red-50 rounded-xl border border-red-100">
                                    <Label className="text-sm font-semibold text-red-700">
                                        Alasan Penolakan <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        placeholder="Masukkan alasan penolakan..."
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="rounded-xl border-red-200 focus:ring-red-300"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </>
                    )}
                </DialogBody>

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl"
                    >
                        Tutup
                    </Button>

                    {data && isPending && canApprove && !rejectMode && (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setRejectMode(true)}
                                className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 gap-1"
                            >
                                <XCircle className="h-4 w-4" />
                                Tolak
                            </Button>
                            <Button
                                type="button"
                                onClick={handleApprove}
                                disabled={processing}
                                className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white gap-1"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Memproses...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        Setujui & Proses
                                    </>
                                )}
                            </Button>
                        </>
                    )}

                    {rejectMode && (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setRejectMode(false);
                                    setRejectReason("");
                                }}
                                className="rounded-xl"
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                onClick={handleReject}
                                disabled={processing || !rejectReason.trim()}
                                className="rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white gap-1"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Memproses...
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="h-4 w-4" />
                                        Konfirmasi Tolak
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
