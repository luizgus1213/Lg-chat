import emailjs from "@emailjs/nodejs";
import { AppError } from "../errors/AppError";
import { env } from "../config/env";
import { logger } from "../utils/logger";

type SendVerificationEmailInput = {
  toEmail: string;
  toName: string;
  code: string;
  expiresMinutes: number;
};

type EmailJsError = {
  status?: number;
  text?: string;
};

function isEmailJsError(error: unknown): error is EmailJsError {
  return typeof error === "object" && error !== null;
}

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

export async function sendVerificationEmail(input: SendVerificationEmailInput) {
  assertEmailJsConfigured();

  try {
    await emailjs.send(
      env.EMAILJS_SERVICE_ID as string,
      env.EMAILJS_TEMPLATE_ID as string,
      {
        to_email: input.toEmail,
        to_name: input.toName,
        code: input.code,
        expires_in: `${input.expiresMinutes} minutos`,
        app_name: env.EMAIL_FROM_NAME,
      },
      {
        publicKey: env.EMAILJS_PUBLIC_KEY as string,
        privateKey: env.EMAILJS_PRIVATE_KEY as string,
        limitRate: {
          id: `email-verification:${input.toEmail}`,
          throttle: env.EMAIL_CODE_RESEND_COOLDOWN_SECONDS * 1000,
        },
      },
    );

    logger.info(
      {
        email: input.toEmail,
      },
      "Código de verificação enviado",
    );
  } catch (error: unknown) {
    if (isEmailJsError(error)) {
      logger.error(
        {
          status: error.status,
          text: error.text,
          email: input.toEmail,
        },
        "EmailJS recusou o envio do email",
      );
    } else {
      logger.error(
        {
          err: error,
          email: input.toEmail,
        },
        "Falha inesperada ao enviar email de verificação",
      );
    }

    throw new AppError(
      502,
      "Não foi possível enviar o código por email. Tente novamente.",
      "EMAIL_SEND_FAILED",
    );
  }
}
