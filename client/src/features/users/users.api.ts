import { ApiError, apiRequest, type ApiSuccess } from "../../api/apiClient";
import { userDirectorySchema, type ChatUser } from "./users.schemas";

type RequestOptions = {
  signal?: AbortSignal;
  query?: string;
  page?: number;
  limit?: number;
};

export async function listAvailableUsers(
  options: RequestOptions = {},
): Promise<ApiSuccess<ChatUser[]>> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 50),
    page: String(options.page ?? 1),
  });
  const query = options.query?.trim();
  if (query) params.set("q", query);

  const response = await apiRequest<unknown>(
    `/api/users/directory?${params.toString()}`,
    {
      method: "GET",
      signal: options.signal,
    },
  );

  const parsed = userDirectorySchema.safeParse(response.data);
  if (!parsed.success) {
    throw new ApiError({
      statusCode: 200,
      code: "INVALID_API_RESPONSE",
      message: "O servidor retornou uma resposta inválida.",
      details: parsed.error,
    });
  }

  return { ...response, data: parsed.data.items };
}
