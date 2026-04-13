"use client";

import { useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, CheckCircle2, Send, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

type ConfirmKind = "submit" | "delete" | "approve" | "custom";

const KIND_META: Record<
    ConfirmKind,
    {
        title: string;
        confirmLabel: string;
        icon: ComponentType<{ className?: string }>;
        mediaClassName: string;
        actionVariant: "default" | "destructive";
    }
> = {
    submit: {
        title: "Konfirmasi Submit",
        confirmLabel: "Submit",
        icon: Send,
        mediaClassName: "bg-primary/10 text-primary",
        actionVariant: "default",
    },
    delete: {
        title: "Konfirmasi Hapus",
        confirmLabel: "Hapus",
        icon: Trash2,
        mediaClassName: "bg-red-100 text-red-600",
        actionVariant: "destructive",
    },
    approve: {
        title: "Konfirmasi Persetujuan",
        confirmLabel: "Setujui",
        icon: ShieldCheck,
        mediaClassName: "bg-emerald-100 text-emerald-600",
        actionVariant: "default",
    },
    custom: {
        title: "Konfirmasi",
        confirmLabel: "Lanjutkan",
        icon: CheckCircle2,
        mediaClassName: "bg-muted text-foreground",
        actionVariant: "default",
    },
};

type ActionConfirmDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void | Promise<void>;
    kind?: ConfirmKind;
    title?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    loading?: boolean;
    confirmDisabled?: boolean;
    size?: "sm" | "default";
};

export function ActionConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    kind = "custom",
    title,
    description,
    confirmLabel,
    cancelLabel = "Batal",
    loading = false,
    confirmDisabled = false,
    size = "sm",
}: ActionConfirmDialogProps) {
    const meta = KIND_META[kind];
    const Icon = meta.icon;
    const [processing, setProcessing] = useState(false);
    const isLoading = loading || processing;

    const handleConfirm = async () => {
        if (isLoading || confirmDisabled) return;
        setProcessing(true);
        try {
            await onConfirm();
        } finally {
            setProcessing(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={(v) => { if (!isLoading) onOpenChange(v); }}>
            <AlertDialogContent size={size} className="rounded-2xl">
                <AlertDialogHeader>
                    <AlertDialogMedia className={cn("rounded-xl size-14", meta.mediaClassName)}>
                        <Icon className="w-6 h-6" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>{title || meta.title}</AlertDialogTitle>
                    {description ? (
                        <AlertDialogDescription>{description}</AlertDialogDescription>
                    ) : null}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>{cancelLabel}</AlertDialogCancel>
                    <AlertDialogAction
                        variant={meta.actionVariant}
                        onClick={(e) => {
                            e.preventDefault();
                            handleConfirm();
                        }}
                        disabled={isLoading || confirmDisabled}
                    >
                        {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : null}
                        {isLoading ? "Memproses..." : confirmLabel || meta.confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
