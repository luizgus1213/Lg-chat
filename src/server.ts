import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import { Server } from "socket.io";

import { env } from "./config/env";
import { logger } from "./utils/logger";
import { testarConexaoBanco } from "./db/connection";
import { initModels } from "./models";

import { errorHandler } from "./middlewares/errorHandler";
import { AppError } from "./errors/AppError";

import { authRoutes } from "./routes/auth.routes";
import { usersRoutes } from "./routes/users.routes";
import { messagesRoutes } from "./routes/messages.routes";
import { chatRoutes } from "./routes/chat.routes";
import { statusRoutes } from "./routes/status.routes";
import { diagnosticsRoutes } from "./routes/diagnostics.routes";

import { setupSocket } from "./sockets";
import { startStatusCleanupJob } from "./services/StatusCleanupService";
import { startRuntimeDiagnostics } from "./services/RuntimeDiagnosticsService";

const app = express();
const server = http.createServer(app);

/*
  Origens permitidas no desenvolvimento e produção.

  CLIENT_ORIGINS_ARRAY pode possuir outras origens configuradas no env.
  O Set evita duplicações.
*/
const allowedOrigins = new Set(
  [
    ...(env.CLIENT_ORIGINS_ARRAY ?? []),
    env.CLIENT_ORIGIN,

    "http://localhost:5000",
    "http://localhost:5173",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:5173",

    ...(env.NODE_ENV === "development" ? ["http://192.168.1.111:5173"] : []),
  ].filter((origin): origin is string => {
    return typeof origin === "string" && origin.trim().length > 0;
  }),
);

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) {
    // Postman, servidor interno, health checks e requisições sem Origin.
    return true;
  }

  return allowedOrigins.has(origin);
}

const io = new Server(server, {
  cors: {
    origin: [...allowedOrigins],
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

app.use(
  compression({
    threshold: 1024,

    filter: (req, res) => {
      if (req.headers["x-no-compression"]) {
        return false;
      }

      return compression.filter(req, res);
    },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      logger.warn(
        {
          origin,
          allowedOrigins: [...allowedOrigins],
        },
        "Origem bloqueada pelo CORS",
      );

      return callback(
        new AppError(
          403,
          "Esta origem não possui permissão para acessar o servidor.",
          "CORS_ORIGIN_DENIED",
        ),
      );
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],

    exposedHeaders: [
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
    ],

    optionsSuccessStatus: 204,
  }),
);

app.use(express.json({ limit: env.JSON_BODY_LIMIT }));

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - start;

    const payload = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      ms,
    };

    if (ms >= 1200) {
      logger.warn(payload, "HTTP request lenta");
      return;
    }

    logger.info(payload, "HTTP request");
  });

  next();
});

/*
  Arquivos públicos ficam antes do rate limit.

  Assim CSS, JS, HTML, imagens e partials não recebem 429.
*/

app.get("/favicon.ico", (_req, res) => {
  return res.status(204).end();
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  return res.status(204).end();
});

app.use(
  "/uploads",
  express.static(path.resolve("public", "uploads"), {
    etag: true,
    maxAge: "30d",
    immutable: true,
    fallthrough: true,
    dotfiles: "deny",
    index: false,

    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    },
  }),
);

app.use(
  express.static(path.resolve("public"), {
    dotfiles: "deny",
    index: "index.html",
    etag: true,
    maxAge: "5m",

    setHeaders: (res, filePath) => {
      const normalizedPath = filePath.replace(/\\/g, "/");

      if (
        normalizedPath.endsWith("/index.html") ||
        normalizedPath.endsWith("/sw.js") ||
        normalizedPath.endsWith("/manifest.webmanifest")
      ) {
        res.setHeader("Cache-Control", "no-store");
        return;
      }

      if (/\.(js|css)$/i.test(normalizedPath)) {
        res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");

        return;
      }

      if (
        /\.(png|jpg|jpeg|webp|gif|svg|ico|woff|woff2)$/i.test(normalizedPath)
      ) {
        res.setHeader("Cache-Control", "public, max-age=604800");
      }
    },
  }),
);

/*
  Diagnóstico fora do rate limit principal.

  Se ocorrer erro no frontend, o diagnóstico não deve ser bloqueado.
*/
app.use("/api/diagnostics", diagnosticsRoutes);

app.get("/health", (_req, res) => {
  return res.json({
    success: true,
    message: "Servidor online",
  });
});

/*
  Rate limit apenas nas rotas da API.
*/
const apiRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,

  skip: (req) => {
    return req.method === "OPTIONS";
  },

  message: {
    success: false,
    error: {
      code: "RATE_LIMIT",
      message: "Muitas requisições. Tente novamente em alguns segundos.",
      statusCode: 429,
    },
  },
});

app.use("/api", apiRateLimit);

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/status", statusRoutes);

app.use((req, _res, next) => {
  return next(
    new AppError(
      404,
      `Rota ${req.originalUrl} não encontrada.`,
      "ROUTE_NOT_FOUND",
    ),
  );
});

app.use(errorHandler);

async function bootstrap() {
  try {
    initModels();

    await testarConexaoBanco();

    setupSocket(io);
    startStatusCleanupJob();
    startRuntimeDiagnostics();

    server.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          allowedOrigins: [...allowedOrigins],
        },
        `Servidor rodando em http://localhost:${env.PORT}`,
      );
    });
  } catch (error) {
    logger.fatal(
      {
        err: error,
      },
      "Erro fatal ao iniciar servidor",
    );

    process.exit(1);
  }
}

process.on("unhandledRejection", (error) => {
  logger.fatal(
    {
      err: error,
    },
    "Unhandled Rejection",
  );

  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.fatal(
    {
      err: error,
    },
    "Uncaught Exception",
  );

  process.exit(1);
});

void bootstrap();
