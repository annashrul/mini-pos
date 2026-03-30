"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { getSidebarMenuAccess } from "@/features/access-control";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    FolderTree,
    History,
    Users,
    BarChart3,
    BoxesIcon,
    LogOut,
    ChevronLeft,
    ShoppingBag,
    Tag,
    Truck,
    UserCheck,
    Wallet,
    Clock,
    ScrollText,
    Percent,
    Building2,
    ClipboardList,
    BrainCircuit,
    HeartHandshake,
    ClipboardCheck,
    ArrowLeftRight,
    ChevronDown,
    Settings,
    DollarSign,
    ShieldCheck,
    FileText,
} from "lucide-react";
import { DEFAULT_ROLE_COLOR } from "@/constants/roles";
import type { AccessMenu } from "@/types";

type MenuItem = {
    key: string;
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
};

const iconByMenuKey: Record<string, React.ComponentType<{ className?: string }>> = {
    dashboard: LayoutDashboard,
    pos: ShoppingCart,
    transactions: History,
    shifts: Clock,
    products: Package,
    categories: FolderTree,
    brands: Tag,
    suppliers: Truck,
    customers: UserCheck,
    stock: BoxesIcon,
    purchases: ClipboardList,
    "stock-opname": ClipboardCheck,
    "stock-transfers": ArrowLeftRight,
    expenses: Wallet,
    promotions: Percent,
    reports: BarChart3,
    analytics: BrainCircuit,
    "customer-intelligence": HeartHandshake,
    branches: Building2,
    "branch-prices": DollarSign,
    "audit-logs": ScrollText,
    "closing-reports": FileText,
    users: Users,
    settings: Settings,
    "access-control": ShieldCheck,
};

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const currentRole = (session?.user?.role || "") as string;
    const [dynamicMenuGroups, setDynamicMenuGroups] = useState<{ title: string; items: MenuItem[] }[]>([]);
    const [roleColor, setRoleColor] = useState<string>(DEFAULT_ROLE_COLOR);

    useEffect(() => {
        let active = true;
        const CACHE_KEY = "sidebar-menus";

        const buildGroups = (menus: AccessMenu[], role: string) => {
            const grouped = new Map<string, MenuItem[]>();
            for (const menu of menus) {
                if (!menu.permissions[role]) continue;
                const icon = iconByMenuKey[menu.key] ?? LayoutDashboard;
                const list = grouped.get(menu.group) ?? [];
                list.push({ key: menu.key, href: menu.path, label: menu.name, icon });
                grouped.set(menu.group, list);
            }
            return Array.from(grouped.entries()).map(([title, items]) => ({ title, items }));
        };
        const applyMenus = (menus: AccessMenu[], role: string, nextRoleColor?: string) => {
            queueMicrotask(() => {
                if (!active) return;
                setDynamicMenuGroups(buildGroups(menus, role));
                if (nextRoleColor) setRoleColor(nextRoleColor);
            });
        };

        // Try cache first
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached) as { role: string; menus: AccessMenu[]; roleColor?: string };
                if (parsed.role === currentRole) {
                    applyMenus(parsed.menus, parsed.role, parsed.roleColor);
                    return;
                }
            }
        } catch { /* ignore */ }

        // Fetch from server
        const loadMenus = async () => {
            const result = await getSidebarMenuAccess();
            if (!active) return;
            try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch { /* */ }
            applyMenus(result.menus as AccessMenu[], result.role, result.roleColor);
        };
        loadMenus();
        return () => { active = false; };
    }, [currentRole]);

    const visibleMenuGroups = dynamicMenuGroups.filter((group) => group.items.length > 0);
    const visibleMenuItems = useMemo(
        () => visibleMenuGroups.flatMap((group) => group.items),
        [visibleMenuGroups]
    );
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const defaultOpenGroups = useMemo(
        () =>
            Object.fromEntries(
                visibleMenuGroups.map((group) => [
                    group.title,
                    group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/")),
                ])
            ),
        [pathname, visibleMenuGroups]
    );

    return (
        <div
            className={cn(
                "h-dvh max-h-dvh overflow-hidden bg-white border-r border-slate-200 flex flex-col transition-all duration-300 shadow-sm",
                collapsed ? "w-[70px]" : "w-[260px]"
            )}
        >
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                            <ShoppingBag className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <span className="font-bold text-lg">POS</span>
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggle}
                    className="h-8 w-8 rounded-lg"
                >
                    <ChevronLeft
                        className={cn(
                            "h-4 w-4 transition-transform",
                            collapsed && "rotate-180"
                        )}
                    />
                </Button>
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1 min-h-0 py-4">
                <nav className="px-3">
                    {collapsed ? (
                        <div className="space-y-1">
                            {visibleMenuItems.map((item) => {
                                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                                            isActive
                                                ? "bg-primary text-primary-foreground shadow-md"
                                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                        )}
                                    >
                                        <item.icon className="h-5 w-5 flex-shrink-0" />
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        visibleMenuGroups.map((group) => (
                            <div key={group.title} className="mb-3 last:mb-0">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                        setOpenGroups((prev) => ({
                                            ...prev,
                                            [group.title]: !(prev[group.title] ?? defaultOpenGroups[group.title] ?? false),
                                        }))
                                    }
                                    className="w-full h-8 px-3 mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                                >
                                    <span>{group.title}</span>
                                    <ChevronDown
                                        className={cn(
                                            "h-4 w-4 transition-transform",
                                            openGroups[group.title] ? "rotate-0" : "-rotate-90"
                                        )}
                                    />
                                </Button>
                                {(openGroups[group.title] ?? defaultOpenGroups[group.title] ?? false) && (
                                    <div className="space-y-1">
                                        {group.items.map((item) => {
                                            const isActive =
                                                pathname === item.href || pathname.startsWith(item.href + "/");
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={cn(
                                                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                                                        isActive
                                                            ? "bg-primary text-primary-foreground shadow-md"
                                                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                                    )}
                                                >
                                                    <item.icon className="h-5 w-5 flex-shrink-0" />
                                                    <span>{item.label}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </nav>
            </ScrollArea>

            {/* User section */}
            <div className="border-t border-slate-100 p-3">
                {!collapsed ? (
                    <div className="flex items-center gap-3 p-2">
                        <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                                {session?.user?.name?.charAt(0) || "U"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {session?.user?.name}
                            </p>
                            <Badge
                                variant="secondary"
                                className={cn(
                                    "text-[10px] px-1.5 py-0",
                                    roleColor
                                )}
                            >
                                {session?.user?.role}
                            </Badge>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500"
                            onClick={() => signOut({ callbackUrl: "/login" })}
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-full h-10 rounded-lg text-slate-400 hover:text-red-500"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
