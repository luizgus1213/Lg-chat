import { Sequelize } from "sequelize";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: "postgres",

  dialectOptions: env.DB_SSL
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},

  pool: {
    max: 10,
    min: 0,
    acquire: 30_000,
    idle: 10_000,
  },

  logging: env.IS_DEVELOPMENT ? (msg) => logger.debug(msg) : false,
});

export async function testarConexaoBanco() {
  await sequelize.authenticate();
  logger.info("Banco de dados conectado com sucesso.");
}

export default sequelize;
