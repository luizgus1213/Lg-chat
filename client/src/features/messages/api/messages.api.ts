import { apiRequest, type ApiSuccess } from "../../../api/apiClient";

import {
  chatMessagesSchema,
  markReadResultSchema,
  type MarkReadResult,
  type ServerChatMessage,
} from "../messages.schemas";

type ListMessagesOptions = {
  limit?: number;
  beforeId?: number;
};

export async function listMessages(
  chatId: number,
  options: ListMessagesOptions = {},
): Promise<ApiSuccess<ServerChatMessage[]>> {
  const limit = options.limit ?? 30;

  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (options.beforeId) {
    params.set("beforeId", String(options.beforeId));
  }

  const response = await apiRequest<unknown>(
    `/api/chats/${chatId}/messages?${params.toString()}`,
    {
      method: "GET",
    },
  );

  return {
    ...response,
    data: chatMessagesSchema.parse(response.data),
  };
}

export async function markChatAsRead(
  chatId: number,
  messageId: number,
): Promise<ApiSuccess<MarkReadResult>> {
  const response = await apiRequest<unknown>(`/api/chats/${chatId}/read`, {
    method: "POST",
    body: JSON.stringify({
      messageId,
    }),
  });

  return {
    ...response,
    data: markReadResultSchema.parse(response.data),
  };
}
