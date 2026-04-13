"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { getPlanUi } from "@/lib/plan-ui";
import { cn } from "@/lib/utils";
import Link from "next/link";

/**
 * Wraps an action button with tooltip when disabled.
 * If menuKey+actionKey provided, checks plan first (badge + link), then role.
 */
export function DisabledActionTooltip({
    disabled,
    message,
    menuKey,
    actionKey,
    children,
}: {
    disabled: boolean;
    message: string;
    menuKey?: string | undefined;
    actionKey?: string | undefined;
    children: ReactNode;
}) {
    const { canAction, getRequiredPlan, loaded } = usePlanAccess();

    // 1. Plan check first
    if (menuKey && actionKey && loaded) {
        const planAllowed = canAction(menuKey, actionKey);
        if (!planAllowed) {
            const { badge, tooltip } = getRequiredPlan(menuKey, actionKey);
            const ui = getPlanUi(badge);
            const Icon = ui.icon;

            return (
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link href="/plan" className="inline-flex cursor-pointer relative">
                                <span className="opacity-40 pointer-events-none">{children}</span>
                                <span className={cn("absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gradient-to-r flex items-center justify-center shadow-sm z-10", ui.gradient)}>
                                    <Icon className="w-2.5 h-2.5 text-white" />
                                </span>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[220px]">
                            <p className="font-semibold">Plan {ui.name}</p>
                            <p className="text-muted-foreground">{tooltip}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }
    }

    // 2. Role check
    if (!disabled) return <>{children}</>;
    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex cursor-not-allowed">{children}</span>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{message}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
