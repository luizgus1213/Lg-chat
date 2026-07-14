import { dispatchRecoverableError, dispatchSessionInvalid } from "./apiEvents";
import { SESSION_INVALID_ERROR_CODES } from "@shared/publicContracts";

const SESSION_INVALID_CODES = new Set<string>(SESSION_INVALID_ERROR_CODES);

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

export type ApiRequestOptions = RequestInit & {
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
  return isObject(payload) ? (payload as ApiErrorPayload) : null;
}

function getCookie(name: string): string | null {
  const prefix = `${name}=`;
  const part = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  if (!part) return null;

  try {
    return decodeURIComponent(part.slice(prefix.length));
  } catch {
    return null;
  }
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
    signal: externalSignal,
    ...requestOptions
  } = options;

  const controller = new AbortController();
  let timedOut = false;

  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, {
      once: true,
    });
  }

  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const headers = new Headers(customHeaders);

  headers.set("Accept", "application/json");

  const isFormData = requestOptions.body instanceof FormData;

  if (requestOptions.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const method = (requestOptions.method ?? "GET").toUpperCase();
  if (auth && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = getCookie(
      import.meta.env.VITE_CSRF_COOKIE_NAME || "lgchat_csrf",
    );
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  }

  try {
    const response = await fetch(path, {
      ...requestOptions,
      credentials: "include",
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
      if (
        auth &&
        error.statusCode === 401 &&
        SESSION_INVALID_CODES.has(error.code)
      ) {
        dispatchSessionInvalid();
      } else if (
        error.statusCode === 0 ||
        error.statusCode === 408 ||
        error.statusCode >= 500
      ) {
        dispatchRecoverableError({
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      if (timedOut) {
        throw new ApiError({
          statusCode: 408,
          code: "REQUEST_TIMEOUT",
          message: "O servidor demorou demais para responder.",
        });
      }

      throw new ApiError({
        statusCode: 0,
        code: "REQUEST_CANCELLED",
        message: "A requisição foi cancelada.",
      });
    }

    const apiError = new ApiError({
      statusCode: 0,
      code: "API_UNAVAILABLE",
      message: "Não foi possível conectar ao servidor. Verifique sua conexão.",
      details: error,
    });
    dispatchRecoverableError({
      code: apiError.code,
      message: apiError.message,
    });
    throw apiError;
  } finally {
    window.clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}
