import { apiRequest, type ApiSuccess } from "../../api/apiClient";
import { chatUsersSchema, type ChatUser } from "./users.schemas";

type RequestOptions = {
  signal?: AbortSignal;
};

export async function listAvailableUsers(
  options: RequestOptions = {},
): Promise<ApiSuccess<ChatUser[]>> {
  const response = await apiRequest<unknown>("/api/users", {
    method: "GET",
    signal: options.signal,
  });

  return {
    ...response,
    data: chatUsersSchema.parse(response.data),
  };
}
