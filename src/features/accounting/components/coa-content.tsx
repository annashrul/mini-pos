"use client";

import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { ExportMenu } from "@/components/ui/export-menu";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { useMenuActionAccess } from "@/features/access-control";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  CreditCard,
  Landmark,
  TrendingUp,
  Receipt,
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  BookOpen,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoa } from "../hooks";
import { CATEGORY_CONFIG, CATEGORY_ORDER } from "../utils";
import type { Account } from "../types";
import { AccountDialog } from "./account-dialog";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  ASET: Building2,
  KEWAJIBAN: CreditCard,
  MODAL: Landmark,
  PENDAPATAN: TrendingUp,
  BEBAN: Receipt,
};

const CATEGORY_BORDER_COLORS: Record<string, string> = {
  ASET: "border-l-blue-500",
  KEWAJIBAN: "border-l-rose-500",
  MODAL: "border-l-purple-500",
  PENDAPATAN: "border-l-emerald-500",
  BEBAN: "border-l-amber-500",
};

function AccountRow({
  account,
  depth = 0,
  onEdit,
  onDelete,
  canUpdate = true,
  canDelete = true,
}: {
  account: Account;
  depth?: number;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  canUpdate?: boolean;
  canDelete?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = account.children && account.children.length > 0;

  return (
    <>
      <div
        className="group flex items-center gap-1.5 sm:gap-3 py-2 sm:py-2.5 px-2 sm:px-4 hover:bg-gray-50/80 rounded-lg sm:rounded-xl transition-all duration-150"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded transition-colors shrink-0"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>
        ) : (
          <span className="w-4 sm:w-5 shrink-0" />
        )}

        <span className="font-mono text-[11px] sm:text-sm text-gray-500 w-14 sm:w-24 shrink-0 tabular-nums">
          {account.code}
        </span>

        <span className="text-xs sm:text-sm font-medium text-gray-900 flex-1 truncate">
          {account.name}
        </span>

        {!account.isActive && (
          <Badge
            variant="outline"
            className="text-[10px] sm:text-[11px] bg-gray-100 text-gray-400 border-gray-200 px-1.5 sm:px-2"
          >
            Nonaktif
          </Badge>
        )}

        <span className="text-[11px] sm:text-sm font-semibold font-mono tabular-nums w-20 sm:w-36 text-right text-gray-800 shrink-0">
          {formatCurrency(account.balance)}
        </span>

        <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-1">
          <DisabledActionTooltip disabled={!canUpdate} message="Anda tidak memiliki akses" menuKey="accounting-coa" actionKey="update">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-blue-50"
              onClick={() => onEdit(account)}
              disabled={!canUpdate}
            >
              <Pencil className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500" />
            </Button>
          </DisabledActionTooltip>
          <DisabledActionTooltip disabled={!canDelete} message="Anda tidak memiliki akses" menuKey="accounting-coa" actionKey="delete">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-red-50"
              onClick={() => onDelete(account)}
              disabled={!canDelete}
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500" />
          </Button>
          </DisabledActionTooltip>
        </div>
      </div>

      {expanded &&
        hasChildren &&
        account.children!.map((child) => (
          <AccountRow
            key={child.id}
            account={child}
            depth={depth + 1}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

export function COAContent() {
  const {
    allAccounts,
    search,
    setSearch,
    collapsedCategories,
    dialogOpen,
    editingAccount,
    loading,
    initialLoad,
    filteredTree,
    stats,
    toggleCategory,
    handleEdit,
    handleDelete,
    handleDialogClose,
    handleOpenCreate,
  } = useCoa();

  const { canAction, cannotMessage } = useMenuActionAccess("accounting-coa");
  const { canAction: canPlan } = usePlanAccess();
  const canCreate = canAction("create") && canPlan("accounting-coa", "create");
  const canUpdate = canAction("update") && canPlan("accounting-coa", "update");
  const canDelete = canAction("delete") && canPlan("accounting-coa", "delete");

  const statsCards = [
    {
      label: "Total Akun",
      value: stats.totalAccounts.toString(),
      icon: BookOpen,
      gradient: "from-blue-500 to-indigo-600",
      shadow: "shadow-blue-500/20",
    },
    {
      label: "Total Aset",
      value: formatCurrency(stats.aset),
      icon: Building2,
      gradient: "from-blue-500 to-cyan-500",
      shadow: "shadow-cyan-500/20",
    },
    {
      label: "Kewajiban",
      value: formatCurrency(stats.kewajiban),
      icon: CreditCard,
      gradient: "from-rose-500 to-pink-500",
      shadow: "shadow-rose-500/20",
    },
    {
      label: "Modal",
      value: formatCurrency(stats.modal),
      icon: Landmark,
      gradient: "from-purple-500 to-violet-500",
      shadow: "shadow-purple-500/20",
    },
  ];

  // ── Loading skeleton ────────────────────────────────────────────────
  if (initialLoad) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <Skeleton className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl" />
            <div className="space-y-1.5 sm:space-y-2">
              <Skeleton className="h-5 sm:h-7 w-40 sm:w-52" />
              <Skeleton className="h-3.5 sm:h-4 w-52 sm:w-72" />
            </div>
          </div>
          <Skeleton className="hidden sm:block h-10 w-32 rounded-xl" />
        </div>

        {/* Search skeleton */}
        <Skeleton className="h-9 sm:h-10 w-full sm:w-80 rounded-xl" />

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] sm:h-[104px] rounded-xl sm:rounded-2xl" />
          ))}
        </div>

        {/* Tree skeleton */}
        <div className="space-y-2 sm:space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl sm:rounded-2xl overflow-hidden">
              <Skeleton className="h-10 sm:h-14 w-full" />
              <div className="space-y-1 p-1.5 sm:p-2">
                <Skeleton className="h-8 sm:h-10 w-full rounded-lg sm:rounded-xl" />
                <Skeleton className="h-8 sm:h-10 w-full rounded-lg sm:rounded-xl" />
                <Skeleton className="h-8 sm:h-10 w-[95%] rounded-lg sm:rounded-xl ml-5 sm:ml-7" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <BookOpen className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
              Bagan Akun (COA)
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Kelola chart of accounts perusahaan Anda
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <ExportMenu module="coa" />
          <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="accounting-coa" actionKey="create">
            <Button
              onClick={handleOpenCreate}
              disabled={!canCreate}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/20 gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Tambah Akun
            </Button>
          </DisabledActionTooltip>
        </div>
      </div>

      {/* Mobile: Floating button */}
      <div className="sm:hidden fixed bottom-4 right-4 z-50">
        <Button
          onClick={handleOpenCreate}
          size="icon"
          className="h-12 w-12 rounded-full shadow-xl shadow-blue-300/50 bg-gradient-to-br from-blue-500 to-indigo-600"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="relative sm:max-w-sm">
        <Search className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Cari kode atau nama akun..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 sm:pl-10 rounded-xl h-9 sm:h-10 text-sm border-gray-200 focus-visible:ring-blue-500/20"
        />
      </div>

      {/* ── Stats Bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {statsCards.map((s) => (
          <Card
            key={s.label}
            className="rounded-xl sm:rounded-2xl border-0 shadow-sm bg-white hover:shadow-md transition-shadow duration-200"
          >
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center gap-2.5 sm:block">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br ${s.gradient} ${s.shadow} shadow-lg flex items-center justify-center shrink-0 sm:mb-3`}
                >
                  <s.icon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 sm:order-2 sm:mt-1">{s.label}</p>
                  <p className="text-sm sm:text-lg font-bold text-gray-900 font-mono tabular-nums truncate">
                    {s.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Account Tree ───────────────────────────────────────────────── */}
      {loading && !initialLoad && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-gray-500">Memuat data...</span>
        </div>
      )}

      {filteredTree.length === 0 && !loading && (
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-sm bg-white">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-20 text-gray-400">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gray-100 flex items-center justify-center mb-3 sm:mb-4">
              <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-gray-300" />
            </div>
            <p className="text-sm sm:text-base font-medium text-gray-500 mb-1">
              Belum ada akun
            </p>
            <p className="text-xs sm:text-sm text-gray-400">
              Mulai dengan menambahkan akun pertama Anda
            </p>
          </CardContent>
        </Card>
      )}

      {filteredTree.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          {CATEGORY_ORDER.map((catKey) => {
            const catData = filteredTree.find((t) => t.category === catKey);
            if (!catData) return null;
            const config = CATEGORY_CONFIG[catKey];
            if (!config) return null;
            const isCollapsed = collapsedCategories.has(catKey);
            const Icon = CATEGORY_ICONS[catKey] || BookOpen;
            const borderColor =
              CATEGORY_BORDER_COLORS[catKey] || "border-l-gray-300";

            return (
              <Card
                key={catKey}
                className={`rounded-xl sm:rounded-2xl border-0 shadow-sm bg-white overflow-hidden border-l-4 ${borderColor}`}
              >
                <CardContent className="p-0">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(catKey)}
                    className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-4 ${config.bgColor} hover:opacity-90 transition-all duration-150`}
                  >
                    <div
                      className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-white/60 flex items-center justify-center shrink-0"
                    >
                      <Icon className={`w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 ${config.color}`} />
                    </div>

                    <span
                      className={`font-bold text-xs sm:text-sm ${config.color} tracking-wide`}
                    >
                      {config.label}
                    </span>

                    <Badge
                      variant="outline"
                      className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 ${config.badgeColor} border-0 font-medium`}
                    >
                      {catData.accounts.length}
                    </Badge>

                    <div className="flex-1" />

                    <span
                      className={`text-[11px] sm:text-sm font-bold font-mono tabular-nums ${config.color}`}
                    >
                      {formatCurrency(catData.total)}
                    </span>

                    <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shrink-0">
                      {isCollapsed ? (
                        <ChevronRight
                          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${config.color} transition-transform duration-200`}
                        />
                      ) : (
                        <ChevronDown
                          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${config.color} transition-transform duration-200`}
                        />
                      )}
                    </div>
                  </button>

                  {/* Account rows with smooth transition */}
                  <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      isCollapsed
                        ? "max-h-0 opacity-0"
                        : "max-h-[2000px] opacity-100"
                    }`}
                  >
                    <div className="py-0.5 sm:py-1 px-0.5 sm:px-1">
                      {catData.accounts.map((account) => (
                        <AccountRow
                          key={account.id}
                          account={account}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          canUpdate={canUpdate}
                          canDelete={canDelete}
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AccountDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        account={editingAccount}
        accounts={allAccounts}
      />
    </div>
  );
}
