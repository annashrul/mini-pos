"use client";

import { useState, useTransition } from "react";
import {
  ArrowRight,
  ChefHat,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Star,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  advanceOrderStatus,
  cancelOrder,
  updateOrderItemStatus,
} from "@/server/actions/order-queue";

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  notes: string | null;
  status: string;
}

interface Order {
  id: string;
  queueNumber: number;
  status: string;
  priority: number;
  notes: string | null;
  items: OrderItem[];
  createdAt: string | Date;
  servedAt: string | Date | null;
  transaction?: { invoiceNumber: string; customer?: { name: string } | null } | null;
  branch?: { id: string; name: string } | null;
}

interface OrderCardProps {
  order: Order;
  darkMode?: boolean;
  onRefresh: () => void;
  onSpeak?: ((text: string) => void) | undefined;
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    nextLabel: string;
    headerBg: string;
    headerBgDark: string;
    glow: string;
    icon: typeof ChefHat;
    borderColor: string;
    tintLight: string;
    tintDark: string;
    queueColor: string;
    queueColorDark: string;
    btnGradient: string;
  }
> = {
  NEW: {
    label: "Baru",
    nextLabel: "Mulai Proses",
    headerBg: "bg-red-500",
    headerBgDark: "bg-red-600",
    glow: "",
    icon: Clock,
    borderColor: "border-l-red-500",
    tintLight: "bg-red-500/5",
    tintDark: "bg-red-500/10",
    queueColor: "text-red-500",
    queueColorDark: "text-red-400",
    btnGradient: "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-500/25",
  },
  PREPARING: {
    label: "Diproses",
    nextLabel: "Siap Antar",
    headerBg: "bg-amber-500",
    headerBgDark: "bg-amber-600",
    glow: "",
    icon: ChefHat,
    borderColor: "border-l-amber-500",
    tintLight: "bg-amber-500/5",
    tintDark: "bg-amber-500/10",
    queueColor: "text-amber-500",
    queueColorDark: "text-amber-400",
    btnGradient: "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-emerald-500/25",
  },
  READY: {
    label: "Siap",
    nextLabel: "Sudah Diantar",
    headerBg: "bg-emerald-500",
    headerBgDark: "bg-emerald-600",
    glow: "",
    icon: CheckCircle2,
    borderColor: "border-l-emerald-500",
    tintLight: "bg-emerald-500/5",
    tintDark: "bg-emerald-500/10",
    queueColor: "text-emerald-500",
    queueColorDark: "text-emerald-400",
    btnGradient: "bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-gray-500/25",
  },
  SERVED: {
    label: "Selesai",
    nextLabel: "",
    headerBg: "bg-gray-500",
    headerBgDark: "bg-gray-600",
    glow: "",
    icon: CheckCircle2,
    borderColor: "border-l-gray-400",
    tintLight: "bg-white",
    tintDark: "bg-gray-800/80",
    queueColor: "text-gray-400",
    queueColorDark: "text-gray-500",
    btnGradient: "",
  },
  CANCELLED: {
    label: "Dibatalkan",
    nextLabel: "",
    headerBg: "bg-rose-800",
    headerBgDark: "bg-rose-900",
    glow: "",
    icon: XCircle,
    borderColor: "border-l-rose-800",
    tintLight: "bg-rose-500/5",
    tintDark: "bg-rose-500/10",
    queueColor: "text-rose-800",
    queueColorDark: "text-rose-400",
    btnGradient: "",
  },
};

function formatElapsedTime(createdAt: string | Date): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}j ${remainMins}m`;
}

function isOverdue(createdAt: string | Date): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  return now.getTime() - created.getTime() > 15 * 60000; // 15 minutes
}

export function OrderCard({ order, darkMode, onRefresh, onSpeak }: OrderCardProps) {
  const [isPending, startTransition] = useTransition();
  const [cancelPending, setCancelPending] = useState(false);

  const config = (STATUS_CONFIG[order.status] ?? STATUS_CONFIG.NEW)!;
  const overdue = isOverdue(order.createdAt) && order.status !== "SERVED" && order.status !== "CANCELLED";
  const canAdvance = order.status !== "SERVED" && order.status !== "CANCELLED";
  const canCancel = order.status !== "SERVED" && order.status !== "CANCELLED";
  const isCancelled = order.status === "CANCELLED";

  // Get customer name from order notes ("Atas nama: X") or registered customer
  const notesName = order.notes?.replace(/^Atas nama:\s*/i, "").trim();
  const customerLabel = notesName || order.transaction?.customer?.name;
  const queueLabel = customerLabel
    ? `pesanan atas nama ${customerLabel}`
    : `nomor antrian ${order.queueNumber}`;

  const NEXT_STATUS_SPEECH: Record<string, string> = {
    NEW: `${queueLabel} sedang diproses`,
    PREPARING: `${queueLabel} siap diantar`,
    READY: `${queueLabel} sudah diantar`,
  };

  function handleAdvance() {
    const speechText = NEXT_STATUS_SPEECH[order.status];
    if (speechText && onSpeak) onSpeak(speechText);

    startTransition(async () => {
      try {
        await advanceOrderStatus(order.id);
        toast.success(`Order #${String(order.queueNumber).padStart(3, "0")} diperbarui`);
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memperbarui order");
      }
    });
  }

  function handleCancel() {
    if (onSpeak) onSpeak(`${queueLabel} dibatalkan`);
    setCancelPending(true);
    startTransition(async () => {
      try {
        await cancelOrder(order.id);
        toast.success(`Order #${String(order.queueNumber).padStart(3, "0")} dibatalkan`);
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal membatalkan order");
      } finally {
        setCancelPending(false);
      }
    });
  }

  function handleItemToggle(item: OrderItem) {
    const nextStatus = item.status === "DONE" ? "PREPARING" : "DONE";
    startTransition(async () => {
      try {
        await updateOrderItemStatus(item.id, nextStatus);
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memperbarui item");
      }
    });
  }

  return (
    <div
      className={[
        "rounded-2xl border-l-4 overflow-hidden transition-all",
        config.borderColor,
        darkMode ? config.tintDark : config.tintLight,
        darkMode ? "bg-gray-800/80" : "bg-white",
        darkMode ? "border border-l-4 border-gray-700/50" : "border border-l-4 border-gray-200/80",
        overdue ? "ring-2 ring-red-500/50" : "",
        isCancelled ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* ── Header row ── */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
        {/* Left: queue number + VIP */}
        <div className="flex items-center gap-2">
          <span
            className={`text-3xl font-black tracking-tight leading-none ${
              darkMode ? config.queueColorDark : config.queueColor
            }`}
          >
            #{String(order.queueNumber).padStart(3, "0")}
          </span>
          {order.priority > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/20 px-2 py-0.5 text-xs font-bold text-yellow-600 dark:text-yellow-400">
              <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
              VIP
            </span>
          )}
        </div>

        {/* Right: elapsed time */}
        <div
          className={[
            "flex items-center gap-1.5 rounded-lg px-2 py-1",
            overdue
              ? "bg-red-500/10 animate-pulse"
              : darkMode
              ? "bg-gray-700/50"
              : "bg-gray-100",
          ].join(" ")}
        >
          <Clock
            className={`h-3.5 w-3.5 ${
              overdue ? "text-red-500" : darkMode ? "text-gray-400" : "text-gray-500"
            }`}
          />
          <span
            className={`text-sm font-mono tabular-nums font-semibold ${
              overdue ? "text-red-500" : darkMode ? "text-gray-300" : "text-gray-600"
            }`}
          >
            {formatElapsedTime(order.createdAt)}
          </span>
          {overdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
        </div>
      </div>

      {/* Invoice number */}
      {order.transaction?.invoiceNumber && (
        <div className="px-4 pb-2">
          <span
            className={`text-xs font-mono tracking-wide ${
              darkMode ? "text-gray-500" : "text-gray-400"
            }`}
          >
            {order.transaction.invoiceNumber}
          </span>
        </div>
      )}

      {/* ── Divider ── */}
      <div className={`mx-4 border-t ${darkMode ? "border-gray-700/60" : "border-gray-200/80"}`} />

      {/* ── Items ── */}
      <div className="px-4 py-3">
        <div className="space-y-0">
          {order.items.map((item, idx) => {
            const isDone = item.status === "DONE";
            return (
              <div key={item.id}>
                {idx > 0 && (
                  <div
                    className={`my-2 border-t border-dashed ${
                      darkMode ? "border-gray-700/40" : "border-gray-200/60"
                    }`}
                  />
                )}
                <div className="flex items-start gap-3 py-1">
                  {/* Checkbox or dot indicator */}
                  {order.status === "PREPARING" ? (
                    <Checkbox
                      checked={isDone}
                      onCheckedChange={() => handleItemToggle(item)}
                      disabled={isPending}
                      className={`mt-0.5 h-6 w-6 rounded-lg border-2 shrink-0 transition-colors ${
                        isDone
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : darkMode
                          ? "border-gray-500"
                          : "border-gray-300"
                      }`}
                    />
                  ) : (
                    <div
                      className={`mt-2 h-2.5 w-2.5 rounded-full shrink-0 ${
                        isDone
                          ? "bg-emerald-500"
                          : item.status === "PREPARING"
                          ? "bg-amber-500"
                          : darkMode
                          ? "bg-gray-600"
                          : "bg-gray-300"
                      }`}
                    />
                  )}

                  {/* Item content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-base font-semibold truncate ${
                          isDone
                            ? "line-through opacity-40"
                            : isCancelled
                            ? "line-through opacity-50"
                            : darkMode
                            ? "text-white"
                            : "text-gray-900"
                        }`}
                      >
                        {item.productName}
                      </span>
                      <span
                        className={`text-lg font-bold tabular-nums shrink-0 ${
                          isDone
                            ? "line-through opacity-40"
                            : darkMode
                            ? "text-gray-300"
                            : "text-gray-700"
                        }`}
                      >
                        x{item.quantity}
                      </span>
                    </div>
                    {item.notes && (
                      <p
                        className={`text-xs mt-1 italic ${
                          darkMode ? "text-amber-400/80" : "text-amber-600/80"
                        }`}
                      >
                        Catatan: {item.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Order Notes ── */}
      {order.notes && (
        <>
          <div className={`mx-4 border-t ${darkMode ? "border-gray-700/60" : "border-gray-200/80"}`} />
          <div className="px-4 py-3">
            <div
              className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 ${
                darkMode
                  ? "bg-amber-500/10 text-amber-300"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed">{order.notes}</p>
            </div>
          </div>
        </>
      )}

      {/* ── Actions ── */}
      {(canAdvance || canCancel) && (
        <>
          <div className={`mx-4 border-t ${darkMode ? "border-gray-700/60" : "border-gray-200/80"}`} />
          <div className="px-4 py-3 flex gap-2">
            {canAdvance && (
              <Button
                onClick={handleAdvance}
                disabled={isPending}
                className={`flex-1 h-11 text-base font-bold rounded-xl transition-all shadow-md ${config.btnGradient}`}
              >
                {isPending ? (
                  <span className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <>
                    {config.nextLabel}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            )}
            {canCancel && (
              <Button
                onClick={handleCancel}
                disabled={isPending || cancelPending}
                variant="outline"
                size="icon"
                className={`h-11 w-11 rounded-xl shrink-0 transition-colors ${
                  darkMode
                    ? "border-gray-600 text-gray-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50"
                    : "border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-300"
                }`}
              >
                <XCircle className="h-5 w-5" />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
