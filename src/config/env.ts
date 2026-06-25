import "dotenv/config";
import { z } from "zod";

const rawEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),

  DB_NAME: z.string().min(1, "DB_NAME é obrigatório"),
  DB_USER: z.string().min(1, "DB_USER é obrigatório"),
  DB_PASS: z.string().min(1, "DB_PASS é obrigatório"),
  DB_HOST: z.string().min(1, "DB_HOST é obrigatório"),
  DB_PORT: z.coerce.number().int().positive().default(5432),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET precisa ter pelo menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("7d"),

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
