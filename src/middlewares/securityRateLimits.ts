import rateLimit from "express-rate-limit";

function makeSecurityRateLimit(params: {
  windowMs: number;
  limit: number;
  code: string;
  message: string;
}) {
  return rateLimit({
    windowMs: params.windowMs,
    limit: params.limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: params.code,
        message: params.message,
        statusCode: 429,
      },
    },
  });
}

export const chatWriteRateLimit = makeSecurityRateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  code: "CHAT_WRITE_RATE_LIMIT",
  message: "Você está enviando mensagens muito rápido. Aguarde um pouco.",
});

export const uploadRateLimit = makeSecurityRateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  code: "UPLOAD_RATE_LIMIT",
  message: "Muitos uploads em pouco tempo. Aguarde antes de enviar outro arquivo.",
});

export const statusRateLimit = makeSecurityRateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  code: "STATUS_RATE_LIMIT",
  message: "Muitas ações de status em pouco tempo. Aguarde alguns segundos.",
});

export const statusCreateRateLimit = makeSecurityRateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  code: "STATUS_CREATE_RATE_LIMIT",
  message: "Você está publicando status muito rápido. Aguarde um pouco.",
});

export const profileUploadRateLimit = makeSecurityRateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  code: "PROFILE_UPLOAD_RATE_LIMIT",
  message: "Muitas alterações de foto em pouco tempo. Aguarde antes de tentar novamente.",
});
