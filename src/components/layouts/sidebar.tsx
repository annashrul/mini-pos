"use client";

import Link from "next/link";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSidebarMenuAccess } from "@/features/access-control";
import { getAllBranches } from "@/server/actions/branches";
import { getCompanyPlan, getCurrentCompanyInfo } from "@/server/actions/plan";
import { type PlanKey } from "@/lib/plan-config";
import { getPlanMenuAccessMap, getAllPlanAccessData } from "@/server/actions/plan-access";
import { useBranch } from "@/components/providers/branch-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    LayoutDashboard, ShoppingCart, Package, FolderTree, History, Users,
    BarChart3, BoxesIcon, LogOut, ChevronLeft, Tag, Truck, UserCheck,
    Wallet, Clock, ScrollText, Percent, Building2, ClipboardList,
    BrainCircuit, HeartHandshake, ClipboardCheck, ArrowLeftRight,
    ChevronDown, Settings, DollarSign, ShieldCheck, FileText, MapPin, X, Zap, Landmark,
    RotateCcw, CalendarClock, CreditCard, ChefHat, CalendarDays, Armchair, Crown,
    Target, TrendingUp, PieChart, BookOpen, FileSpreadsheet, Calculator, BookMarked, Layers, LockKeyhole, Combine,
} from "lucide-react";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DEFAULT_ROLE_COLOR } from "@/constants/roles";
import type { AccessMenu } from "@/types";

type MenuItem = {
    key: string;
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    locked?: boolean;
    lockedBadge?: string | undefined;
};

const iconByMenuKey: Record<string, React.ComponentType<{ className?: string }>> = {
    dashboard: LayoutDashboard, pos: ShoppingCart, bundles: Combine, transactions: History,
    shifts: Clock, products: Package, categories: FolderTree, brands: Tag,
    suppliers: Truck, customers: UserCheck, stock: BoxesIcon,
    purchases: ClipboardList, "stock-opname": ClipboardCheck,
    "stock-transfers": ArrowLeftRight, expenses: Wallet, promotions: Percent, "price-schedules": CalendarClock,
    reports: BarChart3, analytics: BrainCircuit, "customer-intelligence": HeartHandshake,
    branches: Building2, "branch-prices": DollarSign, "audit-logs": ScrollText,
    "closing-reports": FileText, users: Users, settings: Settings,
    "access-control": ShieldCheck,
    debts: Landmark,
    "cashier-performance": Users,
    "ai-assistant": BrainCircuit,
    returns: RotateCcw,
    "gift-cards": CreditCard,
    "kitchen-display": ChefHat,
    "employee-schedules": CalendarDays,
    "sales-targets": Target,
    "inventory-forecast": TrendingUp,
    "profit-dashboard": PieChart,
    "accounting": Calculator,
    "accounting-coa": BookOpen,
    "accounting-journals": FileSpreadsheet,
    "accounting-ledger": BookMarked,
    "accounting-reports": Layers,
    "accounting-periods": LockKeyhole,
    tables: Armchair,
    "subscription-admin": Crown,
    tenants: Building2,
    "platform-activity": ScrollText,
    "plan-management": Settings,
};

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    onMobileClose?: () => void;
}

export function Sidebar({ collapsed, onToggle, onMobileClose }: SidebarProps) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const currentRole = (session?.user?.role || "") as string;
    const [dynamicMenuGroups, setDynamicMenuGroups] = useState<{ title: string; items: MenuItem[] }[]>([]);
    const [roleColor, setRoleColor] = useState<string>(DEFAULT_ROLE_COLOR);
    const [, setCompanyPlan] = useState<PlanKey>("FREE");
    const [companyName, setCompanyName] = useState<string>("-");
    const { branches, selectedBranchId, setBranches, setSelectedBranchId } = useBranch();

    // Load branches based on user role
    const userBranchId = (session?.user as Record<string, unknown> | undefined)?.branchId as string | null | undefined;
    const isAdminRole = currentRole === "SUPER_ADMIN" || currentRole === "ADMIN";

    useEffect(() => {
        if (!session?.user || branches.length > 0) return;
        if (isAdminRole) {
            getAllBranches().then((data) => {
                const active = data.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name }));
                setBranches(active);
            });
        } else if (userBranchId) {
            getAllBranches().then((data) => {
                const userBranch = data.find((b) => b.id === userBranchId && b.isActive);
                if (userBranch) {
                    setBranches([{ id: userBranch.id, name: userBranch.name }]);
                    setSelectedBranchId(userBranch.id);
                }
            });
        }
    }, [session?.user]); // eslint-disable-line react-hooks/exhaustive-deps

    const buildGroups = useCallback((menus: AccessMenu[], role: string, planAccess: Record<string, boolean>, allMenuPlans: Record<string, Record<string, boolean>>) => {
        const planOrder: PlanKey[] = ["FREE", "PRO", "ENTERPRISE"];
        const grouped = new Map<string, MenuItem[]>();
        for (const menu of menus) {
            if (!menu.permissions[role]) continue;
            const icon = iconByMenuKey[menu.key] ?? LayoutDashboard;
            const locked = Object.keys(planAccess).length > 0 ? (planAccess[menu.key] === false) : false;
            let lockedBadge: string | undefined;
            if (locked && allMenuPlans[menu.key]) {
                const menuPlans = allMenuPlans[menu.key]!;
                const enabling = planOrder.find((p) => menuPlans[p] === true);
                lockedBadge = enabling || "SOON";
            } else if (locked) {
                lockedBadge = "SOON";
            }
            const list = grouped.get(menu.group) ?? [];
            list.push({ key: menu.key, href: menu.path, label: menu.name, icon, locked, lockedBadge });
            grouped.set(menu.group, list);
        }
        return Array.from(grouped.entries()).map(([title, items]) => ({ title, items }));
    }, []);

    // Load menus: always fetch from server, use cache only as instant preview
    useEffect(() => {
        if (!currentRole) return;
        let active = true;
        const CACHE_KEY = "sidebar-menus-v5";

        // Show cached menus immediately as preview (non-blocking)
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached) as { role: string; menus: AccessMenu[]; roleColor?: string };
                if (parsed.role === currentRole) {
                    setDynamicMenuGroups(buildGroups(parsed.menus, parsed.role, {}, {}));
                    if (parsed.roleColor) setRoleColor(parsed.roleColor);
                }
            }
        } catch { /* ignore */ }

        // Always fetch fresh data from server (will override cache preview)
        const loadMenus = async () => {
            try {
                const result = await getSidebarMenuAccess();
                if (!active) return;
                let planAccess: Record<string, boolean> = {};
                let allMenuPlans: Record<string, Record<string, boolean>> = {};
                let plan: PlanKey = "PRO";
                if (result.role !== "PLATFORM_OWNER") {
                    try {
                        const [planResult, accessMap, allData, companyInfo] = await Promise.all([
                            getCompanyPlan(),
                            getPlanMenuAccessMap(),
                            getAllPlanAccessData(),
                            getCurrentCompanyInfo(),
                        ]);
                        plan = planResult.plan as PlanKey;
                        planAccess = accessMap;
                        allMenuPlans = allData.menus;
                        setCompanyName(companyInfo.name || "-");
                    } catch { /* no company context */ }
                }
                setCompanyPlan(plan);
                setDynamicMenuGroups(buildGroups(result.menus as AccessMenu[], result.role, planAccess, allMenuPlans));
                if (result.roleColor) setRoleColor(result.roleColor);
                try {
                    sessionStorage.removeItem("sidebar-menus");
                    sessionStorage.removeItem("sidebar-menus-v2");
                    sessionStorage.removeItem("sidebar-menus-v3");
                    sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
                } catch { /* storage full or unavailable */ }
            } catch (err) {
                console.error("[Sidebar] Failed to load menus:", err);
            }
        };
        loadMenus();
        return () => { active = false; };
    }, [currentRole, buildGroups]);

    const visibleMenuGroups = dynamicMenuGroups.filter((group) => group.items.length > 0);
    const visibleMenuItems = useMemo(
        () => visibleMenuGroups.flatMap((group) => group.items),
        [visibleMenuGroups]
    );
    // Detect parent hrefs that have child menu items (e.g. /accounting has /accounting/coa)
    const menuDefinedChildren = useMemo(() => {
        const allHrefs = visibleMenuItems.map((i) => i.href);
        const parents = new Set<string>();
        for (const href of allHrefs) {
            for (const other of allHrefs) {
                if (other !== href && other.startsWith(href + "/")) {
                    parents.add(href);
                    break;
                }
            }
        }
        return parents;
    }, [visibleMenuItems]);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const defaultOpenGroups = useMemo(
        () => Object.fromEntries(
            visibleMenuGroups.map((group) => [
                group.title,
                group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/")),
            ])
        ),
        [pathname, visibleMenuGroups]
    );

    const handleMenuClick = (event: React.MouseEvent, href: string) => {
        if (href === "/pos" && !selectedBranchId) {
            event.preventDefault();
            toast.error("Pilih lokasi terlebih dahulu");
            return;
        }
        onMobileClose?.();
    };

    const renderNavItem = (item: MenuItem, showLabel: boolean) => {
        const isExactParent = item.href !== "/" && menuDefinedChildren.has(item.href);
        const isActive = isExactParent ? pathname === item.href : (pathname === item.href || pathname.startsWith(item.href + "/"));
        const isPosBlocked = item.href === "/pos" && !selectedBranchId;
        const cls = cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150",
            item.locked
                ? "text-slate-400 hover:bg-slate-50 cursor-pointer"
                : isActive
                    ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-md shadow-primary/25"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        );
        const iconCls = cn("h-[18px] w-[18px] shrink-0", isActive && !item.locked ? "text-white" : "text-slate-400");
        const content = (
            <>
                <item.icon className={iconCls} />
                {showLabel && <span className="truncate flex-1">{item.label}</span>}
                {showLabel && item.locked && (
                    <span className={cn("ml-auto shrink-0 px-1.5 py-0.5 text-[9px] font-bold rounded-md text-white leading-none bg-gradient-to-r",
                        item.lockedBadge === "ENTERPRISE" ? "from-purple-500 to-violet-500" :
                        item.lockedBadge === "SOON" ? "from-slate-400 to-slate-500" :
                        "from-amber-400 to-orange-400"
                    )}>
                        {item.lockedBadge === "SOON" ? "SOON" : item.lockedBadge || "PRO"}
                    </span>
                )}
                {!showLabel && item.locked && (
                    <span className={cn("absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
                        item.lockedBadge === "ENTERPRISE" ? "bg-purple-500" :
                        item.lockedBadge === "SOON" ? "bg-slate-400" :
                        "bg-amber-400"
                    )} />
                )}
            </>
        );

        if (item.locked) {
            return <Link key={item.href} href="/plan" onClick={() => onMobileClose?.()} className={cn(cls, "relative")}>{content}</Link>;
        }
        if (isPosBlocked) {
            return <button key={item.href} type="button" onClick={() => toast.error("Pilih lokasi terlebih dahulu")} className={cn(cls, "w-full")}>{content}</button>;
        }
        return <Link key={item.href} href={item.href} onClick={(e) => handleMenuClick(e, item.href)} className={cls}>{content}</Link>;
    };

    return (
        <div className={cn(
            "h-dvh max-h-dvh overflow-hidden bg-white border-r border-slate-200/80 flex flex-col shrink-0",
            collapsed ? "w-[68px]" : "w-[256px]"
        )}>
            {/* Logo / Brand */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-100/80">
                {!collapsed ? (
                    <Link href="/dashboard" className="flex items-center gap-2.5 group">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-sm shadow-primary/20 group-hover:shadow-md group-hover:shadow-primary/30 transition-shadow">
                            <Zap className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[15px] font-bold tracking-tight text-foreground leading-none">NusaPOS</span>
                            <span className="text-[9px] text-muted-foreground/60 font-medium tracking-wider uppercase">Point of Sale</span>
                        </div>
                    </Link>
                ) : (
                    <Link href="/dashboard" className="w-full flex justify-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-sm">
                            <Zap className="w-4 h-4 text-white" />
                        </div>
                    </Link>
                )}
                {/* Collapse button (desktop) */}
                <Button variant="ghost" size="icon" onClick={onToggle} className="h-7 w-7 rounded-lg hidden lg:flex shrink-0">
                    <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")} />
                </Button>
                {/* Close button (mobile) */}
                <Button variant="ghost" size="icon" onClick={onMobileClose} className="h-7 w-7 rounded-lg lg:hidden shrink-0">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Branch Selector */}
            {branches.length > 0 && (
                <div className="px-3 py-2.5 border-b border-slate-100/80">
                    {collapsed ? (
                        <Button variant="ghost" size="icon" className="w-full h-8 rounded-lg" title={selectedBranchId ? branches.find((b) => b.id === selectedBranchId)?.name : "Semua Lokasi"}>
                            <MapPin className="w-4 h-4 text-primary" />
                        </Button>
                    ) : !isAdminRole && branches.length === 1 ? (
                        <div className="h-8 rounded-lg text-xs bg-primary/5 border border-primary/10 text-primary flex items-center gap-1.5 px-3 font-medium">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{branches[0]?.name}</span>
                        </div>
                    ) : (
                        <Select value={selectedBranchId || "__all__"} onValueChange={(v) => setSelectedBranchId(v === "__all__" ? "" : v)}>
                            <SelectTrigger className="h-8 rounded-lg text-xs bg-primary/5 border-primary/10 text-primary font-medium">
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                                    <SelectValue placeholder="Pilih Lokasi" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {isAdminRole && <SelectItem value="__all__">Semua Lokasi</SelectItem>}
                                {branches.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}

            {/* Navigation */}
            <ScrollArea className="flex-1 min-h-0 py-3">
                <nav className="px-3">
                    {collapsed ? (
                        <div className="space-y-0.5">
                            {visibleMenuItems.map((item) => renderNavItem(item, false))}
                        </div>
                    ) : (
                        visibleMenuGroups.map((group) => {
                            const isOpen = openGroups[group.title] ?? defaultOpenGroups[group.title] ?? false;
                            return (
                                <div key={group.title} className="mb-1.5 last:mb-0">
                                    <button
                                        type="button"
                                        onClick={() => setOpenGroups((prev) => ({ ...prev, [group.title]: !isOpen }))}
                                        className="w-full h-7 px-3 mb-0.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors"
                                    >
                                        <span>{group.title}</span>
                                        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !isOpen && "-rotate-90")} />
                                    </button>
                                    {isOpen && (
                                        <div className="space-y-0.5">
                                            {group.items.map((item) => renderNavItem(item, true))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </nav>
            </ScrollArea>

            {/* User section */}
            <div className="border-t border-slate-100/80 p-3">
                {!collapsed ? (
                    <div className="flex items-center gap-2.5 px-2 py-1.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
                            {session?.user?.name?.charAt(0) || "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{session?.user?.name}</p>
                            <p className="text-[11px] text-slate-500 truncate leading-tight mt-0.5 flex items-center gap-1">
                                <Building2 className="h-3 w-3 shrink-0" />
                                <span className="truncate">{companyName}</span>
                            </p>
                            <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 mt-0.5", roleColor)}>
                                {currentRole}
                            </Badge>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            title="Logout"
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-xs font-bold" title={companyName}>
                            {session?.user?.name?.charAt(0) || "U"}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            title="Logout"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
