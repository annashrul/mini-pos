"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Info } from "lucide-react";

export function BranchPricesCopyDialog(props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedBranchName: string | null | undefined;
    customCount: number;
    activeBranchId: string;
    activeBranches: Array<{ id: string; name: string; isActive: boolean }>;
    copyTarget: string;
    onCopyTargetChange: (value: string) => void;
    canCreate: boolean;
    cannotMessage: (action: string) => string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const {
        open,
        onOpenChange,
        selectedBranchName,
        customCount,
        activeBranchId,
        activeBranches,
        copyTarget,
        onCopyTargetChange,
        canCreate,
        cannotMessage,
        onCancel,
        onConfirm,
    } = props;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-2xl max-w-sm p-6 overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-t-2xl -mt-6 mb-2" />
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-500/20">
                            <Copy className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg font-bold">Salin Harga ke Cabang Lain</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Salin <strong className="text-violet-600">{customCount}</strong> harga khusus dari <strong>{selectedBranchName}</strong> ke cabang tujuan.
                    </p>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Cabang Tujuan</Label>
                        <Select value={copyTarget} onValueChange={onCopyTargetChange}>
                            <SelectTrigger className="rounded-xl w-full h-10 border-slate-200/60">
                                <SelectValue placeholder="Pilih cabang tujuan..." />
                            </SelectTrigger>
                            <SelectContent>
                                {activeBranches.filter((b) => b.id !== activeBranchId).map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                        {b.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-start gap-2 bg-blue-50/80 rounded-xl px-3.5 py-2.5 border border-blue-100/50">
                        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-600">
                            Semua harga khusus (beli & jual) akan disalin ke cabang tujuan. Harga yang sudah ada di cabang tujuan akan ditimpa.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel} className="rounded-xl border-slate-200/60">
                        Batal
                    </Button>
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                        <Button
                            disabled={!canCreate || !copyTarget}
                            onClick={onConfirm}
                            className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 transition-all"
                        >
                            <Copy className="w-4 h-4 mr-1.5" /> Salin Harga
                        </Button>
                    </DisabledActionTooltip>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

