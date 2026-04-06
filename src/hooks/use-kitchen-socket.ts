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
 * Listen for kitchen display realtime events via SSE/Pusher.
 * All events coalesced: first event triggers a 1s delay then refresh.
 * After refresh fires, 3s cooldown before accepting new events.
 * This guarantees exactly 1 API call + 1 audio per "burst" of events.
 */
export function useKitchenRealtime(onRefresh: () => void, branchId?: string) {
    const { on } = useRealtimeEvents();
    const refreshRef = useRef(onRefresh);
    refreshRef.current = onRefresh;
    const cooldownUntilRef = useRef(0);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;

        const handler = (data: Record<string, unknown>) => {
            const eventBranch = data.branchId as string | undefined;
            if (branchId && eventBranch && eventBranch !== branchId) return;

            // Skip if in cooldown or already have a pending timer
            const now = Date.now();
            if (now < cooldownUntilRef.current || timer) return;

            timer = setTimeout(() => {
                timer = null;
                cooldownUntilRef.current = Date.now() + 3000; // 3s cooldown after firing
                refreshRef.current();
            }, 1000);
        };

        const unsubs = KITCHEN_EVENTS.map((event) => on(event, handler));

        return () => {
            unsubs.forEach((u) => u());
            if (timer) clearTimeout(timer);
        };
    }, [on, branchId]);
}
