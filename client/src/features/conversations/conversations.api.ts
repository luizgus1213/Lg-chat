import { apiRequest, type ApiSuccess } from "../../api/apiClient";
import { z } from "zod";
import {
  conversationsListSchema,
  type Conversation,
} from "./conversations.schemas";

let activeRequest: Promise<ApiSuccess<Conversation[]>> | null = null;

async function executeListConversations(): Promise<ApiSuccess<Conversation[]>> {
  const response = await apiRequest<unknown>("/api/chats", {
    method: "GET",
  });

  return {
    ...response,
    data: conversationsListSchema.parse(response.data),
  };
}

export function listConversations(): Promise<ApiSuccess<Conversation[]>> {
  if (activeRequest) {
    return activeRequest;
  }

  activeRequest = executeListConversations().finally(() => {
    activeRequest = null;
  });

  return activeRequest;
}
const createdPrivateChatSchema = z
  .object({
    id: z.number().int().positive(),
  })
  .passthrough();

export type CreatedPrivateChat = z.infer<typeof createdPrivateChatSchema>;

export async function createPrivateConversation(
  userId: number,
): Promise<ApiSuccess<CreatedPrivateChat>> {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Usuário inválido.");
  }

  const response = await apiRequest<unknown>("/api/chats/private", {
    method: "POST",
    body: JSON.stringify({
      userId,
    }),
  });

  return {
    ...response,
    data: createdPrivateChatSchema.parse(response.data),
  };
}
