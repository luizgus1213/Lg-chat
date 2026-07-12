import { useEffect, useMemo, useState, type ReactNode } from "react";

import { io, type Socket } from "socket.io-client";

import { useAuth } from "../../features/auth/useAuth";
import { getAuthToken } from "../../features/auth/auth.storage";

import {
  SocketContext,
  type SocketContextValue,
  type SocketStatus,
} from "../socketContext";

type SocketProviderProps = {
  children: ReactNode;
};

type ConnectedSocketProviderProps = {
  children: ReactNode;
  token: string;
};

const disconnectedValue: SocketContextValue = {
  socket: null,
  status: "disconnected",
  errorMessage: null,
};

function ConnectedSocketProvider({
  children,
  token,
}: ConnectedSocketProviderProps) {
  /*
    A instância é criada uma única vez para essa
    combinação de usuário e token.
  */
  const [socket] = useState<Socket>(() => {
    return io({
      autoConnect: false,

      auth: {
        token,
      },

      transports: ["websocket", "polling"],

      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 700,
      reconnectionDelayMax: 5_000,
      timeout: 12_000,
    });
  });

  const [status, setStatus] = useState<SocketStatus>("connecting");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    function handleConnect() {
      setStatus("connected");
      setErrorMessage(null);
    }

    function handleDisconnect() {
      setStatus("disconnected");
    }

    function handleConnectError(error: Error) {
      setStatus("error");

      setErrorMessage(error.message || "Erro ao conectar em tempo real.");
    }

    function handleReconnectAttempt() {
      setStatus("connecting");
      setErrorMessage(null);
    }

    function handleServerError(error: unknown) {
      console.error("[LG Chat] Erro recebido pelo servidor:", error);
    }

    socket.on("connect", handleConnect);

    socket.on("disconnect", handleDisconnect);

    socket.on("connect_error", handleConnectError);

    socket.on("server_error", handleServerError);

    socket.io.on("reconnect_attempt", handleReconnectAttempt);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);

      socket.off("disconnect", handleDisconnect);

      socket.off("connect_error", handleConnectError);

      socket.off("server_error", handleServerError);

      socket.io.off("reconnect_attempt", handleReconnectAttempt);

      socket.disconnect();
    };
  }, [socket]);

  const value = useMemo<SocketContextValue>(
    () => ({
      socket,
      status,
      errorMessage,
    }),
    [socket, status, errorMessage],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function SocketProvider({ children }: SocketProviderProps) {
  const auth = useAuth();

  const token = auth.status === "authenticated" ? getAuthToken() : null;

  const userId = auth.user?.id ?? null;

  if (!token || !userId) {
    return (
      <SocketContext.Provider value={disconnectedValue}>
        {children}
      </SocketContext.Provider>
    );
  }

  return (
    <ConnectedSocketProvider key={`${userId}:${token}`} token={token}>
      {children}
    </ConnectedSocketProvider>
  );
}
