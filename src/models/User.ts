import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db/connection";

export interface UserAttributes {
  id: number;
  nome: string;
  email: string;
  senha: string;
}

type UserCreationAttributes = Optional<UserAttributes, "id">;

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  declare id: number;
  declare nome: string;
  declare email: string;
  declare senha: string;
}

export function initUserModel() {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      nome: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      senha: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "users",
      timestamps: false,
    },
  );

  return User;
}
