import type { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";
import { AppError, toClientError } from "../errors/AppError";
import { verificarToken } from "../utils/jwt";
import { logger } from "../utils/logger";
import { User } from "../models/User";
import { Chat } from "../models/Chat";
import { ChatMember } from "../models/ChatMember";
import { UserBlock } from "../models/UserBlock";
import { sendChatMessageSchema } from "../validators/chatValidator";
import { assertChatMember, sendMessageToChat } from "../services/ChatService";
import { setSocketServer } from "./socketServer";
import { setUserOnlineStatus } from "../services/UserService";
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

function getChatIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("chatId" in payload)) {
    throw new AppError(400, "Chat inválido.", "INVALID_CHAT_ID");
  }

  const chatId = Number((payload as { chatId?: unknown }).chatId);

  if (!Number.isInteger(chatId) || chatId <= 0) {
    throw new AppError(400, "Chat inválido.", "INVALID_CHAT_ID");
  }

  return chatId;
}

function sendAckError(ack: ClientAck | undefined, error: unknown) {
  const clientError = toClientError(error);

  if (typeof ack === "function") {
    ack({
      success: false,
      error: clientError,
    });
  }

  return clientError;
}


type CallType = "voice" | "video";

type ActiveCall = {
  id: string;
  chatId: number;
  callerId: number;
  receiverId: number;
  type: CallType;
  startedAt: string;
  acceptedAt?: string;
};

const activeCalls = new Map<string, ActiveCall>();

function getObjectPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new AppError(400, "Dados da chamada inválidos.", "INVALID_CALL_PAYLOAD");
  }

  return payload as Record<string, unknown>;
}

function getCallType(payload: Record<string, unknown>): CallType {
  const type = payload.type;

  if (type !== "voice" && type !== "video") {
    throw new AppError(400, "Tipo de chamada inválido.", "INVALID_CALL_TYPE");
  }

  return type;
}

function getCallId(payload: Record<string, unknown>) {
  const callId = String(payload.callId || "").trim();

  if (!callId || callId.length > 120) {
    throw new AppError(400, "Chamada inválida.", "INVALID_CALL_ID");
  }

  return callId;
}

function getSignalPayload(payload: Record<string, unknown>) {
  const signal = payload.signal;

  if (!signal || typeof signal !== "object") {
    throw new AppError(400, "Sinal da chamada inválido.", "INVALID_CALL_SIGNAL");
  }

  return signal;
}

async function getPrivateCallTarget(chatId: number, currentUserId: number) {
  const chat = await Chat.findByPk(chatId, {
    attributes: ["id", "type"],
  });

  if (!chat) {
    throw new AppError(404, "Chat não encontrado.", "CHAT_NOT_FOUND");
  }

  if (chat.type !== "private") {
    throw new AppError(
      400,
      "Chamadas estão disponíveis somente em conversas privadas.",
      "CALL_ONLY_PRIVATE_CHAT",
    );
  }

  await assertChatMember(chatId, currentUserId);

  const members = await ChatMember.findAll({
    where: {
      chatId,
      leftAt: null,
    },
    attributes: ["userId"],
  });

  const otherMember = members.find((member) => member.userId !== currentUserId);

  if (!otherMember) {
    throw new AppError(
      404,
      "Contato da conversa não encontrado.",
      "CALL_TARGET_NOT_FOUND",
    );
  }

  const [blockedByMe, blockedMe] = await Promise.all([
    UserBlock.findOne({
      where: {
        blockerId: currentUserId,
        blockedId: otherMember.userId,
      },
    }),
    UserBlock.findOne({
      where: {
        blockerId: otherMember.userId,
        blockedId: currentUserId,
      },
    }),
  ]);

  if (blockedByMe) {
    throw new AppError(
      403,
      "Você bloqueou esse contato. Desbloqueie para iniciar chamada.",
      "CALL_CONTACT_BLOCKED_BY_ME",
    );
  }

  if (blockedMe) {
    throw new AppError(
      403,
      "Você não pode iniciar chamada com esse contato.",
      "CALL_CONTACT_BLOCKED_ME",
    );
  }

  const targetUser = await User.findByPk(otherMember.userId, {
    attributes: ["id", "nome", "email"],
  });

  if (!targetUser) {
    throw new AppError(404, "Usuário da chamada não encontrado.", "CALL_USER_NOT_FOUND");
  }

  return {
    targetUserId: targetUser.id,
    targetUser: {
      id: targetUser.id,
      nome: targetUser.nome,
      email: targetUser.email,
    },
  };
}

function assertCallParticipant(call: ActiveCall, userId: number) {
  if (call.callerId !== userId && call.receiverId !== userId) {
    throw new AppError(403, "Você não participa dessa chamada.", "CALL_ACCESS_DENIED");
  }
}

function getOtherCallUserId(call: ActiveCall, userId: number) {
  assertCallParticipant(call, userId);

  return call.callerId === userId ? call.receiverId : call.callerId;
}

function callPublicDTO(call: ActiveCall) {
  return {
    callId: call.id,
    chatId: call.chatId,
    callerId: call.callerId,
    receiverId: call.receiverId,
    type: call.type,
    startedAt: call.startedAt,
    acceptedAt: call.acceptedAt ?? null,
  };
}



function getUserChatRooms(chatIds: Iterable<number>) {
  return Array.from(new Set(Array.from(chatIds).map((chatId) => `chat:${chatId}`)));
}

function emitUserStatusToRelatedRooms(
  io: Server,
  rooms: string[],
  payload: {
    userId: number;
    isOnline: boolean;
    lastSeenAt: Date | null;
  },
) {
  if (!rooms.length) {
    return;
  }

  io.to(rooms).emit("user_status", payload);
}

function canEmitTyping(
  typingMap: Map<string, number>,
  key: string,
  intervalMs: number,
) {
  const now = Date.now();
  const last = typingMap.get(key) || 0;

  if (now - last < intervalMs) {
    return false;
  }

  typingMap.set(key, now);

  return true;
}


export function setupSocket(io: Server) {
  setSocketServer(io);
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

    try {
      socket.join(`user:${user.id}`);

      const memberships = await ChatMember.findAll({
        where: {
          userId: user.id,
          leftAt: null,
        },
        attributes: ["chatId"],
      });

      const allowedChatIds = new Set<number>(
        memberships
          .map((membership) => Number(membership.chatId))
          .filter((chatId) => Number.isInteger(chatId) && chatId > 0),
      );

      const userChatRooms = getUserChatRooms(allowedChatIds);

      socket.data.allowedChatIds = allowedChatIds;
      socket.data.userChatRooms = userChatRooms;
      socket.data.typingRate = new Map<string, number>();

      for (const room of userChatRooms) {
        socket.join(room);
      }

      logger.info(
        {
          socketId: socket.id,
          userId: user.id,
          email: user.email,
        },
        "Cliente conectado no socket",
      );

      const onlineUser = await setUserOnlineStatus({
        userId: user.id,
        isOnline: true,
      });

      emitUserStatusToRelatedRooms(io, userChatRooms, {
        userId: user.id,
        isOnline: true,
        lastSeenAt: onlineUser.lastSeenAt,
      });
    } catch (error) {
      logger.error(
        {
          err: error,
          socketId: socket.id,
          userId: user.id,
        },
        "Erro ao preparar salas do socket",
      );

      socket.emit("server_error", toClientError(error));
      socket.disconnect(true);
      return;
    }

    socket.on("join_chat", async (payload: unknown, ack?: ClientAck) => {
      try {
        const chatId = getChatIdFromPayload(payload);

        await assertChatMember(chatId, user.id);

        socket.join(`chat:${chatId}`);

        const allowedChatIds = socket.data.allowedChatIds as Set<number> | undefined;
        allowedChatIds?.add(chatId);

        const userChatRooms = socket.data.userChatRooms as string[] | undefined;
        if (userChatRooms && !userChatRooms.includes(`chat:${chatId}`)) {
          userChatRooms.push(`chat:${chatId}`);
        }

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
        const clientError = sendAckError(ack, error);

        logger.warn(
          {
            err: error,
            userId: user.id,
            payload,
          },
          "Erro ao entrar no chat pelo socket",
        );

        socket.emit("server_error", clientError);
      }
    });

    socket.on("chat_message", async (payload: unknown, ack?: ClientAck) => {
      try {
        const rawPayload =
          typeof payload === "object" && payload !== null ? payload : {};

        const chatId = getChatIdFromPayload(rawPayload);
        const data = sendChatMessageSchema.parse(rawPayload);

        const message = await sendMessageToChat({
          currentUserId: user.id,
          chatId,
          text: data.text,
          clientId: data.clientId,
          replyToMessageId: data.replyToMessageId,
        });

        io.to(`chat:${chatId}`).emit("chat_message", message);

        io.to(`chat:${chatId}`).emit("chat_updated", {
          chatId,
          updatedAt: message.createdAt,
        });

        if (typeof ack === "function") {
          ack({
            success: true,
            data: message,
          });
        }
      } catch (error) {
        const clientError = sendAckError(ack, error);

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

        socket.emit("server_error", clientError);
      }
    });


    socket.on("call:start", async (payload: unknown, ack?: ClientAck) => {
      try {
        const rawPayload = getObjectPayload(payload);
        const chatId = getChatIdFromPayload(rawPayload);
        const type = getCallType(rawPayload);
        const { targetUserId, targetUser } = await getPrivateCallTarget(chatId, user.id);

        const call: ActiveCall = {
          id: randomUUID(),
          chatId,
          callerId: user.id,
          receiverId: targetUserId,
          type,
          startedAt: new Date().toISOString(),
        };

        activeCalls.set(call.id, call);

        io.to(`user:${targetUserId}`).emit("call:incoming", {
          ...callPublicDTO(call),
          fromUser: {
            id: user.id,
            nome: user.nome,
            email: user.email,
          },
        });

        if (typeof ack === "function") {
          ack({
            success: true,
            data: {
              ...callPublicDTO(call),
              targetUser,
            },
          });
        }

        logger.info(
          {
            callId: call.id,
            chatId,
            callerId: user.id,
            receiverId: targetUserId,
            type,
          },
          "Chamada iniciada",
        );
      } catch (error) {
        const clientError = sendAckError(ack, error);

        logger.warn(
          {
            err: error,
            userId: user.id,
            payload,
          },
          "Erro ao iniciar chamada",
        );

        socket.emit("server_error", clientError);
      }
    });

    socket.on("call:accept", async (payload: unknown, ack?: ClientAck) => {
      try {
        const rawPayload = getObjectPayload(payload);
        const callId = getCallId(rawPayload);
        const call = activeCalls.get(callId);

        if (!call) {
          throw new AppError(404, "Chamada não encontrada ou encerrada.", "CALL_NOT_FOUND");
        }

        if (call.receiverId !== user.id) {
          throw new AppError(403, "Apenas quem recebeu a chamada pode aceitar.", "CALL_ACCEPT_DENIED");
        }

        call.acceptedAt = new Date().toISOString();
        activeCalls.set(call.id, call);

        io.to(`user:${call.callerId}`).emit("call:accepted", {
          ...callPublicDTO(call),
          acceptedBy: user.id,
        });

        if (typeof ack === "function") {
          ack({
            success: true,
            data: callPublicDTO(call),
          });
        }

        logger.info(
          {
            callId: call.id,
            chatId: call.chatId,
            userId: user.id,
          },
          "Chamada aceita",
        );
      } catch (error) {
        const clientError = sendAckError(ack, error);

        logger.warn(
          {
            err: error,
            userId: user.id,
            payload,
          },
          "Erro ao aceitar chamada",
        );

        socket.emit("server_error", clientError);
      }
    });

    socket.on("call:reject", async (payload: unknown, ack?: ClientAck) => {
      try {
        const rawPayload = getObjectPayload(payload);
        const callId = getCallId(rawPayload);
        const call = activeCalls.get(callId);

        if (!call) {
          throw new AppError(404, "Chamada não encontrada ou encerrada.", "CALL_NOT_FOUND");
        }

        assertCallParticipant(call, user.id);

        const otherUserId = getOtherCallUserId(call, user.id);
        activeCalls.delete(call.id);

        io.to(`user:${otherUserId}`).emit("call:rejected", {
          ...callPublicDTO(call),
          rejectedBy: user.id,
        });

        if (typeof ack === "function") {
          ack({
            success: true,
            data: {
              ended: true,
              callId: call.id,
            },
          });
        }

        logger.info(
          {
            callId: call.id,
            chatId: call.chatId,
            userId: user.id,
          },
          "Chamada recusada/cancelada",
        );
      } catch (error) {
        const clientError = sendAckError(ack, error);

        logger.warn(
          {
            err: error,
            userId: user.id,
            payload,
          },
          "Erro ao recusar/cancelar chamada",
        );

        socket.emit("server_error", clientError);
      }
    });

    socket.on("call:end", async (payload: unknown, ack?: ClientAck) => {
      try {
        const rawPayload = getObjectPayload(payload);
        const callId = getCallId(rawPayload);
        const call = activeCalls.get(callId);

        if (!call) {
          if (typeof ack === "function") {
            ack({
              success: true,
              data: {
                ended: true,
                callId,
              },
            });
          }

          return;
        }

        assertCallParticipant(call, user.id);

        const otherUserId = getOtherCallUserId(call, user.id);
        activeCalls.delete(call.id);

        io.to(`user:${otherUserId}`).emit("call:ended", {
          ...callPublicDTO(call),
          endedBy: user.id,
        });

        if (typeof ack === "function") {
          ack({
            success: true,
            data: {
              ended: true,
              callId: call.id,
            },
          });
        }

        logger.info(
          {
            callId: call.id,
            chatId: call.chatId,
            userId: user.id,
          },
          "Chamada encerrada",
        );
      } catch (error) {
        const clientError = sendAckError(ack, error);

        logger.warn(
          {
            err: error,
            userId: user.id,
            payload,
          },
          "Erro ao encerrar chamada",
        );

        socket.emit("server_error", clientError);
      }
    });

    socket.on("call:signal", async (payload: unknown, ack?: ClientAck) => {
      try {
        const rawPayload = getObjectPayload(payload);
        const callId = getCallId(rawPayload);
        const signal = getSignalPayload(rawPayload);
        const call = activeCalls.get(callId);

        if (!call) {
          throw new AppError(404, "Chamada não encontrada ou encerrada.", "CALL_NOT_FOUND");
        }

        assertCallParticipant(call, user.id);

        const otherUserId = getOtherCallUserId(call, user.id);

        io.to(`user:${otherUserId}`).emit("call:signal", {
          callId: call.id,
          chatId: call.chatId,
          fromUserId: user.id,
          signal,
        });

        if (typeof ack === "function") {
          ack({
            success: true,
            data: {
              delivered: true,
              callId: call.id,
            },
          });
        }
      } catch (error) {
        const clientError = sendAckError(ack, error);

        logger.warn(
          {
            err: error,
            userId: user.id,
            payload,
          },
          "Erro ao enviar sinal da chamada",
        );

        socket.emit("server_error", clientError);
      }
    });

    socket.on("disconnect", async () => {
      try {
        const offlineUser = await setUserOnlineStatus({
          userId: user.id,
          isOnline: false,
        });

        const userChatRooms = (socket.data.userChatRooms as string[] | undefined) || [];

        emitUserStatusToRelatedRooms(io, userChatRooms, {
          userId: user.id,
          isOnline: false,
          lastSeenAt: offlineUser.lastSeenAt,
        });
      } catch (error) {
        logger.warn(
          {
            err: error,
            userId: user.id,
          },
          "Erro ao atualizar status offline do usuário",
        );
      }
    });

    socket.on("typing_start", async (payload: unknown) => {
      try {
        const chatId = getChatIdFromPayload(payload);
        const allowedChatIds = socket.data.allowedChatIds as Set<number> | undefined;

        if (!allowedChatIds?.has(chatId)) {
          throw new AppError(403, "Você não participa desse chat.", "CHAT_ACCESS_DENIED");
        }

        const typingRate = socket.data.typingRate as Map<string, number> | undefined;
        const canEmit = typingRate
          ? canEmitTyping(typingRate, `start:${chatId}`, 900)
          : true;

        if (!canEmit) return;

        socket.to(`chat:${chatId}`).emit("typing_start", {
          chatId,
          userId: user.id,
          nome: user.nome,
        });
      } catch {
        // Erro de typing não deve derrubar o socket.
      }
    });

    socket.on("typing_stop", async (payload: unknown) => {
      try {
        const chatId = getChatIdFromPayload(payload);
        const allowedChatIds = socket.data.allowedChatIds as Set<number> | undefined;

        if (!allowedChatIds?.has(chatId)) {
          throw new AppError(403, "Você não participa desse chat.", "CHAT_ACCESS_DENIED");
        }

        const typingRate = socket.data.typingRate as Map<string, number> | undefined;
        const canEmit = typingRate
          ? canEmitTyping(typingRate, `stop:${chatId}`, 350)
          : true;

        if (!canEmit) return;

        socket.to(`chat:${chatId}`).emit("typing_stop", {
          chatId,
          userId: user.id,
          nome: user.nome,
        });
      } catch {
        // Erro de typing não deve derrubar o socket.
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
