import { initUserModel, User } from "./User";
import { initMessageModel, Message } from "./Message";
import { initChatModel, Chat } from "./Chat";
import { initChatMemberModel, ChatMember } from "./ChatMember";

export function initModels() {
  initUserModel();
  initChatModel();
  initChatMemberModel();
  initMessageModel();

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
}
