"use client";

import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Building2, CheckCircle2, MapPin, Pencil, Phone, Plus, Trash2, XCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Branch } from "@/types";

export function BranchesGrid(props: {
    branches: Branch[];
    loading: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    cannotMessage: (action: string) => string;
    onCreateFirst: () => void;
    onEdit: (branch: Branch) => void;
    onDelete: (id: string) => void;
    selectedIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
    onCardClick?: (branch: Branch) => void;
}) {
    const { branches, loading, canCreate, canUpdate, canDelete, cannotMessage, onCreateFirst, onEdit, onDelete, selectedIds, onToggleSelect, onCardClick } = props;

    if (loading && branches.length === 0) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border/40 bg-white p-5 space-y-3 animate-pulse">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-200" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-4 w-32 bg-gray-200 rounded" />
                                <div className="h-3 w-24 bg-gray-200 rounded" />
                            </div>
                        </div>
                        <div className="h-3 w-full bg-gray-200 rounded" />
                        <div className="flex justify-between">
                            <div className="h-5 w-16 bg-gray-200 rounded-full" />
                            <div className="h-5 w-12 bg-gray-200 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (branches.length === 0) {
        if (loading) return null;
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-100 to-teal-100 mx-auto">
                    <Building2 className="w-8 h-8 text-cyan-400" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">Belum ada cabang</h3>
                <p className="text-sm text-muted-foreground mt-1">Mulai tambahkan cabang pertama untuk mengelola toko Anda.</p>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="branches" actionKey="create">
                    <Button
                        disabled={!canCreate}
                        className="rounded-xl mt-3 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                        onClick={onCreateFirst}
                    >
                        <Plus className="w-4 h-4 mr-2" /> Tambah Cabang Pertama
                    </Button>
                </DisabledActionTooltip>
            </div>
        );
    }

    return (
        <div className={loading ? "opacity-50 pointer-events-none transition-opacity" : ""}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {branches.map((branch) => {
                    const isSelected = selectedIds?.has(branch.id) ?? false;
                    return (
                    <div key={branch.id} className={`rounded-xl border bg-white hover:shadow-md transition-all group relative overflow-hidden cursor-pointer ${isSelected ? "border-primary ring-2 ring-primary/20" : "border-border/40"}`} onClick={() => onCardClick?.(branch)}>
                        <div className={`h-1 w-full ${branch.isActive ? "bg-gradient-to-r from-cyan-500 to-teal-500" : "bg-gradient-to-r from-gray-300 to-gray-400"}`} />

                        <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    {onToggleSelect && (
                                        <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(branch.id)} className="shrink-0" onClick={(e) => e.stopPropagation()} />
                                    )}
                                    <div
                                        className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${branch.isActive ? "bg-gradient-to-br from-cyan-100 to-teal-100" : "bg-gradient-to-br from-gray-100 to-gray-200"
                                            }`}
                                    >
                                        <Building2 className={`w-5 h-5 ${branch.isActive ? "text-cyan-600" : "text-gray-400"}`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-foreground truncate">{branch.name}</p>
                                        {branch.isActive ? (
                                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-emerald-200 bg-emerald-50/50 text-emerald-600 ring-1 ring-emerald-100">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Aktif
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-red-200 bg-red-50/50 text-red-600 ring-1 ring-red-100">
                                                <XCircle className="w-3 h-3" />
                                                Nonaktif
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                    <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="branches" actionKey="update">
                                        <Button
                                            disabled={!canUpdate}
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                            onClick={() => onEdit(branch)}
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                    </DisabledActionTooltip>
                                    <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="branches" actionKey="delete">
                                        <Button
                                            disabled={!canDelete}
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                                            onClick={() => onDelete(branch.id)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </DisabledActionTooltip>
                                </div>
                            </div>

                            {branch.address && (
                                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground/60" />
                                    <span className="line-clamp-2">{branch.address}</span>
                                </p>
                            )}

                            {branch.phone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                                    {branch.phone}
                                </p>
                            )}
                        </div>
                    </div>
                    );
                })}
            </div>
        </div>
    );
}

