import { z } from "zod";

export const getMessagesParamsSchema = z.object({
  userId: z.coerce.number().int().positive("ID do usuário inválido"),
});

export const getMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  beforeId: z.coerce.number().int().positive().optional(),
});

export const createPrivateMessageSchema = z.object({
  toUserId: z.coerce.number().int().positive("Destinatário inválido"),
  text: z
    .string()
    .trim()
    .min(1, "Mensagem vazia")
    .max(1000, "Mensagem muito grande"),
  clientId: z.string().trim().max(100).optional(),
});
