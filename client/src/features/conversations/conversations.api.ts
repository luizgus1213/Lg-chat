import { z } from "zod";

import { apiRequest, type ApiSuccess } from "../../api/apiClient";
import {
  conversationsListSchema,
  type Conversation,
} from "./conversations.schemas";

type RequestOptions = {
  signal?: AbortSignal;
  archived?: boolean;
};

export async function listConversations(
  options: RequestOptions = {},
): Promise<ApiSuccess<Conversation[]>> {
  const path = options.archived ? "/api/chats?archived=true" : "/api/chats";
  const response = await apiRequest<unknown>(path, {
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
    type: z.literal("private"),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();

export type CreatedPrivateChat = z.infer<typeof createdPrivateChatSchema>;

export async function createPrivateConversation(
  userId: number,
  options: RequestOptions = {},
): Promise<ApiSuccess<CreatedPrivateChat>> {
  const validUserId = z
    .number()
    .int()
    .positive("Usuário inválido.")
    .parse(userId);

  const response = await apiRequest<unknown>("/api/chats/private", {
    method: "POST",
    signal: options.signal,
    body: JSON.stringify({ userId: validUserId }),
  });

  return {
    ...response,
    data: createdPrivateChatSchema.parse(response.data),
  };
}
