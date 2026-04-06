"use client";

import { useEffect, useRef } from "react";
import { useRealtimeEvents } from "./use-socket";
import { EVENTS } from "@/lib/socket-emit";

const CONFIG_EVENTS = [
    EVENTS.CONFIG_POS_UPDATED,
    EVENTS.CONFIG_RECEIPT_UPDATED,
    EVENTS.CONFIG_KITCHEN_UPDATED,
];

/**
 * Listen for config changes via SSE.
 * When any POS/Receipt/Kitchen config is saved from settings page,
 * this hook triggers onRefresh so the POS page reloads its config instantly.
 */
export function useConfigRealtime(onRefresh: () => void, branchId?: string) {
    const { on } = useRealtimeEvents();
    const refreshRef = useRef(onRefresh);
    refreshRef.current = onRefresh;

    const lastRefreshRef = useRef(0);

    useEffect(() => {
        const unsubs = CONFIG_EVENTS.map((event) =>
            on(event, (data) => {
                const eventBranch = data.branchId as string | undefined;
                // If branch-specific config, only refresh if matching or no branch selected
                if (branchId && eventBranch && eventBranch !== branchId) return;

                // Debounce: max 1 refresh per 2 seconds
                const now = Date.now();
                if (now - lastRefreshRef.current < 2000) return;
                lastRefreshRef.current = now;

                refreshRef.current();
            })
        );

        return () => { unsubs.forEach((u) => u()); };
    }, [on, branchId]);
}
