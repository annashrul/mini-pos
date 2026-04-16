"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartSelect } from "@/components/ui/smart-select";
import { Loader2, Lock, Mail, MapPin, Pencil, Plus, Shield, UserCircle } from "lucide-react";
import { useRef, useState } from "react";

export function UsersFormDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  defaultValues: { name: string; email: string; isActive: boolean };
  canSubmit: boolean;
  cannotMessage: string;
  roleOptions: Array<{ value: string; label: string }>;
  branchOptions: Array<{ value: string; label: string }>;
  formRole: string;
  onFormRoleChange: (v: string) => void;
  formBranchId: string;
  onFormBranchIdChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const {
    open,
    onOpenChange,
    editing,
    defaultValues,
    canSubmit,
    cannotMessage,
    roleOptions,
    branchOptions,
    formRole,
    onFormRoleChange,
    formBranchId,
    onFormBranchIdChange,
    onCancel,
    onSubmit,
  } = props;
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSubmitting(false); onOpenChange(v); }}>
      <DialogContent className="rounded-2xl max-w-md">
        <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 rounded-t-2xl -mt-6 mb-2" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg font-bold">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-sky-200/50">
              {editing ? <Pencil className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
            </div>
            {editing ? "Edit User" : "Tambah User"}
          </DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={onSubmit} className="min-h-0 flex flex-col">
          <DialogBody className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium inline-flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  Nama <span className="text-red-400">*</span>
                </Label>
                <Input name="name" defaultValue={defaultValues.name} required className="rounded-xl h-10" autoFocus placeholder="Masukkan nama lengkap" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  Email <span className="text-red-400">*</span>
                </Label>
                <Input name="email" type="email" defaultValue={defaultValues.email} required className="rounded-xl h-10" placeholder="contoh@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  Password{" "}
                  {editing && <span className="text-xs text-muted-foreground font-normal">(kosongkan jika tidak diubah)</span>}
                </Label>
                <Input name="password" type="password" required={!editing} minLength={6} className="rounded-xl h-10" placeholder="Minimal 6 karakter" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium inline-flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  Role <span className="text-red-400">*</span>
                </Label>
                <SmartSelect value={formRole} onChange={onFormRoleChange} initialOptions={roleOptions} onSearch={async (q) => roleOptions.filter((opt) => opt.label.toLowerCase().includes(q.toLowerCase()))} />
                <input type="hidden" name="role" value={formRole} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  Lokasi
                </Label>
                <SmartSelect
                  value={formBranchId}
                  onChange={onFormBranchIdChange}
                  initialOptions={branchOptions}
                  placeholder="Pilih lokasi (opsional)"
                  onSearch={async (q) => branchOptions.filter((opt) => opt.label.toLowerCase().includes(q.toLowerCase()))}
                />
                <input type="hidden" name="branchId" value={formBranchId} />
              </div>
            </div>

            {editing && <input type="hidden" name="isActive" value={defaultValues.isActive ? "true" : "false"} />}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">
              Batal
            </Button>
            <DisabledActionTooltip disabled={!canSubmit} message={cannotMessage} menuKey="users" actionKey="create">
              <Button
                disabled={!canSubmit || submitting}
                type="button"
                onClick={() => setSubmitConfirmOpen(true)}
                className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {editing ? "Update" : "Simpan"}
              </Button>
            </DisabledActionTooltip>
          </DialogFooter>
        </form>
        <ActionConfirmDialog
          open={submitConfirmOpen}
          onOpenChange={setSubmitConfirmOpen}
          kind="submit"
          title={editing ? "Update Pengguna?" : "Tambah Pengguna?"}
          description={editing ? "Perubahan pengguna akan disimpan." : "Pengguna baru akan ditambahkan."}
          confirmLabel={editing ? "Update" : "Simpan"}
          confirmDisabled={!canSubmit}
          onConfirm={async () => { setSubmitting(true); formRef.current?.requestSubmit(); }}
          size="sm"
        />
      </DialogContent>
    </Dialog>
  );
}
