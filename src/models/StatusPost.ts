import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db/connection";

export type StatusPostType = "text" | "image" | "video";

export interface StatusPostAttributes {
  id: number;
  userId: number;
  type: StatusPostType;
  text: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  mediaOriginalName?: string | null;
  backgroundColor?: string | null;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type StatusPostCreationAttributes = Optional<
  StatusPostAttributes,
  | "id"
  | "text"
  | "mediaUrl"
  | "mediaMimeType"
  | "mediaSize"
  | "mediaOriginalName"
  | "backgroundColor"
  | "createdAt"
  | "updatedAt"
>;

export class StatusPost
  extends Model<StatusPostAttributes, StatusPostCreationAttributes>
  implements StatusPostAttributes
{
  declare id: number;
  declare userId: number;
  declare type: StatusPostType;
  declare text: string | null;
  declare mediaUrl: string | null;
  declare mediaMimeType: string | null;
  declare mediaSize: number | null;
  declare mediaOriginalName: string | null;
  declare backgroundColor: string | null;
  declare expiresAt: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initStatusPostModel() {
  StatusPost.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "user_id",
      },

      type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: [["text", "image", "video"]],
        },
      },

      text: {
        type: DataTypes.STRING(700),
        allowNull: true,
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

      backgroundColor: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: "background_color",
      },

      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "expires_at",
      },
    },
    {
      sequelize,
      tableName: "status_posts",
      underscored: true,
      timestamps: true,
      indexes: [
        {
          fields: ["user_id", "expires_at"],
        },
        {
          fields: ["expires_at"],
        },
      ],
    },
  );

  return StatusPost;
}
