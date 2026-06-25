import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db/connection";

export type ChatType = "private" | "group";

export interface ChatAttributes {
  id: number;
  type: ChatType;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  createdById: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ChatCreationAttributes = Optional<
  ChatAttributes,
  | "id"
  | "name"
  | "description"
  | "avatarUrl"
  | "createdById"
  | "createdAt"
  | "updatedAt"
>;

export class Chat
  extends Model<ChatAttributes, ChatCreationAttributes>
  implements ChatAttributes
{
  declare id: number;
  declare type: ChatType;
  declare name: string | null;
  declare description: string | null;
  declare avatarUrl: string | null;
  declare createdById: number | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initChatModel() {
  Chat.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "private",
        validate: {
          isIn: [["private", "group"]],
        },
      },

      name: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },

      description: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },

      avatarUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "avatar_url",
      },

      createdById: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "created_by_id",
      },
    },
    {
      sequelize,
      tableName: "chats",
      underscored: true,
      timestamps: true,
    },
  );

  return Chat;
}
