"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  getPendingTransactions,
  getPendingCount,
  updateTransactionStatus,
  removeTransaction,
} from "@/lib/offline-queue";
import { posService } from "@/features/pos";
import { toast } from "sonner";

const { createTransaction } = posService;

export function useOfflineSync(isOnline: boolean) {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  // Refresh pending count
  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  }, []);

  // Sync all pending transactions
  const syncAll = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);

    try {
      const pending = await getPendingTransactions();
      const toSync = pending.filter((t) => t.status !== "syncing");

      if (toSync.length === 0) {
        setSyncing(false);
        syncingRef.current = false;
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const tx of toSync) {
        await updateTransactionStatus(tx.id, "syncing");

        try {
          const result = await createTransaction(
            tx.payload as unknown as Parameters<typeof createTransaction>[0]
          );

          if (result.error) {
            await updateTransactionStatus(tx.id, "failed", result.error);
            failCount++;
          } else {
            await removeTransaction(tx.id);
            successCount++;
          }
        } catch (err) {
          await updateTransactionStatus(
            tx.id,
            "failed",
            err instanceof Error ? err.message : "Gagal sinkronisasi"
          );
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} transaksi offline berhasil disinkronkan`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} transaksi gagal disinkronkan`);
      }
    } catch {
      toast.error("Gagal memproses sinkronisasi");
    }

    await refreshCount();
    setSyncing(false);
    syncingRef.current = false;
  }, [refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncingRef.current) {
      const timer = setTimeout(() => { void syncAll(); }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, syncAll]);

  // Periodic auto-retry when online (every 30s)
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(async () => {
      if (syncingRef.current) return;
      try {
        const count = await getPendingCount();
        if (count > 0) {
          const pending = await getPendingTransactions();
          const retryable = pending.filter((t) => t.status === "failed" && (t.retryCount ?? 0) < 5);
          if (retryable.length > 0) syncAll();
        }
      } catch { /* silent */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [isOnline, syncAll]);

  // Check pending count on mount
  useEffect(() => {
    const timer = setTimeout(() => { void refreshCount(); }, 0);
    return () => clearTimeout(timer);
  }, [refreshCount]);

  return { pendingCount, syncing, syncAll, refreshCount };
}
