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
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (pusherKey && pusherCluster) {
      let pusher: any;
      let channel: any;
      let unmounted = false;

      (async () => {
        const Pusher = (await import("pusher-js")).default;
        if (unmounted) return;

        pusher = new Pusher(pusherKey, {
          cluster: pusherCluster,
          forceTLS: true,
        });

        const dispatch = (eventName: string, data: Record<string, unknown>) => {
          listenersRef.current.get(eventName)?.forEach((cb) => cb(data || {}));
          listenersRef.current
            .get("*")
            ?.forEach((cb) => cb({ event: eventName, ...(data || {}) }));
        };

        channel = pusher.subscribe("pos-events");

        pusher.connection.bind("connected", () => {
          console.log("[Pusher] Connected");
        });
        pusher.connection.bind("error", (err: unknown) => {
          console.error("[Pusher] Connection error:", err);
        });

        channel.bind_global(
          (eventName: string, data: Record<string, unknown>) => {
            // Skip Pusher internal events
            if (!eventName || eventName.startsWith("pusher:") || eventName.startsWith("pusher_internal:")) return;
            console.log("[Pusher] Event received:", eventName);
            dispatch(eventName, data || {});
          },
        );
      })();

      return () => {
        unmounted = true;
        try {
          if (channel) channel.unbind_all();
          if (pusher) pusher.disconnect();
        } catch {
          //
        }
      };
    }

    const es = new EventSource("/api/events");
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data) as {
          event?: string;
          data?: Record<string, unknown>;
        };
        const eventName = payload.event;
        if (!eventName) return;

        listenersRef.current
          .get(eventName)
          ?.forEach((cb) => cb(payload.data || {}));
        listenersRef.current
          .get("*")
          ?.forEach((cb) => cb({ event: eventName, ...(payload.data || {}) }));
      } catch {
        //
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  const on = useCallback((event: string, callback: EventCallback) => {
    if (!listenersRef.current.has(event))
      listenersRef.current.set(event, new Set());
    listenersRef.current.get(event)!.add(callback);
    return () => {
      listenersRef.current.get(event)?.delete(callback);
    };
  }, []);

  return { on };
}
