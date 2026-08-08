import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { AppError } from "../errors/AppError";
import { getCookieValue } from "../utils/sessionCookies";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function tokensMatch(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  return (
    firstBuffer.length === secondBuffer.length &&
    crypto.timingSafeEqual(firstBuffer, secondBuffer)
  );
}

export function csrfProtection(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const authorization = req.headers.authorization;

  if (authorization?.startsWith("Bearer ")) {
    return next();
  }

  const cookieToken = getCookieValue(req.headers.cookie, env.CSRF_COOKIE_NAME);
  const headerToken = req.get("x-csrf-token")?.trim() ?? "";

  if (!cookieToken || !headerToken || !tokensMatch(cookieToken, headerToken)) {
    return next(
      new AppError(
        403,
        "Não foi possível validar esta ação. Atualize a página e tente novamente.",
        "CSRF_VALIDATION_FAILED",
      ),
    );
  }

  return next();
}
