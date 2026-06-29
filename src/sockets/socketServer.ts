import type { Server } from "socket.io";

let ioInstance: Server | null = null;

export function setSocketServer(io: Server) {
  ioInstance = io;
}

export function emitToChat(chatId: number, event: string, payload: unknown) {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(`chat:${chatId}`).emit(event, payload);
}
