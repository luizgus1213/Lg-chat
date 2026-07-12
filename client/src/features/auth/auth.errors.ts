import { ZodError } from "zod";
import { ApiError } from "../../api/apiClient";

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof ZodError) {
    return error.issues[0]?.message || "Verifique os dados informados.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Ocorreu um erro inesperado. Tente novamente.";
}
