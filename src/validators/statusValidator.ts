import { z } from "zod";

export const statusIdParamsSchema = z.object({
  statusId: z.coerce.number().int().positive("ID do status inválido"),
});

export const createTextStatusSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Digite algo para publicar no status.")
    .max(700, "Status de texto pode ter no máximo 700 caracteres."),

  backgroundColor: z
    .string()
    .trim()
    .max(40, "Cor de fundo inválida.")
    .regex(/^#[0-9a-fA-F]{6}$|^linear-gradient\(.+\)$/i, "Cor de fundo inválida.")
    .optional()
    .nullable(),
});

export const createMediaStatusSchema = z.object({
  text: z
    .string()
    .trim()
    .max(700, "Legenda pode ter no máximo 700 caracteres.")
    .optional()
    .nullable(),
});
