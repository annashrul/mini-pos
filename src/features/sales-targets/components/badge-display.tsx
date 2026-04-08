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
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
      {definitions.map((def) => {
        const Icon = BADGE_ICONS[def.key] || Crown;
        const isEarned = earnedBadgeKeys.has(def.key);
        const earnerCount = badgeEarnerCounts.get(def.key) || 0;
        const earnerNames = badgeEarners.get(def.key) || [];

        return (
          <div
            key={def.key}
            className={`relative overflow-hidden rounded-xl sm:rounded-2xl border p-3 sm:p-5 transition-all ${
              isEarned
                ? "border-amber-200 bg-white shadow-lg shadow-amber-100/50"
                : "border-gray-200 bg-gray-50/50"
            }`}
          >
            {isEarned && (
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 to-transparent pointer-events-none" />
            )}

            <div className="relative">
              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-3 ${
                isEarned ? `bg-gradient-to-br ${def.color} shadow-lg` : "bg-gray-200"
              }`}>
                {isEarned ? (
                  <Icon className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                ) : (
                  <Lock className="w-4 h-4 sm:w-6 sm:h-6 text-gray-400" />
                )}
              </div>

              <h4 className={`font-semibold text-xs sm:text-sm ${isEarned ? "text-gray-900" : "text-gray-400"}`}>
                {def.title}
              </h4>

              <p className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 line-clamp-2 ${isEarned ? "text-gray-500" : "text-gray-300"}`}>
                {def.description}
              </p>

              {isEarned && earnerCount > 0 && (
                <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-1.5 sm:-space-x-2">
                      {earnerNames.slice(0, 3).map((name) => (
                        <div key={name} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-white border-2 border-white">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <span className="text-[10px] sm:text-xs text-gray-500">{earnerCount}</span>
                  </div>
                </div>
              )}

              {!isEarned && (
                <div className="mt-2 sm:mt-3">
                  <span className="text-[9px] sm:text-[10px] font-medium text-gray-300 uppercase tracking-wider">Locked</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
