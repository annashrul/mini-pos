"use client";

import { useEffect, useRef, useCallback } from "react";

type EventCallback = (data: Record<string, unknown>) => void;

/**
 * Real-time event hook using Server-Sent Events (SSE).
 * Connects to /api/events and listens for server-pushed events.
 */
export function useRealtimeEvents() {
    const listenersRef = useRef(new Map<string, Set<EventCallback>>());
    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        const es = new EventSource("/api/events");
        eventSourceRef.current = es;

        es.onmessage = (e) => {
            try {
                const payload = JSON.parse(e.data) as { event?: string; data?: Record<string, unknown> };
                const eventName = payload.event;
                if (!eventName) return;

                // Notify specific event listeners
                listenersRef.current.get(eventName)?.forEach((cb) => cb(payload.data || {}));

                // Notify wildcard listeners
                listenersRef.current.get("*")?.forEach((cb) => cb({ event: eventName, ...(payload.data || {}) }));
            } catch {
                // Ignore parse errors
            }
        };

        es.onerror = () => {
            // EventSource auto-reconnects
        };

        return () => {
            es.close();
            eventSourceRef.current = null;
        };
    }, []);

    const on = useCallback((event: string, callback: EventCallback) => {
        if (!listenersRef.current.has(event)) listenersRef.current.set(event, new Set());
        listenersRef.current.get(event)!.add(callback);
        return () => { listenersRef.current.get(event)?.delete(callback); };
    }, []);

    return { on };
}
