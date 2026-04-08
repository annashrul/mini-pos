"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useBranch } from "@/components/providers/branch-provider";
import { accountingService } from "../services";
import type { AccountSimple, JournalFormLine } from "../types";

let lineCounter = 0;
function nextLineId() {
  lineCounter += 1;
  return `line-${lineCounter}`;
}

export function useJournalForm(open: boolean, onClose: (saved?: boolean) => void) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<JournalFormLine[]>([
    { id: nextLineId(), accountId: "", description: "", debit: "", credit: "" },
    { id: nextLineId(), accountId: "", description: "", debit: "", credit: "" },
  ]);
  const [accounts, setAccounts] = useState<AccountSimple[]>([]);
  const [saving, startSaving] = useTransition();
  const [_loadingAccounts, startLoadingAccounts] = useTransition();
  const { selectedBranchId } = useBranch();

  useEffect(() => {
    if (open) {
      startLoadingAccounts(async () => {
        try {
          const result = await accountingService.getAccounts({
            ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
          });
          setAccounts(result.accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, category: a.category.name })));
        } catch {
          toast.error("Gagal memuat data akun");
        }
      });

      setDate(format(new Date(), "yyyy-MM-dd"));
      setDescription("");
      setReference("");
      setNotes("");
      setLines([
        { id: nextLineId(), accountId: "", description: "", debit: "", credit: "" },
        { id: nextLineId(), accountId: "", description: "", debit: "", credit: "" },
      ]);
    }
  }, [open, selectedBranchId]);

  const updateLine = (id: string, field: keyof JournalFormLine, value: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        if (field === "debit" && parseFloat(value) > 0) {
          updated.credit = "";
        }
        if (field === "credit" && parseFloat(value) > 0) {
          updated.debit = "";
        }
        return updated;
      })
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: nextLineId(), accountId: "", description: "", debit: "", credit: "" },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) {
      toast.error("Minimal 2 baris jurnal");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const difference = totalDebit - totalCredit;
  const isBalanced = Math.abs(difference) < 0.01;

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const clearError = (key: string) => {
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = (postImmediately: boolean) => {
    const errors: Record<string, string> = {};

    if (!date) {
      errors.date = "Tanggal wajib diisi";
    }

    if (!description.trim()) {
      errors.description = "Deskripsi jurnal wajib diisi";
    }

    const validLines = lines.filter(
      (l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)
    );
    if (validLines.length < 2) {
      errors.lines = "Minimal 2 baris jurnal dengan akun dan nominal";
    }

    if (postImmediately && !isBalanced) {
      errors.balance = "Debit dan kredit harus seimbang untuk posting";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});

    startSaving(async () => {
      try {
        await accountingService.createJournalEntry({
          date,
          description: description.trim(),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
          lines: validLines.map((l) => ({
            accountId: l.accountId,
            description: l.description.trim(),
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          })),
        });
        toast.success(
          postImmediately ? "Jurnal berhasil diposting" : "Draft jurnal disimpan"
        );
        onClose(true);
      } catch {
        toast.error("Gagal menyimpan jurnal");
      }
    });
  };

  return {
    date,
    setDate,
    description,
    setDescription,
    reference,
    setReference,
    notes,
    setNotes,
    lines,
    accounts,
    saving,
    totalDebit,
    totalCredit,
    difference,
    isBalanced,
    updateLine,
    addLine,
    removeLine,
    handleSave,
    validationErrors,
    clearError,
  };
}
