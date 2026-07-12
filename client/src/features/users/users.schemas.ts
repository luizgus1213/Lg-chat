import { z } from "zod";

export const chatUserSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string().trim().min(1),
  email: z.string().email(),

  avatarUrl: z.string().nullable().optional().default(null),

  about: z.string().optional().default("Disponível"),

  isOnline: z.boolean().optional().default(false),

  lastSeenAt: z.string().nullable().optional().default(null),
});

export const chatUsersSchema = z.array(chatUserSchema);

export type ChatUser = z.infer<typeof chatUserSchema>;
