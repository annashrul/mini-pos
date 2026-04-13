"use client";

import type { ReactNode } from "react";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { Crown, Lock, Sparkles, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import Link from "next/link";

const planBadge = {
  PRO: { icon: Crown, gradient: "from-amber-400 to-orange-400", label: "PRO" },
  ENTERPRISE: { icon: Sparkles, gradient: "from-purple-500 to-violet-500", label: "ENTERPRISE" },
  FREE: { icon: Zap, gradient: "from-slate-400 to-slate-500", label: "FREE" },
  SOON: { icon: Lock, gradient: "from-slate-400 to-slate-500", label: "SOON" },
} as const;

/**
 * Unified action guard — checks plan first, then role.
 *
 * Usage:
 *   <ActionGuard menuKey="branches" actionKey="create" roleAllowed={canCreate} roleMessage={cannotMessage("create")}>
 *     <Button>Tambah</Button>
 *   </ActionGuard>
 *
 * If plan blocks: children disabled + plan badge + tooltip "Upgrade ke PRO"
 * If role blocks: children disabled + tooltip "Anda tidak memiliki izin"
 * If both allow: children rendered normally
 */
export function ActionGuard({
  menuKey,
  actionKey,
  roleAllowed = true,
  roleMessage = "Anda tidak memiliki izin untuk aksi ini",
  children,
}: {
  menuKey: string;
  actionKey: string;
  roleAllowed?: boolean;
  roleMessage?: string;
  children: ReactNode;
}) {
  const { canAction, getRequiredPlan, loaded } = usePlanAccess();
  const planAllowed = loaded ? canAction(menuKey, actionKey) : true;

  // 1. Plan check first
  if (loaded && !planAllowed) {
    const { badge, tooltip } = getRequiredPlan(menuKey, actionKey);
    const style = planBadge[badge as keyof typeof planBadge] ?? planBadge.SOON;
    const Icon = style.icon;

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/plan" className="inline-flex cursor-pointer relative">
              <span className="opacity-40 pointer-events-none">{children}</span>
              <span className={cn("absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gradient-to-r flex items-center justify-center shadow-sm z-10", style.gradient)}>
                <Icon className="w-2.5 h-2.5 text-white" />
              </span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[220px]">
            <p className="font-semibold">Plan {style.label}</p>
            <p className="text-muted-foreground">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 2. Role check
  if (!roleAllowed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-not-allowed">{children}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {roleMessage}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // 3. Both allow
  return <>{children}</>;
}
