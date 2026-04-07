"use client";

import { ClipboardList, ChefHat, Bell, CheckCircle2, Clock, XCircle } from "lucide-react";

interface QueueStats {
  totalToday: number;
  inQueue: number;
  preparing: number;
  ready: number;
  served: number;
  cancelled: number;
  avgPrepTime: number;
}

interface QueueStatsBarProps {
  stats: QueueStats;
  darkMode?: boolean;
}

export function QueueStatsBar({ stats, darkMode }: QueueStatsBarProps) {
  const items = [
    {
      label: "Hari Ini",
      value: stats.totalToday,
      icon: ClipboardList,
      color: darkMode ? "text-blue-400" : "text-blue-600",
      bg: darkMode ? "bg-blue-500/10" : "bg-blue-50",
      ring: "",
    },
    {
      label: "Antrian",
      value: stats.inQueue,
      icon: Bell,
      color: darkMode ? "text-red-400" : "text-red-600",
      bg: darkMode ? "bg-red-500/10" : "bg-red-50",
      ring: stats.inQueue > 0 ? "ring-1 ring-red-500/30" : "",
    },
    {
      label: "Diproses",
      value: stats.preparing,
      icon: ChefHat,
      color: darkMode ? "text-amber-400" : "text-amber-600",
      bg: darkMode ? "bg-amber-500/10" : "bg-amber-50",
      ring: stats.preparing > 0 ? "ring-1 ring-amber-500/30" : "",
    },
    {
      label: "Siap",
      value: stats.ready,
      icon: CheckCircle2,
      color: darkMode ? "text-emerald-400" : "text-emerald-600",
      bg: darkMode ? "bg-emerald-500/10" : "bg-emerald-50",
      ring: stats.ready > 0 ? "ring-1 ring-emerald-500/30" : "",
    },
    {
      label: "Selesai",
      value: stats.served,
      icon: CheckCircle2,
      color: darkMode ? "text-gray-400" : "text-gray-500",
      bg: darkMode ? "bg-gray-500/10" : "bg-gray-100",
      ring: "",
    },
    {
      label: "Batal",
      value: stats.cancelled,
      icon: XCircle,
      color: darkMode ? "text-rose-400" : "text-rose-500",
      bg: darkMode ? "bg-rose-500/10" : "bg-rose-50",
      ring: "",
    },
    {
      label: "Rata-rata",
      value: `${stats.avgPrepTime}m`,
      icon: Clock,
      color: darkMode ? "text-violet-400" : "text-violet-600",
      bg: darkMode ? "bg-violet-500/10" : "bg-violet-50",
      ring: "",
    },
  ];

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1">
      {items.map((item) => (
        <div
          key={item.label}
          className={`flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 min-w-fit ${item.bg} ${item.ring}`}
        >
          <item.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${item.color} shrink-0`} />
          <div className="flex flex-col">
            <span
              className={`text-sm sm:text-lg font-extrabold font-mono tabular-nums leading-tight ${
                darkMode ? "text-white" : "text-gray-900"
              }`}
            >
              {item.value}
            </span>
            <span
              className={`text-[10px] uppercase tracking-widest font-medium leading-tight ${
                darkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {item.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
