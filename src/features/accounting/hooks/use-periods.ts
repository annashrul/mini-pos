"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { accountingService } from "../services";
import { getAccountingPeriods } from "@/server/actions/accounting";

const createPeriodSchema = z.object({
  name: z.string().min(1, "Nama periode wajib diisi"),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
  endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
}).refine((data) => {
  if (!data.startDate || !data.endDate) return true;
  return new Date(data.endDate) > new Date(data.startDate);
}, { message: "Tanggal selesai harus setelah tanggal mulai", path: ["endDate"] });

export type CreatePeriodFormValues = z.infer<typeof createPeriodSchema>;

type AccountingPeriodsData = Awaited<ReturnType<typeof getAccountingPeriods>>;

export function usePeriods() {
  const [periods, setPeriods] = useState<AccountingPeriodsData>([]);
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "close" | "reopen" | "lock" } | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      const data = await accountingService.getAccountingPeriods();
      setPeriods(data);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleAction() {
    if (!confirmAction) return;
    startTransition(async () => {
      try {
        let result;
        if (confirmAction.action === "close") result = await accountingService.closePeriod(confirmAction.id);
        else if (confirmAction.action === "reopen") result = await accountingService.reopenPeriod(confirmAction.id);
        else result = await accountingService.lockPeriod(confirmAction.id);

        if ("error" in result) { toast.error(result.error); return; }
        toast.success(confirmAction.action === "close" ? "Periode ditutup" : confirmAction.action === "reopen" ? "Periode dibuka kembali" : "Periode dikunci permanan");
        setConfirmAction(null);
        load();
      } catch { toast.error("Gagal"); }
    });
  }

  return {
    periods,
    isPending,
    showCreate,
    setShowCreate,
    confirmAction,
    setConfirmAction,
    handleAction,
    load,
  };
}

export function useCreatePeriod(open: boolean, onClose: () => void, onCreated: () => void) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreatePeriodFormValues>({
    resolver: zodResolver(createPeriodSchema),
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: "", startDate: "", endDate: "" });
    }
  }, [open, form]);

  function onSubmit(values: CreatePeriodFormValues) {
    startTransition(async () => {
      try {
        const result = await accountingService.createAccountingPeriod({
          name: values.name,
          startDate: values.startDate,
          endDate: values.endDate,
        });
        if ("error" in result) { toast.error(result.error); return; }
        toast.success("Periode dibuat");
        form.reset();
        onClose();
        onCreated();
      } catch { toast.error("Gagal membuat periode"); }
    });
  }

  return { form, isPending, onSubmit };
}
