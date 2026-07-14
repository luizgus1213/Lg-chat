import pino from "pino";
import { env } from "../config/env";

export function toSafeLogError(error: unknown) {
  if (!(error instanceof Error)) {
    return { name: typeof error };
  }

  const possibleCode = Reflect.get(error, "code");
  const errorCode =
    typeof possibleCode === "string" && possibleCode.length <= 80
      ? possibleCode
      : undefined;

  return {
    name: error.name || "Error",
    errorCode,
    stackFrames: error.stack?.split("\n").slice(1, 9),
  };
}

export const logger = pino(
  env.IS_DEVELOPMENT
    ? {
        level: "debug",
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {
        level: env.LOG_LEVEL,
      },
);
