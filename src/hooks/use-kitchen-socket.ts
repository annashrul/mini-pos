"use client";

import { useEffect, useRef } from "react";
import { useRealtimeEvents } from "./use-socket";
import { EVENTS } from "@/lib/socket-emit";

const KITCHEN_EVENTS = [
    EVENTS.ORDER_QUEUE_CREATED,
    EVENTS.ORDER_QUEUE_UPDATED,
    EVENTS.ORDER_QUEUE_CANCELLED,
];

/**
 * Listen for kitchen display realtime events via SSE.
 * Calls onRefresh when an order is created, updated, or cancelled.
 * Debounced to max 1 refresh per 1 second (kitchen needs faster updates than dashboard).
 */
export function useKitchenRealtime(onRefresh: () => void, branchId?: string) {
    const { on } = useRealtimeEvents();
    const refreshRef = useRef(onRefresh);
    refreshRef.current = onRefresh;

    const lastRefreshRef = useRef(0);

    useEffect(() => {
        const unsubs = KITCHEN_EVENTS.map((event) =>
            on(event, (data) => {
                // Branch filtering
                const eventBranch = data.branchId as string | undefined;
                if (branchId && eventBranch && eventBranch !== branchId) return;

                // Debounce: max 1 refresh per second
                const now = Date.now();
                if (now - lastRefreshRef.current < 1000) return;
                lastRefreshRef.current = now;

                refreshRef.current();
            })
        );

        return () => { unsubs.forEach((u) => u()); };
    }, [on, branchId]);
}
