import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
    if (io) return io;

    io = new SocketIOServer(httpServer, {
        path: "/api/socketio",
        addTrailingSlash: false,
        cors: { origin: "*" },
    });

    io.on("connection", (socket) => {
        console.log("[Socket.IO] Client connected:", socket.id);

        // Join branch room for branch-specific updates
        socket.on("join-branch", (branchId: string) => {
            socket.join(`branch:${branchId}`);
        });

        socket.on("leave-branch", (branchId: string) => {
            socket.leave(`branch:${branchId}`);
        });

        socket.on("disconnect", () => {
            console.log("[Socket.IO] Client disconnected:", socket.id);
        });
    });

    return io;
}

export function getIO(): SocketIOServer | null {
    return io;
}

// Helper to emit dashboard events
export function emitDashboardUpdate(event: string, data: unknown, branchId?: string) {
    const server = getIO();
    if (!server) return;

    // Emit to all clients
    server.emit(event, data);

    // Also emit to branch-specific room
    if (branchId) {
        server.to(`branch:${branchId}`).emit(event, data);
    }
}
