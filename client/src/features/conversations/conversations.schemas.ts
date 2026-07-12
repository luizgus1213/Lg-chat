import { z } from "zod";

const nullableStringSchema = z.string().nullable().optional().default(null);

export const conversationUserSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string().min(1),
  email: z.string().email(),

  avatarUrl: nullableStringSchema,
  about: z.string().optional().default("Disponível"),
  isOnline: z.boolean().optional().default(false),
  lastSeenAt: nullableStringSchema,
});

export const messageSummarySchema = z.object({
  id: z.number().int().positive(),
  chatId: z.number().int().positive(),
  fromUserId: z.number().int().positive(),

  text: nullableStringSchema,
  type: z.string().min(1),

  mediaUrl: nullableStringSchema,
  mediaMimeType: nullableStringSchema,
  mediaOriginalName: nullableStringSchema,

  createdAt: z.string().min(1),
  updatedAt: z.string().min(1).optional(),

  editedAt: nullableStringSchema,
  deletedAt: nullableStringSchema,
});

export const chatBlockSchema = z.object({
  blockedByMe: z.boolean(),
  blockedMe: z.boolean(),
  isBlocked: z.boolean(),
});

export const conversationSchema = z.object({
  id: z.number().int().positive(),

  type: z.enum(["private", "group"]),

  name: nullableStringSchema,
  description: nullableStringSchema,
  avatarUrl: nullableStringSchema,

  createdById: z.number().int().positive().nullable().optional().default(null),

  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),

  myRole: z.string().nullable().optional().default(null),
  lastReadMessageId: z.number().int().nullable().optional().default(null),

  isPinned: z.boolean().optional().default(false),
  isArchived: z.boolean().optional().default(false),
  isMuted: z.boolean().optional().default(false),

  pinnedAt: nullableStringSchema,
  archivedAt: nullableStringSchema,
  mutedUntil: nullableStringSchema,
  chatClearedAt: nullableStringSchema,
  chatDeletedAt: nullableStringSchema,

  unreadCount: z.number().int().nonnegative().optional().default(0),

  block: chatBlockSchema.nullable().optional().default(null),
  lastMessage: messageSummarySchema.nullable().optional().default(null),
  privateUser: conversationUserSchema.nullable().optional().default(null),
});

export const conversationsListSchema = z.array(conversationSchema);

export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationUser = z.infer<typeof conversationUserSchema>;
export type MessageSummary = z.infer<typeof messageSummarySchema>;
