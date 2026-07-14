import type { ZodType } from "zod";

import { ApiError, apiRequest, type ApiSuccess } from "../../api/apiClient";

import {
  authSessionSchema,
  loginInputSchema,
  meResultSchema,
  registerInputSchema,
  registerResultSchema,
  resendEmailInputSchema,
  resendEmailResultSchema,
  verifyEmailInputSchema,
  type AuthSession,
  type LoginInput,
  type MeResult,
  type RegisterInput,
  type RegisterResult,
  type ResendEmailInput,
  type ResendEmailResult,
  type VerifyEmailInput,
} from "./auth.schemas";

type RequestOptions = {
  signal?: AbortSignal;
};

function parseResponseData<T>(schema: ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;

  throw new ApiError({
    statusCode: 200,
    code: "INVALID_API_RESPONSE",
    message: "O servidor retornou uma resposta inválida.",
    details: parsed.error,
  });
}

export async function registerUser(
  input: RegisterInput,
  options: RequestOptions = {},
): Promise<ApiSuccess<RegisterResult>> {
  const validatedInput = registerInputSchema.parse(input);

  const response = await apiRequest<unknown>("/api/auth/register", {
    method: "POST",
    auth: false,
    timeoutMs: 30_000,
    signal: options.signal,
    body: JSON.stringify(validatedInput),
  });

  return {
    ...response,
    data: parseResponseData(registerResultSchema, response.data),
  };
}

export async function loginUser(
  input: LoginInput,
  options: RequestOptions = {},
): Promise<ApiSuccess<AuthSession>> {
  const validatedInput = loginInputSchema.parse(input);

  const response = await apiRequest<unknown>("/api/auth/login", {
    method: "POST",
    auth: false,
    signal: options.signal,
    body: JSON.stringify(validatedInput),
  });

  return {
    ...response,
    data: parseResponseData(authSessionSchema, response.data),
  };
}

export async function verifyEmail(
  input: VerifyEmailInput,
  options: RequestOptions = {},
): Promise<ApiSuccess<AuthSession>> {
  const validatedInput = verifyEmailInputSchema.parse(input);

  const response = await apiRequest<unknown>("/api/auth/verify-email", {
    method: "POST",
    auth: false,
    signal: options.signal,
    body: JSON.stringify(validatedInput),
  });

  return {
    ...response,
    data: parseResponseData(authSessionSchema, response.data),
  };
}

export async function resendVerificationEmail(
  input: ResendEmailInput,
  options: RequestOptions = {},
): Promise<ApiSuccess<ResendEmailResult>> {
  const validatedInput = resendEmailInputSchema.parse(input);

  const response = await apiRequest<unknown>("/api/auth/resend-verification", {
    method: "POST",
    auth: false,
    timeoutMs: 30_000,
    signal: options.signal,
    body: JSON.stringify(validatedInput),
  });

  return {
    ...response,
    data: parseResponseData(resendEmailResultSchema, response.data),
  };
}

export async function getMySession(
  options: RequestOptions = {},
): Promise<ApiSuccess<MeResult>> {
  const response = await apiRequest<unknown>("/api/auth/me", {
    method: "GET",
    signal: options.signal,
  });

  return {
    ...response,
    data: parseResponseData(meResultSchema, response.data),
  };
}

export async function logoutUser(): Promise<void> {
  await apiRequest<unknown>("/api/auth/logout", {
    method: "POST",
  });
}
