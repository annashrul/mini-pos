"use client";

import { useEffect, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SmartSelect } from "@/components/ui/smart-select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBranch } from "@/components/providers/branch-provider";
import { accountingService } from "../services";
import { ACCOUNT_TYPES, CATEGORY_OPTIONS } from "../utils";
import type { AccountDialogProps } from "../types";

const accountSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "Nama akun wajib diisi"),
  category: z.string().min(1, "Kategori wajib dipilih"),
  type: z.string(),
  parentId: z.string().optional(),
  description: z.string().optional(),
  openingBalance: z.number(),
  isActive: z.boolean(),
  autoCode: z.boolean(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

export function AccountDialog({
  open,
  onClose,
  account,
  accounts,
}: AccountDialogProps) {
  const [saving, startSaving] = useTransition();
  const { selectedBranchId } = useBranch();

  const isEditing = !!account;

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: "",
      name: "",
      category: "ASET",
      type: "",
      parentId: "",
      description: "",
      openingBalance: 0,
      isActive: true,
      autoCode: true,
    },
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = form;

  const category = watch("category");
  const autoCode = watch("autoCode");

  useEffect(() => {
    if (open) {
      if (account) {
        reset({
          code: account.code,
          name: account.name,
          category: account.category,
          type: account.type,
          parentId: account.parentId || "",
          description: account.description || "",
          openingBalance: account.balance,
          isActive: account.isActive,
          autoCode: false,
        });
      } else {
        reset({
          code: "",
          name: "",
          category: "ASET",
          type: "",
          parentId: "",
          description: "",
          openingBalance: 0,
          isActive: true,
          autoCode: true,
        });
      }
    }
  }, [open, account, reset]);

  const parentCandidates = accounts.filter(
    (a) => a.category === category && a.id !== account?.id
  );

  const typeOptions = ACCOUNT_TYPES[category] || [];

  const type = watch("type");
  useEffect(() => {
    if (!isEditing && typeOptions.length > 0 && !typeOptions.includes(type)) {
      setValue("type", typeOptions[0] || "");
    }
  }, [category, typeOptions, type, isEditing, setValue]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (raw: any) => {
    const values = raw as AccountFormValues;
    if (!values.autoCode && !values.code?.trim()) {
      toast.error("Kode akun wajib diisi");
      return;
    }

    startSaving(async () => {
      try {
        const data = {
          code: values.autoCode && !isEditing ? undefined : values.code,
          name: values.name.trim(),
          category: values.category,
          type: values.type,
          parentId: values.parentId || null,
          description: values.description?.trim() || null,
          openingBalance: values.openingBalance || 0,
          isActive: values.isActive,
          branchId: selectedBranchId || null,
        };

        if (isEditing) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await accountingService.updateAccount(account!.id, data as any);
          toast.success("Akun berhasil diperbarui");
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await accountingService.createAccount(data as any);
          toast.success("Akun berhasil dibuat");
        }
        onClose(true);
      } catch {
        toast.error(
          isEditing ? "Gagal memperbarui akun" : "Gagal membuat akun"
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[540px] p-0 rounded-2xl overflow-hidden gap-0 flex flex-col max-h-[85vh]">
        <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />

        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="text-lg font-bold text-gray-900">
            {isEditing ? "Edit Akun" : "Tambah Akun Baru"}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 mt-1">
            {isEditing
              ? "Perbarui informasi akun yang sudah ada"
              : "Buat akun baru untuk chart of accounts"}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <form
            id="account-form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
          >
            {/* Auto code toggle */}
            {!isEditing && (
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Kode otomatis
                  </Label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Generate kode akun secara otomatis
                  </p>
                </div>
                <Controller
                  control={control}
                  name="autoCode"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            )}

            {/* Code */}
            {(!autoCode || isEditing) && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Kode Akun
                </Label>
                <Input
                  {...register("code")}
                  placeholder="Contoh: 1-1001"
                  className="rounded-xl border-gray-200 font-mono focus-visible:ring-blue-500/20"
                />
                {errors.code && (
                  <p className="text-xs text-red-500">{errors.code.message}</p>
                )}
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Nama Akun <span className="text-red-400">*</span>
              </Label>
              <Input
                {...register("name")}
                placeholder="Masukkan nama akun"
                className="rounded-xl border-gray-200 focus-visible:ring-blue-500/20"
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Category & Type - side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Kategori
                </Label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <SmartSelect
                      value={field.value}
                      onChange={(v) => { field.onChange(v); setValue("parentId", ""); }}
                      placeholder="Pilih kategori"
                      onSearch={async (query) =>
                        CATEGORY_OPTIONS.filter((o) => !query || o.label.toLowerCase().includes(query.toLowerCase()))
                          .map((o) => ({ value: o.value, label: o.label }))
                      }
                      initialOptions={CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    />
                  )}
                />
                {errors.category && (
                  <p className="text-xs text-red-500">
                    {errors.category.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Tipe Akun
                </Label>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <SmartSelect
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Pilih tipe"
                      onSearch={async (query) =>
                        typeOptions.filter((t) => !query || t.toLowerCase().includes(query.toLowerCase()))
                          .map((t) => ({ value: t, label: t }))
                      }
                      initialOptions={typeOptions.map((t) => ({ value: t, label: t }))}
                    />
                  )}
                />
              </div>
            </div>

            {/* Parent Account */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Akun Induk{" "}
                <span className="text-gray-400 font-normal">(Opsional)</span>
              </Label>
              <Controller
                control={control}
                name="parentId"
                render={({ field }) => (
                  <SmartSelect
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Tidak ada (root)"
                    onSearch={async (query) =>
                      parentCandidates
                        .filter((a) => !query || a.code.toLowerCase().includes(query.toLowerCase()) || a.name.toLowerCase().includes(query.toLowerCase()))
                        .map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))
                    }
                    initialOptions={parentCandidates.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                  />
                )}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Deskripsi
              </Label>
              <Textarea
                {...register("description")}
                placeholder="Deskripsi akun (opsional)"
                rows={3}
                className="rounded-xl border-gray-200 resize-none focus-visible:ring-blue-500/20"
              />
            </div>

            {/* Opening Balance */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                {isEditing ? "Saldo" : "Saldo Awal"}
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                  Rp
                </span>
                <Input
                  type="number"
                  {...register("openingBalance", { valueAsNumber: true })}
                  className="rounded-xl border-gray-200 pl-10 font-mono tabular-nums focus-visible:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Status Aktif
                </Label>
                <p className="text-xs text-gray-400 mt-0.5">
                  Akun nonaktif tidak muncul di pilihan jurnal
                </p>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </form>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-gray-100 shrink-0">
          <Button
            variant="outline"
            onClick={() => onClose()}
            className="rounded-xl border-gray-200 hover:bg-gray-50"
          >
            Batal
          </Button>
          <Button
            type="submit"
            form="account-form"
            disabled={saving}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/20 min-w-[120px]"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? "Simpan Perubahan" : "Buat Akun"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
