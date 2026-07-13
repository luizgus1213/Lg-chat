import { useEffect, useMemo, useState, type ReactNode } from "react";

import { io, type Socket } from "socket.io-client";
import { z } from "zod";

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

const serverErrorSchema = z
  .object({
    message: z.string().trim().min(1).max(300),
  })
  .passthrough();

function getConnectionErrorMessage(error: Error): string {
  if (/autentic|login|sessão|sessao|token/i.test(error.message)) {
    return "Sua sessão não pôde ser autenticada. Entre novamente.";
  }

  return "Não foi possível conectar às atualizações em tempo real.";
}

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
      reconnectionAttempts: Infinity,
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
      setStatus(socket.active ? "connecting" : "disconnected");

      if (socket.active) {
        setErrorMessage(null);
      }
    }

    function handleConnectError(error: Error) {
      setStatus("error");
      setErrorMessage(getConnectionErrorMessage(error));
    }

    function handleReconnectAttempt() {
      setStatus("connecting");
      setErrorMessage(null);
    }

    function handleReconnectError(error: Error) {
      setStatus("connecting");
      setErrorMessage(getConnectionErrorMessage(error));
    }

    function handleReconnectFailed() {
      setStatus("error");
      setErrorMessage(
        "A conexão em tempo real foi interrompida. Verifique sua conexão.",
      );
    }

    function handleServerError(payload: unknown) {
      const parsed = serverErrorSchema.safeParse(payload);

      setErrorMessage(
        parsed.success
          ? parsed.data.message
          : "O servidor recusou uma operação em tempo real.",
      );

      if (!parsed.success && import.meta.env.DEV) {
        console.warn("[LG Chat] Evento server_error inválido.");
      }
    }

    socket.on("connect", handleConnect);

    socket.on("disconnect", handleDisconnect);

    socket.on("connect_error", handleConnectError);

    socket.on("server_error", handleServerError);

    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.io.on("reconnect_error", handleReconnectError);
    socket.io.on("reconnect_failed", handleReconnectFailed);

    // Adiar um tick evita que o primeiro ciclo de efeito do StrictMode abra
    // um handshake que será descartado imediatamente pelo cleanup de teste.
    const connectTimer = window.setTimeout(() => {
      socket.connect();
    }, 0);

    return () => {
      window.clearTimeout(connectTimer);

      socket.off("connect", handleConnect);

      socket.off("disconnect", handleDisconnect);

      socket.off("connect_error", handleConnectError);

      socket.off("server_error", handleServerError);

      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.io.off("reconnect_error", handleReconnectError);
      socket.io.off("reconnect_failed", handleReconnectFailed);

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
