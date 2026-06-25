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
