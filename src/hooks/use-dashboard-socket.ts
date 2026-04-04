"use client";

import { useEffect, useRef } from "react";
import { useRealtimeEvents } from "./use-socket";
import { EVENTS } from "@/lib/socket-emit";

const DASHBOARD_EVENTS = [
    EVENTS.TRANSACTION_CREATED,
    EVENTS.TRANSACTION_VOIDED,
    EVENTS.TRANSACTION_REFUNDED,
    EVENTS.STOCK_UPDATED,
    EVENTS.SHIFT_OPENED,
    EVENTS.SHIFT_CLOSED,
    EVENTS.DASHBOARD_REFRESH,
];

export function useDashboardRealtime(onRefresh: () => void, branchId?: string) {
    const { on } = useRealtimeEvents();
    const refreshRef = useRef(onRefresh);
    refreshRef.current = onRefresh;

    // Debounce: don't refresh more than once per 3 seconds
    const lastRefreshRef = useRef(0);

    useEffect(() => {
        const unsubs = DASHBOARD_EVENTS.map((event) =>
            on(event, (data) => {
                // If branch-specific, only refresh if matching
                const eventBranch = data.branchId as string | undefined;
                if (branchId && eventBranch && eventBranch !== branchId) return;

                // Debounce
                const now = Date.now();
                if (now - lastRefreshRef.current < 3000) return;
                lastRefreshRef.current = now;

                refreshRef.current();
            })
        );

        return () => { unsubs.forEach((u) => u()); };
    }, [on, branchId]);
}
