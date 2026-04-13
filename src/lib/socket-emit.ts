import { broadcastEvent } from "./event-bus";
import Pusher from "pusher";

export const EVENTS = {
  TRANSACTION_CREATED: "transaction:created",
  TRANSACTION_VOIDED: "transaction:voided",
  TRANSACTION_REFUNDED: "transaction:refunded",
  STOCK_UPDATED: "stock:updated",
  SHIFT_OPENED: "shift:opened",
  SHIFT_CLOSED: "shift:closed",
  SHIFT_RECLOSED: "shift:reclosed",
  DASHBOARD_REFRESH: "dashboard:refresh",
  ORDER_QUEUE_CREATED: "order-queue:created",
  ORDER_QUEUE_UPDATED: "order-queue:updated",
  ORDER_QUEUE_CANCELLED: "order-queue:cancelled",
  CONFIG_POS_UPDATED: "config:pos-updated",
  CONFIG_RECEIPT_UPDATED: "config:receipt-updated",
  CONFIG_KITCHEN_UPDATED: "config:kitchen-updated",
  SUBSCRIPTION_UPDATED: "subscription:updated",
  COMPANY_REGISTERED: "company:registered",
} as const;

let pusherClient: {
  trigger: (channel: string, event: string, data: unknown) => Promise<unknown>;
} | null = null;

function getPusher() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) return null;
  if (pusherClient) return pusherClient;

  pusherClient = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
  return pusherClient;
}

/**
 * Emit a real-time event from server actions.
 * Broadcasts directly to all connected SSE clients via global controllers.
 */
export function emitEvent(event: string, data?: unknown, branchId?: string) {
  try {
    const payload = {
      ...(data && typeof data === "object" ? data : {}),
      branchId: branchId || undefined,
      timestamp: Date.now(),
    };

    const pusher = getPusher();
    if (pusher) {
      pusher.trigger("pos-events", event, payload).catch((err) => {
        console.error("[Pusher] Failed to trigger event:", event, err);
        // Fallback to SSE if Pusher fails
        broadcastEvent(event, payload);
      });
      return;
    }

    broadcastEvent(event, payload);
  } catch (err) {
    console.error("[emitEvent] Error:", err);
  }
}
