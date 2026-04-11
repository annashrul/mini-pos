"use client";

import { usePlanAccess } from "@/hooks/use-plan-access";
import { Crown, Lock, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ProGateProps {
    menuKey: string;
    actionKey: string;
    children: React.ReactNode;
    mode?: "disable" | "hide";
}

const badgeStyles: Record<string, { icon: typeof Crown; gradient: string }> & { default: { icon: typeof Crown; gradient: string } } = {
    FREE: { icon: Zap, gradient: "from-slate-400 to-slate-500" },
    PRO: { icon: Crown, gradient: "from-amber-400 to-orange-400" },
    ENTERPRISE: { icon: Sparkles, gradient: "from-purple-500 to-violet-500" },
    SOON: { icon: Lock, gradient: "from-slate-400 to-slate-500" },
    default: { icon: Lock, gradient: "from-slate-400 to-slate-500" },
};

export function ProGate({ menuKey, actionKey, children, mode = "disable" }: ProGateProps) {
    const { canAction, getRequiredPlan, loaded } = usePlanAccess();
    const allowed = loaded ? canAction(menuKey, actionKey) : true;

    if (!loaded) return <>{children}</>;
    if (allowed) return <>{children}</>;
    if (mode === "hide") return null;

    const { label, badge, tooltip } = getRequiredPlan(menuKey, actionKey);
    const style = badgeStyles[badge] ?? badgeStyles.default;
    const Icon = style.icon;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="relative rounded-xl overflow-hidden">
                        <div className="opacity-30 select-none" style={{ pointerEvents: "none" }} aria-hidden>
                            {children}
                        </div>
                        <Link
                            href="/plan"
                            className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-[2px] cursor-pointer group"
                        >
                            <span className={cn("flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-xs font-bold shadow-lg group-hover:scale-105 transition-transform bg-gradient-to-r", style.gradient)}>
                                <Icon className="w-3.5 h-3.5" /> {label}
                            </span>
                        </Link>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[220px] text-center">
                    {tooltip}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export function ProButton({
    menuKey,
    actionKey,
    children,
    onClick,
    className = "",
    disabled = false,
}: {
    menuKey: string;
    actionKey: string;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
}) {
    const { canAction, getRequiredPlan, loaded } = usePlanAccess();

    if (!loaded || canAction(menuKey, actionKey)) {
        return (
            <button onClick={onClick} disabled={disabled || !loaded} className={className}>
                {children}
            </button>
        );
    }

    const { badge, tooltip } = getRequiredPlan(menuKey, actionKey);
    const style = badgeStyles[badge] ?? badgeStyles.default;
    const Icon = style.icon;
    const planLabel = badge === "SOON" ? "Segera Hadir" : `Plan ${badge}`;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link href="/plan" className={`${className} opacity-50 relative`}>
                        {children}
                        <span className={cn("absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gradient-to-r flex items-center justify-center shadow-sm", style.gradient)}>
                            <Icon className="w-2.5 h-2.5 text-white" />
                        </span>
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                    <p className="font-semibold">{planLabel}</p>
                    <p className="text-muted-foreground mt-0.5">{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
