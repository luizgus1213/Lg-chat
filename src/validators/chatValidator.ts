import { z } from "zod";

export const chatIdParamsSchema = z.object({
  chatId: z.coerce.number().int().positive("ID do chat inválido"),
});

export const userIdParamsSchema = z.object({
  userId: z.coerce.number().int().positive("ID do usuário inválido"),
});

export const createPrivateChatSchema = z.object({
  userId: z.coerce.number().int().positive("Usuário inválido"),
});

export const createGroupChatSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome do grupo precisa ter pelo menos 2 letras")
    .max(120, "Nome do grupo muito grande"),

  description: z
    .string()
    .trim()
    .max(500, "Descrição muito grande")
    .optional()
    .nullable(),

  memberIds: z
    .array(z.coerce.number().int().positive())
    .max(100, "Grupo não pode começar com mais de 100 membros")
    .default([]),
});

export const updateGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome do grupo precisa ter pelo menos 2 letras")
    .max(120)
    .optional(),

  description: z.string().trim().max(500).optional().nullable(),

  avatarUrl: z
    .string()
    .trim()
    .url("URL da imagem inválida")
    .max(500)
    .optional()
    .nullable(),
});

export const addMemberSchema = z.object({
  userId: z.coerce.number().int().positive("Usuário inválido"),
});

export const sendChatMessageSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Mensagem vazia")
    .max(1000, "Mensagem muito grande"),

  clientId: z.string().trim().max(100).optional(),
});

export const listChatMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  beforeId: z.coerce.number().int().positive().optional(),
});
