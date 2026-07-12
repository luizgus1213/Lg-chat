import { apiRequest, type ApiSuccess } from "../../api/apiClient";

import { chatUsersSchema, type ChatUser } from "./users.schemas";

export async function listAvailableUsers(): Promise<ApiSuccess<ChatUser[]>> {
  const response = await apiRequest<unknown>("/api/users", {
    method: "GET",
  });

  return {
    ...response,
    data: chatUsersSchema.parse(response.data),
  };
}
