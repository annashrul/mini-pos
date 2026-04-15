"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
    accessControlService,
    updateRoleActionPermission,
    updateRoleMenuPermission,
} from "@/features/access-control";
import { useMenuActionAccess } from "@/features/access-control";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { AccessMenu } from "@/types";
import {
    Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
    Shield, ChevronDown, ChevronRight, Search, CheckCircle2, XCircle,
    Lock, Loader2, Plus, Pencil, Trash2, SlidersHorizontal, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";

interface AppRoleData {
    id: string;
    key: string;
    name: string;
    description: string | null;
    color: string | null;
    isSystem: boolean;
    isActive: boolean;
}

const DEFAULT_COLORS = [
    { value: "bg-red-100 text-red-700", label: "Merah" },
    { value: "bg-blue-100 text-blue-700", label: "Biru" },
    { value: "bg-purple-100 text-purple-700", label: "Ungu" },
    { value: "bg-green-100 text-green-700", label: "Hijau" },
    { value: "bg-orange-100 text-orange-700", label: "Orange" },
    { value: "bg-teal-100 text-teal-700", label: "Teal" },
    { value: "bg-pink-100 text-pink-700", label: "Pink" },
    { value: "bg-slate-100 text-slate-700", label: "Abu-abu" },
];

const ACTION_LABELS: Record<string, string> = {
    view: "Lihat", create: "Tambah", update: "Edit", delete: "Hapus",
    export: "Export", void: "Void", refund: "Refund", approve: "Approve",
    receive: "Terima", manage: "Kelola", open_shift: "Buka Shift", close_shift: "Tutup Shift",
};

export function AccessControlContent() {
    const [data, setData] = useState<{ error?: string | null; roles: string[]; menus: AccessMenu[] }>({ roles: [], menus: [] });
    const [appRoles, setAppRoles] = useState<AppRoleData[]>([]);
    const [pending, startTransition] = useTransition();
    const roleKeys = useMemo(
        () => appRoles.filter((role) => role.isActive).map((role) => role.key),
        [appRoles]
    );
    const [selectedRole, setSelectedRole] = useState(roleKeys[0] ?? data.roles[0] ?? "SUPER_ADMIN");
    const [searchQuery, setSearchQuery] = useState("");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["Utama", "Master Data"]));
    const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
    const [roleSheetOpen, setRoleSheetOpen] = useState(false);

    // Role CRUD dialogs
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<AppRoleData | null>(null);
    const [formKey, setFormKey] = useState("");
    const [formName, setFormName] = useState("");
    const [formDesc, setFormDesc] = useState("");
    const [formColor, setFormColor] = useState("bg-slate-100 text-slate-700");
    const [formCopyFrom, setFormCopyFrom] = useState("");
    const [confirmDelete, setConfirmDelete] = useState<AppRoleData | null>(null);
    const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
    const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
    const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
    const [submitConfirmTitle, setSubmitConfirmTitle] = useState("Konfirmasi");
    const [submitConfirmText, setSubmitConfirmText] = useState("");
    const [submitConfirmKind, setSubmitConfirmKind] = useState<"submit" | "delete">("submit");
    const [pendingSubmitAction, setPendingSubmitAction] = useState<null | (() => Promise<void>)>(null);
    const effectiveRole = roleKeys.includes(selectedRole) ? selectedRole : (roleKeys[0] ?? "SUPER_ADMIN");
    const { canAction, cannotMessage } = useMenuActionAccess("access-control");
    const { canAction: canPlan } = usePlanAccess();
    const canCreateRole = canAction("create_role") && canPlan("access-control", "create_role");
    const canUpdateRole = canAction("update_role") && canPlan("access-control", "update_role");
    const canDeleteRole = canAction("delete_role") && canPlan("access-control", "delete_role");
    const canManageMenu = canAction("manage_menu") && canPlan("access-control", "manage_menu");
    const canManageAction = canAction("manage_action") && canPlan("access-control", "manage_action");

    const didFetchRef = useRef(false);
    useEffect(() => {
        if (didFetchRef.current) return;
        didFetchRef.current = true;
        startTransition(async () => {
            const [matrix, roles] = await Promise.all([
                accessControlService.getAccessControlMatrix(),
                accessControlService.getRoles(),
            ]);
            setData(matrix);
            setAppRoles(roles as AppRoleData[]);
            setSelectedRole((roles.find((role) => role.isActive)?.key) ?? matrix.roles[0] ?? "SUPER_ADMIN");
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchMatrix = (q: string) => {
        startTransition(async () => {
            const matrix = await accessControlService.getAccessControlMatrix(q);
            setData((prev) => ({ ...prev, menus: matrix.menus }));
        });
    };

    const groupedMenus = useMemo(() => {
        const groups = new Map<string, AccessMenu[]>();
        for (const menu of data.menus) {
            const current = groups.get(menu.group) ?? [];
            current.push(menu);
            groups.set(menu.group, current);
        }
        return Array.from(groups.entries());
    }, [data.menus]);

    const toggleGroup = (group: string) => {
        setExpandedGroups((prev) => { const n = new Set(prev); if (n.has(group)) n.delete(group); else n.add(group); return n; });
    };
    const toggleMenuExpand = (menuId: string) => {
        setExpandedMenus((prev) => { const n = new Set(prev); if (n.has(menuId)) n.delete(menuId); else n.add(menuId); return n; });
    };

    const toggleMenu = (menuId: string, role: string, allowed: boolean) => {
        if (!canManageMenu) { toast.error(cannotMessage("manage_menu")); return; }
        startTransition(async () => {
            const result = await updateRoleMenuPermission({ menuId, role, allowed });
            if (result.error) { toast.error(result.error); return; }
            setData((prev) => ({
                ...prev,
                menus: prev.menus.map((m) => m.id === menuId ? { ...m, permissions: { ...m.permissions, [role]: allowed } } : m),
            }));
        });
    };

    const toggleAction = (actionId: string, role: string, allowed: boolean) => {
        if (!canManageAction) { toast.error(cannotMessage("manage_action")); return; }
        startTransition(async () => {
            const result = await updateRoleActionPermission({ actionId, role, allowed });
            if (result.error) { toast.error(result.error); return; }
            setData((prev) => ({
                ...prev,
                menus: prev.menus.map((m) => ({
                    ...m,
                    actions: m.actions.map((a) => a.id === actionId ? { ...a, permissions: { ...a.permissions, [role]: allowed } } : a),
                })),
            }));
        });
    };

    // Role CRUD handlers
    const executeCreateRole = async () => {
        if (!canCreateRole) { toast.error(cannotMessage("create_role")); return; }
        const result = await accessControlService.createRole({
            key: formKey,
            name: formName,
            description: formDesc,
            color: formColor,
            ...(formCopyFrom ? { copyFromRole: formCopyFrom } : {}),
        });
        if (result.error) { toast.error(result.error); return; }
        toast.success(`Role "${formName}" berhasil dibuat`);
        setCreateOpen(false);
        if (result.role) {
            const createdRole = result.role as AppRoleData;
            setAppRoles((prev) => {
                if (prev.some((role) => role.key === createdRole.key)) return prev;
                return [createdRole, ...prev];
            });
            setSelectedRole(createdRole.key);
            setData((prev) => ({
                ...prev,
                roles: prev.roles.includes(createdRole.key) ? prev.roles : [createdRole.key, ...prev.roles],
                menus: prev.menus.map((menu) => ({
                    ...menu,
                    permissions: { ...menu.permissions, [createdRole.key]: false },
                    actions: menu.actions.map((action) => ({
                        ...action,
                        permissions: { ...action.permissions, [createdRole.key]: false },
                    })),
                })),
            }));
        }
        setFormKey(""); setFormName(""); setFormDesc(""); setFormCopyFrom("");
    };

    const handleCreateRole = async () => {
        setSubmitConfirmKind("submit");
        setSubmitConfirmTitle("Buat Role Baru?");
        setSubmitConfirmText("Role baru akan dibuat dan dapat langsung diatur permission-nya.");
        setPendingSubmitAction(() => async () => {
            await executeCreateRole();
            setSubmitConfirmOpen(false);
            setPendingSubmitAction(null);
        });
        setSubmitConfirmOpen(true);
    };

    const executeUpdateRole = async () => {
        if (!canUpdateRole) { toast.error(cannotMessage("update_role")); return; }
        if (!editingRole) return;
        const result = await accessControlService.updateRole(editingRole.id, { name: formName, description: formDesc, color: formColor });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Role berhasil diupdate");
        setEditOpen(false);
        setAppRoles((prev) => prev.map((r) => r.id === editingRole.id ? { ...r, name: formName, description: formDesc, color: formColor } : r));
    };

    const handleUpdateRole = async () => {
        setSubmitConfirmKind("submit");
        setSubmitConfirmTitle("Simpan Perubahan Role?");
        setSubmitConfirmText("Perubahan nama, deskripsi, dan warna role akan disimpan.");
        setPendingSubmitAction(() => async () => {
            await executeUpdateRole();
            setSubmitConfirmOpen(false);
            setPendingSubmitAction(null);
        });
        setSubmitConfirmOpen(true);
    };

    const executeDeleteRole = async () => {
        if (!canDeleteRole) { toast.error(cannotMessage("delete_role")); return; }
        if (!confirmDelete) return;
        const deletingRoleKey = confirmDelete.key;
        const result = await accessControlService.deleteRole(confirmDelete.id);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Role berhasil dihapus");
        setConfirmDelete(null);
        setAppRoles((prev) => prev.filter((role) => role.id !== confirmDelete.id));
        setData((prev) => ({
            ...prev,
            roles: prev.roles.filter((roleKey) => roleKey !== deletingRoleKey),
            menus: prev.menus.map((menu) => {
                const nextPermissions = { ...menu.permissions };
                delete nextPermissions[deletingRoleKey];
                return {
                    ...menu,
                    permissions: nextPermissions,
                    actions: menu.actions.map((action) => {
                        const nextActionPermissions = { ...action.permissions };
                        delete nextActionPermissions[deletingRoleKey];
                        return { ...action, permissions: nextActionPermissions };
                    }),
                };
            }),
        }));
    };

    const handleDeleteRole = async () => {
        await executeDeleteRole();
    };

    const openEditRole = (role: AppRoleData) => {
        setEditingRole(role);
        setFormName(role.name);
        setFormDesc(role.description || "");
        setFormColor(role.color || "bg-slate-100 text-slate-700");
        setEditOpen(true);
    };

    // Get role metadata from appRoles
    const getRoleMeta = (roleKey: string) => {
        const appRole = appRoles.find((r) => r.key === roleKey);
        if (appRole) return { label: appRole.name, description: appRole.description || "", color: appRole.color || "bg-slate-100 text-slate-700", icon: appRole.key.substring(0, 2) };
        return { label: roleKey, description: "", color: "bg-slate-100 text-slate-700", icon: roleKey.substring(0, 2) };
    };

    const totalMenus = data.menus.length;

    const activeMenuCount = data.menus.filter((m) => m.permissions[effectiveRole]).length;

    const isInitialLoading = pending && data.menus.length === 0;
    const isUpdating = pending && data.menus.length > 0;

    if (data.error) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-red-50 flex items-center justify-center">
                        <Lock className="w-10 h-10 text-red-400" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-lg font-semibold text-foreground">Akses Ditolak</p>
                        <p className="text-sm text-red-500 max-w-xs">{data.error}</p>
                    </div>
                    <Button variant="outline" className="rounded-xl" onClick={() => window.history.back()}>
                        Kembali
                    </Button>
                </div>
            </div>
        );
    }

    if (isInitialLoading) {
        return (
            <div className="space-y-6">
                {/* Header skeleton */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-200" />
                        <div className="space-y-2">
                            <div className="h-7 w-48 bg-gray-200 rounded" />
                            <div className="h-4 w-64 bg-gray-200 rounded" />
                        </div>
                    </div>
                    <div className="h-10 w-36 bg-gray-200 rounded-xl" />
                </div>

                {/* Mobile skeleton: horizontal role pills */}
                <div className="lg:hidden flex gap-2 overflow-hidden pb-2 px-1 animate-pulse">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="shrink-0 h-10 w-28 bg-gray-200 rounded-xl" />
                    ))}
                </div>

                <div className="flex flex-col lg:flex-row lg:gap-6">
                    {/* Desktop: Left sidebar skeleton */}
                    <div className="hidden lg:block w-[300px] shrink-0">
                        <div className="rounded-2xl border border-border/30 bg-white shadow-sm overflow-hidden animate-pulse">
                            <div className="px-4 py-3 border-b border-border/20">
                                <div className="h-4 w-24 bg-gray-200 rounded" />
                            </div>
                            <div className="p-2 space-y-1.5">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="rounded-xl p-3 space-y-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-200" />
                                            <div className="flex-1 space-y-1.5">
                                                <div className="h-4 w-24 bg-gray-200 rounded" />
                                                <div className="h-3 w-32 bg-gray-200 rounded" />
                                            </div>
                                        </div>
                                        <div className="pl-[52px] space-y-1.5">
                                            <div className="h-1.5 w-full bg-gray-200 rounded-full" />
                                            <div className="h-3 w-16 bg-gray-200 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right content skeleton */}
                    <div className="flex-1 min-w-0 space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="rounded-2xl border border-border/40 bg-white p-6 space-y-4 animate-pulse">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gray-200" />
                                        <div className="space-y-1.5">
                                            <div className="h-5 w-32 bg-gray-200 rounded" />
                                            <div className="h-3 w-48 bg-gray-200 rounded" />
                                        </div>
                                    </div>
                                    <div className="h-6 w-16 bg-gray-200 rounded-full" />
                                </div>
                                <div className="h-2 w-full bg-gray-200 rounded-full" />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {Array.from({ length: 8 }).map((_, j) => (
                                        <div key={j} className="h-8 bg-gray-200 rounded-lg" />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("space-y-6 transition-opacity duration-200", isUpdating && "opacity-60 pointer-events-none")}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                        <Shield className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-3xl font-bold text-foreground tracking-tight">Hak Akses</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs sm:text-sm text-muted-foreground">Kelola role dan akses menu</p>
                            <Badge variant="secondary" className="rounded-full text-[10px] px-2">{roleKeys.length} role</Badge>
                        </div>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canCreateRole} message={cannotMessage("create_role")} menuKey="access-control" actionKey="create_role">
                    <Button
                        disabled={!canCreateRole}
                        className="hidden lg:inline-flex rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                        onClick={() => { setFormKey(""); setFormName(""); setFormDesc(""); setFormColor("bg-slate-100 text-slate-700"); setFormCopyFrom(""); setCreateOpen(true); }}
                    >
                        <Plus className="w-4 h-4 mr-2" /> Tambah Role
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* ===== Mobile: Role bottom sheet (hidden, triggered from search bar) ===== */}
            <div className="lg:hidden">
                {pending && (
                    <div className="flex items-center gap-1.5 text-[11px] text-primary">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="animate-pulse">Menyimpan...</span>
                    </div>
                )}
                <Sheet open={roleSheetOpen} onOpenChange={setRoleSheetOpen}>
                    <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] flex flex-col" showCloseButton={false}>
                        <div className="shrink-0">
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                            </div>
                            <SheetHeader className="px-4 pb-3 pt-0">
                                <SheetTitle className="text-base font-bold">Pilih Role</SheetTitle>
                            </SheetHeader>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 space-y-1">
                            {roleKeys.map((roleKey) => {
                                const meta = getRoleMeta(roleKey);
                                const appRole = appRoles.find((r) => r.key === roleKey);
                                const isSelected = effectiveRole === roleKey;
                                const mCount = data.menus.filter((m) => m.permissions[roleKey]).length;
                                return (
                                    <button
                                        key={roleKey}
                                        onClick={() => { setSelectedRole(roleKey); setRoleSheetOpen(false); }}
                                        className={cn(
                                            "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                            isSelected ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted"
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0", isSelected ? "bg-background/20 text-background" : meta.color)}>
                                                {meta.icon}
                                            </div>
                                            <div className="text-left">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{meta.label}</span>
                                                    {appRole?.isSystem && <Lock className="w-3 h-3 opacity-50" />}
                                                </div>
                                                <p className={cn("text-[11px] mt-0.5", isSelected ? "text-background/60" : "text-muted-foreground")}>{mCount} menu aktif</p>
                                            </div>
                                        </div>
                                        {isSelected && <Check className="w-4 h-4" />}
                                    </button>
                                );
                            })}
                        </div>
                        <SheetFooter className="shrink-0 border-t px-4 py-3 flex-row gap-2">
                            {(() => {
                                const selectedAppRole = appRoles.find((r) => r.key === effectiveRole);
                                return (
                                    <>
                                        {selectedAppRole && canUpdateRole && (
                                            <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={() => { setRoleSheetOpen(false); openEditRole(selectedAppRole); }}>
                                                <Pencil className="w-3 h-3" /> Edit
                                            </Button>
                                        )}
                                        {selectedAppRole && !selectedAppRole.isSystem && canDeleteRole && (
                                            <Button variant="outline" size="sm" className="rounded-xl gap-1 text-red-500 hover:text-red-600" onClick={() => { setRoleSheetOpen(false); setConfirmDelete(selectedAppRole); }}>
                                                <Trash2 className="w-3 h-3" /> Hapus
                                            </Button>
                                        )}
                                        <div className="flex-1" />
                                        {canCreateRole && (
                                            <Button size="sm" className="rounded-xl gap-1" onClick={() => { setRoleSheetOpen(false); setFormKey(""); setFormName(""); setFormDesc(""); setFormColor("bg-slate-100 text-slate-700"); setFormCopyFrom(""); setCreateOpen(true); }}>
                                                <Plus className="w-3 h-3" /> Tambah Role
                                            </Button>
                                        )}
                                    </>
                                );
                            })()}
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
            </div>

            <div className="flex flex-col lg:flex-row lg:gap-6">
                {/* ===== Desktop: Left Sidebar - Role List ===== */}
                <div className="hidden lg:block sticky top-4 h-fit lg:max-h-[calc(100vh-7rem)] w-[300px] shrink-0 overflow-y-auto">
                    <div className="rounded-2xl border border-border/30 bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/20">
                            <h2 className="text-sm font-semibold text-foreground">Daftar Role</h2>
                        </div>

                        <div className="p-2 space-y-1.5">
                            {roleKeys.map((roleKey) => {
                                const meta = getRoleMeta(roleKey);
                                const appRole = appRoles.find((r) => r.key === roleKey);
                                const isSelected = effectiveRole === roleKey;
                                const isChecked = selectedRoleIds.has(appRole?.id ?? "");
                                const mCount = data.menus.filter((m) => m.permissions[roleKey]).length;
                                const aCount = data.menus.reduce((sum, menu) => sum + menu.actions.filter((action) => action.permissions[roleKey]).length, 0);
                                const pct = totalMenus > 0 ? Math.round(mCount / totalMenus * 100) : 0;
                                return (
                                    <div
                                        key={roleKey}
                                        className={cn(
                                            "group rounded-xl transition-all relative",
                                            isSelected
                                                ? "border-l-4 border-l-primary bg-primary/5 border border-primary/10"
                                                : "border border-transparent hover:bg-muted/30",
                                            isChecked && "ring-2 ring-primary/20"
                                        )}
                                    >
                                        <button onClick={() => setSelectedRole(roleKey)} className="w-full text-left p-3">
                                            <div className="flex items-center gap-3">
                                                {appRole && !appRole.isSystem && (
                                                    <Checkbox checked={isChecked} onCheckedChange={() => { const next = new Set(selectedRoleIds); if (next.has(appRole.id)) next.delete(appRole.id); else next.add(appRole.id); setSelectedRoleIds(next); }} className="shrink-0" onClick={(e) => e.stopPropagation()} />
                                                )}
                                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm", meta.color)}>
                                                    {meta.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className={cn("text-sm font-semibold", isSelected && "text-primary")}>{meta.label}</p>
                                                        {appRole?.isSystem && (
                                                            <Lock className="w-3 h-3 text-muted-foreground/50" />
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground truncate">{meta.description}</p>
                                                </div>
                                            </div>
                                            <div className="mt-2.5 pl-[52px] space-y-1.5">
                                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                    <span>{mCount}/{totalMenus} menu</span>
                                                    <span>{pct}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden">
                                                    <div
                                                        className={cn("h-full rounded-full transition-all duration-300", isSelected ? "bg-primary" : "bg-muted-foreground/30")}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">{aCount} aksi aktif</p>
                                            </div>
                                        </button>
                                        {/* Edit/Delete buttons - show on hover */}
                                        {appRole && (
                                            <div className="flex gap-1 px-3 pb-2 pl-[52px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                <DisabledActionTooltip disabled={!canUpdateRole} message={cannotMessage("update_role")} menuKey="access-control" actionKey="update_role">
                                                    <Button disabled={!canUpdateRole} variant="ghost" size="xs" className="h-6 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => openEditRole(appRole)}>
                                                        <Pencil className="w-3 h-3 mr-1" /> Edit
                                                    </Button>
                                                </DisabledActionTooltip>
                                                {!appRole.isSystem && (
                                                    <DisabledActionTooltip disabled={!canDeleteRole} message={cannotMessage("delete_role")} menuKey="access-control" actionKey="delete_role">
                                                        <Button disabled={!canDeleteRole} variant="ghost" size="xs" className="h-6 text-[10px] rounded-lg text-muted-foreground hover:text-red-500" onClick={() => setConfirmDelete(appRole)}>
                                                            <Trash2 className="w-3 h-3 mr-1" /> Hapus
                                                        </Button>
                                                    </DisabledActionTooltip>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Saving indicator */}
                        {pending && (
                            <div className="px-4 py-3 border-t border-border/20">
                                <div className="flex items-center gap-2 text-xs text-primary">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span className="animate-pulse">Menyimpan perubahan...</span>
                                </div>
                            </div>
                        )}

                        {/* Bottom add button */}
                        <div className="p-2 border-t border-border/20">
                            <DisabledActionTooltip disabled={!canCreateRole} message={cannotMessage("create_role")} menuKey="access-control" actionKey="create_role">
                                <Button
                                    disabled={!canCreateRole}
                                    variant="outline"
                                    className="w-full rounded-xl border-dashed text-muted-foreground hover:text-foreground text-xs h-9"
                                    onClick={() => { setFormKey(""); setFormName(""); setFormDesc(""); setFormColor("bg-slate-100 text-slate-700"); setFormCopyFrom(""); setCreateOpen(true); }}
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Tambah Role
                                </Button>
                            </DisabledActionTooltip>
                        </div>
                    </div>
                </div>

                {/* Right Content - Menu Permissions */}
                <div className="flex-1 min-w-0 space-y-4">
                    {/* Search bar + Role filter button (mobile) */}
                    <div className="">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/60" />
                                <Input
                                    placeholder="Cari menu..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setSearchQuery(v);
                                        if (debounceRef.current) clearTimeout(debounceRef.current);
                                        debounceRef.current = setTimeout(() => {
                                            fetchMatrix(v);
                                        }, 300);
                                    }}
                                    className="pl-9 sm:pl-12 h-9 sm:h-11 rounded-xl  focus:border-primary/30 focus:bg-white transition-colors"
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="lg:hidden shrink-0 rounded-xl h-9 gap-1.5"
                                onClick={() => setRoleSheetOpen(true)}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span className="text-xs max-w-[80px] truncate">{getRoleMeta(effectiveRole).label}</span>
                            </Button>
                        </div>
                    </div>

                    {/* Stats pills */}
                    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide sm:flex-wrap">
                        <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white border border-border/30 shadow-sm text-[11px] sm:text-xs text-muted-foreground shrink-0">
                            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500" />
                            <span className="font-medium text-foreground font-mono tabular-nums">{activeMenuCount}</span>/<span className="font-mono tabular-nums">{totalMenus}</span> menu
                        </div>
                        <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white border border-border/30 shadow-sm text-[11px] sm:text-xs text-muted-foreground shrink-0">
                            Role: <span className="font-medium text-foreground">{getRoleMeta(effectiveRole).label}</span>
                        </div>
                    </div>

                    {/* ===== Mobile: Card-based permission list ===== */}
                    <div className="lg:hidden space-y-3 pb-20">
                        {groupedMenus.map(([groupName, menus]) => {
                            const groupActiveCount = menus.filter((m) => m.permissions[effectiveRole]).length;
                            const isGroupExpanded = expandedGroups.has(groupName);
                            return (
                                <div key={groupName} className="rounded-xl border border-border/30 bg-white shadow-sm overflow-hidden">
                                    {/* Group header */}
                                    <button onClick={() => toggleGroup(groupName)} className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30">
                                        <div className="flex items-center gap-1.5">
                                            {isGroupExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{groupName}</span>
                                        </div>
                                        <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                                            <span className="text-foreground font-semibold">{groupActiveCount}</span>/{menus.length}
                                        </span>
                                    </button>
                                    {/* Menu items */}
                                    {isGroupExpanded && (
                                        <div className="divide-y divide-border/20">
                                            {menus.map((menu) => {
                                                const hasAccess = Boolean(menu.permissions[effectiveRole]);
                                                const isExpanded = expandedMenus.has(menu.id);
                                                const activeActions = menu.actions.filter((a) => a.permissions[effectiveRole]).length;
                                                return (
                                                    <div key={menu.id}>
                                                        <div className="flex items-center gap-2 px-3 py-2">
                                                            <div
                                                                className="flex items-center gap-2 flex-1 min-w-0"
                                                                onClick={() => { if (menu.actions.length > 0) toggleMenuExpand(menu.id); }}
                                                            >
                                                                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", hasAccess ? "bg-green-500" : "bg-muted-foreground/30")} />
                                                                <span className={cn("text-xs font-medium truncate", !hasAccess && "text-muted-foreground")}>{menu.name}</span>
                                                                {menu.actions.length > 0 && (
                                                                    <span className="text-[9px] text-muted-foreground font-mono tabular-nums shrink-0">{activeActions}/{menu.actions.length}</span>
                                                                )}
                                                            </div>
                                                            <Switch disabled={!canManageMenu} checked={hasAccess} onCheckedChange={(v) => toggleMenu(menu.id, effectiveRole, v)} className="scale-90 shrink-0" />
                                                            {menu.actions.length > 0 ? (
                                                                <button onClick={() => toggleMenuExpand(menu.id)} className="shrink-0 p-0.5">
                                                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                                                </button>
                                                            ) : (
                                                                <span className="w-4 shrink-0" />
                                                            )}
                                                        </div>
                                                        {isExpanded && hasAccess && menu.actions.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 px-3 pb-2 pl-6">
                                                                {menu.actions.map((action) => {
                                                                    const allowed = Boolean(action.permissions[effectiveRole]);
                                                                    return (
                                                                        <Button
                                                                            size={'sm'}
                                                                            key={action.id}
                                                                            disabled={!canManageAction}
                                                                            onClick={() => toggleAction(action.id, effectiveRole, !allowed)}
                                                                            className={cn(
                                                                                "text-[10px] px-2 py-1 rounded-md font-medium transition-all",
                                                                                allowed
                                                                                    ? "bg-primary/10 text-primary"
                                                                                    : "bg-muted/60 text-muted-foreground",
                                                                                !canManageAction && "opacity-60 cursor-not-allowed"
                                                                            )}
                                                                        >
                                                                            {ACTION_LABELS[action.key] ?? action.key}
                                                                        </Button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {groupedMenus.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-12 h-12 mx-auto rounded-xl bg-muted/30 flex items-center justify-center mb-3">
                                    <Search className="w-6 h-6 text-muted-foreground/30" />
                                </div>
                                <p className="text-xs font-medium text-muted-foreground">Tidak ada menu ditemukan</p>
                            </div>
                        )}
                    </div>

                    {/* ===== Desktop: Group cards (original layout) ===== */}
                    <div className="hidden lg:block space-y-4">
                        {groupedMenus.map(([groupName, menus]) => {
                            const groupActiveCount = menus.filter((m) => m.permissions[effectiveRole]).length;
                            const groupPct = menus.length > 0 ? Math.round(groupActiveCount / menus.length * 100) : 0;
                            return (
                                <div key={groupName} className="bg-white rounded-2xl border border-border/30 shadow-sm overflow-hidden">
                                    <button onClick={() => toggleGroup(groupName)} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-0.5 h-5 rounded-full bg-gradient-to-b from-primary to-primary/40" />
                                            {expandedGroups.has(groupName) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                            <span className="text-sm font-bold text-foreground">{groupName}</span>
                                            <Badge variant="secondary" className="text-[10px] rounded-full px-2">{menus.length}</Badge>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-16 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full bg-primary/60 transition-all duration-300" style={{ width: `${groupPct}%` }} />
                                            </div>
                                            <span className="text-[11px] text-muted-foreground font-medium">{groupActiveCount}/{menus.length} aktif</span>
                                        </div>
                                    </button>

                                    {expandedGroups.has(groupName) && (
                                        <div className="border-t border-border/20">
                                            {menus.map((menu, idx) => {
                                                const hasAccess = Boolean(menu.permissions[effectiveRole]);
                                                const isExpanded = expandedMenus.has(menu.id);
                                                const activeActions = menu.actions.filter((a) => a.permissions[effectiveRole]).length;
                                                return (
                                                    <div key={menu.id} className={cn("border-b border-border/10 last:border-0", idx % 2 === 1 && "bg-muted/5")}>
                                                        <div className={cn(
                                                            "flex items-center gap-3 px-5 py-3 hover:bg-muted/10 transition-colors",
                                                            hasAccess && "border-l-2 border-l-green-400"
                                                        )}>
                                                            {menu.actions.length > 0 ? (
                                                                <button onClick={() => toggleMenuExpand(menu.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                                                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                </button>
                                                            ) : <div className="w-3.5" />}
                                                            <div className={cn("shrink-0", !hasAccess && "opacity-40")}>
                                                                {hasAccess ? <CheckCircle2 className="w-4.5 h-4.5 text-green-500" /> : <XCircle className="w-4.5 h-4.5 text-muted-foreground" />}
                                                            </div>
                                                            <div className={cn("flex-1 min-w-0", !hasAccess && "opacity-50")}>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-medium">{menu.name}</span>
                                                                    {menu.actions.length > 0 && (
                                                                        <span className="text-[10px] text-muted-foreground">{activeActions}/{menu.actions.length} aksi</span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[11px] text-muted-foreground font-mono">{menu.path}</p>
                                                            </div>
                                                            <Switch disabled={!canManageMenu} checked={hasAccess} onCheckedChange={(v) => toggleMenu(menu.id, effectiveRole, v)} />
                                                        </div>

                                                        {isExpanded && menu.actions.length > 0 && (
                                                            <div className="mx-5 mb-3 ml-14">
                                                                <div className="bg-slate-50 rounded-xl p-3">
                                                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                                                                        {menu.actions.map((action) => {
                                                                            const allowed = Boolean(action.permissions[effectiveRole]);
                                                                            return (
                                                                                <button key={action.id} disabled={!canManageAction} onClick={() => toggleAction(action.id, effectiveRole, !allowed)}
                                                                                    className={cn(
                                                                                        "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all",
                                                                                        allowed
                                                                                            ? "bg-primary text-white shadow-sm shadow-primary/20"
                                                                                            : "bg-white border border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                                                                                        !canManageAction && "opacity-60 cursor-not-allowed"
                                                                                    )}>
                                                                                    {allowed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                                                    {ACTION_LABELS[action.key] ?? action.key}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {groupedMenus.length === 0 && (
                            <div className="text-center py-16">
                                <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                                    <Search className="w-8 h-8 text-muted-foreground/30" />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">Tidak ada menu ditemukan</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Coba ubah kata kunci pencarian</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile: Sticky bottom "Tambah Role" button */}
            <div className="lg:hidden fixed bottom-4 right-4 z-50">
                <DisabledActionTooltip disabled={!canCreateRole} message={cannotMessage("create_role")} menuKey="access-control" actionKey="create_role">
                    <Button
                        disabled={!canCreateRole}
                        size="lg"
                        className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 shadow-xl shadow-primary/30 h-12 px-5"
                        onClick={() => { setFormKey(""); setFormName(""); setFormDesc(""); setFormColor("bg-slate-100 text-slate-700"); setFormCopyFrom(""); setCreateOpen(true); }}
                    >
                        <Plus className="w-5 h-5 mr-2" /> Tambah Role
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* Create Role Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="rounded-2xl max-w-lg p-0 overflow-hidden max-h-[90vh]">
                    <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/50 shrink-0" />
                    <div className="p-6 space-y-5 overflow-y-auto">
                        <DialogHeader><DialogTitle className="text-lg">Tambah Role Baru</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Key (Identifier) <span className="text-red-400">*</span></Label>
                                <Input value={formKey} onChange={(e) => setFormKey(e.target.value.toUpperCase().replace(/\s+/g, "_"))} className="rounded-xl font-mono h-10" placeholder="CUSTOM_ROLE" />
                                <p className="text-[11px] text-muted-foreground">Huruf kapital, tanpa spasi. Contoh: SUPERVISOR, HEAD_CASHIER</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Nama Role <span className="text-red-400">*</span></Label>
                                <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="rounded-xl h-10" placeholder="Nama tampilan role" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Deskripsi</Label>
                                <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="rounded-xl h-10" placeholder="Opsional" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Warna</Label>
                                <div className="flex flex-wrap gap-2.5">
                                    {DEFAULT_COLORS.map((c) => (
                                        <div key={c.value} className="group/color relative">
                                            <button type="button" disabled={!canUpdateRole} onClick={() => setFormColor(c.value)}
                                                className={cn("w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xs font-bold transition-all",
                                                    c.value, formColor === c.value ? "border-foreground ring-2 ring-foreground/20 scale-110" : "border-transparent hover:scale-105"
                                                )}>
                                                {formColor === c.value && "✓"}
                                            </button>
                                            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground opacity-0 group-hover/color:opacity-100 transition-opacity whitespace-nowrap">{c.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2 pt-2">
                                <Label className="text-sm font-medium">Salin Permission Dari</Label>
                                <Select value={formCopyFrom} onValueChange={setFormCopyFrom}>
                                    <SelectTrigger className="rounded-xl w-full h-10"><SelectValue placeholder="Mulai dari kosong" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Mulai dari kosong</SelectItem>
                                        {appRoles.map((r) => {
                                            const roleMeta = getRoleMeta(r.key);
                                            return (
                                                <SelectItem key={r.key} value={r.key}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold", roleMeta.color)}>
                                                            {roleMeta.icon}
                                                        </div>
                                                        {r.name}
                                                    </div>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground">Permission bisa diatur setelah role dibuat</p>
                            </div>
                            <div className="flex justify-end gap-2 pt-3">
                                <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Batal</Button>
                                <DisabledActionTooltip disabled={!canCreateRole} message={cannotMessage("create_role")} menuKey="access-control" actionKey="create_role">
                                    <Button onClick={handleCreateRole} className="rounded-xl bg-gradient-to-r from-primary to-primary/80" disabled={!canCreateRole || !formKey || !formName}>Buat Role</Button>
                                </DisabledActionTooltip>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Role Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="rounded-2xl max-w-md p-0 overflow-hidden max-h-[90vh]">
                    <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/50 shrink-0" />
                    <div className="p-6 space-y-5 overflow-y-auto">
                        <DialogHeader><DialogTitle className="text-lg">Edit Role: {editingRole?.key}</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Nama Role</Label>
                                <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="rounded-xl h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Deskripsi</Label>
                                <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="rounded-xl h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Warna</Label>
                                <div className="flex flex-wrap gap-2.5">
                                    {DEFAULT_COLORS.map((c) => (
                                        <div key={c.value} className="group/color relative">
                                            <button type="button" disabled={!canCreateRole} onClick={() => setFormColor(c.value)}
                                                className={cn("w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xs font-bold transition-all",
                                                    c.value, formColor === c.value ? "border-foreground ring-2 ring-foreground/20 scale-110" : "border-transparent hover:scale-105"
                                                )}>
                                                {formColor === c.value && "✓"}
                                            </button>
                                            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground opacity-0 group-hover/color:opacity-100 transition-opacity whitespace-nowrap">{c.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-3">
                                <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">Batal</Button>
                                <DisabledActionTooltip disabled={!canUpdateRole} message={cannotMessage("update_role")} menuKey="access-control" actionKey="update_role">
                                    <Button disabled={!canUpdateRole} onClick={handleUpdateRole} className="rounded-xl bg-gradient-to-r from-primary to-primary/80">Simpan</Button>
                                </DisabledActionTooltip>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ActionConfirmDialog
                open={submitConfirmOpen}
                onOpenChange={(v) => { setSubmitConfirmOpen(v); if (!v) { setPendingSubmitAction(null); } }}
                kind={submitConfirmKind}
                title={submitConfirmTitle}
                description={submitConfirmText}
                confirmLabel={submitConfirmKind === "delete" ? "Ya, Hapus" : "Ya, Lanjutkan"}
                confirmDisabled={submitConfirmKind === "delete" ? !canDeleteRole : !canCreateRole && !canUpdateRole}
                onConfirm={async () => { await pendingSubmitAction?.(); }}
                size="sm"
            />
            <ActionConfirmDialog
                open={!!confirmDelete}
                onOpenChange={(v) => { if (!v) setConfirmDelete(null); }}
                kind="delete"
                title="Hapus Role?"
                description={`Yakin ingin menghapus role ${confirmDelete?.name ?? ""}? Semua permission untuk role ini akan dihapus permanen.`}
                confirmLabel="Ya, Hapus"
                confirmDisabled={!canDeleteRole}
                onConfirm={handleDeleteRole}
                size="sm"
            />
            <BulkActionBar
                selectedCount={selectedRoleIds.size}
                actions={[{
                    label: "Hapus",
                    variant: "destructive",
                    icon: <Trash2 className="w-3 h-3" />,
                    onClick: () => { if (canDeleteRole) setBulkConfirmOpen(true); },
                }]}
                onClear={() => setSelectedRoleIds(new Set())}
            />
            <ActionConfirmDialog
                open={bulkConfirmOpen}
                onOpenChange={setBulkConfirmOpen}
                title={`Hapus ${selectedRoleIds.size} Role`}
                description={`Yakin ingin menghapus ${selectedRoleIds.size} role? Tindakan ini tidak dapat dibatalkan.`}
                kind="delete"
                onConfirm={async () => {
                    const { count } = await accessControlService.bulkDeleteRoles([...selectedRoleIds]);
                    toast.success(`${count} role dihapus`);
                    setSelectedRoleIds(new Set());
                    setBulkConfirmOpen(false);
                    startTransition(async () => {
                        const [matrix, roles] = await Promise.all([
                            accessControlService.getAccessControlMatrix(),
                            accessControlService.getRoles(),
                        ]);
                        setData(matrix);
                        setAppRoles(roles as AppRoleData[]);
                    });
                }}
            />
        </div>
    );
}
