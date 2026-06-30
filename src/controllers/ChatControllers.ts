import type { Request, Response } from "express";
import { emitToChat } from "../sockets/socketServer";

import {
  addMemberSchema,
  chatIdParamsSchema,
  createGroupChatSchema,
  createPrivateChatSchema,
  listChatMessagesQuerySchema,
  listMyChatsQuerySchema,
  searchChatMessagesQuerySchema,
  markChatAsReadSchema,
  sendChatMediaSchema,
  sendChatMessageSchema,
  editChatMessageSchema,
  messageIdParamsSchema,
  toggleReactionSchema,
  updateChatPreferencesSchema,
  blockContactSchema,
  toggleStarSchema,
  forwardMessageSchema,
  listStarredMessagesQuerySchema,
  updateGroupSchema,
  userIdParamsSchema,
} from "../validators/chatValidator";

import {
  addMemberToGroup,
  createGroupChat,
  createPrivateChat,
  deleteGroupChat,
  getChatById,
  getChatMessages,
  searchChatMessages,
  leaveGroupChat,
  listChatMembers,
  listMyChats,
  markChatAsRead,
  removeMemberFromGroup,
  sendMediaMessageToChat,
  sendMessageToChat,
  updateGroup,
  updateGroupAvatar,
  editMessageInChat,
  deleteMessageForEveryone,
  toggleMessageReaction,
  updateChatPreferences,
  updatePrivateChatBlock,
  clearChatForMe,
  deleteChatForMe,
  toggleMessageStar,
  listStarredMessages,
  forwardMessageToChats,
} from "../services/ChatService";

import { created, ok } from "../utils/httpResponse";
import {
  processAvatarImageUpload,
  processChatMediaUpload,
  removeUploadedFile,
  type ProcessedUpload,
} from "../utils/uploadSecurity";

export async function createPrivateChatController(req: Request, res: Response) {
  const data = createPrivateChatSchema.parse(req.body);

  const chat = await createPrivateChat(req.user!.id, data.userId);

  return created(res, chat, "Conversa criada com sucesso.");
}

export async function createGroupChatController(req: Request, res: Response) {
  const data = createGroupChatSchema.parse(req.body);

  const chat = await createGroupChat({
    currentUserId: req.user!.id,
    name: data.name,
    description: data.description,
    memberIds: data.memberIds,
  });

  return created(res, chat, "Grupo criado com sucesso.");
}

export async function listMyChatsController(req: Request, res: Response) {
  const query = listMyChatsQuerySchema.parse(req.query);
  const chats = await listMyChats(req.user!.id, {
    archived: query.archived,
  });

  return ok(res, chats);
}

export async function getChatController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);

  const chat = await getChatById(req.user!.id, chatId);

  return ok(res, chat);
}

export async function listChatMembersController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);

  const members = await listChatMembers(req.user!.id, chatId);

  return ok(res, members);
}

export async function addMemberController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);
  const data = addMemberSchema.parse(req.body);

  const member = await addMemberToGroup({
    currentUserId: req.user!.id,
    chatId,
    userId: data.userId,
  });

  return created(res, member, "Membro adicionado com sucesso.");
}

export async function removeMemberController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);
  const { userId } = userIdParamsSchema.parse(req.params);

  const result = await removeMemberFromGroup({
    currentUserId: req.user!.id,
    chatId,
    userId,
  });

  return ok(res, result, "Membro removido com sucesso.");
}

export async function updateGroupController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);
  const data = updateGroupSchema.parse(req.body);

  const chat = await updateGroup({
    currentUserId: req.user!.id,
    chatId,
    name: data.name,
    description: data.description,
    avatarUrl: data.avatarUrl,
  });

  return ok(res, chat, "Grupo atualizado com sucesso.");
}

export async function sendChatMessageController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);
  const data = sendChatMessageSchema.parse(req.body);

  const message = await sendMessageToChat({
    currentUserId: req.user!.id,
    chatId,
    text: data.text,
    clientId: data.clientId,
    replyToMessageId: data.replyToMessageId,
  });

  return created(res, message, "Mensagem enviada com sucesso.");
}

export async function listChatMessagesController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);
  const query = listChatMessagesQuerySchema.parse(req.query);

  const messages = await getChatMessages({
    currentUserId: req.user!.id,
    chatId,
    limit: query.limit,
    beforeId: query.beforeId,
  });

  return ok(res, messages);
}

export async function searchChatMessagesController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);
  const query = searchChatMessagesQuerySchema.parse(req.query);

  const result = await searchChatMessages({
    currentUserId: req.user!.id,
    chatId,
    q: query.q,
    type: query.type,
    limit: query.limit,
  });

  return ok(res, result);
}

export async function markChatAsReadController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);
  const data = markChatAsReadSchema.parse(req.body);

  const result = await markChatAsRead({
    currentUserId: req.user!.id,
    chatId,
    messageId: data.messageId,
  });

  return ok(res, result, "Chat marcado como lido.");
}



export async function updateChatPreferencesController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);
  const data = updateChatPreferencesSchema.parse(req.body);

  const preferences = await updateChatPreferences({
    currentUserId: req.user!.id,
    chatId,
    isPinned: data.isPinned,
    isArchived: data.isArchived,
    isMuted: data.isMuted,
    mutedUntil: data.mutedUntil,
  });

  return ok(res, preferences, "Preferências do chat atualizadas.");
}




export async function blockContactController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);
  const data = blockContactSchema.parse(req.body);

  const result = await updatePrivateChatBlock({
    currentUserId: req.user!.id,
    chatId,
    blocked: data.blocked,
  });

  return ok(
    res,
    result,
    data.blocked ? "Contato bloqueado com sucesso." : "Contato desbloqueado com sucesso.",
  );
}

export async function clearChatForMeController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);

  const result = await clearChatForMe({
    currentUserId: req.user!.id,
    chatId,
  });

  return ok(res, result, "Conversa limpa somente para você.");
}

export async function deleteChatForMeController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);

  const result = await deleteChatForMe({
    currentUserId: req.user!.id,
    chatId,
  });

  return ok(res, result, "Conversa apagada somente para você.");
}

export async function editChatMessageController(req: Request, res: Response) {
  const { chatId, messageId } = messageIdParamsSchema.parse(req.params);
  const data = editChatMessageSchema.parse(req.body);

  const message = await editMessageInChat({
    currentUserId: req.user!.id,
    chatId,
    messageId,
    text: data.text,
  });

  emitToChat(chatId, "chat_message_updated", message);

  emitToChat(chatId, "chat_updated", {
    chatId,
    updatedAt: message.updatedAt || message.editedAt || message.createdAt,
  });

  return ok(res, message, "Mensagem editada com sucesso.");
}

export async function deleteChatMessageController(req: Request, res: Response) {
  const { chatId, messageId } = messageIdParamsSchema.parse(req.params);

  const message = await deleteMessageForEveryone({
    currentUserId: req.user!.id,
    chatId,
    messageId,
  });

  emitToChat(chatId, "chat_message_updated", message);

  emitToChat(chatId, "chat_updated", {
    chatId,
    updatedAt: message.updatedAt || message.deletedAt || message.createdAt,
  });

  return ok(res, message, "Mensagem apagada com sucesso.");
}

export async function toggleMessageReactionController(req: Request, res: Response) {
  const { chatId, messageId } = messageIdParamsSchema.parse(req.params);
  const data = toggleReactionSchema.parse(req.body);

  const message = await toggleMessageReaction({
    currentUserId: req.user!.id,
    chatId,
    messageId,
    emoji: data.emoji,
  });

  emitToChat(chatId, "chat_message_updated", message);

  return ok(res, message, "Reação atualizada com sucesso.");
}

export async function toggleMessageStarController(req: Request, res: Response) {
  const { chatId, messageId } = messageIdParamsSchema.parse(req.params);
  const data = toggleStarSchema.parse(req.body);

  const message = await toggleMessageStar({
    currentUserId: req.user!.id,
    chatId,
    messageId,
    starred: data.starred,
  });

  return ok(
    res,
    message,
    message.isStarred ? "Mensagem favoritada." : "Mensagem removida das favoritas.",
  );
}

export async function listStarredMessagesController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);
  const query = listStarredMessagesQuerySchema.parse(req.query);

  const messages = await listStarredMessages({
    currentUserId: req.user!.id,
    chatId,
    limit: query.limit,
  });

  return ok(res, messages);
}

export async function forwardMessageController(req: Request, res: Response) {
  const { chatId, messageId } = messageIdParamsSchema.parse(req.params);
  const data = forwardMessageSchema.parse(req.body);

  const messages = await forwardMessageToChats({
    currentUserId: req.user!.id,
    sourceChatId: chatId,
    messageId,
    targetChatIds: data.targetChatIds,
  });

  for (const message of messages) {
    const targetChatId = Number(message.chatId);

    emitToChat(targetChatId, "chat_message", message);

    emitToChat(targetChatId, "chat_updated", {
      chatId: targetChatId,
      updatedAt: message.createdAt,
    });
  }

  return created(res, messages, "Mensagem encaminhada com sucesso.");
}

export async function deleteGroupController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);

  const result = await deleteGroupChat({
    currentUserId: req.user!.id,
    chatId,
  });

  return ok(res, result, "Grupo excluído com sucesso.");
}

export async function leaveGroupController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);

  const result = await leaveGroupChat({
    currentUserId: req.user!.id,
    chatId,
  });

  return ok(res, result, "Você saiu do grupo com sucesso.");
}


export async function updateGroupAvatarController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: {
        code: "IMAGE_REQUIRED",
        message: "Envie uma imagem para salvar como foto do grupo.",
        statusCode: 400,
      },
    });
  }

  let processedFile: ProcessedUpload | null = null;

  try {
    processedFile = await processAvatarImageUpload(req.file);

    const chat = await updateGroupAvatar({
      currentUserId: req.user!.id,
      chatId,
      avatarUrl: processedFile.mediaUrl,
    });

    emitToChat(chatId, "chat_updated", {
      chatId,
      avatarUrl: processedFile.mediaUrl,
      updatedAt: chat.updatedAt,
    });

    return ok(res, chat, "Foto do grupo atualizada com sucesso.");
  } catch (error) {
    await removeUploadedFile(processedFile?.filePath ?? req.file.path);
    throw error;
  }
}

export async function sendChatMediaController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);
  const data = sendChatMediaSchema.parse(req.body);

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: {
        code: "MEDIA_REQUIRED",
        message: "Envie uma foto, vídeo, áudio ou documento.",
        statusCode: 400,
      },
    });
  }

  let processedFile: ProcessedUpload | null = null;

  try {
    processedFile = await processChatMediaUpload(req.file);

    const message = await sendMediaMessageToChat({
      currentUserId: req.user!.id,
      chatId,
      caption: data.caption,
      mediaUrl: processedFile.mediaUrl,
      mediaMimeType: processedFile.mediaMimeType,
      mediaSize: processedFile.mediaSize,
      mediaOriginalName: processedFile.mediaOriginalName,
      replyToMessageId: data.replyToMessageId,
    });

    emitToChat(chatId, "chat_message", message);

    emitToChat(chatId, "chat_updated", {
      chatId,
      updatedAt: message.createdAt,
    });

    return created(res, message, "Arquivo enviado com sucesso.");
  } catch (error) {
    await removeUploadedFile(processedFile?.filePath ?? req.file.path);
    throw error;
  }
}
