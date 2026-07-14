import { apiRequest, type ApiSuccess } from "../../../api/apiClient";
import {
  chatMessageSchema,
  chatMessagesSchema,
  messageContextSchema,
  allStarredMessagesSchema,
  markReadResultSchema,
  type MarkReadResult,
  type ServerChatMessage,
} from "../messages.schemas";

type ListMessagesOptions = {
  limit?: number;
  beforeId?: number;
};

type RequestOptions = {
  signal?: AbortSignal;
};

type SendMediaOptions = RequestOptions & {
  caption?: string;
  replyToMessageId?: number;
};

async function parseMessageResponse(
  response: ApiSuccess<unknown>,
): Promise<ApiSuccess<ServerChatMessage>> {
  return {
    ...response,
    data: chatMessageSchema.parse(response.data),
  };
}

export async function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  requestOptions: RequestOptions = {},
) {
  const response = await apiRequest<unknown>(
    `/api/chats/${chatId}/messages/${messageId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ text }),
      signal: requestOptions.signal,
    },
  );
  return parseMessageResponse(response);
}

export async function deleteMessage(
  chatId: number,
  messageId: number,
  requestOptions: RequestOptions = {},
) {
  const response = await apiRequest<unknown>(
    `/api/chats/${chatId}/messages/${messageId}`,
    { method: "DELETE", signal: requestOptions.signal },
  );
  return parseMessageResponse(response);
}

export async function forwardMessage(
  chatId: number,
  messageId: number,
  targetChatIds: number[],
  requestOptions: RequestOptions = {},
) {
  const response = await apiRequest<unknown>(
    `/api/chats/${chatId}/messages/${messageId}/forward`,
    {
      method: "POST",
      body: JSON.stringify({ targetChatIds }),
      signal: requestOptions.signal,
    },
  );
  return {
    ...response,
    data: chatMessagesSchema.parse(response.data),
  };
}

export async function listStarredMessages(
  chatId: number,
  limit = 100,
  requestOptions: RequestOptions = {},
) {
  const response = await apiRequest<unknown>(
    `/api/chats/${chatId}/messages/starred?limit=${limit}`,
    { method: "GET", signal: requestOptions.signal },
  );
  return { ...response, data: chatMessagesSchema.parse(response.data) };
}

export async function listAllStarredMessages(
  options: { limit?: number; beforeId?: number } = {},
  requestOptions: RequestOptions = {},
) {
  const params = new URLSearchParams({ limit: String(options.limit ?? 30) });
  if (options.beforeId) params.set("beforeId", String(options.beforeId));

  const response = await apiRequest<unknown>(
    `/api/chats/messages/starred?${params.toString()}`,
    { method: "GET", signal: requestOptions.signal },
  );

  return {
    ...response,
    data: allStarredMessagesSchema.parse(response.data),
  };
}

export async function loadMessageContext(
  chatId: number,
  messageId: number,
  radius = 15,
  requestOptions: RequestOptions = {},
) {
  const response = await apiRequest<unknown>(
    `/api/chats/${chatId}/messages/${messageId}/context?radius=${radius}`,
    { method: "GET", signal: requestOptions.signal },
  );

  return { ...response, data: messageContextSchema.parse(response.data) };
}

export async function listMessages(
  chatId: number,
  options: ListMessagesOptions = {},
  requestOptions: RequestOptions = {},
): Promise<ApiSuccess<ServerChatMessage[]>> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 30),
  });

  if (options.beforeId) {
    params.set("beforeId", String(options.beforeId));
  }

  const response = await apiRequest<unknown>(
    `/api/chats/${chatId}/messages?${params.toString()}`,
    {
      method: "GET",
      signal: requestOptions.signal,
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
  requestOptions: RequestOptions = {},
): Promise<ApiSuccess<MarkReadResult>> {
  const response = await apiRequest<unknown>(`/api/chats/${chatId}/read`, {
    method: "POST",
    body: JSON.stringify({ messageId }),
    signal: requestOptions.signal,
  });

  return {
    ...response,
    data: markReadResultSchema.parse(response.data),
  };
}

export async function sendMediaMessage(
  chatId: number,
  file: File,
  options: SendMediaOptions = {},
): Promise<ApiSuccess<ServerChatMessage>> {
  const formData = new FormData();
  formData.set("media", file, file.name);

  const caption = options.caption?.trim();
  if (caption) formData.set("caption", caption);
  if (options.replyToMessageId) {
    formData.set("replyToMessageId", String(options.replyToMessageId));
  }

  const response = await apiRequest<unknown>(`/api/chats/${chatId}/media`, {
    method: "POST",
    body: formData,
    signal: options.signal,
    timeoutMs: 90_000,
  });

  return parseMessageResponse(response);
}

export async function toggleMessageReaction(
  chatId: number,
  messageId: number,
  emoji: string,
  requestOptions: RequestOptions = {},
): Promise<ApiSuccess<ServerChatMessage>> {
  const response = await apiRequest<unknown>(
    `/api/chats/${chatId}/messages/${messageId}/reactions`,
    {
      method: "POST",
      body: JSON.stringify({ emoji }),
      signal: requestOptions.signal,
    },
  );

  return parseMessageResponse(response);
}

export async function setMessageStarred(
  chatId: number,
  messageId: number,
  starred: boolean,
  requestOptions: RequestOptions = {},
): Promise<ApiSuccess<ServerChatMessage>> {
  const response = await apiRequest<unknown>(
    `/api/chats/${chatId}/messages/${messageId}/star`,
    {
      method: "POST",
      body: JSON.stringify({ starred }),
      signal: requestOptions.signal,
    },
  );

  return parseMessageResponse(response);
}
