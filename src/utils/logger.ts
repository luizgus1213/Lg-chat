import pino from "pino";
import { env } from "../config/env";

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
