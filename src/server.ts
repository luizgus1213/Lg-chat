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

function isAllowedOrigin(origin?: string) {
  if (!origin) {
    return true;
  }

  return env.CLIENT_ORIGINS_ARRAY.includes(origin);
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origem não permitida pelo CORS."));
    },
    methods: ["GET", "POST"],
    credentials: true,
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
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origem não permitida pelo CORS."));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: env.JSON_BODY_LIMIT }));

app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: "RATE_LIMIT",
        message: "Muitas requisições. Tente novamente em alguns segundos.",
        statusCode: 429,
      },
    },
  }),
);

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

      if (/\.(png|jpg|jpeg|webp|gif|svg|ico|woff|woff2)$/i.test(normalizedPath)) {
        res.setHeader("Cache-Control", "public, max-age=604800");
      }
    },
  }),
);

app.use("/api/diagnostics", diagnosticsRoutes);

app.get("/health", (_req, res) => {
  return res.json({
    success: true,
    message: "Servidor online",
  });
});

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
      logger.info(`Servidor rodando em http://localhost:${env.PORT}`);
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

bootstrap();
