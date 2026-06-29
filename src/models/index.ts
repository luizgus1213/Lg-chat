import { initUserModel, User } from "./User";
import { initMessageModel, Message } from "./Message";
import { initChatModel, Chat } from "./Chat";
import { initChatMemberModel, ChatMember } from "./ChatMember";
import { initUserBlockModel, UserBlock } from "./UserBlock";
import { initStatusPostModel, StatusPost } from "./StatusPost";
import { initStatusViewModel, StatusView } from "./StatusView";
export function initModels() {
  initUserModel();
  initChatModel();
  initChatMemberModel();
  initMessageModel();
  initUserBlockModel();
  initStatusPostModel();
  initStatusViewModel();

  User.hasMany(Message, {
    foreignKey: "senderId",
    as: "sentMessages",
  });

  Message.belongsTo(User, {
    foreignKey: "senderId",
    as: "sender",
  });

  Chat.hasMany(Message, {
    foreignKey: "chatId",
    as: "messages",
  });

  Message.belongsTo(Chat, {
    foreignKey: "chatId",
    as: "chat",
  });

  Chat.hasMany(ChatMember, {
    foreignKey: "chatId",
    as: "members",
  });

  ChatMember.belongsTo(Chat, {
    foreignKey: "chatId",
    as: "chat",
  });

  User.hasMany(ChatMember, {
    foreignKey: "userId",
    as: "chatMemberships",
  });

  ChatMember.belongsTo(User, {
    foreignKey: "userId",
    as: "user",
  });

  User.hasMany(Chat, {
    foreignKey: "createdById",
    as: "createdChats",
  });

  Chat.belongsTo(User, {
    foreignKey: "createdById",
    as: "creator",
  });

  User.hasMany(UserBlock, {
    foreignKey: "blockerId",
    as: "blockedUsers",
  });

  UserBlock.belongsTo(User, {
    foreignKey: "blockerId",
    as: "blocker",
  });

  User.hasMany(UserBlock, {
    foreignKey: "blockedId",
    as: "blockedByUsers",
  });

  UserBlock.belongsTo(User, {
    foreignKey: "blockedId",
    as: "blocked",
  });
  User.hasMany(StatusPost, {
    foreignKey: "userId",
    as: "statusPosts",
  });

  StatusPost.belongsTo(User, {
    foreignKey: "userId",
    as: "author",
  });

  StatusPost.hasMany(StatusView, {
    foreignKey: "statusPostId",
    as: "views",
  });

  StatusView.belongsTo(StatusPost, {
    foreignKey: "statusPostId",
    as: "statusPost",
  });

  User.hasMany(StatusView, {
    foreignKey: "viewerId",
    as: "statusViews",
  });

  StatusView.belongsTo(User, {
    foreignKey: "viewerId",
    as: "viewer",
  });

}
