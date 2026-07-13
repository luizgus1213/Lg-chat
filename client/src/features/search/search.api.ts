import { apiRequest } from "../../api/apiClient";
import { messageSearchResultSchema, type MessageSearchType } from "./search.schemas";

export async function searchMessages(
  chatId: number,
  input: { q: string; type: MessageSearchType; limit?: number },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    q: input.q.trim(),
    type: input.type,
    limit: String(input.limit ?? 40),
  });
  const response = await apiRequest<unknown>(`/api/chats/${chatId}/messages/search?${params}`, {
    method: "GET",
    signal,
  });
  return { ...response, data: messageSearchResultSchema.parse(response.data) };
}
