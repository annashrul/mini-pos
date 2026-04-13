"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ChefHat,
  Moon,
  Sun,
  RefreshCcw,
  Volume2,
  VolumeX,
  RotateCcw,
  Bell,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getOrderQueue, getQueueStats, resetDailyQueue, updateOrderStatus } from "@/server/actions/order-queue";
import { useMenuActionAccess } from "@/features/access-control";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { useKitchenRealtime } from "@/hooks/use-kitchen-socket";
import { useBranch } from "@/components/providers/branch-provider";
import { OrderCard } from "./order-card";
import { QueueStatsBar } from "./queue-stats-bar";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

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

type GroupedOrders = Record<string, Order[]>;

interface QueueStats {
  totalToday: number;
  inQueue: number;
  preparing: number;
  ready: number;
  served: number;
  cancelled: number;
  avgPrepTime: number;
}

const COLUMNS = [
  {
    key: "NEW",
    label: "Antrian Baru",
    icon: Bell,
    gradient: "bg-gradient-to-r from-red-500 to-rose-600",
    emptyText: "Tidak ada order baru",
    emptyIcon: "text-red-300 dark:text-red-800",
  },
  {
    key: "PREPARING",
    label: "Sedang Diproses",
    icon: ChefHat,
    gradient: "bg-gradient-to-r from-amber-500 to-orange-600",
    emptyText: "Tidak ada order diproses",
    emptyIcon: "text-amber-300 dark:text-amber-800",
  },
  {
    key: "READY",
    label: "Siap Antar",
    icon: CheckCircle2,
    gradient: "bg-gradient-to-r from-emerald-500 to-teal-600",
    emptyText: "Tidak ada order siap",
    emptyIcon: "text-emerald-300 dark:text-emerald-800",
  },
  {
    key: "SERVED",
    label: "Selesai",
    icon: Clock,
    gradient: "bg-gradient-to-r from-gray-500 to-gray-600",
    emptyText: "Belum ada order selesai",
    emptyIcon: "text-gray-300 dark:text-gray-700",
  },
] as const;

const VALID_TRANSITIONS: Record<string, string> = {
  NEW: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
};

function DroppableColumn({
  id,
  darkMode,
  children,
}: {
  id: string;
  darkMode: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl overflow-hidden shadow-lg transition-all duration-300 ${
        darkMode
          ? "bg-gray-900/80 border border-gray-800/80 shadow-black/20"
          : "bg-white border border-gray-200 shadow-gray-200/60"
      } ${isOver ? "ring-2 ring-white/30 scale-[1.01]" : ""}`}
    >
      {children}
    </div>
  );
}

function DraggableOrderCard({
  order,
  darkMode,
  onRefresh,
  onSpeak,
  canUpdateStatus,
}: {
  order: Order;
  darkMode: boolean;
  onRefresh: () => void;
  onSpeak?: (text: string) => void;
  canUpdateStatus?: boolean;
}) {
  const isDraggable = order.status !== "SERVED" && order.status !== "CANCELLED";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { status: order.status, order },
    disabled: !isDraggable,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${isDragging ? "opacity-30" : ""} ${isDraggable ? "touch-none cursor-grab" : ""}`}
    >
      <OrderCard order={order} darkMode={darkMode} onRefresh={onRefresh} onSpeak={onSpeak} canUpdateStatus={canUpdateStatus} />
    </div>
  );
}

const FALLBACK_POLL_INTERVAL = 30_000; // 30s fallback poll (realtime handles instant updates)

export function KitchenDisplayContent() {
  const [orders, setOrders] = useState<GroupedOrders>({
    NEW: [],
    PREPARING: [],
    READY: [],
    SERVED: [],
    CANCELLED: [],
  });
  const [stats, setStats] = useState<QueueStats>({
    totalToday: 0,
    inQueue: 0,
    preparing: 0,
    ready: 0,
    served: 0,
    cancelled: 0,
    avgPrepTime: 0,
  });
  const [darkMode, setDarkMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  soundEnabledRef.current = soundEnabled;
  const [isPending, startTransition] = useTransition();
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>({});
  const { canAction } = useMenuActionAccess("kitchen-display");
  const { canAction: canPlan } = usePlanAccess();
  const canUpdateStatus = canAction("update_status") && canPlan("kitchen-display", "update_status");
  const canReset = canAction("reset") && canPlan("kitchen-display", "reset");
  const prevNewCountRef = useRef(-1); // -1 = first load, skip sound
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioInitRef = useRef(false);

  // Pre-initialize audio on first user interaction (required by browsers)
  useEffect(() => {
    function initAudio() {
      if (audioInitRef.current) return;
      audioInitRef.current = true;
      // Pre-load notification beep
      const audio = new Audio("/sounds/notification.wav");
      audio.volume = 0.7;
      audio.load();
      audioRef.current = audio;
      // Warm up speech synthesis
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const warmup = new SpeechSynthesisUtterance("");
        warmup.volume = 0;
        window.speechSynthesis.speak(warmup);
      }
    }
    document.addEventListener("click", initAudio, { once: true });
    document.addEventListener("touchstart", initAudio, { once: true });
    return () => {
      document.removeEventListener("click", initAudio);
      document.removeEventListener("touchstart", initAudio);
    };
  }, []);

  // DnD state
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const order = event.active.data.current?.order as Order;
    setActiveOrder(order);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveOrder(null);
    const { active, over } = event;
    if (!over) return;

    const fromStatus = active.data.current?.status as string;
    const toStatus = over.id as string;
    if (fromStatus === toStatus) return;

    if (!canUpdateStatus) {
      toast.error("Anda tidak memiliki izin untuk mengubah status order");
      return;
    }

    if (VALID_TRANSITIONS[fromStatus] !== toStatus) {
      toast.error("Hanya bisa pindah ke status berikutnya");
      return;
    }

    const orderId = active.id as string;
    const draggedOrder = active.data.current?.order as Order;

    // Optimistic update: move card immediately without waiting for API
    setOrders((prev) => {
      const updated = { ...prev };
      updated[fromStatus] = (updated[fromStatus] ?? []).filter((o) => o.id !== orderId);
      updated[toStatus] = [{ ...draggedOrder, status: toStatus }, ...(updated[toStatus] ?? [])];
      return updated;
    });

    // Update stats optimistically
    setStats((prev) => {
      const statusToStatKey: Record<string, keyof QueueStats> = {
        NEW: "inQueue", PREPARING: "preparing", READY: "ready", SERVED: "served",
      };
      const fromKey = statusToStatKey[fromStatus];
      const toKey = statusToStatKey[toStatus];
      const next = { ...prev };
      if (fromKey && typeof next[fromKey] === "number") (next[fromKey] as number) -= 1;
      if (toKey && typeof next[toKey] === "number") (next[toKey] as number) += 1;
      return next;
    });

    // Announce status change with speech
    // Get customer name from order notes ("Atas nama: X") or registered customer
    const notesName = draggedOrder.notes?.replace(/^Atas nama:\s*/i, "").trim();
    const customerLabel = notesName || draggedOrder.transaction?.customer?.name;
    const queueLabel = customerLabel
      ? `pesanan atas nama ${customerLabel}`
      : `nomor antrian ${draggedOrder.queueNumber}`;
    const STATUS_SPEECH: Record<string, string> = {
      PREPARING: `${queueLabel} sedang diproses`,
      READY: `${queueLabel} siap diantar`,
      SERVED: `${queueLabel} sudah diantar`,
    };
    const speechText = STATUS_SPEECH[toStatus];
    if (speechText) speak(speechText);

    // Fire API in background — don't block UI
    updateOrderStatus(orderId, toStatus)
      .then(() => {
        toast.success(`Order #${String(draggedOrder.queueNumber).padStart(3, "0")} → ${toStatus}`);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Gagal memperbarui status");
        // Revert on error by re-fetching
        fetchData();
      });
  }

  // Text-to-speech with strict single-play guarantee
  const speakingRef = useRef(false);
  const speak = useCallback((text: string) => {
    if (!soundEnabledRef.current) return;
    if (speakingRef.current) return; // Already speaking — block

    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) {
      // Fallback beep
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); }
      return;
    }

    speakingRef.current = true;
    synth.cancel(); // Clear any queued utterances

    // Small delay after cancel to avoid browser bugs
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;
      const voices = synth.getVoices();
      const idVoice = voices.find((v) => v.lang.startsWith("id")) || voices.find((v) => v.lang.startsWith("ms"));
      if (idVoice) utterance.voice = idVoice;

      // Unlock after speech ends (or after 10s timeout as safety)
      const unlock = () => { speakingRef.current = false; };
      utterance.onend = unlock;
      utterance.onerror = unlock;
      setTimeout(unlock, 10000); // Safety timeout

      synth.speak(utterance);
    }, 100);
  }, []);

  // Atomic lock + cooldown: 1 fetch at a time, 3s cooldown after completion
  const fetchingRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const speakRef = useRef(speak);
  speakRef.current = speak;

  const fetchData = useCallback(async () => {
    const now = Date.now();
    if (fetchingRef.current || now < cooldownUntilRef.current) return;
    fetchingRef.current = true;

    try {
      const [queueData, statsData] = await Promise.all([
        getOrderQueue(),
        getQueueStats(),
      ]);
      setOrders(queueData as unknown as GroupedOrders);
      setStats({
        totalToday: statsData.totalToday ?? 0,
        inQueue: statsData.inQueue ?? 0,
        preparing: statsData.preparing ?? 0,
        ready: statsData.ready ?? 0,
        served: statsData.served ?? 0,
        cancelled: statsData.cancelled ?? 0,
        avgPrepTime: statsData.avgPrepTime ?? 0,
      });

      // Sound notification — only when NEW count increases
      const newCount = (queueData as unknown as GroupedOrders).NEW?.length ?? 0;
      if (prevNewCountRef.current >= 0 && newCount > prevNewCountRef.current) {
        speakRef.current("Ada antrian baru");
      }
      prevNewCountRef.current = newCount;
    } catch {
      // Silently fail
    } finally {
      fetchingRef.current = false;
      cooldownUntilRef.current = Date.now() + 3000; // 3s cooldown
    }
  }, []); // Stable — no deps, uses refs

  const { selectedBranchId } = useBranch();

  // Realtime: instant refresh on order events via SSE
  useKitchenRealtime(fetchData, selectedBranchId || undefined);

  // Fallback polling: slower interval as safety net
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, FALLBACK_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Current time display
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  function handleReset() {
    if (!canReset) { toast.error("Anda tidak memiliki izin untuk aksi ini"); return; }
    if (!confirm("Reset semua antrian hari ini? Order aktif akan dibatalkan.")) return;
    startTransition(async () => {
      try {
        const result = await resetDailyQueue();
        toast.success(`${result.cancelledCount} order dibatalkan`);
        fetchData();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal reset antrian");
      }
    });
  }

  function toggleCollapse(key: string) {
    setCollapsedCols((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div
      className={`-mt-6 -mx-4 lg:-mx-6 min-h-screen flex flex-col transition-all duration-300 ${
        darkMode ? "bg-gray-950 text-white" : "bg-gray-100 text-gray-900"
      }`}
    >
      {/* ===== TOP BAR ===== */}
      <header
        className={`sticky top-0 z-50 border-b transition-all duration-300 ${
          darkMode
            ? "bg-gray-900/95 border-gray-800 backdrop-blur-md"
            : "bg-white/95 border-gray-200 backdrop-blur-md"
        }`}
      >
        <div className="px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4 mb-3">
            {/* Left: Icon + Title + Live indicator */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="relative h-10 w-10 sm:h-13 sm:w-13 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
                <ChefHat className="h-5 w-5 sm:h-7 sm:w-7 text-white drop-shadow-sm" />
              </div>
              <div>
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <h1 className="text-base sm:text-2xl font-black tracking-tight">Kitchen Display</h1>
                  {/* LIVE indicator */}
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                      Live
                    </span>
                  </span>
                </div>
                <p
                  className={`text-xs sm:text-sm font-mono tabular-nums mt-0.5 hidden sm:block ${
                    darkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {time.toLocaleDateString("id-ID", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}{" "}
                  &bull;{" "}
                  {time.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`h-9 w-9 sm:h-11 sm:w-11 rounded-xl transition-all duration-300 ${
                  darkMode
                    ? "border-gray-700 bg-gray-800/80 text-gray-300 hover:bg-gray-700 hover:text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                } ${soundEnabled ? "" : "opacity-60"}`}
                title={soundEnabled ? "Matikan suara" : "Nyalakan suara"}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDarkMode(!darkMode)}
                className={`h-9 w-9 sm:h-11 sm:w-11 rounded-xl transition-all duration-300 ${
                  darkMode
                    ? "border-gray-700 bg-gray-800/80 text-gray-300 hover:bg-gray-700 hover:text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
                title={darkMode ? "Mode terang" : "Mode gelap"}
              >
                {darkMode ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchData}
                disabled={isPending}
                className={`h-9 w-9 sm:h-11 sm:w-11 rounded-xl transition-all duration-300 ${
                  darkMode
                    ? "border-gray-700 bg-gray-800/80 text-gray-300 hover:bg-gray-700 hover:text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
                title="Refresh"
              >
                <RefreshCcw className={`h-4 w-4 sm:h-5 sm:w-5 ${isPending ? "animate-spin" : ""}`} />
              </Button>
              <DisabledActionTooltip disabled={!canReset} message="Anda tidak memiliki izin untuk aksi ini" menuKey="kitchen-display" actionKey="reset">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={!canReset || isPending}
                  className={`h-9 sm:h-11 rounded-xl gap-1 sm:gap-2 transition-all duration-300 text-xs sm:text-sm ${
                    darkMode
                      ? "border-gray-700 bg-gray-800/80 text-gray-300 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/50"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                  }`}
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="hidden sm:inline font-semibold">Reset</span>
                </Button>
              </DisabledActionTooltip>
            </div>
          </div>

          {/* Stats Bar */}
          <QueueStatsBar stats={stats} darkMode={darkMode} />
        </div>
      </header>

      {/* ===== KANBAN BOARD ===== */}
      <main className="flex-1 p-4 lg:p-6 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5 h-full">
            {COLUMNS.map((col) => {
              const columnOrders = orders[col.key] ?? [];
              const ColIcon = col.icon;
              const isCollapsed = collapsedCols[col.key] ?? false;

              return (
                <DroppableColumn key={col.key} id={col.key} darkMode={darkMode}>
                  {/* Column Header */}
                  <div
                    className={`${col.gradient} px-4 py-3.5 flex items-center justify-between cursor-pointer md:cursor-default`}
                    onClick={() => {
                      // Only collapsible on mobile
                      if (window.innerWidth < 768) toggleCollapse(col.key);
                    }}
                  >
                    <div className="flex items-center gap-2.5 text-white">
                      <ColIcon className="h-5 w-5 drop-shadow-sm" />
                      <span className="text-lg font-bold tracking-tight drop-shadow-sm">
                        {col.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-white/20 backdrop-blur-sm text-white text-sm font-bold px-3 py-1 rounded-full min-w-[2rem] text-center">
                        {columnOrders.length}
                      </span>
                      {/* Mobile collapse indicator */}
                      <span className="md:hidden text-white/70">
                        {isCollapsed ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronUp className="h-4 w-4" />
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Column Content */}
                  <div
                    className={`flex-1 overflow-y-auto min-h-0 transition-all duration-300 ${
                      isCollapsed ? "max-h-0 md:max-h-none" : "max-h-[70vh] md:max-h-none"
                    }`}
                  >
                    <div className="p-3 space-y-3">
                      {columnOrders.length === 0 ? (
                        <div
                          className={`flex flex-col items-center justify-center py-16 ${
                            darkMode ? "text-gray-600" : "text-gray-400"
                          }`}
                        >
                          <ColIcon className="h-16 w-16 mb-4 opacity-[0.15]" />
                          <p className="text-xs font-medium uppercase tracking-wider opacity-60">
                            {col.emptyText}
                          </p>
                        </div>
                      ) : (
                        columnOrders.map((order, idx) => (
                          <div key={order.id}>
                            <DraggableOrderCard
                              order={order}
                              darkMode={darkMode}
                              onRefresh={fetchData}
                              onSpeak={speak}
                              canUpdateStatus={canUpdateStatus}
                            />
                            {/* Subtle divider between cards */}
                            {idx < columnOrders.length - 1 && (
                              <div
                                className={`mt-3 border-t ${
                                  darkMode ? "border-gray-800/50" : "border-gray-100"
                                }`}
                              />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </DroppableColumn>
              );
            })}
          </div>

          <DragOverlay>
            {activeOrder && (
              <div className="opacity-90 scale-105 rotate-2">
                <OrderCard order={activeOrder} darkMode={darkMode} onRefresh={() => {}} canUpdateStatus={canUpdateStatus} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
