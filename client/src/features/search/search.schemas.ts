import { z } from "zod";

import { chatMessageSchema } from "../messages/messages.schemas";

export const messageSearchTypeSchema = z.enum([
  "all",
  "text",
  "image",
  "video",
  "audio",
  "file",
  "media",
]);

export const messageSearchResultSchema = z.object({
  query: z.string(),
  type: messageSearchTypeSchema,
  total: z.number().int().nonnegative(),
  results: z.array(chatMessageSchema),
});

export type MessageSearchType = z.infer<typeof messageSearchTypeSchema>;
export type MessageSearchResult = z.infer<typeof messageSearchResultSchema>;
