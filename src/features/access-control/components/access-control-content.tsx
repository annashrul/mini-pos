"use client";

import { useMemo, useState, useTransition } from "react";
import {
    accessControlService,
    updateRoleActionPermission,
    updateRoleMenuPermission,
} from "@/features/access-control";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { AccessMenu } from "@/types";
import {
    Shield, ChevronDown, ChevronRight, Search, CheckCircle2, XCircle,
    Lock, Loader2, Plus, Pencil, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppRoleData {
    id: string;
    key: string;
    name: string;
    description: string | null;
    color: string | null;
    isSystem: boolean;
    isActive: boolean;
}

interface Props {
    initialData: { error?: string | null; roles: string[]; menus: AccessMenu[] };
    appRoles: AppRoleData[];
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

export function AccessControlContent({ initialData, appRoles: initialRoles }: Props) {
    const [data, setData] = useState(initialData);
    const [appRoles, setAppRoles] = useState(initialRoles);
    const [pending, startTransition] = useTransition();
    const roleKeys = useMemo(
        () => appRoles.filter((role) => role.isActive).map((role) => role.key),
        [appRoles]
    );
    const [selectedRole, setSelectedRole] = useState(roleKeys[0] ?? data.roles[0] ?? "SUPER_ADMIN");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["Utama", "Master Data"]));
    const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

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
    const effectiveRole = roleKeys.includes(selectedRole) ? selectedRole : (roleKeys[0] ?? "SUPER_ADMIN");

    const groupedMenus = useMemo(() => {
        const groups = new Map<string, AccessMenu[]>();
        for (const menu of data.menus) {
            if (searchQuery && !menu.name.toLowerCase().includes(searchQuery.toLowerCase())) continue;
            const current = groups.get(menu.group) ?? [];
            current.push(menu);
            groups.set(menu.group, current);
        }
        return Array.from(groups.entries());
    }, [data.menus, searchQuery]);

    const toggleGroup = (group: string) => {
        setExpandedGroups((prev) => { const n = new Set(prev); if (n.has(group)) n.delete(group); else n.add(group); return n; });
    };
    const toggleMenuExpand = (menuId: string) => {
        setExpandedMenus((prev) => { const n = new Set(prev); if (n.has(menuId)) n.delete(menuId); else n.add(menuId); return n; });
    };

    const toggleMenu = (menuId: string, role: string, allowed: boolean) => {
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
    const handleCreateRole = async () => {
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

    const handleUpdateRole = async () => {
        if (!editingRole) return;
        const result = await accessControlService.updateRole(editingRole.id, { name: formName, description: formDesc, color: formColor });
        if (result.error) { toast.error(result.error); return; }
        toast.success("Role berhasil diupdate");
        setEditOpen(false);
        setAppRoles((prev) => prev.map((r) => r.id === editingRole.id ? { ...r, name: formName, description: formDesc, color: formColor } : r));
    };

    const handleDeleteRole = async () => {
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
    console.log("####", data)

    if (data.error) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center space-y-2">
                    <Lock className="w-10 h-10 mx-auto text-muted-foreground/40" />
                    <p className="text-sm text-red-500">{data.error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Shield className="w-6 h-6 text-primary" /> Hak Akses & Role
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Kelola role dan atur akses menu per role</p>
                </div>
            </div>

            <div className="flex gap-5">
                <div className="sticky top-4 h-fit max-h-[calc(100vh-7rem)] w-[280px] shrink-0 space-y-3 overflow-y-auto pr-1">
                    <div className="space-y-2">
                        {roleKeys.map((roleKey) => {
                            const meta = getRoleMeta(roleKey);
                            const appRole = appRoles.find((r) => r.key === roleKey);
                            const isSelected = effectiveRole === roleKey;
                            const mCount = data.menus.filter((m) => m.permissions[roleKey]).length;
                            const aCount = data.menus.reduce((sum, menu) => sum + menu.actions.filter((action) => action.permissions[roleKey]).length, 0);
                            return (
                                <div
                                    key={roleKey}
                                    className={cn(
                                        "rounded-xl border transition-all",
                                        isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border/40 hover:border-border"
                                    )}
                                >
                                    <button onClick={() => setSelectedRole(roleKey)} className="w-full text-left p-3">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0", meta.color)}>
                                                {meta.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className={cn("text-sm font-semibold", isSelected && "text-primary")}>{meta.label}</p>
                                                    {appRole?.isSystem && <Badge className="text-[9px] h-4 bg-muted text-muted-foreground">Sistem</Badge>}
                                                </div>
                                                <p className="text-[11px] text-muted-foreground truncate">{meta.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-2 pl-12">
                                            <Badge variant="secondary" className="text-[10px] rounded-md">{mCount}/{totalMenus} menu</Badge>
                                            <Badge variant="secondary" className="text-[10px] rounded-md">{aCount} aksi</Badge>
                                            <Badge variant="secondary" className="text-[10px] rounded-md">{totalMenus > 0 ? Math.round(mCount / totalMenus * 100) : 0}%</Badge>
                                        </div>
                                    </button>
                                    {/* Edit/Delete buttons */}
                                    {appRole && (
                                        <div className="flex gap-1 px-3 pb-2 pl-14">
                                            <Button variant="ghost" size="sm" className="h-6 text-[10px] rounded-md text-muted-foreground hover:text-foreground" onClick={() => openEditRole(appRole)}>
                                                <Pencil className="w-3 h-3 mr-1" /> Edit
                                            </Button>
                                            {!appRole.isSystem && (
                                                <Button variant="ghost" size="sm" className="h-6 text-[10px] rounded-md text-muted-foreground hover:text-red-500" onClick={() => setConfirmDelete(appRole)}>
                                                    <Trash2 className="w-3 h-3 mr-1" /> Hapus
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {pending && <div className="flex items-center gap-2 text-xs text-primary px-1"><Loader2 className="w-3 h-3 animate-spin" /> Menyimpan...</div>}
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                    <div className="rounded-xl border border-border/40 bg-white p-3">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input placeholder="Cari menu..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 rounded-lg" />
                            </div>
                            <Button className="rounded-lg" onClick={() => { setFormKey(""); setFormName(""); setFormDesc(""); setFormColor("bg-slate-100 text-slate-700"); setFormCopyFrom(""); setCreateOpen(true); }}>
                                <Plus className="w-4 h-4 mr-2" /> Tambah Role
                            </Button>
                        </div>
                    </div>

                    {groupedMenus.map(([groupName, menus]) => (
                        <div key={groupName} className="bg-white rounded-xl border border-border/40 overflow-hidden">
                            <button onClick={() => toggleGroup(groupName)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center gap-2">
                                    {expandedGroups.has(groupName) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                    <span className="text-sm font-semibold">{groupName}</span>
                                    <Badge variant="secondary" className="text-[10px] rounded-md">{menus.length}</Badge>
                                </div>
                                <span className="text-[11px] text-muted-foreground">{menus.filter((m) => m.permissions[effectiveRole]).length}/{menus.length} aktif</span>
                            </button>

                            {expandedGroups.has(groupName) && (
                                <div className="border-t border-border/30">
                                    {menus.map((menu) => {
                                        const hasAccess = Boolean(menu.permissions[effectiveRole]);
                                        const isExpanded = expandedMenus.has(menu.id);
                                        const activeActions = menu.actions.filter((a) => a.permissions[effectiveRole]).length;
                                        return (
                                            <div key={menu.id} className="border-b border-border/20 last:border-0">
                                                <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/10 transition-colors">
                                                    {menu.actions.length > 0 ? (
                                                        <button onClick={() => toggleMenuExpand(menu.id)} className="text-muted-foreground hover:text-foreground">
                                                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                        </button>
                                                    ) : <div className="w-3.5" />}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium">{menu.name}</span>
                                                            {menu.actions.length > 0 && <span className="text-[10px] text-muted-foreground">({activeActions}/{menu.actions.length} aksi)</span>}
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground">{menu.path}</p>
                                                    </div>
                                                    {hasAccess ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400/50 shrink-0" />}
                                                    <Switch checked={hasAccess} onCheckedChange={(v) => toggleMenu(menu.id, effectiveRole, v)} />
                                                </div>

                                                {isExpanded && menu.actions.length > 0 && (
                                                    <div className="bg-muted/20 px-4 py-2 pl-12">
                                                        <div className="flex flex-wrap gap-2">
                                                            {menu.actions.map((action) => {
                                                                const allowed = Boolean(action.permissions[effectiveRole]);
                                                                return (
                                                                    <button key={action.id} onClick={() => toggleAction(action.id, effectiveRole, !allowed)}
                                                                        className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all",
                                                                            allowed ? "bg-primary/10 border-primary/30 text-primary" : "bg-white border-border/50 text-muted-foreground hover:border-border"
                                                                        )}>
                                                                        {allowed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                                        {ACTION_LABELS[action.key] ?? action.key}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}

                    {groupedMenus.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground/40">
                            <Search className="w-10 h-10 mx-auto mb-2" />
                            <p className="text-sm">Tidak ada menu ditemukan</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Role Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader><DialogTitle>Tambah Role Baru</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm">Key (Identifier) <span className="text-red-400">*</span></Label>
                            <Input value={formKey} onChange={(e) => setFormKey(e.target.value.toUpperCase().replace(/\s+/g, "_"))} className="rounded-lg font-mono" placeholder="CUSTOM_ROLE" />
                            <p className="text-[11px] text-muted-foreground">Huruf kapital, tanpa spasi. Contoh: SUPERVISOR, HEAD_CASHIER</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Nama Role <span className="text-red-400">*</span></Label>
                            <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="rounded-lg" placeholder="Nama tampilan role" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Deskripsi</Label>
                            <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="rounded-lg" placeholder="Opsional" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Warna</Label>
                            <div className="flex flex-wrap gap-2">
                                {DEFAULT_COLORS.map((c) => (
                                    <button key={c.value} type="button" onClick={() => setFormColor(c.value)}
                                        className={cn("w-8 h-8 rounded-lg border-2 flex items-center justify-center text-[10px] font-bold transition-all",
                                            c.value, formColor === c.value ? "border-foreground ring-2 ring-foreground/20" : "border-transparent"
                                        )}>
                                        {formColor === c.value && "✓"}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Salin Permission Dari</Label>
                            <Select value={formCopyFrom} onValueChange={setFormCopyFrom}>
                                <SelectTrigger className="rounded-lg w-full"><SelectValue placeholder="Mulai dari kosong" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Mulai dari kosong</SelectItem>
                                    {appRoles.map((r) => (
                                        <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground">Permission bisa diatur setelah role dibuat</p>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-lg">Batal</Button>
                            <Button onClick={handleCreateRole} className="rounded-lg" disabled={!formKey || !formName}>Buat Role</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Role Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader><DialogTitle>Edit Role: {editingRole?.key}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm">Nama Role</Label>
                            <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="rounded-lg" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Deskripsi</Label>
                            <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="rounded-lg" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Warna</Label>
                            <div className="flex flex-wrap gap-2">
                                {DEFAULT_COLORS.map((c) => (
                                    <button key={c.value} type="button" onClick={() => setFormColor(c.value)}
                                        className={cn("w-8 h-8 rounded-lg border-2 flex items-center justify-center text-[10px] font-bold transition-all",
                                            c.value, formColor === c.value ? "border-foreground ring-2 ring-foreground/20" : "border-transparent"
                                        )}>
                                        {formColor === c.value && "✓"}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-lg">Batal</Button>
                            <Button onClick={handleUpdateRole} className="rounded-lg">Simpan</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm Dialog */}
            <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <DialogHeader><DialogTitle>Hapus Role</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Yakin ingin menghapus role <strong>{confirmDelete?.name}</strong>? Semua permission untuk role ini akan dihapus.
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setConfirmDelete(null)} className="rounded-lg">Batal</Button>
                        <Button variant="destructive" onClick={handleDeleteRole} className="rounded-lg">Ya, Hapus</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
