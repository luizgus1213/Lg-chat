import { createContext } from "react";
import type { Socket } from "socket.io-client";

export type SocketStatus =
  "disconnected" | "connecting" | "connected" | "error";

export type SocketContextValue = {
  socket: Socket | null;
  status: SocketStatus;
  errorMessage: string | null;
};

export const SocketContext = createContext<SocketContextValue | null>(null);
