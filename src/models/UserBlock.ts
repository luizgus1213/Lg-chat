import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db/connection";

export interface UserBlockAttributes {
  id: number;
  blockerId: number;
  blockedId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserBlockCreationAttributes = Optional<
  UserBlockAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export class UserBlock
  extends Model<UserBlockAttributes, UserBlockCreationAttributes>
  implements UserBlockAttributes
{
  declare id: number;
  declare blockerId: number;
  declare blockedId: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initUserBlockModel() {
  UserBlock.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      blockerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "blocker_id",
      },

      blockedId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "blocked_id",
      },
    },
    {
      sequelize,
      tableName: "user_blocks",
      underscored: true,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["blocker_id", "blocked_id"],
        },
      ],
      validate: {
        cannotBlockYourself() {
          if (this.blockerId === this.blockedId) {
            throw new Error("Usuário não pode bloquear a si mesmo.");
          }
        },
      },
    },
  );

  return UserBlock;
}
