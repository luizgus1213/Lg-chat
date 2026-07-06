import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  registerUserController,
  loginUserController,
  meController,
  verifyEmailController,
  resendEmailCodeController,
} from "../controllers/AuthControllers";
import { asyncHandler } from "../utils/asyncHandler";

export const authRoutes = Router();

const authRateLimit = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "AUTH_RATE_LIMIT",
      message: "Muitas tentativas. Tente novamente em alguns segundos.",
      statusCode: 429,
    },
  },
});

const emailCodeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "EMAIL_CODE_RATE_LIMIT",
      message: "Muitas tentativas. Aguarde um pouco e tente novamente.",
      statusCode: 429,
    },
  },
});

authRoutes.post(
  "/register",
  authRateLimit,
  asyncHandler(registerUserController),
);
authRoutes.post("/login", authRateLimit, asyncHandler(loginUserController));
authRoutes.post(
  "/verify-email",
  emailCodeRateLimit,
  asyncHandler(verifyEmailController),
);
authRoutes.post(
  "/resend-verification",
  emailCodeRateLimit,
  asyncHandler(resendEmailCodeController),
);
authRoutes.get("/me", authMiddleware, asyncHandler(meController));
