import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { UniqueConstraintError } from "sequelize";
import { AppError } from "../errors/AppError";
import { User } from "../models/User";
import { env } from "../config/env";
import { gerarToken } from "../utils/jwt";
import { sendVerificationEmail } from "./EmailService";
import type { z } from "zod";
import type {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendEmailCodeSchema,
} from "../validators/AuthValidator";

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
type ResendEmailCodeInput = z.infer<typeof resendEmailCodeSchema>;

function publicAuthUser(user: User) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    about: user.about ?? "Disponível",
    isOnline: Boolean(user.isOnline),
    lastSeenAt: user.lastSeenAt ?? null,
    emailVerificado: Boolean(user.emailVerificado),
  };
}

function buildAuthResult(user: User) {
  const token = gerarToken({
    id: user.id,
    nome: user.nome,
    email: user.email,
  });

  return {
    token,
    user: publicAuthUser(user),
  };
}

function generateEmailCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function getEmailCodeExpiration() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + env.EMAIL_CODE_EXPIRES_MINUTES);
  return date;
}

function assertCanResend(user: User) {
  if (!user.emailCodigoEnviadoEm) return;

  const elapsedMs = Date.now() - new Date(user.emailCodigoEnviadoEm).getTime();
  const cooldownMs = env.EMAIL_CODE_RESEND_COOLDOWN_SECONDS * 1000;

  if (elapsedMs < cooldownMs) {
    const seconds = Math.ceil((cooldownMs - elapsedMs) / 1000);

    throw new AppError(
      429,
      `Aguarde ${seconds} segundos para reenviar o código.`,
      "EMAIL_CODE_COOLDOWN",
    );
  }
}

async function createAndSendEmailCode(user: User) {
  const code = generateEmailCode();
  const codeHash = await bcrypt.hash(code, env.BCRYPT_ROUNDS);

  user.emailCodigoHash = codeHash;
  user.emailCodigoExpiraEm = getEmailCodeExpiration();
  user.emailCodigoTentativas = 0;
  user.emailCodigoEnviadoEm = new Date();

  await user.save();

  await sendVerificationEmail({
    toEmail: user.email,
    toName: user.nome,
    code,
    expiresMinutes: env.EMAIL_CODE_EXPIRES_MINUTES,
  });
}

export async function registerUser(data: RegisterInput) {
  const emailJaExiste = await User.findOne({
    where: {
      email: data.email,
    },
  });

  if (emailJaExiste) {
    throw new AppError(409, "Esse email já está cadastrado.", "EMAIL_EXISTS");
  }

  const senhaCriptografada = await bcrypt.hash(data.senha, env.BCRYPT_ROUNDS);

  try {
    const user = await User.create({
      nome: data.nome,
      email: data.email,
      senha: senhaCriptografada,
      about: "Disponível",
      isOnline: false,
      lastSeenAt: null,
      avatarUrl: null,
      emailVerificado: false,
      emailVerificadoEm: null,
      emailCodigoHash: null,
      emailCodigoExpiraEm: null,
      emailCodigoTentativas: 0,
      emailCodigoEnviadoEm: null,
    });

    await createAndSendEmailCode(user);

    return {
      emailVerificationRequired: true,
      user: publicAuthUser(user),
    };
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new AppError(409, "Esse email já está cadastrado.", "EMAIL_EXISTS");
    }

    throw error;
  }
}

export async function loginUser(data: LoginInput) {
  const user = await User.findOne({
    where: {
      email: data.email,
    },
  });

  if (!user) {
    throw new AppError(401, "Email ou senha incorretos.", "INVALID_LOGIN");
  }

  const senhaCorreta = await bcrypt.compare(data.senha, user.senha);

  if (!senhaCorreta) {
    throw new AppError(401, "Email ou senha incorretos.", "INVALID_LOGIN");
  }

  if (!user.emailVerificado) {
    throw new AppError(
      403,
      "Verifique seu email antes de entrar.",
      "EMAIL_NOT_VERIFIED",
    );
  }

  return buildAuthResult(user);
}

export async function verifyEmail(data: VerifyEmailInput) {
  const user = await User.findOne({
    where: {
      email: data.email,
    },
  });

  if (!user) {
    throw new AppError(400, "Código inválido ou expirado.", "INVALID_EMAIL_CODE");
  }

  if (user.emailVerificado) {
    return buildAuthResult(user);
  }

  if (!user.emailCodigoHash || !user.emailCodigoExpiraEm) {
    throw new AppError(
      400,
      "Código inválido ou expirado. Solicite um novo código.",
      "EMAIL_CODE_MISSING",
    );
  }

  if (new Date(user.emailCodigoExpiraEm).getTime() < Date.now()) {
    throw new AppError(
      400,
      "Código expirado. Solicite um novo código.",
      "EMAIL_CODE_EXPIRED",
    );
  }

  if (Number(user.emailCodigoTentativas || 0) >= env.EMAIL_CODE_MAX_ATTEMPTS) {
    throw new AppError(
      429,
      "Muitas tentativas incorretas. Solicite um novo código.",
      "EMAIL_CODE_TOO_MANY_ATTEMPTS",
    );
  }

  const codeMatches = await bcrypt.compare(data.codigo, user.emailCodigoHash);

  if (!codeMatches) {
    user.emailCodigoTentativas = Number(user.emailCodigoTentativas || 0) + 1;
    await user.save();

    throw new AppError(
      400,
      "Código inválido. Verifique e tente novamente.",
      "INVALID_EMAIL_CODE",
    );
  }

  user.emailVerificado = true;
  user.emailVerificadoEm = new Date();
  user.emailCodigoHash = null;
  user.emailCodigoExpiraEm = null;
  user.emailCodigoTentativas = 0;
  user.emailCodigoEnviadoEm = null;

  await user.save();

  return buildAuthResult(user);
}

export async function resendVerificationEmail(data: ResendEmailCodeInput) {
  const user = await User.findOne({
    where: {
      email: data.email,
    },
  });

  // Resposta genérica para não facilitar enumeração de emails.
  if (!user) {
    return {
      emailVerificationRequired: true,
    };
  }

  if (user.emailVerificado) {
    throw new AppError(
      409,
      "Esse email já está verificado.",
      "EMAIL_ALREADY_VERIFIED",
    );
  }

  assertCanResend(user);

  await createAndSendEmailCode(user);

  return {
    emailVerificationRequired: true,
  };
}
