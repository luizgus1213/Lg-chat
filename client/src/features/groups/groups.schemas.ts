import { z } from "zod";

import { conversationSchema } from "../conversations/conversations.schemas";
import { chatUserSchema } from "../users/users.schemas";

const groupUserSchema = chatUserSchema.extend({
  about: z.preprocess((value) => value ?? "Disponível", z.string().max(140)),
});

export const groupChatSchema = conversationSchema
  .extend({
    type: z.literal("group"),
    canManageGroup: z.boolean().optional().default(false),
    canDeleteGroup: z.boolean().optional().default(false),
  })
  .passthrough();

export const groupMemberSchema = z.object({
  id: z.number().int().positive(),
  chatId: z.number().int().positive(),
  userId: z.number().int().positive(),
  role: z.enum(["owner", "admin", "member"]),
  joinedAt: z.string().datetime({ offset: true }).optional(),
  lastReadMessageId: z.number().int().positive().nullable().optional(),
  user: groupUserSchema,
});

export const groupMembersSchema = z.array(groupMemberSchema);

export const addedGroupMemberSchema = z.object({
  id: z.number().int().positive(),
  chatId: z.number().int().positive(),
  userId: z.number().int().positive(),
  role: z.literal("member"),
});

export const removedGroupMemberSchema = z.object({ removed: z.literal(true) });
export const leaveGroupResultSchema = z.object({
  left: z.literal(true),
  deletedGroupBecauseEmpty: z.boolean(),
  chatId: z.number().int().positive(),
});
export const deleteGroupResultSchema = z.object({
  deleted: z.literal(true),
  chatId: z.number().int().positive(),
});

export type GroupChat = z.infer<typeof groupChatSchema>;
export type GroupMember = z.infer<typeof groupMemberSchema>;
