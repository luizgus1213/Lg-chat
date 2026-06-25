import type { Server, Socket } from "socket.io";
import { AppError, toClientError } from "../errors/AppError";
import { verificarToken } from "../utils/jwt";
import { logger } from "../utils/logger";
import { User } from "../models/User";
import { ChatMember } from "../models/ChatMember";
import { sendChatMessageSchema } from "../validators/chatValidator";
import { assertChatMember, sendMessageToChat } from "../services/ChatService";

type AuthenticatedUser = {
  id: number;
  nome: string;
  email: string;
};

type ClientAck = (response: {
  success: boolean;
  data?: unknown;
  error?: unknown;
}) => void;

async function authenticateSocket(socket: Socket): Promise<AuthenticatedUser> {
  const token = socket.handshake.auth?.token;

  if (!token || typeof token !== "string") {
    throw new AppError(401, "Token não enviado.", "SOCKET_AUTH_REQUIRED");
  }

  const payload = verificarToken(token);

  const user = await User.findByPk(payload.id, {
    attributes: ["id", "nome", "email"],
  });

  if (!user) {
    throw new AppError(401, "Usuário não encontrado.", "USER_NOT_FOUND");
  }

  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
  };
}

export function setupSocket(io: Server) {
  io.use(async (socket, next) => {
    try {
      const user = await authenticateSocket(socket);
      socket.data.user = user;

      return next();
    } catch (error) {
      logger.warn({ err: error }, "Falha ao autenticar socket");
      return next(new Error("Não autenticado. Faça login novamente."));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user as AuthenticatedUser;

    socket.join(`user:${user.id}`);

    const memberships = await ChatMember.findAll({
      where: {
        userId: user.id,
        leftAt: null,
      },
      attributes: ["chatId"],
    });

    for (const membership of memberships) {
      socket.join(`chat:${membership.chatId}`);
    }

    logger.info(
      {
        socketId: socket.id,
        userId: user.id,
        email: user.email,
      },
      "Cliente conectado no socket",
    );

    socket.on("join_chat", async (payload: unknown, ack?: ClientAck) => {
      try {
        const chatId =
          typeof payload === "object" &&
          payload &&
          "chatId" in payload &&
          typeof (payload as { chatId?: unknown }).chatId === "number"
            ? (payload as { chatId: number }).chatId
            : null;

        if (!chatId) {
          throw new AppError(400, "Chat inválido.", "INVALID_CHAT_ID");
        }

        await assertChatMember(chatId, user.id);

        socket.join(`chat:${chatId}`);

        if (typeof ack === "function") {
          ack({
            success: true,
            data: {
              joined: true,
              chatId,
            },
          });
        }
      } catch (error) {
        const clientError = toClientError(error);

        if (typeof ack === "function") {
          ack({
            success: false,
            error: clientError,
          });
        }

        socket.emit("server_error", clientError);
      }
    });

    socket.on("chat_message", async (payload: unknown, ack?: ClientAck) => {
      try {
        const rawPayload =
          typeof payload === "object" && payload ? payload : {};

        const chatId =
          "chatId" in rawPayload
            ? Number((rawPayload as { chatId?: unknown }).chatId)
            : 0;

        if (!Number.isInteger(chatId) || chatId <= 0) {
          throw new AppError(400, "Chat inválido.", "INVALID_CHAT_ID");
        }

        const data = sendChatMessageSchema.parse(rawPayload);

        const message = await sendMessageToChat({
          currentUserId: user.id,
          chatId,
          text: data.text,
          clientId: data.clientId,
        });

        io.to(`chat:${chatId}`).emit("chat_message", message);

        if (typeof ack === "function") {
          ack({
            success: true,
            data: message,
          });
        }
      } catch (error) {
        const clientError = toClientError(error);

        logger.error(
          {
            err: error,
            userId: user.id,
            payload: {
              chatId:
                typeof payload === "object" && payload && "chatId" in payload
                  ? (payload as { chatId?: unknown }).chatId
                  : undefined,
              textLength:
                typeof payload === "object" &&
                payload &&
                "text" in payload &&
                typeof (payload as { text?: unknown }).text === "string"
                  ? (payload as { text: string }).text.length
                  : undefined,
            },
          },
          "Erro ao enviar mensagem pelo socket",
        );

        if (typeof ack === "function") {
          ack({
            success: false,
            error: clientError,
          });
        }

        socket.emit("server_error", clientError);
      }
    });

    socket.on("typing_start", async (payload: unknown) => {
      try {
        const chatId =
          typeof payload === "object" && payload && "chatId" in payload
            ? Number((payload as { chatId?: unknown }).chatId)
            : 0;

        if (!Number.isInteger(chatId) || chatId <= 0) return;

        await assertChatMember(chatId, user.id);

        socket.to(`chat:${chatId}`).emit("typing_start", {
          chatId,
          userId: user.id,
          nome: user.nome,
        });
      } catch {
        // Não derruba socket por erro de typing
      }
    });

    socket.on("typing_stop", async (payload: unknown) => {
      try {
        const chatId =
          typeof payload === "object" && payload && "chatId" in payload
            ? Number((payload as { chatId?: unknown }).chatId)
            : 0;

        if (!Number.isInteger(chatId) || chatId <= 0) return;

        await assertChatMember(chatId, user.id);

        socket.to(`chat:${chatId}`).emit("typing_stop", {
          chatId,
          userId: user.id,
          nome: user.nome,
        });
      } catch {
        // Não derruba socket por erro de typing
      }
    });

    socket.on("disconnect", (reason) => {
      logger.info(
        {
          socketId: socket.id,
          userId: user.id,
          reason,
        },
        "Cliente desconectado",
      );
    });
  });
}
