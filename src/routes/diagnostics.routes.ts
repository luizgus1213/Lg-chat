import { Router } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger";

type ClientDiagnosticBody = {
  level?: unknown;
  type?: unknown;
  message?: unknown;
  stack?: unknown;
  source?: unknown;
  path?: unknown;
  userAgent?: unknown;
  connection?: unknown;
  metadata?: unknown;
};

const diagnosticsRoutes = Router();

const diagnosticsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "DIAGNOSTICS_RATE_LIMIT",
      message: "Muitos relatórios de diagnóstico enviados.",
      statusCode: 429,
    },
  },
});

function toSafeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function toSafeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const safe: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === "string") {
      safe[key] = rawValue.slice(0, 500);
      continue;
    }

    if (
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null
    ) {
      safe[key] = rawValue;
    }
  }

  return safe;
}

diagnosticsRoutes.post("/client-error", diagnosticsRateLimit, (req, res) => {
  const body = (req.body || {}) as ClientDiagnosticBody;

  const level = toSafeString(body.level, 20) || "error";
  const type = toSafeString(body.type, 80) || "client_error";
  const message = toSafeString(body.message, 1200) || "Erro no cliente.";
  const stack = toSafeString(body.stack, 3500);
  const source = toSafeString(body.source, 500);
  const path = toSafeString(body.path, 500);
  const userAgent = toSafeString(body.userAgent, 500);
  const connection = toSafeString(body.connection, 80);
  const metadata = toSafeObject(body.metadata);

  const payload = {
    level,
    type,
    message,
    stack,
    source,
    path,
    userAgent,
    connection,
    metadata,
    ip: req.ip,
  };

  if (level === "warn") {
    logger.warn(payload, "Diagnóstico do navegador");
  } else {
    logger.error(payload, "Erro reportado pelo navegador");
  }

  return res.status(204).send();
});

export { diagnosticsRoutes };
