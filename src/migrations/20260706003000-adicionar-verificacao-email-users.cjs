"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "email_verificado", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("users", "email_verificado_em", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("users", "email_codigo_hash", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn("users", "email_codigo_expira_em", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("users", "email_codigo_tentativas", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("users", "email_codigo_enviado_em", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Mantém usuários antigos sem travar o login.
    // Novos usuários criados depois desta migration entram como não verificados.
    await queryInterface.sequelize.query(`
      UPDATE "users"
      SET
        "email_verificado" = true,
        "email_verificado_em" = NOW()
      WHERE "email_verificado" = false;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("users", "email_codigo_enviado_em");
    await queryInterface.removeColumn("users", "email_codigo_tentativas");
    await queryInterface.removeColumn("users", "email_codigo_expira_em");
    await queryInterface.removeColumn("users", "email_codigo_hash");
    await queryInterface.removeColumn("users", "email_verificado_em");
    await queryInterface.removeColumn("users", "email_verificado");
  },
};
