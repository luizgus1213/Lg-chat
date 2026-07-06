import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db/connection";

export interface UserAttributes {
  id: number;
  nome: string;
  email: string;
  senha: string;
  avatarUrl?: string | null;
  about?: string | null;
  isOnline?: boolean;
  lastSeenAt?: Date | null;
  emailVerificado?: boolean;
  emailVerificadoEm?: Date | null;
  emailCodigoHash?: string | null;
  emailCodigoExpiraEm?: Date | null;
  emailCodigoTentativas?: number;
  emailCodigoEnviadoEm?: Date | null;
}

type UserCreationAttributes = Optional<
  UserAttributes,
  | "id"
  | "avatarUrl"
  | "about"
  | "isOnline"
  | "lastSeenAt"
  | "emailVerificado"
  | "emailVerificadoEm"
  | "emailCodigoHash"
  | "emailCodigoExpiraEm"
  | "emailCodigoTentativas"
  | "emailCodigoEnviadoEm"
>;

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  declare id: number;
  declare nome: string;
  declare email: string;
  declare senha: string;
  declare avatarUrl: string | null;
  declare about: string | null;
  declare isOnline: boolean;
  declare lastSeenAt: Date | null;
  declare emailVerificado: boolean;
  declare emailVerificadoEm: Date | null;
  declare emailCodigoHash: string | null;
  declare emailCodigoExpiraEm: Date | null;
  declare emailCodigoTentativas: number;
  declare emailCodigoEnviadoEm: Date | null;
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
        type: DataTypes.STRING(120),
        allowNull: false,
      },

      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },

      senha: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      avatarUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "avatar_url",
      },

      about: {
        type: DataTypes.STRING(140),
        allowNull: true,
        defaultValue: "Disponível",
      },

      isOnline: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_online",
      },

      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_seen_at",
      },

      emailVerificado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "email_verificado",
      },

      emailVerificadoEm: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "email_verificado_em",
      },

      emailCodigoHash: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "email_codigo_hash",
      },

      emailCodigoExpiraEm: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "email_codigo_expira_em",
      },

      emailCodigoTentativas: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "email_codigo_tentativas",
      },

      emailCodigoEnviadoEm: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "email_codigo_enviado_em",
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
