import { ApiError, apiRequest, type ApiSuccess } from "../../api/apiClient";
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

  const parsed = chatUsersSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new ApiError({
      statusCode: 200,
      code: "INVALID_API_RESPONSE",
      message: "O servidor retornou uma resposta inválida.",
      details: parsed.error,
    });
  }

  return { ...response, data: parsed.data };
}
