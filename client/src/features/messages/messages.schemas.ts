import { z } from "zod";

const nullableStringSchema = z.string().nullable().optional().default(null);

const nullableNumberSchema = z.number().nullable().optional().default(null);

export const reactionSchema = z.object({
  emoji: z.string().min(1),
  count: z.number().int().nonnegative(),
  reactedByMe: z.boolean(),
});

export const replyPreviewSchema = z.object({
  id: z.number().int().positive(),
  chatId: z.number().int().positive(),
  fromUserId: z.number().int().positive(),

  text: nullableStringSchema,

  type: z.enum(["text", "system", "image", "video", "audio", "file"]),

  mediaOriginalName: nullableStringSchema,
  deletedAt: nullableStringSchema,
});

export const chatMessageSchema = z.object({
  id: z.number().int().positive(),
  chatId: z.number().int().positive(),
  fromUserId: z.number().int().positive(),

  text: nullableStringSchema,

  type: z.enum(["text", "system", "image", "video", "audio", "file"]),

  mediaUrl: nullableStringSchema,
  mediaMimeType: nullableStringSchema,
  mediaSize: nullableNumberSchema,
  mediaOriginalName: nullableStringSchema,

  replyToMessageId: nullableNumberSchema,
  forwardedFromMessageId: nullableNumberSchema,

  isForwarded: z.boolean().optional().default(false),

  editedAt: nullableStringSchema,
  deletedAt: nullableStringSchema,

  createdAt: z.string().min(1),
  updatedAt: nullableStringSchema,

  clientId: nullableStringSchema,

  replyTo: replyPreviewSchema.nullable().optional().default(null),

  reactions: z.array(reactionSchema).optional().default([]),

  isStarred: z.boolean().optional().default(false),
});

export const chatMessagesSchema = z.array(chatMessageSchema);

export const markReadResultSchema = z.object({
  chatId: z.number().int().positive(),
  lastReadMessageId: z.number().int().positive(),
});

export type ServerChatMessage = z.infer<typeof chatMessageSchema>;

export type ChatMessage = ServerChatMessage & {
  clientStatus?: "sending" | "sent" | "error";
  localError?: string | null;
};

export type MarkReadResult = z.infer<typeof markReadResultSchema>;
