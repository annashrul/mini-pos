"use client";

import type { BadgeDefinition } from "@/server/actions/sales-targets-types";
import {
  Crown, ShieldCheck, Rocket, Flame, Zap, Sunrise, Moon, Users, Lock,
} from "lucide-react";

// Map badge keys to icons
const BADGE_ICONS: Record<string, typeof Crown> = {
  TOP_SELLER: Crown,
  ZERO_VOID: ShieldCheck,
  TARGET_CRUSHER: Rocket,
  STREAK_7: Flame,
  SPEED_DEMON: Zap,
  EARLY_BIRD: Sunrise,
  NIGHT_OWL: Moon,
  TEAM_PLAYER: Users,
};

interface BadgeDisplayProps {
  definitions: BadgeDefinition[];
  earned: { badge: string; userId: string; user: { id: string; name: string } }[];
}

export function BadgeDisplay({ definitions, earned }: BadgeDisplayProps) {
  const earnedBadgeKeys = new Set(earned.map((e) => e.badge));

  // Count earners per badge
  const badgeEarnerCounts = new Map<string, number>();
  const badgeEarners = new Map<string, string[]>();
  for (const e of earned) {
    badgeEarnerCounts.set(e.badge, (badgeEarnerCounts.get(e.badge) || 0) + 1);
    if (!badgeEarners.has(e.badge)) badgeEarners.set(e.badge, []);
    const names = badgeEarners.get(e.badge)!;
    if (!names.includes(e.user.name)) names.push(e.user.name);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {definitions.map((def) => {
        const Icon = BADGE_ICONS[def.key] || Crown;
        const isEarned = earnedBadgeKeys.has(def.key);
        const earnerCount = badgeEarnerCounts.get(def.key) || 0;
        const earnerNames = badgeEarners.get(def.key) || [];

        return (
          <div
            key={def.key}
            className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${
              isEarned
                ? "border-amber-200 bg-white shadow-lg shadow-amber-100/50"
                : "border-gray-200 bg-gray-50/50"
            }`}
          >
            {/* Glow effect for earned badges */}
            {isEarned && (
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent pointer-events-none" />
            )}

            <div className="relative">
              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                isEarned
                  ? `bg-gradient-to-br ${def.color} shadow-lg`
                  : "bg-gray-200"
              }`}>
                {isEarned ? (
                  <Icon className="w-7 h-7 text-white" />
                ) : (
                  <Lock className="w-6 h-6 text-gray-400" />
                )}
              </div>

              {/* Title */}
              <h4 className={`font-semibold text-sm ${isEarned ? "text-gray-900" : "text-gray-400"}`}>
                {def.title}
              </h4>

              {/* Description */}
              <p className={`text-xs mt-1 ${isEarned ? "text-gray-500" : "text-gray-300"}`}>
                {def.description}
              </p>

              {/* Earners */}
              {isEarned && earnerCount > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-2">
                      {earnerNames.slice(0, 3).map((name) => (
                        <div
                          key={name}
                          className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[10px] font-bold text-white border-2 border-white"
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">
                      {earnerCount} kasir
                    </span>
                  </div>
                </div>
              )}

              {/* Locked overlay label */}
              {!isEarned && (
                <div className="mt-3">
                  <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wider">Locked</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
