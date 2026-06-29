import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db/connection";

export interface StatusViewAttributes {
  id: number;
  statusPostId: number;
  viewerId: number;
  viewedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type StatusViewCreationAttributes = Optional<
  StatusViewAttributes,
  "id" | "viewedAt" | "createdAt" | "updatedAt"
>;

export class StatusView
  extends Model<StatusViewAttributes, StatusViewCreationAttributes>
  implements StatusViewAttributes
{
  declare id: number;
  declare statusPostId: number;
  declare viewerId: number;
  declare viewedAt: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initStatusViewModel() {
  StatusView.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      statusPostId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "status_post_id",
      },

      viewerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "viewer_id",
      },

      viewedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "viewed_at",
      },
    },
    {
      sequelize,
      tableName: "status_views",
      underscored: true,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["status_post_id", "viewer_id"],
        },
        {
          fields: ["viewer_id"],
        },
      ],
    },
  );

  return StatusView;
}
