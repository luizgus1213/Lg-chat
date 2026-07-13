import { z } from "zod";

export const authUserSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(150),

  avatarUrl: z.string().trim().min(1).nullable().optional().default(null),
  about: z.string().max(140).optional().default("Disponível"),
  isOnline: z.boolean().optional().default(false),
  lastSeenAt: z.string().datetime().nullable().optional().default(null),
  // `/api/auth/me` não inclui este campo; login e verificação incluem.
  emailVerificado: z.boolean().optional(),
});

export const registerInputSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Nome precisa ter pelo menos 2 letras.")
    .max(80, "Nome muito grande."),

  email: z
    .string()
    .trim()
    .email("Digite um email válido.")
    .max(150, "Email muito grande.")
    .transform((email) => email.toLowerCase()),

  senha: z
    .string()
    .min(8, "A senha precisa ter pelo menos 8 caracteres.")
    .max(72, "Senha muito grande.")
    .refine((senha) => /[A-Za-z]/.test(senha), {
      message: "A senha precisa ter pelo menos uma letra.",
    })
    .refine((senha) => /\d/.test(senha), {
      message: "A senha precisa ter pelo menos um número.",
    }),
});

export const loginInputSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Digite um email válido.")
    .max(150, "Email muito grande.")
    .transform((email) => email.toLowerCase()),

  senha: z
    .string()
    .min(1, "Digite sua senha.")
    .max(72, "Senha muito grande."),
});

export const verifyEmailInputSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Digite um email válido.")
    .max(150, "Email muito grande.")
    .transform((email) => email.toLowerCase()),

  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "O código precisa ter exatamente 6 números."),
});

export const resendEmailInputSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Digite um email válido.")
    .max(150, "Email muito grande.")
    .transform((email) => email.toLowerCase()),
});

export const authSessionSchema = z.object({
  token: z.string().trim().min(1).max(8_192),
  user: authUserSchema,
});

export const registerResultSchema = z.object({
  requiresEmailVerification: z.literal(true),
  email: z.string().email(),
  user: authUserSchema,
});

export const resendEmailResultSchema = z.object({
  emailVerificationRequired: z.literal(true),
  email: z.string().email().optional(),
});

export const meResultSchema = z.object({
  user: authUserSchema,
});

export type AuthUser = z.infer<typeof authUserSchema>;

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;
export type ResendEmailInput = z.infer<typeof resendEmailInputSchema>;

export type AuthSession = z.infer<typeof authSessionSchema>;
export type RegisterResult = z.infer<typeof registerResultSchema>;
export type ResendEmailResult = z.infer<typeof resendEmailResultSchema>;
export type MeResult = z.infer<typeof meResultSchema>;
