import { ApiError } from "../../api/apiClient";
import { getAuthErrorMessage } from "../auth/auth.errors";

const messages: Readonly<Record<string, string>> = {
  GROUP_PERMISSION_DENIED: "Somente donos e administradores podem fazer isso.",
  USER_ALREADY_IN_GROUP: "Essa pessoa já participa do grupo.",
  MEMBER_NOT_FOUND: "Essa pessoa não participa mais do grupo.",
  GROUP_NEEDS_OWNER: "O grupo precisa manter pelo menos um dono.",
  CHAT_ACCESS_DENIED: "Você não participa mais deste grupo.",
  GROUP_NOT_FOUND: "Este grupo foi excluído ou não está mais disponível.",
  INVALID_IMAGE_FORMAT: "Use uma imagem JPG, PNG ou WEBP.",
  IMAGE_REQUIRED: "Escolha uma imagem para o grupo.",
};

export function getGroupErrorMessage(error: unknown) {
  if (error instanceof ApiError && messages[error.code])
    return messages[error.code];
  return getAuthErrorMessage(error);
}
