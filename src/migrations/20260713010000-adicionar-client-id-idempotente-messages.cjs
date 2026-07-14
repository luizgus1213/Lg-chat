"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("messages", "client_id", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX messages_sender_client_id_unique
      ON messages (sender_id, client_id)
      WHERE client_id IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DROP INDEX IF EXISTS messages_sender_client_id_unique",
    );
    await queryInterface.removeColumn("messages", "client_id");
  },
};
