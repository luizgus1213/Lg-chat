import crypto from "node:crypto";

import { env } from "../config/env";

function parseUrls(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createIceServerConfiguration(userId: number) {
  const iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }> = [];

  const stunUrls = parseUrls(env.STUN_URLS);
  if (stunUrls.length > 0) {
    iceServers.push({ urls: stunUrls.length === 1 ? stunUrls[0] : stunUrls });
  }

  const turnUrls = parseUrls(env.TURN_URLS);

  if (turnUrls.length > 0 && env.TURN_SHARED_SECRET) {
    const expiresAt = Math.floor(Date.now() / 1000) + env.TURN_TTL_SECONDS;
    const username = `${expiresAt}:${userId}`;
    const credential = crypto
      .createHmac("sha1", env.TURN_SHARED_SECRET)
      .update(username)
      .digest("base64");

    iceServers.push({
      urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
      username,
      credential,
    });
  }

  return {
    iceServers,
    expiresAt:
      turnUrls.length > 0 && env.TURN_SHARED_SECRET
        ? new Date(Date.now() + env.TURN_TTL_SECONDS * 1000).toISOString()
        : null,
    hasTurn: turnUrls.length > 0 && Boolean(env.TURN_SHARED_SECRET),
  };
}
