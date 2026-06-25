import type { Request, Response } from "express";
import {
  addMemberSchema,
  chatIdParamsSchema,
  createGroupChatSchema,
  createPrivateChatSchema,
  listChatMessagesQuerySchema,
  sendChatMessageSchema,
  updateGroupSchema,
  userIdParamsSchema,
} from "../validators/chatValidator";
import {
  addMemberToGroup,
  createGroupChat,
  createPrivateChat,
  getChatById,
  getChatMessages,
  listChatMembers,
  listMyChats,
  markChatAsRead,
  removeMemberFromGroup,
  sendMessageToChat,
  updateGroup,
} from "../services/ChatService";
import { created, ok } from "../utils/httpResponse";

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
  const chats = await listMyChats(req.user!.id);

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

export async function markChatAsReadController(req: Request, res: Response) {
  const { chatId } = chatIdParamsSchema.parse(req.params);
  const data = userIdParamsSchema
    .pick({
      userId: true,
    })
    .transform((value) => ({
      messageId: value.userId,
    }))
    .parse({
      userId: req.body.messageId,
    });

  const result = await markChatAsRead({
    currentUserId: req.user!.id,
    chatId,
    messageId: data.messageId,
  });

  return ok(res, result, "Chat marcado como lido.");
}
