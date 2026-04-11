"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Building2, Crown, LogIn, UserPlus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getPlatformNotifications } from "@/server/actions/platform-notifications";
import { useRealtimeEvents } from "@/hooks/use-socket";

type Notification = Awaited<ReturnType<typeof getPlatformNotifications>>["notifications"][number];

const actionConfig: Record<string, { icon: typeof Bell; label: string; color: string }> = {
  LOGIN: { icon: LogIn, label: "Login", color: "bg-blue-100 text-blue-600" },
  CREATE: { icon: Building2, label: "Dibuat", color: "bg-emerald-100 text-emerald-600" },
  UPDATE_PLAN: { icon: Crown, label: "Upgrade", color: "bg-amber-100 text-amber-600" },
  EXTEND_PLAN: { icon: Crown, label: "Perpanjang", color: "bg-amber-100 text-amber-600" },
  REVOKE_PLAN: { icon: RotateCcw, label: "Downgrade", color: "bg-red-100 text-red-600" },
  REGISTER: { icon: UserPlus, label: "Register", color: "bg-purple-100 text-purple-600" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}j lalu`;
  return `${Math.floor(hours / 24)}h lalu`;
}

function getNotifMessage(n: Notification): string {
  if (n.entity === "Session" && n.action === "LOGIN") {
    return `${n.userName} login dari ${n.companyName}`;
  }
  if (n.entity === "Subscription") {
    const detail = n.details ? JSON.parse(n.details) : {};
    if (n.action === "UPDATE_PLAN") return `${detail.companyName || n.companyName} upgrade ke ${detail.plan}`;
    if (n.action === "EXTEND_PLAN") return `${detail.companyName || n.companyName} perpanjang plan`;
    if (n.action === "REVOKE_PLAN") return `${detail.companyName || n.companyName} downgrade ke FREE`;
  }
  if (n.entity === "Company" && n.action === "CREATE") {
    return `Perusahaan baru: ${n.companyName}`;
  }
  if (n.entity === "User" && n.action === "CREATE") {
    return `User baru: ${n.userName} (${n.companyName})`;
  }
  return `${n.action} ${n.entity} oleh ${n.userName}`;
}

export function PlatformNotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { on } = useRealtimeEvents();

  const refresh = useCallback(() => {
    getPlatformNotifications()
      .then((r) => { setNotifications(r.notifications); setUnreadCount(r.unreadCount); })
      .catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime refresh
  useEffect(() => {
    const unsub1 = on("subscription:updated", refresh);
    const unsub2 = on("company:registered", refresh);
    return () => { unsub1(); unsub2(); };
  }, [on, refresh]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 rounded-2xl p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between">
          <h4 className="font-semibold text-sm">Notifikasi Platform</h4>
          {unreadCount > 0 && (
            <Badge className="bg-red-100 text-red-700 text-[10px] px-2 py-0 rounded-full">{unreadCount} baru</Badge>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Tidak ada notifikasi
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {notifications.map((n) => {
                const config = actionConfig[n.action] || { icon: Bell, label: n.action, color: "bg-slate-100 text-slate-600" };
                const Icon = config.icon;
                return (
                  <div key={n.id} className="flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{getNotifMessage(n)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
