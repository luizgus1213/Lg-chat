import type { Request, Response } from "express";
import {
  getMessagesParamsSchema,
  getMessagesQuerySchema,
} from "../validators/messageValidator";
import { getConversationMessages } from "../services/MessageService";
import { ok } from "../utils/httpResponse";

export async function getMessages(req: Request, res: Response) {
  const { userId } = getMessagesParamsSchema.parse(req.params);
  const query = getMessagesQuerySchema.parse(req.query);

  const messages = await getConversationMessages({
    currentUserId: req.user!.id,
    otherUserId: userId,
    limit: query.limit,
    beforeId: query.beforeId,
  });

  return ok(res, messages);
}
