import { z } from "zod";

export const chatIdParamsSchema = z.object({
  chatId: z.coerce.number().int().positive("ID do chat inválido"),
});

export const userIdParamsSchema = z.object({
  userId: z.coerce.number().int().positive("ID do usuário inválido"),
});

export const messageIdParamsSchema = z.object({
  chatId: z.coerce.number().int().positive("ID do chat inválido"),
  messageId: z.coerce.number().int().positive("ID da mensagem inválido"),
});

export const listMyChatsQuerySchema = z.object({
  archived: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return false;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      return ["true", "1", "yes", "sim"].includes(value.toLowerCase());
    }

    return Boolean(value);
  }, z.boolean().default(false)),
});

export const updateChatPreferencesSchema = z
  .object({
    isPinned: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    isMuted: z.boolean().optional(),
    mutedUntil: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") return null;
      if (value instanceof Date) return value;
      if (typeof value === "string") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date;
      }

      return value;
    }, z.date().nullable().optional()),
  })
  .refine(
    (data) =>
      data.isPinned !== undefined ||
      data.isArchived !== undefined ||
      data.isMuted !== undefined ||
      data.mutedUntil !== undefined,
    {
      message: "Informe pelo menos uma preferência do chat.",
    },
  );

export const blockContactSchema = z.object({
  blocked: z.preprocess((value) => {
    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (["true", "1", "yes", "sim"].includes(normalized)) return true;
      if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;
    }

    return value;
  }, z.boolean("Informe se deseja bloquear ou desbloquear o contato.")),
});

export const toggleStarSchema = z.object({
  starred: z
    .preprocess((value) => {
      if (value === undefined || value === null || value === "") return undefined;
      if (typeof value === "boolean") return value;

      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();

        if (["true", "1", "yes", "sim"].includes(normalized)) return true;
        if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;
      }

      return value;
    }, z.boolean().optional())
    .optional(),
});

export const forwardMessageSchema = z.object({
  targetChatIds: z
    .array(z.coerce.number().int().positive("Chat de destino inválido"))
    .min(1, "Escolha pelo menos uma conversa para encaminhar")
    .max(20, "Você pode encaminhar para no máximo 20 conversas"),
});

export const listStarredMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
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
    .array(z.coerce.number().int().positive("Usuário inválido"))
    .max(100, "Grupo não pode começar com mais de 100 membros")
    .default([]),
});

export const updateGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome do grupo precisa ter pelo menos 2 letras")
    .max(120, "Nome do grupo muito grande")
    .optional(),

  description: z
    .string()
    .trim()
    .max(500, "Descrição muito grande")
    .optional()
    .nullable(),

  avatarUrl: z
    .string()
    .trim()
    .url("URL da imagem inválida")
    .max(500, "URL da imagem muito grande")
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

  clientId: z.string().trim().max(100, "clientId muito grande").optional(),

  replyToMessageId: z.coerce
    .number()
    .int()
    .positive("Mensagem respondida inválida")
    .optional(),
});

export const listChatMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(80).default(30),
  beforeId: z.coerce.number().int().positive().optional(),
});

export const searchChatMessagesQuerySchema = z.object({
  q: z.string().trim().max(100, "Pesquisa muito grande").optional().default(""),

  type: z
    .enum(["all", "text", "image", "video", "audio", "file", "media"])
    .default("all"),

  limit: z.coerce.number().int().min(1).max(80).default(40),
});

export const markChatAsReadSchema = z.object({
  messageId: z.coerce.number().int().positive("ID da mensagem inválido"),
});
export const editChatMessageSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Mensagem vazia")
    .max(1000, "Mensagem muito grande"),
});

export const toggleReactionSchema = z.object({
  emoji: z
    .string()
    .trim()
    .min(1, "Reação inválida")
    .max(20, "Reação muito grande"),
});

export const sendChatMediaSchema = z.object({
  replyToMessageId: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return value;
  }, z.coerce.number().int().positive("Mensagem respondida inválida").optional()),

  caption: z.preprocess((value) => {
    if (typeof value !== "string") return undefined;

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().max(1000, "Legenda muito grande").optional()),
});
