import crypto from "node:crypto";
import type { Request, Response } from "express";

import { env } from "../config/env";

type CookieSameSite = "lax" | "strict" | "none";

function cookieSameSite(): CookieSameSite {
  return env.SESSION_COOKIE_SAME_SITE;
}

function commonCookieOptions() {
  return {
    secure: env.IS_PRODUCTION || cookieSameSite() === "none",
    sameSite: cookieSameSite(),
    path: "/",
    maxAge: env.SESSION_COOKIE_MAX_AGE_MS,
  } as const;
}

export function getCookieValue(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) continue;

    const key = part.slice(0, separatorIndex).trim();
    if (key !== name) continue;

    const value = part.slice(separatorIndex + 1).trim();

    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  return null;
}

export function createCsrfToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function setSessionCookies(res: Response, token: string): void {
  const options = commonCookieOptions();

  res.cookie(env.SESSION_COOKIE_NAME, token, {
    ...options,
    httpOnly: true,
  });

  res.cookie(env.CSRF_COOKIE_NAME, createCsrfToken(), {
    ...options,
    httpOnly: false,
  });
}

export function ensureCsrfCookie(req: Request, res: Response): void {
  if (getCookieValue(req.headers.cookie, env.CSRF_COOKIE_NAME)) return;

  res.cookie(env.CSRF_COOKIE_NAME, createCsrfToken(), {
    ...commonCookieOptions(),
    httpOnly: false,
  });
}

export function clearSessionCookies(res: Response): void {
  const options = {
    secure: env.IS_PRODUCTION || cookieSameSite() === "none",
    sameSite: cookieSameSite(),
    path: "/",
  } as const;

  res.clearCookie(env.SESSION_COOKIE_NAME, {
    ...options,
    httpOnly: true,
  });
  res.clearCookie(env.CSRF_COOKIE_NAME, {
    ...options,
    httpOnly: false,
  });
}
