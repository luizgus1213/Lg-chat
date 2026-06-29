import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db/connection";

export type MessageType = "text" | "system" | "image" | "video" | "audio" | "file";

export interface MessageAttributes {
  id: number;
  chatId: number | null;
  senderId: number;
  receiverId: number | null;
  text: string | null;
  type: MessageType;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  mediaOriginalName?: string | null;
  replyToMessageId?: number | null;
  forwardedFromMessageId?: number | null;
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
  | "text"
  | "type"
  | "mediaUrl"
  | "mediaMimeType"
  | "mediaSize"
  | "mediaOriginalName"
  | "replyToMessageId"
  | "forwardedFromMessageId"
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
  declare text: string | null;
  declare type: MessageType;
  declare mediaUrl: string | null;
  declare mediaMimeType: string | null;
  declare mediaSize: number | null;
  declare mediaOriginalName: string | null;
  declare replyToMessageId: number | null;
  declare forwardedFromMessageId: number | null;
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
        allowNull: true,
      },

      type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "text",
        validate: {
          isIn: [["text", "system", "image", "video", "audio", "file"]],
        },
      },

      mediaUrl: {
        type: DataTypes.STRING(700),
        allowNull: true,
        field: "media_url",
      },

      mediaMimeType: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: "media_mime_type",
      },

      mediaSize: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "media_size",
      },

      mediaOriginalName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "media_original_name",
      },

      replyToMessageId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "reply_to_message_id",
      },

      forwardedFromMessageId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "forwarded_from_message_id",
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
