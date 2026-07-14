import { ApiError, apiRequest } from "../../api/apiClient";
import { iceConfigurationSchema } from "./calls.schemas";

export async function loadIceServerConfiguration(signal?: AbortSignal) {
  const response = await apiRequest<unknown>("/api/calls/ice-servers", {
    method: "GET",
    signal,
  });
  const parsed = iceConfigurationSchema.safeParse(response.data);

  if (!parsed.success) {
    throw new ApiError({
      statusCode: 200,
      code: "INVALID_ICE_CONFIGURATION",
      message: "O servidor retornou uma configuração de chamada inválida.",
      details: parsed.error,
    });
  }

  return parsed.data;
}
