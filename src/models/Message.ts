import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db/connection";

export type MessageType = "text" | "system";

export interface MessageAttributes {
  id: number;
  chatId: number | null;
  senderId: number;
  receiverId: number | null;
  text: string;
  type: MessageType;
  editedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type MessageCreationAttributes = Optional<
  MessageAttributes,
  | "id"
  | "chatId"
  | "receiverId"
  | "type"
  | "editedAt"
  | "deletedAt"
  | "createdAt"
  | "updatedAt"
>;

export class Message
  extends Model<MessageAttributes, MessageCreationAttributes>
  implements MessageAttributes
{
  declare id: number;
  declare chatId: number | null;
  declare senderId: number;
  declare receiverId: number | null;
  declare text: string;
  declare type: MessageType;
  declare editedAt: Date | null;
  declare deletedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initMessageModel() {
  Message.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      chatId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "chat_id",
      },

      senderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "sender_id",
      },

      receiverId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "receiver_id",
      },

      text: {
        type: DataTypes.STRING(1000),
        allowNull: false,
      },

      type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "text",
        validate: {
          isIn: [["text", "system"]],
        },
      },

      editedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "edited_at",
      },

      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "deleted_at",
      },
    },
    {
      sequelize,
      tableName: "messages",
      underscored: true,
      timestamps: true,
    },
  );

  return Message;
}
