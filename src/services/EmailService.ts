import { AppError } from "../errors/AppError";
import { env } from "../config/env";
import { logger, toSafeLogError } from "../utils/logger";

type SendVerificationEmailInput = {
  toEmail: string;
  toName: string;
  code: string;
  expiresMinutes: number;
};

const EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send";
const EMAIL_TIMEOUT_MS = 20_000;

function assertEmailJsConfigured() {
  const missing = [
    ["EMAILJS_SERVICE_ID", env.EMAILJS_SERVICE_ID],
    ["EMAILJS_TEMPLATE_ID", env.EMAILJS_TEMPLATE_ID],
    ["EMAILJS_PUBLIC_KEY", env.EMAILJS_PUBLIC_KEY],
    ["EMAILJS_PRIVATE_KEY", env.EMAILJS_PRIVATE_KEY],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    logger.error(
      {
        missing: missing.map(([name]) => name),
      },
      "EmailJS não configurado",
    );

    throw new AppError(
      500,
      "Envio de email não configurado no servidor.",
      "EMAIL_PROVIDER_NOT_CONFIGURED",
    );
  }
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendVerificationEmail(input: SendVerificationEmailInput) {
  assertEmailJsConfigured();

  const toEmail = input.toEmail.trim().toLowerCase();
  const toName = input.toName.trim() || toEmail;

  const payload = {
    service_id: env.EMAILJS_SERVICE_ID,
    template_id: env.EMAILJS_TEMPLATE_ID,
    user_id: env.EMAILJS_PUBLIC_KEY,
    accessToken: env.EMAILJS_PRIVATE_KEY,
    template_params: {
      to_email: toEmail,
      to_name: toName,
      code: input.code,
      verification_code: input.code,
      expires_in: `${input.expiresMinutes} minutos`,
      app_name: env.EMAIL_FROM_NAME || "LG Chat",
      reply_to: toEmail,
    },
  };

  try {
    const response = await fetchWithTimeout(EMAILJS_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/plain, application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.error(
        {
          status: response.status,
          statusText: response.statusText,
        },
        "EmailJS recusou o envio do email",
      );

      throw new AppError(
        502,
        "Não foi possível enviar o código por email. Verifique a configuração do EmailJS e tente novamente.",
        "EMAIL_SEND_FAILED",
      );
    }

    logger.info(
      {
        status: response.status,
      },
      "Código de verificação enviado pelo EmailJS",
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error(
      {
        error: toSafeLogError(error),
      },
      "Falha inesperada ao enviar email de verificação",
    );

    throw new AppError(
      502,
      "Não foi possível enviar o código por email. Tente novamente.",
      "EMAIL_SEND_FAILED",
    );
  }
}
