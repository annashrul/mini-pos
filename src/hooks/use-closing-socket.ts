"use client";

import { useEffect, useRef } from "react";
import { useRealtimeEvents } from "./use-socket";
import { EVENTS } from "@/lib/socket-emit";

const CLOSING_EVENTS = [
    EVENTS.SHIFT_CLOSED,
    EVENTS.SHIFT_RECLOSED,
];

export function useClosingRealtime(onRefresh: () => void, branchId?: string) {
    const { on } = useRealtimeEvents();
    const refreshRef = useRef(onRefresh);
    refreshRef.current = onRefresh;

    const lastRefreshRef = useRef(0);

    useEffect(() => {
        const unsubs = CLOSING_EVENTS.map((event) =>
            on(event, (data) => {
                const eventBranch = data.branchId as string | undefined;
                if (branchId && eventBranch && eventBranch !== branchId) return;

                const now = Date.now();
                if (now - lastRefreshRef.current < 2000) return;
                lastRefreshRef.current = now;
                refreshRef.current();
            })
        );
        return () => unsubs.forEach((unsub) => unsub());
    }, [on, branchId]);
}
