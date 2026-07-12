import { z } from "zod";

import { apiRequest, type ApiSuccess } from "../../api/apiClient";
import {
  conversationsListSchema,
  type Conversation,
} from "./conversations.schemas";

type RequestOptions = {
  signal?: AbortSignal;
};

export async function listConversations(
  options: RequestOptions = {},
): Promise<ApiSuccess<Conversation[]>> {
  const response = await apiRequest<unknown>("/api/chats", {
    method: "GET",
    signal: options.signal,
  });

  return {
    ...response,
    data: conversationsListSchema.parse(response.data),
  };
}

const createdPrivateChatSchema = z
  .object({
    id: z.number().int().positive(),
  })
  .passthrough();

export type CreatedPrivateChat = z.infer<typeof createdPrivateChatSchema>;

export async function createPrivateConversation(
  userId: number,
  options: RequestOptions = {},
): Promise<ApiSuccess<CreatedPrivateChat>> {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Usuário inválido.");
  }

  const response = await apiRequest<unknown>("/api/chats/private", {
    method: "POST",
    signal: options.signal,
    body: JSON.stringify({ userId }),
  });

  return {
    ...response,
    data: createdPrivateChatSchema.parse(response.data),
  };
}
