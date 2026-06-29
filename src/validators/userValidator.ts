import { z } from "zod";

export const updateMyProfileSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(2, "Nome precisa ter pelo menos 2 letras")
      .max(120, "Nome muito grande")
      .optional(),

    about: z
      .string()
      .trim()
      .max(140, "Recado muito grande")
      .optional()
      .nullable(),
  })
  .refine((data) => data.nome !== undefined || data.about !== undefined, {
    message: "Envie pelo menos um campo para atualizar.",
  });
