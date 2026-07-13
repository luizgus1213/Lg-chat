import { z } from "zod";

const textSchema = (maximumLength: number) => z.string().max(maximumLength);
const nullableTextSchema = (maximumLength: number) =>
  textSchema(maximumLength).nullable().optional().default(null);

const dateTimeSchema = z.string().datetime({ offset: true });
const nullableDateTimeSchema = dateTimeSchema
  .nullable()
  .optional()
  .default(null);

export const conversationUserSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string().trim().min(1).max(120),
  email: z.string().email().max(255),

  avatarUrl: nullableTextSchema(500),
  about: z.string().max(140).optional().default("Disponível"),
  isOnline: z.boolean().optional().default(false),
  lastSeenAt: nullableDateTimeSchema,
});

export const messageSummarySchema = z.object({
  id: z.number().int().positive(),
  chatId: z.number().int().positive(),
  fromUserId: z.number().int().positive(),

  text: nullableTextSchema(1_000),
  type: z.enum(["text", "system", "image", "video", "audio", "file"]),

  mediaUrl: nullableTextSchema(700),
  mediaMimeType: nullableTextSchema(120),
  mediaOriginalName: nullableTextSchema(255),

  createdAt: dateTimeSchema,
  updatedAt: nullableDateTimeSchema,

  editedAt: nullableDateTimeSchema,
  deletedAt: nullableDateTimeSchema,
});

export const chatBlockSchema = z.object({
  blockedByMe: z.boolean(),
  blockedMe: z.boolean(),
  isBlocked: z.boolean(),
});

export const conversationSchema = z.object({
  id: z.number().int().positive(),

  type: z.enum(["private", "group"]),

  name: nullableTextSchema(120),
  description: nullableTextSchema(500),
  avatarUrl: nullableTextSchema(500),

  createdById: z.number().int().positive().nullable().optional().default(null),

  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,

  myRole: z
    .enum(["owner", "admin", "member"])
    .nullable()
    .optional()
    .default(null),
  lastReadMessageId: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .default(null),

  isPinned: z.boolean().optional().default(false),
  isArchived: z.boolean().optional().default(false),
  isMuted: z.boolean().optional().default(false),

  pinnedAt: nullableDateTimeSchema,
  archivedAt: nullableDateTimeSchema,
  mutedUntil: nullableDateTimeSchema,
  chatClearedAt: nullableDateTimeSchema,
  chatDeletedAt: nullableDateTimeSchema,

  unreadCount: z.number().int().nonnegative().optional().default(0),

  block: chatBlockSchema.nullable().optional().default(null),
  lastMessage: messageSummarySchema.nullable().optional().default(null),
  privateUser: conversationUserSchema.nullable().optional().default(null),
});

export const conversationsListSchema = z.array(conversationSchema);

export const chatUpdatedPayloadSchema = z
  .object({
    chatId: z.number().int().positive(),
    updatedAt: dateTimeSchema.optional(),
    name: textSchema(120).nullable().optional(),
    description: textSchema(500).nullable().optional(),
    avatarUrl: textSchema(500).nullable().optional(),
  })
  .passthrough();

export const userStatusPayloadSchema = z.object({
  userId: z.number().int().positive(),
  isOnline: z.boolean(),
  lastSeenAt: dateTimeSchema.nullable().optional(),
});

export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationUser = z.infer<typeof conversationUserSchema>;
export type MessageSummary = z.infer<typeof messageSummarySchema>;
