import { apiRequest, type ApiSuccess } from "../../api/apiClient";
import { authUserSchema, type AuthUser } from "../auth/auth.schemas";

type RequestOptions = { signal?: AbortSignal };

export async function updateProfile(
  input: { nome: string; about: string | null },
  options: RequestOptions = {},
): Promise<ApiSuccess<AuthUser>> {
  const response = await apiRequest<unknown>("/api/users/me", {
    method: "PATCH",
    signal: options.signal,
    body: JSON.stringify(input),
  });
  return { ...response, data: authUserSchema.parse(response.data) };
}

export async function updateProfileAvatar(
  file: File,
  options: RequestOptions = {},
): Promise<ApiSuccess<AuthUser>> {
  const formData = new FormData();
  formData.set("avatar", file, file.name);
  const response = await apiRequest<unknown>("/api/users/me/avatar", {
    method: "POST",
    body: formData,
    signal: options.signal,
    timeoutMs: 60_000,
  });
  return { ...response, data: authUserSchema.parse(response.data) };
}
