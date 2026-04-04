import { broadcastEvent } from "./event-bus";

export const EVENTS = {
    TRANSACTION_CREATED: "transaction:created",
    TRANSACTION_VOIDED: "transaction:voided",
    TRANSACTION_REFUNDED: "transaction:refunded",
    STOCK_UPDATED: "stock:updated",
    SHIFT_OPENED: "shift:opened",
    SHIFT_CLOSED: "shift:closed",
    DASHBOARD_REFRESH: "dashboard:refresh",
} as const;

/**
 * Emit a real-time event from server actions.
 * Broadcasts directly to all connected SSE clients via global controllers.
 */
export function emitEvent(event: string, data?: unknown, branchId?: string) {
    try {
        broadcastEvent(event, {
            ...((data && typeof data === "object") ? data : {}),
            branchId: branchId || undefined,
            timestamp: Date.now(),
        });
    } catch {
        // Silently fail
    }
}
