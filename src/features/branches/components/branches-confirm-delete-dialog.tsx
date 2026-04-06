"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { AlertTriangle } from "lucide-react";

export function BranchesConfirmDeleteDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDelete: boolean;
  cannotMessage: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { open, onOpenChange, canDelete, cannotMessage, onCancel, onConfirm } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm">
        <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 rounded-t-2xl -mt-6 mb-2" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg font-bold">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-md shadow-red-200/50">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            Hapus Cabang
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl bg-red-50/50 border border-red-100 p-3 mt-1">
          <p className="text-sm text-red-700 font-medium">Yakin ingin menghapus cabang ini?</p>
          <p className="text-xs text-red-500/70 mt-1">Tindakan ini tidak dapat dibatalkan.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} className="rounded-xl">
            Batal
          </Button>
          <DisabledActionTooltip disabled={!canDelete} message={cannotMessage}>
            <Button
              disabled={!canDelete}
              variant="destructive"
              onClick={onConfirm}
              className="rounded-xl shadow-md shadow-red-200/50 hover:shadow-lg hover:shadow-red-300/50 transition-all"
            >
              Ya, Hapus
            </Button>
          </DisabledActionTooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

