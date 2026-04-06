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
 * Listen for config changes via SSE/Pusher.
 * Settings page saves POS + Receipt + Kitchen configs together,
 * emitting 3 events. This hook coalesces them into 1 refresh call.
 */
export function useConfigRealtime(onRefresh: () => void, branchId?: string) {
    const { on } = useRealtimeEvents();
    const refreshRef = useRef(onRefresh);
    refreshRef.current = onRefresh;

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        let cooldownUntil = 0;

        const handler = (data: Record<string, unknown>) => {
            const eventBranch = data.branchId as string | undefined;
            if (branchId && eventBranch && eventBranch !== branchId) return;

            // Skip if in cooldown or already have a pending timer
            const now = Date.now();
            if (now < cooldownUntil || timer) return;

            // Wait 1s for all config events to arrive, then fire once
            timer = setTimeout(() => {
                timer = null;
                cooldownUntil = Date.now() + 5000; // 5s cooldown
                refreshRef.current();
            }, 1000);
        };

        const unsubs = CONFIG_EVENTS.map((event) => on(event, handler));

        return () => {
            unsubs.forEach((u) => u());
            if (timer) clearTimeout(timer);
        };
    }, [on, branchId]);
}
