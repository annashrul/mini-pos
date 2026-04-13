"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pencil, Plus } from "lucide-react";
import { useRef, useState } from "react";

export function BranchesDialog(props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingName: string | undefined;
    defaultValues: { name: string; address: string; phone: string };
    formIsActive: boolean;
    onFormIsActiveChange: (v: boolean) => void;
    canSubmit: boolean;
    cannotMessage: string;
    onCancel: () => void;
    onSubmit: (formData: FormData) => void;
}) {
    const {
        open,
        onOpenChange,
        editingName,
        defaultValues,
        formIsActive,
        onFormIsActiveChange,
        canSubmit,
        cannotMessage,
        onCancel,
        onSubmit,
    } = props;
    const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
    const formRef = useRef<HTMLFormElement | null>(null);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-2xl max-w-md">
                <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 rounded-t-2xl -mt-6 mb-2" />
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-lg font-bold">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-md shadow-cyan-200/50">
                            {editingName ? <Pencil className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
                        </div>
                        {editingName ? "Edit Cabang" : "Tambah Cabang"}
                    </DialogTitle>
                </DialogHeader>

                <form ref={formRef} action={onSubmit} className="min-h-0 flex flex-col">
                    <DialogBody className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">
                                Nama Cabang <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                name="name"
                                defaultValue={defaultValues.name}
                                required
                                className="rounded-xl h-10"
                                autoFocus
                                placeholder="Masukkan nama cabang"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Alamat</Label>
                            <Input name="address" defaultValue={defaultValues.address} className="rounded-xl h-10" placeholder="Alamat lengkap cabang" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Telepon</Label>
                            <Input name="phone" defaultValue={defaultValues.phone} className="rounded-xl h-10" placeholder="No. telepon cabang" />
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 bg-muted/30">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium">Status Aktif</Label>
                                <p className="text-[11px] text-muted-foreground">Cabang dapat digunakan dalam transaksi</p>
                            </div>
                            <Switch checked={formIsActive} onCheckedChange={onFormIsActiveChange} />
                        </div>
                    </DialogBody>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">
                            Batal
                        </Button>
                        <DisabledActionTooltip disabled={!canSubmit} message={cannotMessage} menuKey="branches" actionKey="create">
                            <Button disabled={!canSubmit} type="button" onClick={() => setSubmitConfirmOpen(true)} className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">
                                {editingName ? "Update" : "Simpan"}
                            </Button>
                        </DisabledActionTooltip>
                    </DialogFooter>
                </form>
                <ActionConfirmDialog
                    open={submitConfirmOpen}
                    onOpenChange={setSubmitConfirmOpen}
                    kind="submit"
                    title={editingName ? "Update Cabang?" : "Tambah Cabang?"}
                    description={editingName ? "Perubahan cabang akan disimpan." : "Cabang baru akan ditambahkan."}
                    confirmLabel={editingName ? "Update" : "Simpan"}
                    confirmDisabled={!canSubmit}
                    onConfirm={() => formRef.current?.requestSubmit()}
                    size="sm"
                />
            </DialogContent>
        </Dialog>
    );
}
