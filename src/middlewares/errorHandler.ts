import type { ErrorRequestHandler } from "express";
import { logger } from "../utils/logger";
import { toClientError } from "../errors/AppError";
import { env } from "../config/env";

const SENSITIVE_KEYS = [
  "senha",
  "password",
  "token",
  "authorization",
  "jwt",
  "secret",
  "DB_PASS",
  "JWT_SECRET",
];

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();

    if (
      SENSITIVE_KEYS.some((sensitive) =>
        lowerKey.includes(sensitive.toLowerCase()),
      )
    ) {
      result[key] = "[REDACTED]";
      continue;
    }

    result[key] = sanitize(val);
  }

  return result;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const clientError = toClientError(err);

  logger.error(
    {
      err,
      request: {
        method: req.method,
        path: req.originalUrl,
        body: sanitize(req.body),
        query: sanitize(req.query),
        params: sanitize(req.params),
        ip: req.ip,
      },
      clientError,
    },
    "Erro capturado pela API",
  );

  return res.status(clientError.statusCode).json({
    success: false,
    error: env.IS_DEVELOPMENT
      ? clientError
      : {
          code: clientError.code,
          message: clientError.message,
          statusCode: clientError.statusCode,
        },
  });
};
