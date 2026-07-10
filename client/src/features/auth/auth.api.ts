import { apiRequest, type ApiSuccess } from "../../api/apiClient";

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

export async function registerUser(
  input: RegisterInput,
): Promise<ApiSuccess<RegisterResult>> {
  const validatedInput = registerInputSchema.parse(input);

  const response = await apiRequest<unknown>("/api/auth/register", {
    method: "POST",
    auth: false,
    timeoutMs: 30_000,
    body: JSON.stringify(validatedInput),
  });

  return {
    ...response,
    data: registerResultSchema.parse(response.data),
  };
}

export async function loginUser(
  input: LoginInput,
): Promise<ApiSuccess<AuthSession>> {
  const validatedInput = loginInputSchema.parse(input);

  const response = await apiRequest<unknown>("/api/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify(validatedInput),
  });

  return {
    ...response,
    data: authSessionSchema.parse(response.data),
  };
}

export async function verifyEmail(
  input: VerifyEmailInput,
): Promise<ApiSuccess<AuthSession>> {
  const validatedInput = verifyEmailInputSchema.parse(input);

  const response = await apiRequest<unknown>("/api/auth/verify-email", {
    method: "POST",
    auth: false,
    body: JSON.stringify(validatedInput),
  });

  return {
    ...response,
    data: authSessionSchema.parse(response.data),
  };
}

export async function resendVerificationEmail(
  input: ResendEmailInput,
): Promise<ApiSuccess<ResendEmailResult>> {
  const validatedInput = resendEmailInputSchema.parse(input);

  const response = await apiRequest<unknown>("/api/auth/resend-verification", {
    method: "POST",
    auth: false,
    timeoutMs: 30_000,
    body: JSON.stringify(validatedInput),
  });

  return {
    ...response,
    data: resendEmailResultSchema.parse(response.data),
  };
}

export async function getMySession(): Promise<ApiSuccess<MeResult>> {
  const response = await apiRequest<unknown>("/api/auth/me", {
    method: "GET",
  });

  return {
    ...response,
    data: meResultSchema.parse(response.data),
  };
}
