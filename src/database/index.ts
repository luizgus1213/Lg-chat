import { Sequelize } from "sequelize";

const connection = new Sequelize({
  database: "lgchat",
  username: "postgres",
  password: "Dq1fjNLkWhPrUoXB8JmIRcUxyttUftMTUw6ClGgdkFRmha35Y6WXe4czFinGvHs5",
  host: "185.194.217.84",
  port: 2345,
  dialect: "postgres",
});

export default connection;
