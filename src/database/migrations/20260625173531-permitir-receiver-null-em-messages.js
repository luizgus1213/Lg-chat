"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "messages"
      ALTER COLUMN "receiver_id" DROP NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "messages"
      ALTER COLUMN "receiver_id" SET NOT NULL;
    `);
  },
};
