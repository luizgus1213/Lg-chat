import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db/connection";

export type ChatMemberRole = "owner" | "admin" | "member";

export interface ChatMemberAttributes {
  id: number;
  chatId: number;
  userId: number;
  role: ChatMemberRole;
  joinedAt: Date;
  leftAt?: Date | null;
  lastReadMessageId?: number | null;
  isPinned?: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
  pinnedAt?: Date | null;
  archivedAt?: Date | null;
  mutedUntil?: Date | null;
  chatClearedAt?: Date | null;
  chatDeletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ChatMemberCreationAttributes = Optional<
  ChatMemberAttributes,
  | "id"
  | "role"
  | "joinedAt"
  | "leftAt"
  | "lastReadMessageId"
  | "isPinned"
  | "isArchived"
  | "isMuted"
  | "pinnedAt"
  | "archivedAt"
  | "mutedUntil"
  | "chatClearedAt"
  | "chatDeletedAt"
  | "createdAt"
  | "updatedAt"
>;

export class ChatMember
  extends Model<ChatMemberAttributes, ChatMemberCreationAttributes>
  implements ChatMemberAttributes
{
  declare id: number;
  declare chatId: number;
  declare userId: number;
  declare role: ChatMemberRole;
  declare joinedAt: Date;
  declare leftAt: Date | null;
  declare lastReadMessageId: number | null;
  declare isPinned: boolean;
  declare isArchived: boolean;
  declare isMuted: boolean;
  declare pinnedAt: Date | null;
  declare archivedAt: Date | null;
  declare mutedUntil: Date | null;
  declare chatClearedAt: Date | null;
  declare chatDeletedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initChatMemberModel() {
  ChatMember.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      chatId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "chat_id",
      },

      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "user_id",
      },

      role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "member",
        validate: {
          isIn: [["owner", "admin", "member"]],
        },
      },

      joinedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "joined_at",
      },

      leftAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "left_at",
      },

      lastReadMessageId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "last_read_message_id",
      },

      isPinned: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_pinned",
      },

      isArchived: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_archived",
      },

      isMuted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_muted",
      },

      pinnedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "pinned_at",
      },

      archivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "archived_at",
      },

      mutedUntil: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "muted_until",
      },

      chatClearedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "chat_cleared_at",
      },

      chatDeletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "chat_deleted_at",
      },
    },
    {
      sequelize,
      tableName: "chat_members",
      underscored: true,
      timestamps: true,
    },
  );

  return ChatMember;
}
