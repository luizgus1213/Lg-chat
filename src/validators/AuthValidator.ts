import { z } from "zod";

const nomeSchema = z
  .string()
  .trim()
  .min(2, "Nome precisa ter pelo menos 2 letras")
  .max(80, "Nome muito grande");

const emailSchema = z
  .string()
  .trim()
  .email("Email inválido")
  .max(150, "Email muito grande")
  .transform((email) => email.toLowerCase());

const senhaSchema = z
  .string()
  .min(8, "Senha precisa ter pelo menos 8 caracteres")
  .max(72, "Senha muito grande")
  .refine((senha) => /[A-Za-z]/.test(senha), {
    message: "Senha precisa ter pelo menos uma letra",
  })
  .refine((senha) => /\d/.test(senha), {
    message: "Senha precisa ter pelo menos um número",
  });

export const registerSchema = z.object({
  nome: nomeSchema,
  email: emailSchema,
  senha: senhaSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, "Senha é obrigatória").max(72),
});
