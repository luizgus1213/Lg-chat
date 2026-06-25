import { Op, QueryTypes, Transaction } from "sequelize";
import { sequelize } from "../db/connection";
import { AppError } from "../errors/AppError";
import { Chat } from "../models/Chat";
import { ChatMember } from "../models/ChatMember";
import { Message } from "../models/Message";
import { User } from "../models/User";

type PublicChat = {
  id: number;
  type: string;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  createdById: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function chatDTO(chat: Chat): PublicChat {
  return {
    id: chat.id,
    type: chat.type,
    name: chat.name,
    description: chat.description,
    avatarUrl: chat.avatarUrl,
    createdById: chat.createdById,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
}

function messageDTO(message: Message, clientId?: string | null) {
  return {
    id: message.id,
    chatId: message.chatId,
    fromUserId: message.senderId,
    text: message.deletedAt ? "Mensagem apagada" : message.text,
    type: message.type,
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
    createdAt: message.createdAt,
    clientId: clientId ?? null,
  };
}

async function assertUserExists(userId: number) {
  const user = await User.findByPk(userId, {
    attributes: ["id", "nome", "email"],
  });

  if (!user) {
    throw new AppError(404, "Usuário não encontrado.", "USER_NOT_FOUND");
  }

  return user;
}

export async function assertChatMember(chatId: number, userId: number) {
  const member = await ChatMember.findOne({
    where: {
      chatId,
      userId,
      leftAt: null,
    },
  });

  if (!member) {
    throw new AppError(
      403,
      "Você não participa desse chat.",
      "CHAT_ACCESS_DENIED",
    );
  }

  return member;
}

async function assertGroupAdmin(chatId: number, userId: number) {
  const member = await assertChatMember(chatId, userId);

  if (member.role !== "owner" && member.role !== "admin") {
    throw new AppError(
      403,
      "Apenas dono ou admin pode fazer essa ação.",
      "GROUP_PERMISSION_DENIED",
    );
  }

  return member;
}

export async function createPrivateChat(
  currentUserId: number,
  otherUserId: number,
) {
  if (currentUserId === otherUserId) {
    throw new AppError(
      400,
      "Você não pode criar conversa com você mesmo.",
      "INVALID_PRIVATE_CHAT",
    );
  }

  await assertUserExists(otherUserId);

  const existing = await sequelize.query<{ id: number }>(
    `
      SELECT c.id
      FROM chats c
      INNER JOIN chat_members cm1 ON cm1.chat_id = c.id
      INNER JOIN chat_members cm2 ON cm2.chat_id = c.id
      WHERE c.type = 'private'
        AND cm1.user_id = :currentUserId
        AND cm2.user_id = :otherUserId
        AND cm1.left_at IS NULL
        AND cm2.left_at IS NULL
      LIMIT 1
    `,
    {
      replacements: {
        currentUserId,
        otherUserId,
      },
      type: QueryTypes.SELECT,
    },
  );

  if (existing[0]) {
    const chat = await Chat.findByPk(existing[0].id);

    if (!chat) {
      throw new AppError(404, "Chat não encontrado.", "CHAT_NOT_FOUND");
    }

    return chatDTO(chat);
  }

  const chat = await sequelize.transaction(async (transaction: Transaction) => {
    const createdChat = await Chat.create(
      {
        type: "private",
        name: null,
        description: null,
        avatarUrl: null,
        createdById: currentUserId,
      },
      { transaction },
    );

    const joinedAt = new Date();

    await ChatMember.bulkCreate(
      [
        {
          chatId: createdChat.id,
          userId: currentUserId,
          role: "member",
          joinedAt,
        },
        {
          chatId: createdChat.id,
          userId: otherUserId,
          role: "member",
          joinedAt,
        },
      ],
      { transaction },
    );
    return createdChat;
  });

  return chatDTO(chat);
}

export async function createGroupChat(params: {
  currentUserId: number;
  name: string;
  description?: string | null;
  memberIds: number[];
}) {
  const cleanMemberIds = Array.from(
    new Set(params.memberIds.filter((id) => id !== params.currentUserId)),
  );

  for (const memberId of cleanMemberIds) {
    await assertUserExists(memberId);
  }

  const chat = await sequelize.transaction(async (transaction: Transaction) => {
    const createdChat = await Chat.create(
      {
        type: "group",
        name: params.name,
        description: params.description ?? null,
        avatarUrl: null,
        createdById: params.currentUserId,
      },
      { transaction },
    );

    await ChatMember.create(
      {
        chatId: createdChat.id,
        userId: params.currentUserId,
        role: "owner",
        joinedAt: new Date(),
      },
      { transaction },
    );

    if (cleanMemberIds.length > 0) {
      await ChatMember.bulkCreate(
        cleanMemberIds.map((userId) => ({
          chatId: createdChat.id,
          userId,
          role: "member",
          joinedAt: new Date(),
        })),
        { transaction },
      );
    }

    await Message.create(
      {
        chatId: createdChat.id,
        senderId: params.currentUserId,
        receiverId: null,
        text: "Grupo criado.",
        type: "system",
      },
      { transaction },
    );

    return createdChat;
  });

  return chatDTO(chat);
}

export async function listMyChats(currentUserId: number) {
  const memberships = await ChatMember.findAll({
    where: {
      userId: currentUserId,
      leftAt: null,
    },
    include: [
      {
        model: Chat,
        as: "chat",
      },
    ],
    order: [["updatedAt", "DESC"]],
  });

  return memberships.map((membership) => {
    const chat = membership.get("chat") as Chat;

    return {
      ...chatDTO(chat),
      myRole: membership.role,
    };
  });
}

export async function getChatById(currentUserId: number, chatId: number) {
  await assertChatMember(chatId, currentUserId);

  const chat = await Chat.findByPk(chatId);

  if (!chat) {
    throw new AppError(404, "Chat não encontrado.", "CHAT_NOT_FOUND");
  }

  return chatDTO(chat);
}

export async function listChatMembers(currentUserId: number, chatId: number) {
  await assertChatMember(chatId, currentUserId);

  const members = await ChatMember.findAll({
    where: {
      chatId,
      leftAt: null,
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "nome", "email"],
      },
    ],
    order: [["role", "ASC"]],
  });

  return members.map((member) => ({
    id: member.id,
    chatId: member.chatId,
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt,
    user: member.get("user"),
  }));
}

export async function addMemberToGroup(params: {
  currentUserId: number;
  chatId: number;
  userId: number;
}) {
  const chat = await Chat.findByPk(params.chatId);

  if (!chat) {
    throw new AppError(404, "Chat não encontrado.", "CHAT_NOT_FOUND");
  }

  if (chat.type !== "group") {
    throw new AppError(
      400,
      "Só é possível adicionar membros em grupos.",
      "NOT_GROUP_CHAT",
    );
  }

  await assertGroupAdmin(params.chatId, params.currentUserId);
  await assertUserExists(params.userId);

  const existing = await ChatMember.findOne({
    where: {
      chatId: params.chatId,
      userId: params.userId,
    },
  });

  if (existing && !existing.leftAt) {
    throw new AppError(
      409,
      "Esse usuário já está no grupo.",
      "USER_ALREADY_IN_GROUP",
    );
  }

  if (existing && existing.leftAt) {
    existing.leftAt = null;
    existing.role = "member";
    existing.joinedAt = new Date();
    await existing.save();

    return {
      id: existing.id,
      chatId: existing.chatId,
      userId: existing.userId,
      role: existing.role,
    };
  }

  const member = await ChatMember.create({
    chatId: params.chatId,
    userId: params.userId,
    role: "member",
    joinedAt: new Date(),
  });

  await Message.create({
    chatId: params.chatId,
    senderId: params.currentUserId,
    receiverId: null,
    text: `Um novo membro entrou no grupo.`,
    type: "system",
  });

  return {
    id: member.id,
    chatId: member.chatId,
    userId: member.userId,
    role: member.role,
  };
}

export async function removeMemberFromGroup(params: {
  currentUserId: number;
  chatId: number;
  userId: number;
}) {
  const chat = await Chat.findByPk(params.chatId);

  if (!chat) {
    throw new AppError(404, "Chat não encontrado.", "CHAT_NOT_FOUND");
  }

  if (chat.type !== "group") {
    throw new AppError(
      400,
      "Só é possível remover membros de grupos.",
      "NOT_GROUP_CHAT",
    );
  }

  const targetMember = await ChatMember.findOne({
    where: {
      chatId: params.chatId,
      userId: params.userId,
      leftAt: null,
    },
  });

  if (!targetMember) {
    throw new AppError(
      404,
      "Esse usuário não está no grupo.",
      "MEMBER_NOT_FOUND",
    );
  }

  const isLeavingSelf = params.currentUserId === params.userId;

  if (!isLeavingSelf) {
    await assertGroupAdmin(params.chatId, params.currentUserId);
  }

  if (targetMember.role === "owner") {
    const ownersCount = await ChatMember.count({
      where: {
        chatId: params.chatId,
        role: "owner",
        leftAt: null,
      },
    });

    if (ownersCount <= 1) {
      throw new AppError(
        400,
        "O grupo precisa ter pelo menos um dono.",
        "GROUP_NEEDS_OWNER",
      );
    }
  }

  targetMember.leftAt = new Date();
  await targetMember.save();

  await Message.create({
    chatId: params.chatId,
    senderId: params.currentUserId,
    receiverId: null,
    text: isLeavingSelf
      ? "Um membro saiu do grupo."
      : "Um membro foi removido do grupo.",
    type: "system",
  });

  return {
    removed: true,
  };
}

export async function updateGroup(params: {
  currentUserId: number;
  chatId: number;
  name?: string;
  description?: string | null;
  avatarUrl?: string | null;
}) {
  const chat = await Chat.findByPk(params.chatId);

  if (!chat) {
    throw new AppError(404, "Chat não encontrado.", "CHAT_NOT_FOUND");
  }

  if (chat.type !== "group") {
    throw new AppError(400, "Só grupos podem ser editados.", "NOT_GROUP_CHAT");
  }

  await assertGroupAdmin(params.chatId, params.currentUserId);

  if (params.name !== undefined) chat.name = params.name;
  if (params.description !== undefined) chat.description = params.description;
  if (params.avatarUrl !== undefined) chat.avatarUrl = params.avatarUrl;

  await chat.save();

  return chatDTO(chat);
}

export async function sendMessageToChat(params: {
  currentUserId: number;
  chatId: number;
  text: string;
  clientId?: string;
}) {
  await assertChatMember(params.chatId, params.currentUserId);

  const chat = await Chat.findByPk(params.chatId);

  if (!chat) {
    throw new AppError(404, "Chat não encontrado.", "CHAT_NOT_FOUND");
  }

  const message = await Message.create({
    chatId: params.chatId,
    senderId: params.currentUserId,
    receiverId: null,
    text: params.text,
    type: "text",
  });

  return messageDTO(message, params.clientId ?? null);
}

export async function getChatMessages(params: {
  currentUserId: number;
  chatId: number;
  limit: number;
  beforeId?: number;
}) {
  await assertChatMember(params.chatId, params.currentUserId);

  const where = {
    chatId: params.chatId,
    ...(params.beforeId
      ? {
          id: {
            [Op.lt]: params.beforeId,
          },
        }
      : {}),
  };

  const messages = await Message.findAll({
    where,
    order: [["id", "DESC"]],
    limit: params.limit,
  });

  return messages.reverse().map((message) => messageDTO(message));
}

export async function markChatAsRead(params: {
  currentUserId: number;
  chatId: number;
  messageId: number;
}) {
  const member = await assertChatMember(params.chatId, params.currentUserId);

  member.lastReadMessageId = params.messageId;
  await member.save();

  return {
    chatId: params.chatId,
    lastReadMessageId: params.messageId,
  };
}
