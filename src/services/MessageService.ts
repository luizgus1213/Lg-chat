import { Op, WhereOptions } from "sequelize";
import { AppError } from "../errors/AppError";
import { User } from "../models/User";
import { Message } from "../models/Message";
import type { createPrivateMessageSchema } from "../validators/messageValidator";
import type { z } from "zod";

type CreatePrivateMessageInput = z.infer<typeof createPrivateMessageSchema>;

function messageDTO(message: Message, clientId?: string | null) {
  return {
    id: message.id,
    fromUserId: message.senderId,
    toUserId: message.receiverId,
    text: message.text,
    createdAt: message.createdAt,
    clientId: clientId ?? null,
  };
}

export async function assertUserExists(userId: number) {
  const user = await User.findByPk(userId, {
    attributes: ["id", "nome", "email"],
  });

  if (!user) {
    throw new AppError(404, "Usuário não encontrado.", "USER_NOT_FOUND");
  }

  return user;
}

export async function getConversationMessages(params: {
  currentUserId: number;
  otherUserId: number;
  limit: number;
  beforeId?: number;
}) {
  const { currentUserId, otherUserId, limit, beforeId } = params;

  if (currentUserId === otherUserId) {
    throw new AppError(
      400,
      "Você não pode abrir conversa com você mesmo.",
      "INVALID_CHAT",
    );
  }

  await assertUserExists(otherUserId);

  const where: WhereOptions = {
    [Op.or]: [
      {
        senderId: currentUserId,
        receiverId: otherUserId,
      },
      {
        senderId: otherUserId,
        receiverId: currentUserId,
      },
    ],
  };

  if (beforeId) {
    Object.assign(where, {
      id: {
        [Op.lt]: beforeId,
      },
    });
  }

  const messages = await Message.findAll({
    where,
    order: [["id", "DESC"]],
    limit,
  });

  return messages.reverse().map((message) => messageDTO(message));
}

export async function createPrivateMessage(
  senderId: number,
  data: CreatePrivateMessageInput,
) {
  if (data.toUserId === senderId) {
    throw new AppError(
      400,
      "Você não pode enviar mensagem para você mesmo.",
      "INVALID_RECEIVER",
    );
  }

  await assertUserExists(data.toUserId);

  const message = await Message.create({
    senderId,
    receiverId: data.toUserId,
    text: data.text,
  });

  return messageDTO(message, data.clientId ?? null);
}
