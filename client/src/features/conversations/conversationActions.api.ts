import { z } from "zod";

import { apiRequest, type ApiSuccess } from "../../api/apiClient";
import { chatBlockSchema } from "./conversations.schemas";

type RequestOptions = { signal?: AbortSignal };

const nullableDateSchema = z.string().datetime({ offset: true }).nullable();

const preferencesSchema = z.object({
  chatId: z.number().int().positive(),
  isPinned: z.boolean(),
  isArchived: z.boolean(),
  isMuted: z.boolean(),
  pinnedAt: nullableDateSchema,
  archivedAt: nullableDateSchema,
  mutedUntil: nullableDateSchema,
});

const blockResultSchema = z.object({
  chatId: z.number().int().positive(),
  otherUserId: z.number().int().positive(),
  block: chatBlockSchema,
});

const clearResultSchema = z.object({
  cleared: z.literal(true),
  chatId: z.number().int().positive(),
  chatClearedAt: z.string().datetime({ offset: true }),
  lastReadMessageId: z.number().int().positive().nullable(),
});

const deleteForMeResultSchema = z.object({
  deletedForMe: z.literal(true),
  chatId: z.number().int().positive(),
  chatDeletedAt: z.string().datetime({ offset: true }),
});

export type ChatPreferences = z.infer<typeof preferencesSchema>;

export async function updateConversationPreferences(
  chatId: number,
  input: {
    isPinned: boolean;
    isArchived: boolean;
    isMuted: boolean;
    mutedUntil: string | null;
  },
  options: RequestOptions = {},
): Promise<ApiSuccess<ChatPreferences>> {
  const response = await apiRequest<unknown>(
    `/api/chats/${chatId}/preferences`,
    {
      method: "PATCH",
      signal: options.signal,
      body: JSON.stringify(input),
    },
  );
  return { ...response, data: preferencesSchema.parse(response.data) };
}

export async function updateConversationBlock(
  chatId: number,
  blocked: boolean,
  options: RequestOptions = {},
) {
  const response = await apiRequest<unknown>(`/api/chats/${chatId}/block`, {
    method: "PATCH",
    signal: options.signal,
    body: JSON.stringify({ blocked }),
  });
  return { ...response, data: blockResultSchema.parse(response.data) };
}

export async function clearConversationForMe(
  chatId: number,
  options: RequestOptions = {},
) {
  const response = await apiRequest<unknown>(`/api/chats/${chatId}/clear`, {
    method: "POST",
    signal: options.signal,
  });
  return { ...response, data: clearResultSchema.parse(response.data) };
}

export async function deleteConversationForMe(
  chatId: number,
  options: RequestOptions = {},
) {
  const response = await apiRequest<unknown>(
    `/api/chats/${chatId}/delete-for-me`,
    {
      method: "POST",
      signal: options.signal,
    },
  );
  return { ...response, data: deleteForMeResultSchema.parse(response.data) };
}
