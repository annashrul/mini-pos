"use client";

import { useState, useTransition } from "react";
import { getGiftCardByCode } from "@/server/actions/gift-cards";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreditCard, Search, Loader2 } from "lucide-react";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  USED: "bg-slate-100 text-slate-600 border border-slate-200",
  EXPIRED: "bg-amber-50 text-amber-700 border border-amber-200",
  DISABLED: "bg-red-50 text-red-600 border border-red-200",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Aktif",
  USED: "Habis",
  EXPIRED: "Expired",
  DISABLED: "Nonaktif",
};

interface CheckBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CardResult {
  code: string;
  currentBalance: number;
  initialBalance: number;
  status: string;
  expiresAt: string | Date | null;
  customer: { id: string; name: string; phone: string | null } | null;
}

export function CheckBalanceDialog({
  open,
  onOpenChange,
}: CheckBalanceDialogProps) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CardResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const resetState = () => {
    setCode("");
    setResult(null);
    setError("");
  };

  const handleCheck = () => {
    if (!code.trim()) return;

    startTransition(async () => {
      setError("");
      setResult(null);
      const res = await getGiftCardByCode(code.trim().toUpperCase());
      if (res.error) {
        setError(res.error);
      } else if (res.giftCard) {
        setResult(res.giftCard as unknown as CardResult);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-sm overflow-hidden p-0 gap-0">
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 rounded-t-2xl" />
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <DialogTitle className="flex items-center gap-3 text-base sm:text-lg">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md shadow-blue-500/25">
              <Search className="w-4 h-4 text-white" />
            </div>
            <span>Cek Saldo Gift Card</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Kode Gift Card</Label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="GIFT-XXXX-XXXX-XXXX"
                className="rounded-xl font-mono tracking-wide"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCheck();
                }}
              />
              <Button
                onClick={handleCheck}
                disabled={isPending || !code.trim()}
                className="rounded-xl"
                size="icon"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          {result && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-5 text-white shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-white/80" />
                    <span className="text-xs text-white/70 uppercase tracking-wider font-medium">
                      Gift Card
                    </span>
                  </div>
                  <Badge
                    className={`${statusColors[result.status] || ""} rounded-full px-2 py-0.5 text-[10px] font-medium`}
                  >
                    {statusLabels[result.status] || result.status}
                  </Badge>
                </div>

                <p className="font-mono text-sm tracking-[0.15em] text-white/80 mb-3">
                  {result.code}
                </p>

                <div className="mb-2">
                  <p className="text-xs text-white/60">Saldo</p>
                  <p className="text-3xl font-bold">
                    {formatCurrency(result.currentBalance)}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>
                    Nominal awal: {formatCurrency(result.initialBalance)}
                  </span>
                  {result.expiresAt && (
                    <span>
                      Exp:{" "}
                      {new Intl.DateTimeFormat("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(result.expiresAt))}
                    </span>
                  )}
                </div>

                {result.customer && (
                  <p className="text-xs text-white/50 mt-2">
                    {result.customer.name}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
