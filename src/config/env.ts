import "dotenv/config";
import { z } from "zod";

const rawEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),

  DB_NAME: z.string().min(1, "DB_NAME é obrigatório"),
  DB_USER: z.string().min(1, "DB_USER é obrigatório"),
  DB_PASS: z.string().min(1, "DB_PASS é obrigatório"),
  DB_HOST: z.string().min(1, "DB_HOST é obrigatório"),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  UPLOAD_ROOT: z.string().trim().min(1).default("public/uploads"),
  DB_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET precisa ter pelo menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  SESSION_COOKIE_NAME: z.string().min(1).default("lgchat_session"),
  CSRF_COOKIE_NAME: z.string().min(1).default("lgchat_csrf"),
  SESSION_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  SESSION_COOKIE_MAX_AGE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60 * 1000),

  STUN_URLS: z.string().default("stun:stun.l.google.com:19302"),
  TURN_URLS: z.string().optional(),
  TURN_SHARED_SECRET: z.string().min(16).optional(),
  TURN_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),

  CLIENT_ORIGIN: z.string().default("http://localhost:5000"),
  CLIENT_ORIGINS: z.string().optional(),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),

  JSON_BODY_LIMIT: z.string().default("1mb"),

  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  EMAILJS_SERVICE_ID: z.string().optional(),
  EMAILJS_TEMPLATE_ID: z.string().optional(),
  EMAILJS_PUBLIC_KEY: z.string().optional(),
  EMAILJS_PRIVATE_KEY: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default("LG Chat"),

  EMAIL_CODE_EXPIRES_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(60)
    .default(15),
  EMAIL_CODE_RESEND_COOLDOWN_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(600)
    .default(60),
  EMAIL_CODE_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
});

const result = rawEnvSchema.safeParse(process.env);

if (!result.success) {
  console.error("Erro nas variáveis de ambiente:");
  console.error(result.error.format());
  process.exit(1);
}

const raw = result.data;

const origins = (raw.CLIENT_ORIGINS || raw.CLIENT_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  ...raw,
  CLIENT_ORIGINS_ARRAY: origins,
  IS_PRODUCTION: raw.NODE_ENV === "production",
  IS_DEVELOPMENT: raw.NODE_ENV === "development",
};
