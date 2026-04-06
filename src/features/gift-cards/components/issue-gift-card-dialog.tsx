"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createGiftCard } from "@/server/actions/gift-cards";
import { getCustomers } from "@/server/actions/customers";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { SmartSelect } from "@/components/ui/smart-select";
import { CreditCard, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

const presetAmounts = [50000, 100000, 200000, 500000];

const giftCardSchema = z.object({
  amount: z.number().min(10000, "Nominal minimal Rp 10.000"),
  purchaserName: z.string().optional(),
  customerId: z.string().optional(),
  expiryDate: z.string().optional(),
});

type GiftCardFormValues = z.infer<typeof giftCardSchema>;

interface IssueGiftCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function IssueGiftCardDialog({
  open,
  onOpenChange,
  onSuccess,
}: IssueGiftCardDialogProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<GiftCardFormValues>({
    resolver: zodResolver(giftCardSchema),
    defaultValues: {
      amount: 0,
      purchaserName: "",
      customerId: undefined,
      expiryDate: "",
    },
  });

  const watchedAmount = watch("amount");
  const effectiveAmount = isCustom ? Number(customAmount) || 0 : watchedAmount;

  useEffect(() => {
    if (open) {
      reset({
        amount: 0,
        purchaserName: "",
        customerId: undefined,
        expiryDate: "",
      });
      setIsCustom(false);
      setCustomAmount("");
    }
  }, [open, reset]);

  // Keep the form amount in sync with effective amount
  useEffect(() => {
    if (isCustom) {
      setValue("amount", Number(customAmount) || 0);
    }
  }, [isCustom, customAmount, setValue]);

  const onSubmit = (data: GiftCardFormValues) => {
    if (effectiveAmount <= 0) {
      toast.error("Pilih atau masukkan nominal terlebih dahulu");
      return;
    }

    startTransition(async () => {
      const result = await createGiftCard({
        amount: effectiveAmount,
        ...(data.purchaserName ? { purchasedBy: data.purchaserName } : {}),
        ...(data.customerId ? { customerId: data.customerId } : {}),
        ...(data.expiryDate ? { expiresAt: data.expiryDate } : {}),
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `Gift card berhasil diterbitkan: ${result.giftCard?.code}`,
          { duration: 6000 }
        );
        reset();
        setIsCustom(false);
        setCustomAmount("");
        onOpenChange(false);
        onSuccess();
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          setIsCustom(false);
          setCustomAmount("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[85vh] flex flex-col p-0 rounded-2xl overflow-hidden gap-0 max-w-md">
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
        <DialogHeader className="shrink-0 px-6 pt-5">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/25">
              <Gift className="w-4 h-4 text-white" />
            </div>
            <span>Terbitkan Gift Card</span>
          </DialogTitle>
          <DialogDescription>
            Buat gift card baru dengan nominal dan detail pembeli
          </DialogDescription>
        </DialogHeader>

        <form id="gift-card-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-5">
            {/* Amount Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Nominal <span className="text-red-400">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {presetAmounts.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setValue("amount", preset);
                      setIsCustom(false);
                      setCustomAmount("");
                    }}
                    className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                      !isCustom && watchedAmount === preset
                        ? "bg-violet-50 border-violet-300 text-violet-700 shadow-sm ring-2 ring-violet-200"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    {formatCurrency(preset)}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Nominal custom..."
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setIsCustom(true);
                    setValue("amount", Number(e.target.value) || 0);
                  }}
                  onFocus={() => {
                    setIsCustom(true);
                    setValue("amount", Number(customAmount) || 0);
                  }}
                  className={`rounded-xl ${
                    isCustom && customAmount
                      ? "border-violet-300 ring-2 ring-violet-200"
                      : ""
                  }`}
                />
              </div>
              {errors.amount && (
                <p className="text-xs text-red-500">{errors.amount.message}</p>
              )}
              {effectiveAmount > 0 && !errors.amount && (
                <p className="text-xs text-violet-600 font-medium">
                  Nominal: {formatCurrency(effectiveAmount)}
                </p>
              )}
            </div>

            {/* Customer */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Customer (opsional)</Label>
              <Controller
                control={control}
                name="customerId"
                render={({ field }) => (
                  <SmartSelect
                    value={field.value}
                    onChange={(v) => field.onChange(v)}
                    placeholder="Pilih customer..."
                    onSearch={async (query, _page) => {
                      const res = await getCustomers({
                        search: query,
                        perPage: 20,
                        page: _page,
                      });
                      return res.customers.map(
                        (c: { id: string; name: string; phone: string | null }) => ({
                          value: c.id,
                          label: c.name,
                          description: c.phone ?? "",
                        })
                      );
                    }}
                  />
                )}
              />
            </div>

            {/* Purchased By */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nama Pembeli</Label>
              <Input
                {...register("purchaserName")}
                placeholder="Nama pembeli gift card..."
                className="rounded-xl"
              />
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Tanggal Kedaluwarsa (opsional)
              </Label>
              <Controller
                control={control}
                name="expiryDate"
                render={({ field }) => (
                  <DatePicker
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Pilih tanggal kedaluwarsa..."
                  />
                )}
              />
            </div>

            {/* Preview Card */}
            {effectiveAmount > 0 && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-5 text-white shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="w-5 h-5 text-white/80" />
                    <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                      Gift Card
                    </span>
                  </div>
                  <p className="font-mono text-sm tracking-widest text-white/80 mb-2">
                    GIFT-XXXX-XXXX-XXXX
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(effectiveAmount)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </form>

        <DialogFooter className="shrink-0 px-6 pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              setIsCustom(false);
              setCustomAmount("");
              onOpenChange(false);
            }}
            className="rounded-xl shadow-sm"
          >
            Batal
          </Button>
          <Button
            type="submit"
            form="gift-card-form"
            disabled={isPending || effectiveAmount <= 0}
            className="rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Gift className="w-4 h-4 mr-2" />
            )}
            Terbitkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
