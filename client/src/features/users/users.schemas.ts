import { z } from "zod";

export const chatUserSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(150),

  avatarUrl: z.string().trim().min(1).nullable().optional().default(null),

  about: z.string().max(140).optional().default("Disponível"),

  isOnline: z.boolean().optional().default(false),

  lastSeenAt: z.string().datetime().nullable().optional().default(null),
});

export const chatUsersSchema = z.array(chatUserSchema);

export const userDirectorySchema = z.object({
  items: chatUsersSchema,
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export type ChatUser = z.infer<typeof chatUserSchema>;
