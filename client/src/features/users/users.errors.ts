import { ZodError } from "zod";

import { ApiError } from "../../api/apiClient";
import { getAuthErrorMessage } from "../auth/auth.errors";

const USER_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  USER_NOT_FOUND: "Este usuário não está mais disponível.",
  INVALID_PRIVATE_CHAT: "Não é possível iniciar esta conversa.",
  CONTACT_BLOCKED_BY_ME:
    "Você bloqueou este contato. Desbloqueie-o antes de iniciar a conversa.",
  CONTACT_BLOCKED_ME: "Não é possível iniciar uma conversa com este contato.",
};

export function getUsersErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return "O servidor enviou dados inesperados. Tente novamente.";
  }

  if (error instanceof ApiError) {
    const knownMessage = USER_ERROR_MESSAGES[error.code];
    if (knownMessage) return knownMessage;
  }

  return getAuthErrorMessage(error);
}
