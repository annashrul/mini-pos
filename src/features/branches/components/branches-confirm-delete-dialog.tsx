"use client";

import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";

export function BranchesConfirmDeleteDialog(props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    canDelete: boolean;
    cannotMessage: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const { open, onOpenChange, canDelete, onCancel, onConfirm } = props;

    return (
        <ActionConfirmDialog
            open={open}
            onOpenChange={(v) => {
                onOpenChange(v);
                if (!v) onCancel();
            }}
            kind="delete"
            title="Hapus Cabang"
            description="Yakin ingin menghapus cabang ini? Tindakan ini tidak dapat dibatalkan."
            confirmLabel="Ya, Hapus"
            confirmDisabled={!canDelete}
            onConfirm={onConfirm}
            size="sm"
            cancelLabel="Batal"
        />
    );
}
