import { registerSSEController } from "@/lib/event-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Register this controller to receive broadcasts
            const unregister = registerSSEController(controller);

            // Heartbeat every 25s
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(": heartbeat\n\n"));
                } catch {
                    clearInterval(heartbeat);
                    unregister();
                }
            }, 25000);

            // Send connected event
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: "connected" })}\n\n`));

            // Store cleanup
            (controller as unknown as Record<string, () => void>).__cleanup = () => {
                clearInterval(heartbeat);
                unregister();
            };
        },
        cancel(controller) {
            const cleanup = (controller as unknown as Record<string, () => void>)?.__cleanup;
            if (cleanup) cleanup();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
