import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import {
  addMemberController,
  createGroupChatController,
  createPrivateChatController,
  getChatController,
  listChatMembersController,
  listChatMessagesController,
  listMyChatsController,
  markChatAsReadController,
  removeMemberController,
  sendChatMessageController,
  updateGroupController,
} from "../controllers/ChatControllers";

export const chatRoutes = Router();

chatRoutes.use(authMiddleware);

chatRoutes.get("/", asyncHandler(listMyChatsController));
chatRoutes.post("/private", asyncHandler(createPrivateChatController));
chatRoutes.post("/groups", asyncHandler(createGroupChatController));

chatRoutes.get("/:chatId", asyncHandler(getChatController));
chatRoutes.patch("/:chatId", asyncHandler(updateGroupController));

chatRoutes.get("/:chatId/members", asyncHandler(listChatMembersController));
chatRoutes.post("/:chatId/members", asyncHandler(addMemberController));
chatRoutes.delete(
  "/:chatId/members/:userId",
  asyncHandler(removeMemberController),
);

chatRoutes.get("/:chatId/messages", asyncHandler(listChatMessagesController));
chatRoutes.post("/:chatId/messages", asyncHandler(sendChatMessageController));

chatRoutes.post("/:chatId/read", asyncHandler(markChatAsReadController));
