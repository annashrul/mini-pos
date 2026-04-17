"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useBranch } from "@/components/providers/branch-provider";
import { accountingService } from "../services";
import type { Account, AccountTree } from "../types";

const TYPE_TO_CATEGORY: Record<string, string> = {
  ASSET: "ASET",
  LIABILITY: "KEWAJIBAN",
  EQUITY: "MODAL",
  REVENUE: "PENDAPATAN",
  EXPENSE: "BEBAN",
};

function mapPrismaAccountToAccount(a: Record<string, unknown>): Account {
  const cat = a.category as { name?: string; type?: string } | undefined;
  return {
    id: a.id as string,
    code: a.code as string,
    name: a.name as string,
    category: TYPE_TO_CATEGORY[cat?.type ?? ""] ?? cat?.name ?? "",
    type: cat?.type ?? "",
    balance: (a.openingBalance as number) ?? 0,
    isActive: a.isActive as boolean,
    description: a.description as string | null | undefined,
    parentId: a.parentId as string | null | undefined,
    branchId: a.branchId as string | null | undefined,
    children: Array.isArray(a.children) ? a.children.map(mapPrismaAccountToAccount) : undefined,
  };
}

export function useCoa() {
  const [tree, setTree] = useState<AccountTree[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const { selectedBranchId } = useBranch();

  const fetchData = async () => {
    setLoading(true);
    try {
        const [treeResult, accountsResult] = await Promise.all([
          accountingService.getAccountTree(),
          accountingService.getAccounts(selectedBranchId ? { branchId: selectedBranchId } : {}),
        ]);
        // Map tree: server returns { ...AccountCategory, accounts: [...] }
        // UI expects { category: "ASET"|..., accounts: Account[], total: number }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedTree: AccountTree[] = (treeResult as any[]).map((cat: any) => {
          const categoryKey = TYPE_TO_CATEGORY[cat.type] ?? cat.name ?? "";
          const mappedAccounts = (cat.accounts ?? []).map(mapPrismaAccountToAccount);
          return {
            category: categoryKey,
            accounts: mappedAccounts,
            total: mappedAccounts.reduce((s: number, a: Account) => s + a.balance, 0),
          };
        });
        setTree(mappedTree);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawAccounts = Array.isArray(accountsResult) ? accountsResult : (accountsResult as any).accounts ?? [];
        setAllAccounts(rawAccounts.map(mapPrismaAccountToAccount));
        loadStats();
      } catch {
        toast.error("Gagal memuat data akun");
      } finally {
        setInitialLoad(false);
        setLoading(false);
      }
  };

  // Search debounce
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearch = (value: string) => {
    setSearch(value);
    // Client-side filter — no server call needed, but debounce for performance
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => { /* filteredTree useMemo auto-updates */ }, 200);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.toLowerCase();

    const filterAccounts = (accounts: Account[]): Account[] => {
      return accounts.reduce<Account[]>((acc, a) => {
        const matchesSelf = a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
        const filteredChildren = a.children ? filterAccounts(a.children) : [];

        if (matchesSelf || filteredChildren.length > 0) {
          acc.push({ ...a, children: matchesSelf ? a.children : filteredChildren });
        }
        return acc;
      }, []);
    };

    return tree
      .map((cat) => ({ ...cat, accounts: filterAccounts(cat.accounts) }))
      .filter((cat) => cat.accounts.length > 0);
  }, [tree, search]);

  const [stats, setStats] = useState({ totalAccounts: 0, aset: 0, kewajiban: 0, modal: 0 });

  // Load stats from server
  const loadStats = async () => {
    try {
      const result = await accountingService.getCoaStats();
      setStats(result);
    } catch { /* ignore */ }
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setDialogOpen(true);
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState<Account | null>(null);

  const handleDelete = (account: Account) => {
    setPendingDeleteAccount(account);
    setDeleteConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!pendingDeleteAccount) return;
    try {
      await accountingService.deleteAccount(pendingDeleteAccount.id);
      toast.success("Akun berhasil dihapus");
      fetchData();
    } catch {
      toast.error("Gagal menghapus akun");
    }
    setDeleteConfirmOpen(false);
    setPendingDeleteAccount(null);
  };

  const handleDialogClose = (saved?: boolean) => {
    setDialogOpen(false);
    setEditingAccount(null);
    if (saved) fetchData();
  };

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setDialogOpen(true);
  };

  return {
    tree,
    allAccounts,
    search,
    setSearch,
    handleSearch,
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
    executeDelete,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    pendingDeleteAccount,
    handleDialogClose,
    handleOpenCreate,
  };
}
