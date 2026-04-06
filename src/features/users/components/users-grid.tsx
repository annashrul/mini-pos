"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { Calendar, MapPin, Pencil, ShoppingCart, Trash2, Users } from "lucide-react";
import type { User } from "@/types";

export function UsersGrid(props: {
  users: User[];
  loading: boolean;
  roleColors: Record<string, string>;
  canUpdate: boolean;
  canDelete: boolean;
  cannotMessage: (action: string) => string;
  onEdit: (user: User) => void;
  onDelete: (id: string) => void;
}) {
  const { users, loading, roleColors, canUpdate, canDelete, cannotMessage, onEdit, onDelete } = props;

  if (loading && users.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-white p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border/40">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-border/40 bg-white">
        <Users className="w-10 h-10 text-muted-foreground/30" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">Belum ada user</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Tambah user baru untuk memulai</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${loading ? "opacity-50 pointer-events-none transition-opacity" : ""}`}>
      {users.map((user) => (
        <div key={user.id} className="rounded-xl border border-border/40 bg-white hover:shadow-md transition-all group p-5 relative">
          <div className="absolute top-3 right-3 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
              <Button
                disabled={!canUpdate}
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                onClick={() => onEdit(user)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </DisabledActionTooltip>
            <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
              <Button
                disabled={!canDelete}
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                onClick={() => onDelete(user.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </DisabledActionTooltip>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
              {user.name?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          <div className="mb-3">
            <Badge className={`rounded-full px-3 py-0.5 text-[11px] font-semibold shadow-sm ring-1 ring-inset ring-black/5 ${roleColors[user.role]}`}>
              {user.role}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              {user.branch?.name ?? "-"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              {formatDate(user.createdAt)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShoppingCart className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span className="font-mono tabular-nums text-foreground font-medium">{user._count.transactions}</span>
              <span>transaksi</span>
            </span>
            {user.isActive ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Aktif
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                Nonaktif
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

