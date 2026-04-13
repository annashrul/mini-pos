"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import {
  CreditCard,
  Plus,
  Ban,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  ShoppingCart,
  Clock,
  User,
  MapPin,
  Calendar,
} from "lucide-react";

interface GiftCardDetailData {
  id: string;
  code: string;
  initialBalance: number;
  currentBalance: number;
  status: string;
  purchasedBy: string | null;
  customer: { id: string; name: string; phone: string | null } | null;
  branch: { id: string; name: string } | null;
  createdByUser: { id: string; name: string } | null;
  expiresAt: string | Date | null;
  createdAt: string | Date;
  transactions: {
    id: string;
    type: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    reference: string | null;
    createdAt: string | Date;
  }[];
}

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

const txTypeIcons: Record<string, typeof ArrowDownCircle> = {
  PURCHASE: ShoppingCart,
  REDEEM: ArrowDownCircle,
  TOPUP: ArrowUpCircle,
  REFUND: RefreshCw,
};

const txTypeColors: Record<string, string> = {
  PURCHASE: "text-emerald-600 bg-emerald-50",
  REDEEM: "text-red-600 bg-red-50",
  TOPUP: "text-blue-600 bg-blue-50",
  REFUND: "text-amber-600 bg-amber-50",
};

const txTypeLabels: Record<string, string> = {
  PURCHASE: "Pembelian",
  REDEEM: "Pemakaian",
  TOPUP: "Top Up",
  REFUND: "Refund",
};

interface GiftCardDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: GiftCardDetailData | null;
  onTopUp: (id: string, amount: number) => Promise<void>;
  onDisable: (id: string, code: string) => void;
  canUpdate: boolean;
  canDisable: boolean;
  cannotMessage: (action: string) => string;
}

export function GiftCardDetailDialog({
  open,
  onOpenChange,
  data,
  onTopUp,
  onDisable,
  canUpdate,
  canDisable,
  cannotMessage,
}: GiftCardDetailDialogProps) {
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");

  if (!data) return null;

  const balancePercent =
    data.initialBalance > 0
      ? Math.round((data.currentBalance / data.initialBalance) * 100)
      : 0;

  const handleTopUp = async () => {
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0) return;
    await onTopUp(data.id, amount);
    setTopUpAmount("");
    setShowTopUp(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setShowTopUp(false);
          setTopUpAmount("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-lg overflow-hidden max-h-[90vh] p-0 gap-0 flex flex-col">
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-t-2xl shrink-0" />
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 shrink-0">
          <DialogTitle className="flex items-center gap-3 text-base sm:text-lg">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/25">
              <CreditCard className="w-4 h-4 text-white" />
            </div>
            <span>Detail Gift Card</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6 space-y-4 sm:space-y-5">
          {/* Visual Card */}
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-4 sm:p-6 text-white shadow-lg">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-white/80" />
                  <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                    Gift Card
                  </span>
                </div>
                <Badge
                  className={`${statusColors[data.status] || ""} rounded-full px-2.5 py-0.5 text-[11px] font-medium`}
                >
                  {statusLabels[data.status] || data.status}
                </Badge>
              </div>
              <p className="font-mono text-lg tracking-[0.2em] text-white/90 mb-4">
                {data.code}
              </p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-white/60 mb-1">Saldo</p>
                  <p className="text-3xl font-bold">
                    {formatCurrency(data.currentBalance)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/60 mb-1">Dari</p>
                  <p className="text-sm font-medium text-white/80">
                    {formatCurrency(data.initialBalance)}
                  </p>
                </div>
              </div>
              {/* Balance bar */}
              <div className="mt-3 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white/70 transition-all"
                  style={{ width: `${balancePercent}%` }}
                />
              </div>
              <p className="text-xs text-white/50 mt-1 text-right">
                {balancePercent}% tersisa
              </p>
            </div>
          </div>

          {/* Card Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {data.customer && (
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{data.customer.name}</p>
                  {data.customer.phone && (
                    <p className="text-xs text-muted-foreground">
                      {data.customer.phone}
                    </p>
                  )}
                </div>
              </div>
            )}
            {data.purchasedBy && (
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Pembeli</p>
                  <p className="font-medium">{data.purchasedBy}</p>
                </div>
              </div>
            )}
            {data.branch && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Cabang</p>
                  <p className="font-medium">{data.branch.name}</p>
                </div>
              </div>
            )}
            {data.expiresAt && (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Kedaluwarsa</p>
                  <p className="font-medium">
                    {new Intl.DateTimeFormat("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(data.expiresAt))}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Dibuat</p>
                <p className="font-medium">
                  {new Intl.DateTimeFormat("id-ID", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }).format(new Date(data.createdAt))}
                </p>
              </div>
            </div>
            {data.createdByUser && (
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Diterbitkan oleh</p>
                  <p className="font-medium">{data.createdByUser.name}</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {data.status === "ACTIVE" && (
            <div className="flex gap-2">
              {showTopUp ? (
                <div className="flex-1 flex gap-2">
                  <Input
                    type="number"
                    placeholder="Nominal top up..."
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="rounded-xl flex-1"
                    autoFocus
                  />
                  <Button
                    onClick={handleTopUp}
                    disabled={!topUpAmount || Number(topUpAmount) <= 0}
                    className="rounded-xl"
                    size="sm"
                  >
                    Top Up
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowTopUp(false);
                      setTopUpAmount("");
                    }}
                    className="rounded-xl"
                    size="sm"
                  >
                    Batal
                  </Button>
                </div>
              ) : (
                <>
                  <DisabledActionTooltip
                    disabled={!canUpdate}
                    message={cannotMessage("update")}
                    menuKey="gift-cards"
                    actionKey="update"
                  >
                    <Button
                      disabled={!canUpdate}
                      variant="outline"
                      className="rounded-xl flex-1"
                      onClick={() => setShowTopUp(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Top Up
                    </Button>
                  </DisabledActionTooltip>
                  <DisabledActionTooltip
                    disabled={!canDisable}
                    message={cannotMessage("disable")}
                    menuKey="gift-cards"
                    actionKey="disable"
                  >
                    <Button
                      disabled={!canDisable}
                      variant="outline"
                      className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={() => onDisable(data.id, data.code)}
                    >
                      <Ban className="w-4 h-4 mr-2" /> Nonaktifkan
                    </Button>
                  </DisabledActionTooltip>
                </>
              )}
            </div>
          )}

          {/* Transaction History */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Riwayat Transaksi
            </h3>
            {data.transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Belum ada transaksi
              </p>
            ) : (
              <div className="space-y-1">
                {data.transactions.map((tx, index) => {
                  const Icon = txTypeIcons[tx.type] || Clock;
                  const colorClass =
                    txTypeColors[tx.type] || "text-gray-600 bg-gray-50";
                  const isDebit = tx.type === "REDEEM";
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      {/* Timeline connector */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        {index < data.transactions.length - 1 && (
                          <div className="w-px h-3 bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            {txTypeLabels[tx.type] || tx.type}
                          </p>
                          <p
                            className={`text-sm font-bold font-mono tabular-nums ${
                              isDebit ? "text-red-600" : "text-emerald-600"
                            }`}
                          >
                            {isDebit ? "-" : "+"}
                            {formatCurrency(tx.amount)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-muted-foreground truncate pr-2">
                            {tx.reference || ""}
                          </p>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            Saldo: {formatCurrency(tx.balanceAfter)}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                          {new Intl.DateTimeFormat("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(tx.createdAt))}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
