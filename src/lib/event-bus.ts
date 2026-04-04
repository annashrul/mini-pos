/**
 * Global event bus using BroadcastChannel-style approach via globalThis.
 * Works across all module contexts in Next.js dev/prod.
 */

type Listener = (data: unknown) => void;

// Use a global array of SSE controllers as the communication channel
const g = globalThis as unknown as {
    __sseControllers?: Set<ReadableStreamDefaultController>;
    __eventListeners?: Map<string, Set<Listener>>;
};

if (!g.__sseControllers) g.__sseControllers = new Set();
if (!g.__eventListeners) g.__eventListeners = new Map();

export function registerSSEController(controller: ReadableStreamDefaultController) {
    g.__sseControllers!.add(controller);
    return () => { g.__sseControllers!.delete(controller); };
}

export function broadcastEvent(event: string, data?: unknown) {
    const encoder = new TextEncoder();
    const payload = JSON.stringify({ event, data });
    const message = `data: ${payload}\n\n`;
    const encoded = encoder.encode(message);

    // Send to all connected SSE clients
    for (const controller of g.__sseControllers!) {
        try {
            controller.enqueue(encoded);
        } catch {
            g.__sseControllers!.delete(controller);
        }
    }

    // Also notify in-process listeners
    g.__eventListeners!.get(event)?.forEach((fn) => fn(data));
    g.__eventListeners!.get("*")?.forEach((fn) => fn({ event, data }));
}

export function onEvent(event: string, listener: Listener) {
    if (!g.__eventListeners!.has(event)) g.__eventListeners!.set(event, new Set());
    g.__eventListeners!.get(event)!.add(listener);
    return () => { g.__eventListeners!.get(event)?.delete(listener); };
}
