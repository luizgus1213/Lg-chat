import { getAuthToken } from "../features/auth/auth.storage";

export type ApiSuccess<T> = {
  success: true;
  message?: string;
  data: T;
};

type ApiErrorPayload = {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    statusCode?: number;
    details?: unknown;
  };
};

export type ApiRequestOptions = Omit<RequestInit, "signal"> & {
  auth?: boolean;
  timeoutMs?: number;
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(options: {
    message: string;
    statusCode: number;
    code: string;
    details?: unknown;
  }) {
    super(options.message);

    this.name = "ApiError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getApiErrorPayload(payload: unknown): ApiErrorPayload | null {
  if (!isObject(payload)) return null;

  const error = payload.error;

  if (!isObject(error)) {
    return payload as ApiErrorPayload;
  }

  return payload as ApiErrorPayload;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiSuccess<T>> {
  const {
    auth = true,
    timeoutMs = 15_000,
    headers: customHeaders,
    ...requestOptions
  } = options;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const headers = new Headers(customHeaders);
  const token = getAuthToken();

  headers.set("Accept", "application/json");

  const isFormData = requestOptions.body instanceof FormData;

  if (requestOptions.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (auth && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(path, {
      ...requestOptions,
      headers,
      signal: controller.signal,
    });

    const payload = await parseResponseBody(response);

    if (!response.ok) {
      const errorPayload = getApiErrorPayload(payload);
      const apiError = errorPayload?.error;

      throw new ApiError({
        statusCode: response.status,
        code: apiError?.code || `HTTP_${response.status}`,
        message:
          apiError?.message ||
          `A requisição falhou com o status ${response.status}.`,
        details: apiError?.details,
      });
    }

    if (!isObject(payload) || payload.success !== true) {
      throw new ApiError({
        statusCode: response.status,
        code: "INVALID_API_RESPONSE",
        message: "O servidor retornou uma resposta inválida.",
        details: payload,
      });
    }

    return payload as ApiSuccess<T>;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError({
        statusCode: 408,
        code: "REQUEST_TIMEOUT",
        message: "O servidor demorou demais para responder.",
      });
    }

    throw new ApiError({
      statusCode: 0,
      code: "API_UNAVAILABLE",
      message: "Não foi possível conectar ao servidor. Verifique sua conexão.",
      details: error,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}
