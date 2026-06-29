import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import { chatMediaUpload } from "../middlewares/chatMediaUpload";
import {
  addMemberController,
  createGroupChatController,
  createPrivateChatController,
  deleteGroupController,
  getChatController,
  leaveGroupController,
  listChatMembersController,
  listChatMessagesController,
  searchChatMessagesController,
  listMyChatsController,
  markChatAsReadController,
  removeMemberController,
  sendChatMessageController,
  updateGroupController,
  updateGroupAvatarController,
  sendChatMediaController,
  editChatMessageController,
  deleteChatMessageController,
  toggleMessageReactionController,
  updateChatPreferencesController,
  blockContactController,
  clearChatForMeController,
  deleteChatForMeController,
  toggleMessageStarController,
  listStarredMessagesController,
  forwardMessageController,
} from "../controllers/ChatControllers";
import { groupAvatarUpload } from "../middlewares/groupAvatarUpload";
export const chatRoutes = Router();

chatRoutes.use(authMiddleware);

chatRoutes.get("/", asyncHandler(listMyChatsController));
chatRoutes.post("/private", asyncHandler(createPrivateChatController));
chatRoutes.post("/groups", asyncHandler(createGroupChatController));
chatRoutes.post("/:chatId/leave", asyncHandler(leaveGroupController));
chatRoutes.get("/:chatId", asyncHandler(getChatController));
chatRoutes.patch("/:chatId/preferences", asyncHandler(updateChatPreferencesController));
chatRoutes.patch("/:chatId/block", asyncHandler(blockContactController));
chatRoutes.post("/:chatId/clear", asyncHandler(clearChatForMeController));
chatRoutes.post("/:chatId/delete-for-me", asyncHandler(deleteChatForMeController));
chatRoutes.patch("/:chatId", asyncHandler(updateGroupController));
chatRoutes.delete("/:chatId", asyncHandler(deleteGroupController));
chatRoutes.get("/:chatId/members", asyncHandler(listChatMembersController));
chatRoutes.post("/:chatId/members", asyncHandler(addMemberController));
chatRoutes.delete(
  "/:chatId/members/:userId",
  asyncHandler(removeMemberController),
);

chatRoutes.post(
  "/:chatId/avatar",
  groupAvatarUpload,
  asyncHandler(updateGroupAvatarController),
);
chatRoutes.get("/:chatId/messages/search", asyncHandler(searchChatMessagesController));
chatRoutes.get("/:chatId/messages/starred", asyncHandler(listStarredMessagesController));
chatRoutes.get("/:chatId/messages", asyncHandler(listChatMessagesController));
chatRoutes.post("/:chatId/messages", asyncHandler(sendChatMessageController));
chatRoutes.patch(
  "/:chatId/messages/:messageId",
  asyncHandler(editChatMessageController),
);
chatRoutes.delete(
  "/:chatId/messages/:messageId",
  asyncHandler(deleteChatMessageController),
);
chatRoutes.post(
  "/:chatId/messages/:messageId/reactions",
  asyncHandler(toggleMessageReactionController),
);
chatRoutes.post(
  "/:chatId/messages/:messageId/star",
  asyncHandler(toggleMessageStarController),
);
chatRoutes.post(
  "/:chatId/messages/:messageId/forward",
  asyncHandler(forwardMessageController),
);
chatRoutes.post(
  "/:chatId/media",
  chatMediaUpload,
  asyncHandler(sendChatMediaController),
);
chatRoutes.post("/:chatId/read", asyncHandler(markChatAsReadController));
