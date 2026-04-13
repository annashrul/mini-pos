"use client";

import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";

export function UsersConfirmDeleteDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirmText: string;
  canDelete: boolean;
  cannotMessage: (action: string) => string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { open, onOpenChange, confirmText, canDelete, onCancel, onConfirm } = props;

  return (
    <ActionConfirmDialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) onCancel();
      }}
      kind="delete"
      title="Konfirmasi Hapus"
      description={confirmText}
      confirmLabel="Ya, Hapus"
      confirmDisabled={!canDelete}
      onConfirm={async () => { await onConfirm(); }}
      size="sm"
    />
  );
}
