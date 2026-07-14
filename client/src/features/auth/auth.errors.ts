import { ZodError } from "zod";
import { ApiError } from "../../api/apiClient";

const API_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  API_UNAVAILABLE:
    "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
  REQUEST_TIMEOUT: "O servidor demorou demais para responder. Tente novamente.",
  INVALID_API_RESPONSE:
    "O servidor enviou uma resposta inesperada. Tente novamente.",
  AUTH_RATE_LIMIT: "Muitas tentativas. Aguarde um pouco e tente novamente.",
  EMAIL_CODE_RATE_LIMIT:
    "Muitas tentativas com o código. Aguarde um pouco e tente novamente.",
  EMAIL_CODE_COOLDOWN:
    "Aguarde alguns instantes antes de solicitar outro código.",
  INVALID_LOGIN: "E-mail ou senha incorretos.",
  EMAIL_NOT_VERIFIED: "Confirme seu e-mail antes de entrar.",
  EMAIL_EXISTS: "Este e-mail já está cadastrado.",
  INVALID_EMAIL_CODE:
    "O código informado é inválido. Confira e tente novamente.",
  EMAIL_CODE_MISSING: "Solicite um novo código para verificar seu e-mail.",
  EMAIL_CODE_EXPIRED: "O código expirou. Solicite um novo código.",
  EMAIL_CODE_TOO_MANY_ATTEMPTS:
    "O limite de tentativas foi atingido. Solicite um novo código.",
  EMAIL_ALREADY_VERIFIED: "Este e-mail já foi verificado. Você já pode entrar.",
  AUTH_REQUIRED: "Sua sessão expirou. Entre novamente.",
  INVALID_TOKEN: "Sua sessão expirou. Entre novamente.",
  USER_NOT_FOUND: "Sua sessão não é mais válida. Entre novamente.",
};

export const AUTH_STORAGE_ERROR_MESSAGE =
  "Não foi possível salvar sua sessão neste navegador. Verifique se o armazenamento está liberado e tente novamente.";

export function isRequestCancellation(error: unknown): boolean {
  return error instanceof ApiError && error.code === "REQUEST_CANCELLED";
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const knownMessage = API_ERROR_MESSAGES[error.code];
    if (knownMessage) return knownMessage;

    if (error.statusCode === 429) {
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    }

    if (error.statusCode >= 500) {
      return "O servidor está indisponível no momento. Tente novamente mais tarde.";
    }

    if (error.statusCode === 401) {
      return "Não foi possível confirmar os dados informados.";
    }

    if (error.statusCode === 403) {
      return "Você não tem permissão para concluir esta ação.";
    }

    if (error.statusCode === 404) {
      return "Não foi possível encontrar o item solicitado.";
    }

    if (error.statusCode >= 400) {
      return "Não foi possível concluir a solicitação. Confira os dados e tente novamente.";
    }
  }

  if (error instanceof ZodError) {
    return error.issues[0]?.message || "Verifique os dados informados.";
  }

  return "Ocorreu um erro inesperado. Tente novamente.";
}
