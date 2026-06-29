import { Op, QueryTypes, Transaction, WhereOptions } from "sequelize";
import { sequelize } from "../db/connection";
import { AppError } from "../errors/AppError";
import { Chat } from "../models/Chat";
import { ChatMember } from "../models/ChatMember";
import { Message, type MessageAttributes } from "../models/Message";
import { User } from "../models/User";
import { UserBlock } from "../models/UserBlock";
import fs from "fs/promises";
import path from "path";
import { logger } from "../utils/logger";
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

function publicUserDTO(user: User) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    about: user.about ?? "Disponível",
    isOnline: Boolean(user.isOnline),
    lastSeenAt: user.lastSeenAt ?? null,
  };
}

async function getPrivateChatUser(chatId: number, currentUserId: number) {
  const otherMember = await ChatMember.findOne({
    where: {
      chatId,
      userId: {
        [Op.ne]: currentUserId,
      },
      leftAt: null,
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: [
          "id",
          "nome",
          "email",
          "avatarUrl",
          "about",
          "isOnline",
          "lastSeenAt",
        ],
      },
    ],
  });

  const user = otherMember?.get("user") as User | undefined;

  return user ? publicUserDTO(user) : null;
}


async function getPrivateChatMembers(chatId: number, currentUserId: number) {
  const chat = await Chat.findByPk(chatId);

  if (!chat) {
    throw new AppError(404, "Chat não encontrado.", "CHAT_NOT_FOUND");
  }

  if (chat.type !== "private") {
    throw new AppError(
      400,
      "Essa ação só pode ser feita em conversa privada.",
      "NOT_PRIVATE_CHAT",
    );
  }

  const currentMember = await assertChatMember(chatId, currentUserId);

  const otherMember = await ChatMember.findOne({
    where: {
      chatId,
      userId: {
        [Op.ne]: currentUserId,
      },
      leftAt: null,
    },
  });

  if (!otherMember) {
    throw new AppError(
      404,
      "Contato da conversa não encontrado.",
      "PRIVATE_CONTACT_NOT_FOUND",
    );
  }

  return {
    chat,
    currentMember,
    otherUserId: otherMember.userId,
  };
}

async function getBlockStatusBetween(currentUserId: number, otherUserId?: number | null) {
  if (!otherUserId) {
    return {
      blockedByMe: false,
      blockedMe: false,
      isBlocked: false,
    };
  }

  const [blockedByMe, blockedMe] = await Promise.all([
    UserBlock.findOne({
      where: {
        blockerId: currentUserId,
        blockedId: otherUserId,
      },
    }),
    UserBlock.findOne({
      where: {
        blockerId: otherUserId,
        blockedId: currentUserId,
      },
    }),
  ]);

  return {
    blockedByMe: Boolean(blockedByMe),
    blockedMe: Boolean(blockedMe),
    isBlocked: Boolean(blockedByMe || blockedMe),
  };
}

async function getBlockStatusForPrivateChat(chatId: number, currentUserId: number) {
  const { otherUserId } = await getPrivateChatMembers(chatId, currentUserId);

  return {
    otherUserId,
    ...(await getBlockStatusBetween(currentUserId, otherUserId)),
  };
}

async function assertCanSendToPrivateChat(chat: Chat, currentUserId: number) {
  if (chat.type !== "private") return;

  const block = await getBlockStatusForPrivateChat(chat.id, currentUserId);

  if (block.blockedByMe) {
    throw new AppError(
      403,
      "Você bloqueou esse contato. Desbloqueie para enviar mensagens.",
      "CONTACT_BLOCKED_BY_ME",
    );
  }

  if (block.blockedMe) {
    throw new AppError(
      403,
      "Você não pode enviar mensagens para esse contato.",
      "CONTACT_BLOCKED_ME",
    );
  }
}

function messageVisibilityCutoff(member: ChatMember) {
  const dates = [member.chatClearedAt, member.chatDeletedAt]
    .filter(Boolean)
    .map((date) => new Date(date as Date).getTime())
    .filter((time) => Number.isFinite(time));

  if (!dates.length) return null;

  return new Date(Math.max(...dates));
}

function applyMessageVisibility(where: WhereOptions<MessageAttributes>, member: ChatMember) {
  const cutoff = messageVisibilityCutoff(member);

  if (!cutoff) return where;

  return {
    ...where,
    createdAt: {
      [Op.gt]: cutoff,
    },
  };
}



function getChatFileMessageType(mimeType: string): "image" | "video" | "audio" | "file" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";

  return "file";
}

function getChatFileTypeLabel(mimeType: string) {
  if (mimeType.startsWith("image/")) return "foto";
  if (mimeType.startsWith("video/")) return "vídeo";
  if (mimeType.startsWith("audio/")) return "áudio";

  return "arquivo";
}

function messageDTO(message: Message, clientId?: string | null) {
  return {
    id: message.id,
    chatId: message.chatId,
    fromUserId: message.senderId,
    text: message.deletedAt ? "Mensagem apagada" : message.text,
    type: message.type,
    mediaUrl: message.deletedAt ? null : message.mediaUrl,
    mediaMimeType: message.deletedAt ? null : message.mediaMimeType,
    mediaSize: message.deletedAt ? null : message.mediaSize,
    mediaOriginalName: message.deletedAt ? null : message.mediaOriginalName,
    replyToMessageId: message.replyToMessageId ?? null,
    forwardedFromMessageId: message.forwardedFromMessageId ?? null,
    isForwarded: Boolean(message.forwardedFromMessageId),
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    clientId: clientId ?? null,
  };
}

function replyPreviewDTO(message: Message) {
  return {
    id: message.id,
    chatId: message.chatId,
    fromUserId: message.senderId,
    text: message.deletedAt ? "Mensagem apagada" : message.text,
    type: message.type,
    mediaOriginalName: message.deletedAt ? null : message.mediaOriginalName,
    deletedAt: message.deletedAt,
  };
}

async function getReplyPreview(message: Message) {
  if (!message.replyToMessageId || !message.chatId) {
    return null;
  }

  const replyTo = await Message.findOne({
    where: {
      id: message.replyToMessageId,
      chatId: message.chatId,
    },
  });

  return replyTo ? replyPreviewDTO(replyTo) : null;
}

async function getReactionSummary(messageId: number, currentUserId: number) {
  const rows = await sequelize.query<{
    emoji: string;
    count: string;
    reacted_by_me: boolean;
  }>(
    `
      SELECT
        emoji,
        COUNT(*)::text AS count,
        BOOL_OR(user_id = :currentUserId) AS reacted_by_me
      FROM message_reactions
      WHERE message_id = :messageId
      GROUP BY emoji
      ORDER BY COUNT(*) DESC, emoji ASC
    `,
    {
      replacements: {
        messageId,
        currentUserId,
      },
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => ({
    emoji: row.emoji,
    count: Number(row.count),
    reactedByMe: Boolean(row.reacted_by_me),
  }));
}

async function isMessageStarred(messageId: number, currentUserId: number) {
  const rows = await sequelize.query<{ is_starred: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM message_stars
        WHERE message_id = :messageId
          AND user_id = :currentUserId
      ) AS is_starred
    `,
    {
      replacements: {
        messageId,
        currentUserId,
      },
      type: QueryTypes.SELECT,
    },
  );

  return Boolean(rows[0]?.is_starred);
}

async function getReplyPreviewMap(messages: Message[]) {
  const replyIds = Array.from(
    new Set(
      messages
        .map((message) => message.replyToMessageId)
        .filter((id): id is number => Number.isInteger(id)),
    ),
  );

  if (!replyIds.length) {
    return new Map<number, ReturnType<typeof replyPreviewDTO>>();
  }

  const replies = await Message.findAll({
    where: {
      id: {
        [Op.in]: replyIds,
      },
    },
  });

  return new Map(replies.map((reply) => [reply.id, replyPreviewDTO(reply)]));
}

async function getReactionSummaryMap(messageIds: number[], currentUserId: number) {
  const uniqueIds = Array.from(
    new Set(messageIds.filter((id) => Number.isInteger(id) && id > 0)),
  );

  const map = new Map<
    number,
    Array<{ emoji: string; count: number; reactedByMe: boolean }>
  >();

  if (!uniqueIds.length) {
    return map;
  }

  const rows = await sequelize.query<{
    message_id: number;
    emoji: string;
    count: string;
    reacted_by_me: boolean;
  }>(
    `
      SELECT
        message_id,
        emoji,
        COUNT(*)::text AS count,
        BOOL_OR(user_id = :currentUserId) AS reacted_by_me
      FROM message_reactions
      WHERE message_id IN (:messageIds)
      GROUP BY message_id, emoji
      ORDER BY message_id ASC, COUNT(*) DESC, emoji ASC
    `,
    {
      replacements: {
        messageIds: uniqueIds,
        currentUserId,
      },
      type: QueryTypes.SELECT,
    },
  );

  for (const row of rows) {
    const messageId = Number(row.message_id);
    const current = map.get(messageId) ?? [];

    current.push({
      emoji: row.emoji,
      count: Number(row.count),
      reactedByMe: Boolean(row.reacted_by_me),
    });

    map.set(messageId, current);
  }

  return map;
}

async function getStarredMessageIdSet(messageIds: number[], currentUserId: number) {
  const uniqueIds = Array.from(
    new Set(messageIds.filter((id) => Number.isInteger(id) && id > 0)),
  );

  if (!uniqueIds.length) {
    return new Set<number>();
  }

  const rows = await sequelize.query<{ message_id: number }>(
    `
      SELECT message_id
      FROM message_stars
      WHERE user_id = :currentUserId
        AND message_id IN (:messageIds)
    `,
    {
      replacements: {
        currentUserId,
        messageIds: uniqueIds,
      },
      type: QueryTypes.SELECT,
    },
  );

  return new Set(rows.map((row) => Number(row.message_id)));
}

async function messagesDTOWithExtras(
  messages: Message[],
  currentUserId: number,
  clientIdMap: Map<number, string | null> = new Map(),
) {
  if (!messages.length) {
    return [];
  }

  const messageIds = messages.map((message) => message.id);

  const [replyMap, reactionMap, starredSet] = await Promise.all([
    getReplyPreviewMap(messages),
    getReactionSummaryMap(messageIds, currentUserId),
    getStarredMessageIdSet(messageIds, currentUserId),
  ]);

  return messages.map((message) => {
    const replyToMessageId = message.replyToMessageId ?? null;

    return {
      ...messageDTO(message, clientIdMap.get(message.id) ?? null),
      replyTo: replyToMessageId ? replyMap.get(replyToMessageId) ?? null : null,
      reactions: reactionMap.get(message.id) ?? [],
      isStarred: starredSet.has(message.id),
    };
  });
}

async function messageDTOWithExtras(
  message: Message,
  currentUserId: number,
  clientId?: string | null,
) {
  const clientIdMap = new Map<number, string | null>();

  if (clientId) {
    clientIdMap.set(message.id, clientId);
  }

  const [dto] = await messagesDTOWithExtras([message], currentUserId, clientIdMap);

  return dto;
}

async function assertReplyMessage(params: {
  chatId: number;
  replyToMessageId?: number | null;
}) {
  if (!params.replyToMessageId) {
    return null;
  }

  const replyTo = await Message.findOne({
    where: {
      id: params.replyToMessageId,
      chatId: params.chatId,
    },
  });

  if (!replyTo) {
    throw new AppError(
      404,
      "A mensagem que você está respondendo não foi encontrada.",
      "REPLY_MESSAGE_NOT_FOUND",
    );
  }

  if (replyTo.deletedAt) {
    throw new AppError(
      400,
      "Não é possível responder uma mensagem apagada.",
      "REPLY_MESSAGE_DELETED",
    );
  }

  return replyTo;
}

async function touchChat(chatId: number, transaction?: Transaction) {
  await Chat.update(
    {
      updatedAt: new Date(),
    },
    {
      where: {
        id: chatId,
      },
      transaction,
      silent: false,
    },
  );
}

async function assertUserExists(userId: number) {
  const user = await User.findByPk(userId, {
    attributes: [
          "id",
          "nome",
          "email",
          "avatarUrl",
          "about",
          "isOnline",
          "lastSeenAt",
        ],
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
    await ChatMember.update(
      {
        chatDeletedAt: null,
        isArchived: false,
        archivedAt: null,
      },
      {
        where: {
          chatId: existing[0].id,
          userId: currentUserId,
        },
      },
    );

    return getChatById(currentUserId, existing[0].id);
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

    await touchChat(createdChat.id, transaction);

    return createdChat;
  });

  return chatDTO(chat);
}

export async function listMyChats(currentUserId: number, options: { archived?: boolean } = {}) {
  const memberships = await ChatMember.findAll({
    where: {
      userId: currentUserId,
      leftAt: null,
      chatDeletedAt: null,
      ...(options.archived
        ? { isArchived: true }
        : {
            [Op.or]: [{ isArchived: false }, { isArchived: null }],
          }),
    },
    include: [
      {
        model: Chat,
        as: "chat",
        required: true,
      },
    ],
  });

  if (!memberships.length) {
    return [];
  }

  const chats = memberships
    .map((membership) => membership.get("chat") as Chat)
    .filter(Boolean);

  const privateChatIds = chats
    .filter((chat) => chat.type === "private")
    .map((chat) => chat.id);

  const privateUserByChatId = new Map<number, ReturnType<typeof publicUserDTO>>();

  if (privateChatIds.length) {
    const privateMembers = await ChatMember.findAll({
      where: {
        chatId: {
          [Op.in]: privateChatIds,
        },
        userId: {
          [Op.ne]: currentUserId,
        },
        leftAt: null,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "nome",
            "email",
            "avatarUrl",
            "about",
            "isOnline",
            "lastSeenAt",
          ],
        },
      ],
    });

    for (const member of privateMembers) {
      const user = member.get("user") as User | undefined;

      if (user) {
        privateUserByChatId.set(member.chatId, publicUserDTO(user));
      }
    }
  }

  const otherUserIds = Array.from(
    new Set(
      Array.from(privateUserByChatId.values())
        .map((user) => user.id)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );

  const blockByOtherUserId = new Map<
    number,
    { blockedByMe: boolean; blockedMe: boolean; isBlocked: boolean }
  >();

  for (const otherUserId of otherUserIds) {
    blockByOtherUserId.set(otherUserId, {
      blockedByMe: false,
      blockedMe: false,
      isBlocked: false,
    });
  }

  if (otherUserIds.length) {
    const blocks = await UserBlock.findAll({
      where: {
        [Op.or]: [
          {
            blockerId: currentUserId,
            blockedId: {
              [Op.in]: otherUserIds,
            },
          },
          {
            blockerId: {
              [Op.in]: otherUserIds,
            },
            blockedId: currentUserId,
          },
        ],
      },
    });

    for (const block of blocks) {
      if (block.blockerId === currentUserId) {
        const current = blockByOtherUserId.get(block.blockedId) ?? {
          blockedByMe: false,
          blockedMe: false,
          isBlocked: false,
        };

        current.blockedByMe = true;
        current.isBlocked = true;
        blockByOtherUserId.set(block.blockedId, current);
      } else {
        const current = blockByOtherUserId.get(block.blockerId) ?? {
          blockedByMe: false,
          blockedMe: false,
          isBlocked: false,
        };

        current.blockedMe = true;
        current.isBlocked = true;
        blockByOtherUserId.set(block.blockerId, current);
      }
    }
  }

  const memberStateValues = memberships
    .map((membership) => {
      const cutoff = messageVisibilityCutoff(membership);
      const cutoffSql = cutoff
        ? `${(sequelize as unknown as { escape(value: unknown): string }).escape(
            cutoff.toISOString(),
          )}::timestamptz`
        : "NULL::timestamptz";

      return `(${Number(membership.chatId)}, ${Number(
        membership.lastReadMessageId ?? 0,
      )}, ${cutoffSql})`;
    })
    .join(", ");

  const lastMessages = await sequelize.query<Message>(
    `
      WITH member_state(chat_id, last_read_message_id, cutoff) AS (
        VALUES ${memberStateValues}
      )
      SELECT DISTINCT ON (m.chat_id) m.*
      FROM messages m
      INNER JOIN member_state ms ON ms.chat_id = m.chat_id
      WHERE ms.cutoff IS NULL OR m.created_at > ms.cutoff
      ORDER BY m.chat_id, m.id DESC
    `,
    {
      model: Message,
      mapToModel: true,
    },
  );

  const lastMessageByChatId = new Map<number, Message>();

  for (const message of lastMessages) {
    if (message.chatId) {
      lastMessageByChatId.set(message.chatId, message);
    }
  }

  const unreadRows = await sequelize.query<{
    chat_id: number;
    unread_count: string;
  }>(
    `
      WITH member_state(chat_id, last_read_message_id, cutoff) AS (
        VALUES ${memberStateValues}
      )
      SELECT
        m.chat_id,
        COUNT(*)::text AS unread_count
      FROM messages m
      INNER JOIN member_state ms ON ms.chat_id = m.chat_id
      WHERE m.sender_id <> :currentUserId
        AND m.type <> 'system'
        AND m.id > COALESCE(ms.last_read_message_id, 0)
        AND (ms.cutoff IS NULL OR m.created_at > ms.cutoff)
      GROUP BY m.chat_id
    `,
    {
      replacements: {
        currentUserId,
      },
      type: QueryTypes.SELECT,
    },
  );

  const unreadCountByChatId = new Map(
    unreadRows.map((row) => [Number(row.chat_id), Number(row.unread_count)]),
  );

  const publicChats = memberships.map((membership) => {
    const chat = membership.get("chat") as Chat;
    const privateUser =
      chat.type === "private" ? privateUserByChatId.get(chat.id) ?? null : null;

    return {
      ...chatDTO(chat),
      name: chat.type === "private" && privateUser ? privateUser.nome : chat.name,
      avatarUrl:
        chat.type === "private" && privateUser
          ? privateUser.avatarUrl
          : chat.avatarUrl,
      myRole: membership.role,
      lastReadMessageId: membership.lastReadMessageId,
      isPinned: Boolean(membership.isPinned),
      isArchived: Boolean(membership.isArchived),
      isMuted: Boolean(membership.isMuted),
      pinnedAt: membership.pinnedAt ?? null,
      archivedAt: membership.archivedAt ?? null,
      mutedUntil: membership.mutedUntil ?? null,
      chatClearedAt: membership.chatClearedAt ?? null,
      chatDeletedAt: membership.chatDeletedAt ?? null,
      block:
        chat.type === "private" && privateUser
          ? blockByOtherUserId.get(privateUser.id) ?? {
              blockedByMe: false,
              blockedMe: false,
              isBlocked: false,
            }
          : null,
      lastMessage: lastMessageByChatId.has(chat.id)
        ? messageDTO(lastMessageByChatId.get(chat.id)!)
        : null,
      unreadCount: unreadCountByChatId.get(chat.id) ?? 0,
      privateUser,
    };
  });

  return publicChats.sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
    }

    if (a.isPinned && b.isPinned) {
      return (
        new Date(b.pinnedAt ?? b.updatedAt).getTime() -
        new Date(a.pinnedAt ?? a.updatedAt).getTime()
      );
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export async function getChatById(currentUserId: number, chatId: number) {
  const member = await assertChatMember(chatId, currentUserId);

  const chat = await Chat.findByPk(chatId);

  if (!chat) {
    throw new AppError(404, "Chat não encontrado.", "CHAT_NOT_FOUND");
  }

  const canManageGroup =
    chat.type === "group" &&
    (member.role === "owner" || member.role === "admin");

  const privateUser =
    chat.type === "private"
      ? await getPrivateChatUser(chat.id, currentUserId)
      : null;

  return {
    ...chatDTO(chat),
    name: chat.type === "private" && privateUser ? privateUser.nome : chat.name,
    avatarUrl:
      chat.type === "private" && privateUser
        ? privateUser.avatarUrl
        : chat.avatarUrl,
    myRole: member.role,
    lastReadMessageId: member.lastReadMessageId,
    isPinned: Boolean(member.isPinned),
    isArchived: Boolean(member.isArchived),
    isMuted: Boolean(member.isMuted),
    pinnedAt: member.pinnedAt ?? null,
    archivedAt: member.archivedAt ?? null,
    mutedUntil: member.mutedUntil ?? null,
    chatClearedAt: member.chatClearedAt ?? null,
    chatDeletedAt: member.chatDeletedAt ?? null,
    block:
      chat.type === "private" && privateUser
        ? await getBlockStatusBetween(currentUserId, privateUser.id)
        : null,
    canManageGroup,
    canDeleteGroup: canManageGroup,
    privateUser,
  };
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
        attributes: [
          "id",
          "nome",
          "email",
          "avatarUrl",
          "about",
          "isOnline",
          "lastSeenAt",
        ],
      },
    ],
    order: [
      ["role", "ASC"],
      ["joinedAt", "ASC"],
    ],
  });

  return members.map((member) => ({
    id: member.id,
    chatId: member.chatId,
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt,
    lastReadMessageId: member.lastReadMessageId,
    user: member.get("user"),
  }));
}
export async function deleteGroupChat(params: {
  currentUserId: number;
  chatId: number;
}) {
  const chat = await Chat.findByPk(params.chatId);

  if (!chat) {
    throw new AppError(404, "Grupo não encontrado.", "GROUP_NOT_FOUND");
  }

  if (chat.type !== "group") {
    throw new AppError(400, "Só é possível excluir grupos.", "NOT_GROUP_CHAT");
  }

  await assertGroupAdmin(params.chatId, params.currentUserId);

  await sequelize.transaction(async (transaction) => {
    await Message.destroy({
      where: {
        chatId: params.chatId,
      },
      transaction,
    });

    await ChatMember.destroy({
      where: {
        chatId: params.chatId,
      },
      transaction,
    });

    await Chat.destroy({
      where: {
        id: params.chatId,
      },
      transaction,
    });
  });

  return {
    deleted: true,
    chatId: params.chatId,
  };
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

  const result = await sequelize.transaction(async (transaction) => {
    if (existing && existing.leftAt) {
      existing.leftAt = null;
      existing.role = "member";
      existing.joinedAt = new Date();
      existing.lastReadMessageId = null;

      await existing.save({ transaction });

      await Message.create(
        {
          chatId: params.chatId,
          senderId: params.currentUserId,
          receiverId: null,
          text: "Um membro voltou para o grupo.",
          type: "system",
        },
        { transaction },
      );

      await touchChat(params.chatId, transaction);

      return {
        id: existing.id,
        chatId: existing.chatId,
        userId: existing.userId,
        role: existing.role,
      };
    }

    const member = await ChatMember.create(
      {
        chatId: params.chatId,
        userId: params.userId,
        role: "member",
        joinedAt: new Date(),
      },
      { transaction },
    );

    await Message.create(
      {
        chatId: params.chatId,
        senderId: params.currentUserId,
        receiverId: null,
        text: "Um novo membro entrou no grupo.",
        type: "system",
      },
      { transaction },
    );

    await touchChat(params.chatId, transaction);

    return {
      id: member.id,
      chatId: member.chatId,
      userId: member.userId,
      role: member.role,
    };
  });

  return result;
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

  await sequelize.transaction(async (transaction) => {
    targetMember.leftAt = new Date();

    await targetMember.save({ transaction });

    await Message.create(
      {
        chatId: params.chatId,
        senderId: params.currentUserId,
        receiverId: null,
        text: isLeavingSelf
          ? "Um membro saiu do grupo."
          : "Um membro foi removido do grupo.",
        type: "system",
      },
      { transaction },
    );

    await touchChat(params.chatId, transaction);
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

  if (params.name !== undefined) {
    chat.name = params.name;
  }

  if (params.description !== undefined) {
    chat.description = params.description;
  }

  if (params.avatarUrl !== undefined) {
    chat.avatarUrl = params.avatarUrl;
  }

  await chat.save();

  await Message.create({
    chatId: params.chatId,
    senderId: params.currentUserId,
    receiverId: null,
    text: "As informações do grupo foram atualizadas.",
    type: "system",
  });

  await touchChat(params.chatId);

  return chatDTO(chat);
}

export async function sendMessageToChat(params: {
  currentUserId: number;
  chatId: number;
  text: string;
  clientId?: string;
  replyToMessageId?: number | null;
}) {
  await assertChatMember(params.chatId, params.currentUserId);

  const chat = await Chat.findByPk(params.chatId);

  if (!chat) {
    throw new AppError(404, "Chat não encontrado.", "CHAT_NOT_FOUND");
  }

  await assertCanSendToPrivateChat(chat, params.currentUserId);

  await assertReplyMessage({
    chatId: params.chatId,
    replyToMessageId: params.replyToMessageId,
  });

  const message = await sequelize.transaction(async (transaction) => {
    const createdMessage = await Message.create(
      {
        chatId: params.chatId,
        senderId: params.currentUserId,
        receiverId: null,
        text: params.text,
        type: "text",
        replyToMessageId: params.replyToMessageId ?? null,
      },
      { transaction },
    );

    await touchChat(params.chatId, transaction);

    return createdMessage;
  });

  return messageDTOWithExtras(message, params.currentUserId, params.clientId ?? null);
}

export async function getChatMessages(params: {
  currentUserId: number;
  chatId: number;
  limit: number;
  beforeId?: number;
}) {
  const member = await assertChatMember(params.chatId, params.currentUserId);

  const where: WhereOptions<MessageAttributes> = applyMessageVisibility(
    {
      chatId: params.chatId,
      ...(params.beforeId
        ? {
            id: {
              [Op.lt]: params.beforeId,
            },
          }
        : {}),
    },
    member,
  );

  const messages = await Message.findAll({
    where,
    order: [["id", "DESC"]],
    limit: params.limit,
  });

  return messagesDTOWithExtras(messages.reverse(), params.currentUserId);
}


export async function searchChatMessages(params: {
  currentUserId: number;
  chatId: number;
  q?: string;
  type?: "all" | "text" | "image" | "video" | "audio" | "file" | "media";
  limit: number;
}) {
  const member = await assertChatMember(params.chatId, params.currentUserId);

  const query = (params.q ?? "").trim();
  const type = params.type ?? "all";

  const where: WhereOptions<MessageAttributes> = {
    chatId: params.chatId,
    deletedAt: null,
    type: {
      [Op.ne]: "system",
    },
  };

  if (type === "media") {
    Object.assign(where, {
      type: {
        [Op.in]: ["image", "video", "audio", "file"],
      },
    });
  } else if (type !== "all") {
    Object.assign(where, {
      type,
    });
  } else {
    Object.assign(where, {
      type: {
        [Op.in]: ["text", "image", "video", "audio", "file"],
      },
    });
  }

  if (query) {
    Object.assign(where, {
      [Op.or]: [
        {
          text: {
            [Op.iLike]: `%${query}%`,
          },
        },
        {
          mediaOriginalName: {
            [Op.iLike]: `%${query}%`,
          },
        },
      ],
    });
  }

  const visibleWhere = applyMessageVisibility(where, member);

  const messages = await Message.findAll({
    where: visibleWhere,
    order: [["id", "DESC"]],
    limit: params.limit,
  });

  const results = await messagesDTOWithExtras(messages, params.currentUserId);

  return {
    query,
    type,
    total: results.length,
    results,
  };
}

export async function markChatAsRead(params: {
  currentUserId: number;
  chatId: number;
  messageId: number;
}) {
  const member = await assertChatMember(params.chatId, params.currentUserId);

  const message = await Message.findOne({
    where: {
      id: params.messageId,
      chatId: params.chatId,
    },
    attributes: ["id"],
  });

  if (!message) {
    throw new AppError(
      404,
      "Mensagem não encontrada nesse chat.",
      "MESSAGE_NOT_FOUND",
    );
  }

  const previousLastRead = member.lastReadMessageId ?? 0;
  member.lastReadMessageId = Math.max(previousLastRead, params.messageId);

  await member.save();

  return {
    chatId: params.chatId,
    lastReadMessageId: member.lastReadMessageId,
  };
}

export async function updateChatPreferences(params: {
  currentUserId: number;
  chatId: number;
  isPinned?: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
  mutedUntil?: Date | null;
}) {
  const member = await assertChatMember(params.chatId, params.currentUserId);

  if (params.isPinned !== undefined) {
    member.isPinned = params.isPinned;
    member.pinnedAt = params.isPinned ? new Date() : null;
  }

  if (params.isArchived !== undefined) {
    member.isArchived = params.isArchived;
    member.archivedAt = params.isArchived ? new Date() : null;
  }

  if (params.isMuted !== undefined) {
    member.isMuted = params.isMuted;
    member.mutedUntil = params.isMuted ? (params.mutedUntil ?? null) : null;
  } else if (params.mutedUntil !== undefined) {
    member.mutedUntil = params.mutedUntil;
    member.isMuted = params.mutedUntil !== null;
  }

  await member.save();

  return {
    chatId: member.chatId,
    isPinned: Boolean(member.isPinned),
    isArchived: Boolean(member.isArchived),
    isMuted: Boolean(member.isMuted),
    pinnedAt: member.pinnedAt ?? null,
    archivedAt: member.archivedAt ?? null,
    mutedUntil: member.mutedUntil ?? null,
  };
}


export async function updatePrivateChatBlock(params: {
  currentUserId: number;
  chatId: number;
  blocked: boolean;
}) {
  const { otherUserId } = await getPrivateChatMembers(
    params.chatId,
    params.currentUserId,
  );

  if (params.blocked) {
    await UserBlock.findOrCreate({
      where: {
        blockerId: params.currentUserId,
        blockedId: otherUserId,
      },
      defaults: {
        blockerId: params.currentUserId,
        blockedId: otherUserId,
      },
    });
  } else {
    await UserBlock.destroy({
      where: {
        blockerId: params.currentUserId,
        blockedId: otherUserId,
      },
    });
  }

  return {
    chatId: params.chatId,
    otherUserId,
    block: await getBlockStatusBetween(params.currentUserId, otherUserId),
  };
}

export async function clearChatForMe(params: {
  currentUserId: number;
  chatId: number;
}) {
  const member = await assertChatMember(params.chatId, params.currentUserId);

  const lastMessage = await Message.findOne({
    where: {
      chatId: params.chatId,
    },
    order: [["id", "DESC"]],
    attributes: ["id"],
  });

  member.chatClearedAt = new Date();
  member.lastReadMessageId = lastMessage?.id ?? member.lastReadMessageId ?? null;

  await member.save();

  return {
    cleared: true,
    chatId: params.chatId,
    chatClearedAt: member.chatClearedAt,
    lastReadMessageId: member.lastReadMessageId,
  };
}

export async function deleteChatForMe(params: {
  currentUserId: number;
  chatId: number;
}) {
  const member = await assertChatMember(params.chatId, params.currentUserId);

  const now = new Date();

  member.chatDeletedAt = now;
  member.chatClearedAt = now;
  member.isPinned = false;
  member.pinnedAt = null;
  member.isArchived = false;
  member.archivedAt = null;
  member.isMuted = false;
  member.mutedUntil = null;

  await member.save();

  return {
    deletedForMe: true,
    chatId: params.chatId,
    chatDeletedAt: member.chatDeletedAt,
  };
}

export async function leaveGroupChat(params: {
  currentUserId: number;
  chatId: number;
}) {
  const chat = await Chat.findByPk(params.chatId);

  if (!chat) {
    throw new AppError(404, "Grupo não encontrado.", "GROUP_NOT_FOUND");
  }

  if (chat.type !== "group") {
    throw new AppError(400, "Só é possível sair de grupos.", "NOT_GROUP_CHAT");
  }

  const currentMember = await ChatMember.findOne({
    where: {
      chatId: params.chatId,
      userId: params.currentUserId,
      leftAt: null,
    },
  });

  if (!currentMember) {
    throw new AppError(
      403,
      "Você não participa desse grupo.",
      "CHAT_ACCESS_DENIED",
    );
  }

  const result = await sequelize.transaction(async (transaction) => {
    const otherMembers = await ChatMember.findAll({
      where: {
        chatId: params.chatId,
        userId: {
          [Op.ne]: params.currentUserId,
        },
        leftAt: null,
      },
      order: [["joinedAt", "ASC"]],
      transaction,
    });

    if (otherMembers.length === 0) {
      await Message.destroy({
        where: {
          chatId: params.chatId,
        },
        transaction,
      });

      await ChatMember.destroy({
        where: {
          chatId: params.chatId,
        },
        transaction,
      });

      await Chat.destroy({
        where: {
          id: params.chatId,
        },
        transaction,
      });

      return {
        left: true,
        deletedGroupBecauseEmpty: true,
        chatId: params.chatId,
      };
    }

    if (currentMember.role === "owner") {
      const nextOwner =
        otherMembers.find((member) => member.role === "admin") ||
        otherMembers[0];

      nextOwner.role = "owner";
      await nextOwner.save({ transaction });
    }

    currentMember.leftAt = new Date();
    currentMember.lastReadMessageId = null;

    await currentMember.save({ transaction });

    await Message.create(
      {
        chatId: params.chatId,
        senderId: params.currentUserId,
        receiverId: null,
        text: "Um membro saiu do grupo.",
        type: "system",
      },
      { transaction },
    );

    await Chat.update(
      {
        updatedAt: new Date(),
      },
      {
        where: {
          id: params.chatId,
        },
        transaction,
        silent: false,
      },
    );

    return {
      left: true,
      deletedGroupBecauseEmpty: false,
      chatId: params.chatId,
    };
  });

  return result;
}
function isLocalGroupAvatar(avatarUrl: string | null) {
  return Boolean(avatarUrl && avatarUrl.startsWith("/uploads/groups/"));
}

async function removeOldGroupAvatar(avatarUrl: string | null) {
  if (!isLocalGroupAvatar(avatarUrl)) {
    return;
  }

  try {
    const filePath = path.resolve("public", avatarUrl!.replace(/^\//, ""));
    await fs.unlink(filePath);
  } catch (error) {
    logger.warn(
      {
        err: error,
        avatarUrl,
      },
      "Não foi possível remover avatar antigo do grupo",
    );
  }
}


function isLocalChatMedia(mediaUrl: string | null) {
  return Boolean(mediaUrl && mediaUrl.startsWith("/uploads/chat-media/"));
}

async function removeOldChatMedia(mediaUrl: string | null) {
  if (!isLocalChatMedia(mediaUrl)) {
    return;
  }

  const stillUsed = await Message.count({
    where: {
      mediaUrl,
      deletedAt: null,
    },
  });

  if (stillUsed > 0) {
    return;
  }

  try {
    const filePath = path.resolve("public", mediaUrl!.replace(/^\//, ""));
    await fs.unlink(filePath);
  } catch (error) {
    logger.warn(
      {
        err: error,
        mediaUrl,
      },
      "Não foi possível remover mídia antiga da mensagem",
    );
  }
}

async function getEditableMessage(params: {
  currentUserId: number;
  chatId: number;
  messageId: number;
}) {
  await assertChatMember(params.chatId, params.currentUserId);

  const message = await Message.findOne({
    where: {
      id: params.messageId,
      chatId: params.chatId,
    },
  });

  if (!message) {
    throw new AppError(404, "Mensagem não encontrada.", "MESSAGE_NOT_FOUND");
  }

  if (message.senderId !== params.currentUserId) {
    throw new AppError(
      403,
      "Você só pode alterar mensagens enviadas por você.",
      "MESSAGE_PERMISSION_DENIED",
    );
  }

  if (message.type === "system") {
    throw new AppError(
      400,
      "Mensagens do sistema não podem ser alteradas.",
      "SYSTEM_MESSAGE_CANNOT_CHANGE",
    );
  }

  if (message.deletedAt) {
    throw new AppError(
      400,
      "Essa mensagem já foi apagada.",
      "MESSAGE_ALREADY_DELETED",
    );
  }

  return message;
}

export async function editMessageInChat(params: {
  currentUserId: number;
  chatId: number;
  messageId: number;
  text: string;
}) {
  const message = await getEditableMessage(params);

  message.text = params.text.trim();
  message.editedAt = new Date();

  await message.save();

  await touchChat(params.chatId);

  return messageDTOWithExtras(message, params.currentUserId);
}

export async function deleteMessageForEveryone(params: {
  currentUserId: number;
  chatId: number;
  messageId: number;
}) {
  const message = await getEditableMessage(params);
  const oldMediaUrl = message.mediaUrl ?? null;

  await sequelize.transaction(async (transaction) => {
    message.text = null;
    message.mediaUrl = null;
    message.mediaMimeType = null;
    message.mediaSize = null;
    message.mediaOriginalName = null;
    message.deletedAt = new Date();

    await message.save({ transaction });
    await touchChat(params.chatId, transaction);
  });

  await removeOldChatMedia(oldMediaUrl);

  return messageDTOWithExtras(message, params.currentUserId);
}

export async function toggleMessageReaction(params: {
  currentUserId: number;
  chatId: number;
  messageId: number;
  emoji: string;
}) {
  const allowedEmojis = new Set(["👍", "❤️", "😂", "😮", "😢", "🙏"]);
  const emoji = params.emoji.trim();

  if (!allowedEmojis.has(emoji)) {
    throw new AppError(
      400,
      "Reação inválida.",
      "INVALID_REACTION_EMOJI",
    );
  }

  await assertChatMember(params.chatId, params.currentUserId);

  const message = await Message.findOne({
    where: {
      id: params.messageId,
      chatId: params.chatId,
    },
  });

  if (!message) {
    throw new AppError(404, "Mensagem não encontrada.", "MESSAGE_NOT_FOUND");
  }

  if (message.type === "system") {
    throw new AppError(
      400,
      "Não é possível reagir a mensagens do sistema.",
      "SYSTEM_MESSAGE_CANNOT_REACT",
    );
  }

  if (message.deletedAt) {
    throw new AppError(
      400,
      "Não é possível reagir a uma mensagem apagada.",
      "MESSAGE_ALREADY_DELETED",
    );
  }

  await sequelize.transaction(async (transaction) => {
    const existing = await sequelize.query<{ id: number; emoji: string }>(
      `
        SELECT id, emoji
        FROM message_reactions
        WHERE message_id = :messageId
          AND user_id = :userId
        LIMIT 1
      `,
      {
        replacements: {
          messageId: params.messageId,
          userId: params.currentUserId,
        },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    const current = existing[0];

    if (current && current.emoji === emoji) {
      await sequelize.query(
        `DELETE FROM message_reactions WHERE id = :id`,
        {
          replacements: {
            id: current.id,
          },
          transaction,
        },
      );

      return;
    }

    if (current) {
      await sequelize.query(
        `
          UPDATE message_reactions
          SET emoji = :emoji,
              updated_at = NOW()
          WHERE id = :id
        `,
        {
          replacements: {
            id: current.id,
            emoji,
          },
          transaction,
        },
      );

      return;
    }

    await sequelize.query(
      `
        INSERT INTO message_reactions (message_id, user_id, emoji, created_at, updated_at)
        VALUES (:messageId, :userId, :emoji, NOW(), NOW())
      `,
      {
        replacements: {
          messageId: params.messageId,
          userId: params.currentUserId,
          emoji,
        },
        transaction,
      },
    );
  });

  return messageDTOWithExtras(message, params.currentUserId);
}


async function getVisibleMessageForUser(params: {
  currentUserId: number;
  chatId: number;
  messageId: number;
}) {
  const member = await assertChatMember(params.chatId, params.currentUserId);

  const visibleWhere = applyMessageVisibility(
    {
      id: params.messageId,
      chatId: params.chatId,
    },
    member,
  );

  const message = await Message.findOne({
    where: visibleWhere,
  });

  if (!message) {
    throw new AppError(404, "Mensagem não encontrada.", "MESSAGE_NOT_FOUND");
  }

  if (message.type === "system") {
    throw new AppError(
      400,
      "Não é possível usar mensagem do sistema nessa ação.",
      "SYSTEM_MESSAGE_NOT_ALLOWED",
    );
  }

  if (message.deletedAt) {
    throw new AppError(
      400,
      "Não é possível usar mensagem apagada nessa ação.",
      "MESSAGE_ALREADY_DELETED",
    );
  }

  return message;
}

export async function toggleMessageStar(params: {
  currentUserId: number;
  chatId: number;
  messageId: number;
  starred?: boolean;
}) {
  const message = await getVisibleMessageForUser(params);

  const currentlyStarred = await isMessageStarred(
    params.messageId,
    params.currentUserId,
  );

  const shouldStar =
    typeof params.starred === "boolean" ? params.starred : !currentlyStarred;

  await sequelize.transaction(async (transaction) => {
    if (!shouldStar) {
      await sequelize.query(
        `
          DELETE FROM message_stars
          WHERE message_id = :messageId
            AND user_id = :userId
        `,
        {
          replacements: {
            messageId: params.messageId,
            userId: params.currentUserId,
          },
          transaction,
        },
      );

      return;
    }

    await sequelize.query(
      `
        INSERT INTO message_stars (message_id, user_id, created_at, updated_at)
        VALUES (:messageId, :userId, NOW(), NOW())
        ON CONFLICT (message_id, user_id)
        DO UPDATE SET updated_at = NOW()
      `,
      {
        replacements: {
          messageId: params.messageId,
          userId: params.currentUserId,
        },
        transaction,
      },
    );
  });

  return messageDTOWithExtras(message, params.currentUserId);
}

export async function listStarredMessages(params: {
  currentUserId: number;
  chatId: number;
  limit: number;
}) {
  const member = await assertChatMember(params.chatId, params.currentUserId);

  const visibleWhere = applyMessageVisibility(
    {
      chatId: params.chatId,
      deletedAt: null,
      type: {
        [Op.ne]: "system",
      },
    },
    member,
  );

  const rows = await sequelize.query<{ message_id: number }>(
    `
      SELECT ms.message_id
      FROM message_stars ms
      INNER JOIN messages m ON m.id = ms.message_id
      WHERE ms.user_id = :currentUserId
        AND m.chat_id = :chatId
      ORDER BY ms.created_at DESC
      LIMIT :limit
    `,
    {
      replacements: {
        currentUserId: params.currentUserId,
        chatId: params.chatId,
        limit: params.limit,
      },
      type: QueryTypes.SELECT,
    },
  );

  const ids = rows.map((row) => row.message_id);

  if (!ids.length) {
    return [];
  }

  const messages = await Message.findAll({
    where: {
      ...visibleWhere,
      id: {
        [Op.in]: ids,
      },
    },
  });

  const order = new Map(ids.map((id, index) => [id, index]));

  messages.sort((a, b) => {
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });

  return messagesDTOWithExtras(messages, params.currentUserId);
}

export async function forwardMessageToChats(params: {
  currentUserId: number;
  sourceChatId: number;
  messageId: number;
  targetChatIds: number[];
}) {
  const sourceMessage = await getVisibleMessageForUser({
    currentUserId: params.currentUserId,
    chatId: params.sourceChatId,
    messageId: params.messageId,
  });

  const targetChatIds = Array.from(
    new Set(params.targetChatIds.map((chatId) => Number(chatId))),
  );

  if (!targetChatIds.length) {
    throw new AppError(
      400,
      "Escolha pelo menos uma conversa para encaminhar.",
      "FORWARD_TARGET_REQUIRED",
    );
  }

  const forwardedMessages: Message[] = [];

  for (const targetChatId of targetChatIds) {
    const targetMember = await assertChatMember(targetChatId, params.currentUserId);

    if (targetMember.chatDeletedAt) {
      targetMember.chatDeletedAt = null;
      await targetMember.save();
    }

    const targetChat = await Chat.findByPk(targetChatId);

    if (!targetChat) {
      throw new AppError(404, "Chat de destino não encontrado.", "TARGET_CHAT_NOT_FOUND");
    }

    await assertCanSendToPrivateChat(targetChat, params.currentUserId);

    const message = await sequelize.transaction(async (transaction) => {
      const createdMessage = await Message.create(
        {
          chatId: targetChatId,
          senderId: params.currentUserId,
          receiverId: null,
          text: sourceMessage.text,
          type: sourceMessage.type,
          mediaUrl: sourceMessage.mediaUrl,
          mediaMimeType: sourceMessage.mediaMimeType,
          mediaSize: sourceMessage.mediaSize,
          mediaOriginalName: sourceMessage.mediaOriginalName,
          forwardedFromMessageId: sourceMessage.id,
        },
        { transaction },
      );

      await touchChat(targetChatId, transaction);

      return createdMessage;
    });

    forwardedMessages.push(message);
  }

  return messagesDTOWithExtras(forwardedMessages, params.currentUserId);
}

export async function updateGroupAvatar(params: {
  currentUserId: number;
  chatId: number;
  avatarUrl: string;
}) {
  const chat = await Chat.findByPk(params.chatId);

  if (!chat) {
    throw new AppError(404, "Grupo não encontrado.", "GROUP_NOT_FOUND");
  }

  if (chat.type !== "group") {
    throw new AppError(
      400,
      "Só grupos podem ter imagem de perfil.",
      "NOT_GROUP_CHAT",
    );
  }

  const member = await assertGroupAdmin(params.chatId, params.currentUserId);

  const oldAvatarUrl = chat.avatarUrl;

  chat.avatarUrl = params.avatarUrl;

  await chat.save();

  await Message.create({
    chatId: params.chatId,
    senderId: params.currentUserId,
    receiverId: null,
    text: "A imagem do grupo foi atualizada.",
    type: "system",
  });

  await removeOldGroupAvatar(oldAvatarUrl);

  return {
    ...chatDTO(chat),
    myRole: member.role,
    canManageGroup: true,
    canDeleteGroup: true,
  };
}
export async function sendMediaMessageToChat(params: {
  currentUserId: number;
  chatId: number;
  caption?: string;
  mediaUrl: string;
  mediaMimeType: string;
  mediaSize: number;
  mediaOriginalName: string;
  replyToMessageId?: number | null;
}) {
  await assertChatMember(params.chatId, params.currentUserId);

  const chat = await Chat.findByPk(params.chatId);

  if (!chat) {
    throw new AppError(404, "Chat não encontrado.", "CHAT_NOT_FOUND");
  }

  await assertCanSendToPrivateChat(chat, params.currentUserId);

  await assertReplyMessage({
    chatId: params.chatId,
    replyToMessageId: params.replyToMessageId,
  });

  const messageType = getChatFileMessageType(params.mediaMimeType);
  const fileTypeLabel = getChatFileTypeLabel(params.mediaMimeType);

  const message = await sequelize.transaction(async (transaction) => {
    const createdMessage = await Message.create(
      {
        chatId: params.chatId,
        senderId: params.currentUserId,
        receiverId: null,
        text: params.caption ?? null,
        type: messageType,
        mediaUrl: params.mediaUrl,
        mediaMimeType: params.mediaMimeType,
        mediaSize: params.mediaSize,
        mediaOriginalName: params.mediaOriginalName,
        replyToMessageId: params.replyToMessageId ?? null,
      },
      { transaction },
    );

    await Chat.update(
      {
        updatedAt: new Date(),
      },
      {
        where: {
          id: params.chatId,
        },
        transaction,
        silent: false,
      },
    );

    return createdMessage;
  });

  logger.info(
    {
      chatId: params.chatId,
      userId: params.currentUserId,
      messageId: message.id,
      fileType: fileTypeLabel,
      mimeType: params.mediaMimeType,
      size: params.mediaSize,
    },
    "Arquivo enviado no chat",
  );

  return messageDTOWithExtras(message, params.currentUserId);
}

